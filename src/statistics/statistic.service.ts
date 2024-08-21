import { BalanceOfLpRepository } from "./../repositories/balanceOfLp.repository";
import { ConfigService } from "@nestjs/config";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, LessThanOrEqual, Repository } from "typeorm";
import { hexTransformer } from "src/transformers/hex.transformer";
import { Cron } from "@nestjs/schedule";
import { BalanceOfLp } from "src/entities/balanceOfLp.entity";
import { Project } from "src/entities/project.entity";
import { ProtocolDau } from "src/entities/dau.entity";
import { ExplorerService } from "src/common/service/explorer.service";
import { BlockTokenPrice } from "src/entities/blockTokenPrice.entity";
import { Token } from "src/type/token";
import BigNumber from "bignumber.js";
import { ethers } from "ethers";

@Injectable()
export class StatisticService {
  private readonly logger = new Logger(StatisticService.name);
  private novaBlocksGraph: string;
  private readonly pointsApi: string;

  constructor(
    @InjectRepository(BalanceOfLp)
    private readonly balanceOfLpRepository: Repository<BalanceOfLp>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProtocolDau)
    private readonly protocolDauRepository: Repository<ProtocolDau>,
    @InjectRepository(BlockTokenPrice)
    private readonly blockTokenPriceRepository: Repository<BlockTokenPrice>,
    private readonly configService: ConfigService,
    private readonly explorerService: ExplorerService,
  ) {
    this.novaBlocksGraph = configService.getOrThrow(
      "NOVA_POINT_BLOCK_GRAPH_API",
    );

    this.pointsApi = configService.getOrThrow("POINTS_API_URL");
  }

  // Historical data, run only once
  @Cron("0 15 0 * * *")
  public async statisticHistoryProtocolDau() {
    const result: { min: string; max: string }[] =
      await this.balanceOfLpRepository.query(
        `select date(min("createdAt")) as min, date(max("createdAt")) as max from "blockAddressPointOfLp"`,
      );

    const minDate = new Date(result[0].min);
    let maxDate = new Date(result[0].max);
    // Not counted today
    if (
      maxDate.toISOString().split("T")[0] ===
      new Date().toISOString().split("T")[0]
    ) {
      maxDate.setDate(maxDate.getDate() - 1);
    }

    for (let start = minDate; start <= maxDate; ) {
      this.logger.log(`start statistics date: ${start.toISOString()}`);
      await this.statisticProtocolDauByDay(start);
      await this.statisticCumulativeDauByDay(start);
      start.setDate(start.getDate() + 1);
    }

    this.logger.log("finished history statistics protocol dau");
  }

  @Cron("0 30 0 * * *")
  public async statisticProtocolDau() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await this.statisticProtocolDauByDay(yesterday);
    this.logger.log("finished statistics protocol dau");
  }

  public async statisticCumulativeDauByDay(day: Date) {
    // This parameter is not important
    const begin =
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        0,
        0,
        0,
      ).getTime() / 1000;
    const end =
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        23,
        59,
        59,
      ).getTime() / 1000;

    const [_minBlock, maxBlock] = await this.getBlockRangeByTime(begin, end);

    if (!maxBlock) {
      this.logger.error("Statistical getBlockRangeByTime failure");
      return;
    }

    const allProject = await this.projectRepository.find();
    allProject;

    const groupByName: { [name: string]: Buffer[] } = allProject.reduce(
      (group, project) => {
        const { name } = project;
        group[name] = group[name] ?? [];
        group[name].push(hexTransformer.to(project.pairAddress));
        return group;
      },
      {},
    );

    for (const name in groupByName) {
      const pairAddressList = groupByName[name];
      const count: { count: number }[] = await this.balanceOfLpRepository.query(
        `select count(distinct address) from "blockAddressPointOfLp" where "pairAddress"=any($1) and "blockNumber" <= $2 and type in ('txNum', 'txVol')`,
        [pairAddressList, maxBlock],
      );

      await this.protocolDauRepository
        .createQueryBuilder()
        .insert()
        .values({
          name,
          amount: count[0].count,
          date: day.toISOString().split("T")[0],
          type: 2,
        })
        .orIgnore()
        .execute();
    }
  }

  public async statisticProtocolDauByDay(day: Date) {
    const begin =
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        0,
        0,
        0,
      ).getTime() / 1000;
    const end =
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        23,
        59,
        59,
      ).getTime() / 1000;

    const [minBlock, maxBlock] = await this.getBlockRangeByTime(begin, end);

    if (!minBlock || !maxBlock) {
      this.logger.error("Statistical getBlockRangeByTime failure");
      return;
    }

    const allProject = await this.projectRepository.find();
    allProject;

    const groupByName: { [name: string]: Buffer[] } = allProject.reduce(
      (group, project) => {
        const { name } = project;
        group[name] = group[name] ?? [];
        group[name].push(hexTransformer.to(project.pairAddress));
        return group;
      },
      {},
    );

    for (const name in groupByName) {
      const pairAddressList = groupByName[name];
      const count: { count: number }[] = await this.balanceOfLpRepository.query(
        `select count(distinct address) from "blockAddressPointOfLp" where "pairAddress"=any($1) and "blockNumber" between $2 and $3 and type in ('txNum', 'txVol')`,
        [pairAddressList, minBlock, maxBlock],
      );

      await this.protocolDauRepository
        .createQueryBuilder()
        .insert()
        .values({
          name,
          amount: count[0].count,
          date: day.toISOString().split("T")[0],
          type: 1,
        })
        .orUpdate(["amount"])
        .execute();
    }
  }

  // Historical data, run only once
  @Cron("0 15 0 * * *")
  public async statisticHistoryTvl() {
    const result: { min: string; max: string }[] =
      await this.balanceOfLpRepository.query(
        `select date(min("createdAt")) as min, date(max("createdAt")) as max from "balanceOfLp"`,
      );

    const minDate = new Date(result[0].min);
    let maxDate = new Date(result[0].max);
    // Not counted today
    if (
      maxDate.toISOString().split("T")[0] ===
      new Date().toISOString().split("T")[0]
    ) {
      maxDate.setDate(maxDate.getDate() - 1);
    }

    const tokenMap = await this.getSupportTokens();

    for (let start = minDate; start <= maxDate; ) {
      this.logger.log(`start statistics tvl date: ${start.toISOString()}`);
      await this.statisticTvlByDay(start, tokenMap);
      start.setDate(start.getDate() + 1);
    }

    this.logger.log("finished history statistics protocol tvl");
  }

  @Cron("0 30 0 * * *")
  public async statisticTvl() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const tokenMap = await this.getSupportTokens();
    await this.statisticTvlByDay(yesterday, tokenMap);
    this.logger.log("finished statistics tvl");
  }

  public async statisticTvlByDay(
    day: Date,
    tokenMap: Map<
      string,
      {
        address: {
          l2Address: string;
        };
        symbol: string;
        decimals: number;
        cpPriceId: string;
      }
    >,
  ) {
    const begin =
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        0,
        0,
        0,
      ).getTime() / 1000;
    const end =
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        23,
        59,
        59,
      ).getTime() / 1000;

    const [minBlock, maxBlock] = await this.getBlockRangeByTime(begin, end);

    if (!minBlock || !maxBlock) {
      this.logger.error("Statistical getBlockRangeByTime failure");
      return;
    }

    const allProject = await this.projectRepository.find();
    allProject;

    const groupByName: { [name: string]: Buffer[] } = allProject.reduce(
      (group, project) => {
        const { name } = project;
        group[name] = group[name] ?? [];
        group[name].push(hexTransformer.to(project.pairAddress));
        return group;
      },
      {},
    );

    let maxBlockNumberCurday;
    for (const name in groupByName) {
      const pairAddressList = groupByName[name];

      if (!maxBlockNumberCurday) {
        const maxBlockRes: { max: number }[] =
          await this.balanceOfLpRepository.query(
            `select max("blockNumber") from "balanceOfLp" where "pairAddress" = any($1) and "blockNumber" between $2 and $3`,
            [pairAddressList, minBlock, maxBlock],
          );
        maxBlockNumberCurday = maxBlockRes[0].max;
      }

      const result: { tokenAddress: Buffer; balance: number }[] =
        await this.balanceOfLpRepository.query(
          `select "tokenAddress", sum(balance) as balance from "balanceOfLp" where "pairAddress" = any($1) and "blockNumber" = $2 group by "tokenAddress"`,
          [pairAddressList, maxBlockNumberCurday],
        );
      let tvl = BigNumber(0);
      for (const tokenBalance of result) {
        const l2Address = hexTransformer.from(
          tokenBalance.tokenAddress,
        ) as string;
        const token = tokenMap.get(l2Address);
        const latestPrice = await this.blockTokenPriceRepository.findOne({
          where: {
            priceId: token.cpPriceId,
            blockNumber: LessThanOrEqual(maxBlockNumberCurday),
          },
          order: {
            blockNumber: "desc",
          },
        });

        tvl.plus(
          BigNumber(latestPrice.usdPrice).multipliedBy(
            BigNumber(ethers.formatUnits(tokenBalance.balance, token.decimals)),
          ),
        );
      }

      await this.protocolDauRepository
        .createQueryBuilder()
        .insert()
        .values({
          name,
          amount: tvl.toNumber(),
          date: day.toISOString().split("T")[0],
          type: 3,
        })
        .orUpdate(["amount"])
        .execute();
    }
  }

  public async getBlockRangeByTime(begin: number, end: number) {
    const query = (order: string) =>
      `query block_range {\n  blocks(\n    where: {timestamp_gte: \"${begin}\", timestamp_lte: \"${end}\"}\n    orderBy: number\n    orderDirection: ${order}\n    first: 1\n  ) {\n    timestamp\n    number\n  }\n}`;
    const queryMaxBlock = query("desc");
    const queryMinBlock = query("asc");

    const maxBlock = (await this.queryGraph(queryMaxBlock))?.data.blocks[0]
      .number;
    const minBlock = (await this.queryGraph(queryMinBlock))?.data.blocks[0]
      .number;

    if (!maxBlock || !minBlock) {
      return [undefined, undefined];
    }

    return [Number(minBlock), Number(maxBlock)];
  }

  private async queryGraph(query: string) {
    const body = {
      extensions: {},
      operationName: "block_range",
      query: query,
    };
    let maxRetry = 3;
    while (maxRetry-- > 0) {
      try {
        const response = await fetch(this.novaBlocksGraph, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data: {
          data: { blocks: { timestamp: string; number: string }[] };
        } = await response.json();
        return data;
      } catch (err) {
        this.logger.error(
          `Fetch nova-blocks graph query data faild, remain retry count: ${maxRetry}`,
          err.stack,
        );
      }
    }
  }

  public async getSupportTokens() {
    let maxRetry = 3;
    while (maxRetry-- > 0) {
      try {
        const response = await fetch(
          `${this.pointsApi}/tokens/getSupportTokens`,
        );
        const data: {
          address: {
            l2Address: string;
          };
          symbol: string;
          decimals: number;
          cpPriceId: string;
        }[] = await response.json();

        const tokenMap = new Map(
          data.map((token) => [token.address.l2Address, token]),
        );
        return tokenMap;
      } catch (err) {
        this.logger.error(
          `Fetch getSupportTokens query data faild, remain retry count: ${maxRetry}`,
          err.stack,
        );
      }
    }
  }
}
