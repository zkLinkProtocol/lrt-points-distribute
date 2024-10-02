import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { LRUCache } from "lru-cache";
import { ethers } from "ethers";
import {
  ADDRESS_REGEX_PATTERN,
  ParseAddressPipe,
} from "src/common/pipes/parseAddress.pipe";
import { RenzoPointItem, RenzoService } from "src/renzo/renzo.service";
import { ParseProjectNamePipe } from "src/common/pipes/parseProjectName.pipe";
import { PagingOptionsDto } from "src/common/pagingOptionsDto.dto";
import { PaginationUtil } from "src/common/pagination.util";
import { PuffPointsService, PufferData } from "src/puffer/puffPoints.service";
import { GraphQueryService } from "src/common/service/graphQuery.service";
import { TokenPointsDto } from "./tokenPoints.dto";
import { TokenPointsWithoutDecimalsDto } from "./tokenPointsWithoutDecimals.dto";
import { PointsWithoutDecimalsDto } from "./pointsWithoutDecimals.dto";
import {
  UserElPointsDto,
  ElPointsDto,
  PointsDto,
  ElPointsDtoItem,
  LayerBankPufferPointQueryOptionsDto,
  PufferPointUserBalance,
} from "./points.dto";
import { TokensDto } from "./tokens.dto";
import { NovaService } from "src/nova/nova.service";
import { NovaBalanceService } from "../nova/nova.balance.service";

const options = {
  // how long to live in ms
  ttl: 1000 * 20,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const RENZO_ALL_POINTS_CACHE_KEY = "allRenzoPoints";
const PUFFER_ADDRESS_POINTS_FORWARD = "pufferAddressPointsForward";

@ApiTags("points")
@ApiExcludeController(false)
@Controller("points")
export class PointsController {
  private readonly logger = new Logger(PointsController.name);
  private readonly puffPointsTokenAddress: string;

  constructor(
    private readonly puffPointsService: PuffPointsService,
    private readonly renzoService: RenzoService,
    private readonly graphQueryService: GraphQueryService,
    private configService: ConfigService,
    private readonly novaService: NovaService,
    private readonly novaBalanceService: NovaBalanceService,
  ) {
    this.puffPointsTokenAddress = configService.get<string>(
      "puffPoints.tokenAddress",
    );
  }

  @Get("tokens")
  @ApiOperation({ summary: "Get all tokens" })
  public async getTokens(
    @Query("projectName", new ParseProjectNamePipe()) projectName: string,
  ): Promise<TokensDto> {
    const result =
      await this.graphQueryService.getAllTokenAddresses(projectName);
    return {
      errno: 0,
      errmsg: "no error",
      data: result,
    };
  }

  @Get("renzo/points")
  @ApiOperation({ summary: "Get renzo personal points" })
  public async getRenzoPoints(
    @Query("address", new ParseAddressPipe()) address: string,
  ): Promise<PointsDto[]> {
    const data = await this.renzoService.getPointsData(address);
    const result = data.items.map((point: RenzoPointItem) => {
      const dto: PointsDto = {
        address: point.address,
        updatedAt: point.updatedAt,
        points: point.realRenzoPoints.toFixed(6),
        tokenAddress: point.tokenAddress,
      };
      return dto;
    });
    return result;
  }

  @Get("renzo/all/points")
  @ApiOperation({
    summary:
      "Get renzo point for all users, point are based on user token dimension",
  })
  @ApiOkResponse({
    description:
      "Return all users' RenzoPoints. The rule is to add 1 points per hour. Timing starts from the user's first deposit, with each user having an independent timer.",
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async getAllRenzoPoints(): Promise<TokenPointsWithoutDecimalsDto> {
    const allPoints = cache.get(
      RENZO_ALL_POINTS_CACHE_KEY,
    ) as TokenPointsWithoutDecimalsDto;
    if (allPoints) {
      return allPoints;
    }

    try {
      const data = await this.renzoService.getPointsData();
      const result: PointsWithoutDecimalsDto[] = [];
      const totalPoints = data.realTotalRenzoPoints;
      for (const point of data.items) {
        const dto: PointsWithoutDecimalsDto = {
          address: point.address,
          tokenAddress: point.tokenAddress,
          points: point.realRenzoPoints.toFixed(6),
          updated_at: point.updatedAt,
        };
        result.push(dto);
      }

      const cachePoints: TokenPointsWithoutDecimalsDto = {
        errno: 0,
        errmsg: "no error",
        total_points: totalPoints.toFixed(6),
        data: result,
      };
      cache.set(RENZO_ALL_POINTS_CACHE_KEY, cachePoints);
      return cachePoints;
    } catch (err) {
      this.logger.error("Get renzo all points failed", err.stack);
      return {
        errno: 1,
        errmsg: "Service exception",
        total_points: "0",
        data: [],
      };
    }
  }

  @Get(":address/pufferpoints")
  @ApiParam({
    name: "address",
    schema: { pattern: ADDRESS_REGEX_PATTERN },
    description: "Valid hex address",
  })
  @ApiOkResponse({
    description: "Return the user puff points",
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async pufferPoints(
    @Param("address", new ParseAddressPipe()) address: string,
  ): Promise<TokenPointsWithoutDecimalsDto> {
    let res: TokenPointsWithoutDecimalsDto, data: PufferData;
    try {
      data = this.puffPointsService.getPointsData(address.toLocaleLowerCase());
    } catch (e) {
      this.logger.log(e.errmsg, e.stack);
      res = {
        errno: 1,
        errmsg: "Service exception",
        total_points: "0",
        data: [] as PointsWithoutDecimalsDto[],
      };
    }

    // layerbank point
    const layerbankPoint =
      await this.puffPointsService.getLayerBankPoint(address);
    // aqua point
    const aquaPoint = await this.puffPointsService.getAquaPoint(address);

    const { point: agxPufferPoint, balance: agxPufferEthBalance } =
      await this.puffPointsService.getAGXPufferDataByAddress(address);
    this.logger.log(
      `layerbankPoint: ${layerbankPoint}, aquaPoint: ${aquaPoint}, agxPufferPoint: ${agxPufferPoint}`,
    );
    const point = data.items[0] ?? {
      realPoints: 0,
      balance: BigInt(0),
      updatedAt: Date.now() / 1000,
      tokenAddress: "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC",
    };
    res = {
      errno: 0,
      errmsg: "no error",
      total_points: data.realTotalPoints.toString(),
      data: [
        {
          address: address,
          tokenAddress: point.tokenAddress,
          points: (
            point.realPoints +
            layerbankPoint +
            aquaPoint +
            agxPufferPoint
          ).toString(),
          balance: Number(
            ethers.formatEther(point.balance + agxPufferEthBalance),
          ).toFixed(6),
          updated_at: point.updatedAt,
        },
      ],
    };
    return res;
  }

  @Get("puffer/:address")
  @ApiParam({
    name: "address",
    schema: { pattern: ADDRESS_REGEX_PATTERN },
    description: "Valid hex address",
  })
  @ApiOkResponse({
    description: "Return the user puff eigenlayer points",
    type: UserElPointsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async pufferEigenLayerPoints(
    @Param("address", new ParseAddressPipe()) address: string,
  ): Promise<UserElPointsDto> {
    const pufPointsData = this.puffPointsService.getPointsData(
      address.toLocaleLowerCase(),
    );

    const data = await this.puffPointsService.getPuffElPointsByAddress(address);
    if (!data) {
      throw new NotFoundException();
    }
    const { userPosition, pools } = data;
    try {
      // layerbank point
      const layerbankPoint =
        await this.puffPointsService.getLayerBankPoint(address);

      // aqua point
      const aquaPoint = await this.puffPointsService.getAquaPoint(address);

      const { point: agxPufferPoint, balance: agxPufferBalance } =
        await this.puffPointsService.getAGXPufferDataByAddress(address);

      const pufferPoints = (
        (pufPointsData.items[0]?.realPoints ?? 0) +
        layerbankPoint +
        aquaPoint +
        agxPufferPoint
      ).toString();

      const withdrawingBalance =
        userPosition?.withdrawHistory.reduce((prev, cur) => {
          return prev + BigInt(cur.balance);
        }, BigInt(0)) ?? BigInt(0);

      const balanceFromDappTotal =
        (userPosition?.positions.reduce((prev, cur) => {
          const pool = pools.find((pool) => pool.id === cur.pool);
          const shareBalance =
            (BigInt(pool.balance) * BigInt(cur.supplied)) /
            BigInt(pool.totalSupplied);
          return prev + shareBalance;
        }, BigInt(0)) ?? BigInt(0)) + agxPufferBalance;

      const liquidityDetails =
        userPosition?.positions
          .map((position) => {
            const pool = pools.find((pool) => pool.id === position.pool);
            return {
              dappName: pool.name,
              balance: Number(
                ethers.formatEther(
                  (BigInt(pool.balance) * BigInt(position.supplied)) /
                    BigInt(pool.totalSupplied),
                ),
              ).toFixed(6),
            };
          })
          .filter((i) => !!i) ?? [];

      if (agxPufferBalance > 0n) {
        liquidityDetails.push({
          dappName: "agx",
          balance: Number(ethers.formatEther(agxPufferBalance)).toFixed(6),
        });
      }

      const res = {
        userAddress: address,
        pufEthAddress: "0x1b49ecf1a8323db4abf48b2f5efaa33f7ddab3fc",
        pufferPoints: pufferPoints,
        totalBalance: Number(
          ethers.formatEther(
            BigInt(userPosition?.balance ?? 0) +
              balanceFromDappTotal +
              withdrawingBalance,
          ),
        ).toFixed(6),
        withdrawingBalance: Number(
          ethers.formatEther(withdrawingBalance),
        ).toFixed(6),
        userBalance: Number(
          ethers.formatEther(userPosition?.balance ?? 0),
        ).toFixed(6),
        liquidityBalance: Number(
          ethers.formatEther(balanceFromDappTotal),
        ).toFixed(6),
        liquidityDetails,
        updatedAt: pufPointsData.items[0]?.updatedAt ?? Date.now() / 1000,
      };

      return {
        errno: 0,
        errmsg: "no error",
        data: res,
      };
    } catch (e) {
      this.logger.log(e.errmsg, e.stack);
      return {
        errno: 1,
        errmsg: "Service exception",
        data: null as unknown as ElPointsDtoItem,
      };
    }
  }

  @Get("/allpufferpoints2")
  @ApiOkResponse({
    description:
      "Return all users' PufferPoints. The rule is to add 30 points per hour.\nTiming starts from the user's first deposit, with each user having an independent timer.",
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async allPufferPoints2(): Promise<TokenPointsWithoutDecimalsDto> {
    let res: TokenPointsWithoutDecimalsDto;
    try {
      const data = this.puffPointsService.getPointsData();
      const allPointsFilter = data.items.filter((p) => p.balance >= 10 ** 12);
      res = {
        errno: 0,
        errmsg: "no error",
        total_points: data.realTotalPoints.toString(),
        data: allPointsFilter.map((p) => {
          return {
            address: p.address,
            tokenAddress: p.tokenAddress,
            balance: Number(ethers.formatEther(p.balance)).toFixed(6),
            updated_at: p.updatedAt,
            points: p.realPoints.toString(),
          };
        }),
      };
    } catch (e) {
      res = {
        errno: 1,
        errmsg: "Not Found",
        total_points: "0",
        data: [] as PointsWithoutDecimalsDto[],
      };
    }

    return res;
  }

  @Get("forward/puffer/zklink_point")
  public async getForwardPuffer(
    @Query("address", new ParseAddressPipe()) address: string,
  ) {
    const cacheKey = PUFFER_ADDRESS_POINTS_FORWARD + address;
    const pufReadDataCache = cache.get(cacheKey);
    if (pufReadDataCache) {
      return pufReadDataCache;
    }
    const realData = await fetch(
      `https://quest-api.puffer.fi/puffer-quest/third/query_user_points?address=${address}`,
      {
        method: "get",
        headers: {
          "Content-Type": "application/json",
          "client-id": "08879426f59a4b038b7755b274bc19dc",
        },
      },
    );
    const pufReadData = await realData.json();
    cache.set(cacheKey, pufReadData);
    return pufReadData;
  }

  @Get("/allpufferpoints")
  @ApiOkResponse({
    description:
      "Return all users' PufferPoints with a decimals of 18. The rule is to add 30 points per hour.\nTiming starts from the user's first deposit, with each user having an independent timer.",
    type: TokenPointsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async allPufferPoints(): Promise<TokenPointsDto> {
    this.logger.log("allPufferPoints");
    const data = this.puffPointsService.getPointsData();
    const allPointsFilter = data.items.filter((p) => p.balance > 10 ** 12);
    const result = allPointsFilter.map((p) => {
      return {
        address: p.address,
        updatedAt: p.updatedAt,
        tokenAddress: p.tokenAddress,
        points: p.localPoints.toString(),
      };
    });
    return {
      decimals: 18,
      tokenAddress: this.puffPointsService.tokenAddress,
      totalPoints: data.localTotalPoints.toString(),
      result: result,
    };
  }

  @Get("/allpufferpoints/paging")
  @ApiOkResponse({
    description:
      "Return paginated results of all users' PufferPoints with a decimals of 18. The rule is to add 30 points per hour.\nTiming starts from the user's first deposit, with each user having an independent timer.",
    type: TokenPointsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async allPufferPointsPaging(
    @Query() pagingOptions: PagingOptionsDto,
  ): Promise<TokenPointsDto> {
    this.logger.log("allPufferPoints");
    const data = this.puffPointsService.getPointsData();
    const allPointsFilter = data.items.filter((p) => p.balance >= 10 ** 12);
    const { page = 1, limit = 100 } = pagingOptions;
    const paging = PaginationUtil.paginate(allPointsFilter, page, limit);
    const result = paging.items.map((p) => {
      return {
        address: p.address,
        updatedAt: p.updatedAt,
        tokenAddress: p.tokenAddress,
        points: p.realPoints.toString(),
      };
    });
    return {
      decimals: 18,
      tokenAddress: this.puffPointsService.tokenAddress,
      totalPoints: data.localTotalPoints.toString(),
      meta: paging.meta,
      result: result,
    };
  }

  @Get("/allpufferpoints2/paging")
  @ApiOkResponse({
    description:
      "Return paginated results of all users' PufferPoints. The rule is to add 30 points per hour.\nTiming starts from the user's first deposit, with each user having an independent timer.",
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async allPufferPointsPaging2(
    @Query() pagingOptions: PagingOptionsDto,
  ): Promise<TokenPointsWithoutDecimalsDto> {
    let res: TokenPointsWithoutDecimalsDto;
    try {
      const data = this.puffPointsService.getPointsData();
      const allPointsFilter = data.items.filter((p) => p.balance > 10 ** 12);
      const { page = 1, limit = 100 } = pagingOptions;
      const paging = PaginationUtil.paginate(allPointsFilter, page, limit);
      res = {
        errno: 0,
        errmsg: "no error",
        total_points: data.realTotalPoints.toString(),
        meta: paging.meta,
        data: paging.items.map((p) => {
          return {
            address: p.address,
            tokenAddress: p.tokenAddress,
            balance: Number(ethers.formatEther(p.balance)).toFixed(6),
            updated_at: p.updatedAt,
            points: p.realPoints.toString(),
          };
        }),
      };
    } catch (e) {
      res = {
        errno: 1,
        errmsg: "Not Found",
        total_points: "0",
        data: [] as PointsWithoutDecimalsDto[],
      };
    }

    return res;
  }

  // todo
  @Get("/puffer")
  @ApiOkResponse({
    description:
      "Return paginated results of all users' Puffer Points. The rule is to add 30 points per hour.\nTiming starts from the user's first deposit, with each user having an independent timer.",
    type: ElPointsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async queryPufferEigenlayerPoints(
    @Query() pagingOptions: PagingOptionsDto,
  ): Promise<ElPointsDto> {
    const data = await this.puffPointsService.getPointsData();
    const { pools, userPositions } =
      await this.puffPointsService.getPuffElPoints(pagingOptions);
    const addresses = userPositions.map((i) => i.id);
    // layerbank point
    const layerbankPoints =
      await this.puffPointsService.getLayerBankPointList(addresses);
    // aqua point
    const aquaPoints = await this.puffPointsService.getAquaPointList(addresses);

    const res = {
      errno: 0,
      errmsg: "no error",
      data: {
        totalPufferPoints: data.realTotalPoints.toString(),
        list: userPositions.map((p) => {
          const userPointData = data.items.find((i) => i.address === p.id);

          const layerbankPoint =
            layerbankPoints.find(
              (layerbankPoint) => layerbankPoint.address === p.id,
            )?.layerbankPoint ?? 0;

          const aquaPoint =
            aquaPoints.find((aquaPoint) => aquaPoint.address === p.id)
              ?.aquaPoint ?? 0;

          const liquidityBalance = p.positions.reduce((prev, cur) => {
            const pool = pools.find((pool) => pool.id === cur.pool);
            if (!pool) return prev;

            const shareBalance =
              (BigInt(pool.balance) * BigInt(cur.supplied)) /
              BigInt(pool.totalSupplied);
            return prev + shareBalance;
          }, BigInt(0));

          const withdrawingBalance = p.withdrawHistory.reduce((prev, cur) => {
            return prev + BigInt(cur.balance);
          }, BigInt(0));

          const totalBalance = Number(
            ethers.formatEther(
              liquidityBalance + BigInt(p.balance) + withdrawingBalance,
            ),
          ).toFixed(6);

          const liquidityDetails = p.positions
            .map((position) => {
              const pool = pools.find((pool) => pool.id === position.pool);
              if (!pool) return;
              return {
                dappName: pool?.name,
                balance: Number(
                  ethers.formatEther(
                    (BigInt(pool.balance) * BigInt(position.supplied)) /
                      BigInt(pool.totalSupplied),
                  ),
                ).toFixed(6),
              };
            })
            .filter((i) => !!i);
          return {
            userAddress: p.id,
            pufEthAddress: "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC",
            pufferPoints: (
              (userPointData?.realPoints ?? 0) +
              layerbankPoint +
              aquaPoint
            ).toString(),
            totalBalance: totalBalance,
            withdrawingBalance: Number(
              ethers.formatEther(withdrawingBalance),
            ).toFixed(6),
            userBalance: Number(ethers.formatEther(BigInt(p.balance))).toFixed(
              6,
            ),
            liquidityBalance: Number(
              ethers.formatEther(liquidityBalance),
            ).toFixed(6),
            liquidityDetails: liquidityDetails,
            updatedAt: userPointData?.updatedAt,
          };
        }),
      },
    };

    return res;
  }

  @Get("/puffer/:address/balances")
  @ApiOkResponse({
    description:
      "Return users' puffer balance. Including the withdrawing and staked balance in dapp.",
    type: ElPointsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async queryUserPufferHistoricData(
    @Param("address", new ParseAddressPipe()) address: string,
    @Query() queryOptions: LayerBankPufferPointQueryOptionsDto,
  ): Promise<PufferPointUserBalance> {
    let res: PufferPointUserBalance;
    try {
      const [userPosition, pools] =
        await this.puffPointsService.getPufferUserBalance(
          address,
          queryOptions.time,
        );

      const dappBalance = userPosition.positionHistory.map((item) => {
        const pool = pools.find((i) => i.pool === item.pool);
        return {
          dappName: item.poolName,
          balance: Number(
            ethers.formatEther(
              (BigInt(pool.balance) * BigInt(item.supplied)) /
                BigInt(pool.totalSupplied),
            ),
          ).toFixed(6),
        };
      });
      res = {
        errno: 0,
        errmsg: "no error",
        data: {
          dappBalance: dappBalance,
          withdrawingBalance: Number(
            ethers.formatEther(
              userPosition.withdrawHistory.reduce((prev, cur) => {
                return prev + BigInt(cur.balance);
              }, BigInt(0)),
            ),
          ).toFixed(6),
        },
      };
    } catch (e) {
      res = {
        errno: 1,
        errmsg: "Not Found",
        data: {
          dappBalance: [],
          withdrawingBalance: "0",
        },
      };
    }

    return res;
  }
}
