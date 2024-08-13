import { BalanceOfLpRepository } from "./../repositories/balanceOfLp.repository";
import { ConfigService } from "@nestjs/config";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { hexTransformer } from "src/transformers/hex.transformer";
import { Cron } from "@nestjs/schedule";
import { BalanceOfLp } from "src/entities/balanceOfLp.entity";
import { Project } from "src/entities/project.entity";
import { ProtocolDau } from "src/entities/dau.entity";

@Injectable()
export class StatisticService {
  private readonly logger = new Logger(StatisticService.name);
  private novaBlocksGraph: string;

  constructor(
    @InjectRepository(BalanceOfLp)
    private readonly balanceOfLpRepository: Repository<BalanceOfLp>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProtocolDau)
    private readonly protocolDauRepository: Repository<ProtocolDau>,
    private readonly configService: ConfigService,
  ) {
    this.novaBlocksGraph = configService.getOrThrow(
      "NOVA_POINT_BLOCK_GRAPH_API",
    );
  }

  // Historical data, run only once
  @Cron("0 15 0 * * *")
  public async statisticHistoryProtocolDau() {
    const result: { min: string; max: string }[] =
      await this.balanceOfLpRepository.query(
        `select date(min("createdAt")) as min, date(max("createdAt")) as max from "balancesOfLp"`,
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
      await this.statisticProtocolDauByDay(start);
      start.setDate(start.getDate() + 1);
    }

    this.logger.log("finished history statistics protocol dau");
  }

  @Cron("0 15 0 * * *")
  public async statisticProtocolDau() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await this.statisticProtocolDauByDay(yesterday);
    this.logger.log("finished statistics protocol dau");
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
        `select count(distinct address) from "balancesOfLp" where "pairAddress"=any($1) and "blockNumber" between $2 and $3`,
        [pairAddressList, minBlock, maxBlock],
      );

      await this.protocolDauRepository
        .createQueryBuilder()
        .insert()
        .values({
          name,
          amount: count[0].count,
          date: day.toISOString().split("T")[0],
        })
        .orIgnore()
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
}
