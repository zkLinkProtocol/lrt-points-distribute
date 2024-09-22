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
import {
  PUFFER_ETH_ADDRESS,
  PuffPointsService,
  PufferData,
} from "src/puffer/puffPoints.service";
import { GraphQueryService } from "src/common/service/graphQuery.service";
import { TokenPointsDto } from "./tokenPoints.dto";
import { TokenPointsWithoutDecimalsDto } from "./tokenPointsWithoutDecimals.dto";
import { PointsWithoutDecimalsDto } from "./pointsWithoutDecimals.dto";
import {
  UserElPointsDto,
  ElPointsDto,
  PointsDto,
  ElPointsDtoItem,
  TimeQueryOptionsDto,
  PufferPointUserBalance,
  UserPufferDateBalanceDto,
  PufferSlashResponseDto,
} from "./points.dto";
import { TokensDto } from "./tokens.dto";
import { NovaService } from "src/nova/nova.service";
import { NovaBalanceService } from "../nova/nova.balance.service";
import { RedistributeBalanceRepository } from "src/repositories/redistributeBalance.repository";

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
    private readonly redistributeBalanceRepository: RedistributeBalanceRepository,
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
      data = await this.puffPointsService.getPointsData(
        address.toLocaleLowerCase(),
      );
    } catch (e) {
      this.logger.log(e.errmsg, e.stack);
      res = {
        errno: 1,
        errmsg: "Service exception",
        total_points: "0",
        data: [] as PointsWithoutDecimalsDto[],
      };
    }

    const lpPufferPositions =
      await this.puffPointsService.getUserStakedPosition(address);

    const lpPufferPoint = lpPufferPositions.reduce((result, cur) => {
      return result + cur.point;
    }, 0);

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
          points: (point.realPoints + lpPufferPoint).toString(),
          balance: Number(ethers.formatEther(point.balance)).toFixed(6),
          updated_at: point.updatedAt,
        },
      ],
    };
    return res;
  }

  @Get("/puffer/slash")
  @ApiOkResponse({
    description: "Return puffer slashed withdrawing data by time.",
    type: PufferSlashResponseDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async queryPufferSlashData(
    @Query() query: TimeQueryOptionsDto,
  ): Promise<PufferSlashResponseDto> {
    try {
      const finalFixedTimestamp =
        new Date("2024-09-22T09:44:04Z").getTime() / 1000;
      const firstFixedTimestamp =
        new Date("2024-09-21T03:52:59Z").getTime() / 1000;

      const issueStartTimestamp =
        new Date("2024-06-08T07:07:19Z").getTime() / 1000;

      const queryTimestamp = new Date(query.time).getTime() / 1000;
      const queryWithdrawTimestamp = queryTimestamp - 7 * 24 * 60 * 60;
      console.log(queryTimestamp, queryWithdrawTimestamp);
      if (
        queryTimestamp >= finalFixedTimestamp ||
        queryTimestamp <= issueStartTimestamp
      ) {
        return { errno: 0, errmsg: "no error", data: [] };
      }

      const withdrawData = this.puffPointsService.allWithdrawList;

      const aggregatedData = withdrawData.reduce((acc, item) => {
        const address = item.address.toLowerCase();
        const balance = BigInt(item.balance);

        if (!acc[address]) {
          acc[address] = {
            address: address,
            inaccurateWithdrawBalance: BigInt(0),
            accurateWithdrawBalance: BigInt(0),
          };
        }

        // set before

        if (
          queryTimestamp < firstFixedTimestamp &&
          item.blockTimestamp > issueStartTimestamp
        ) {
          acc[address].inaccurateWithdrawBalance += balance;
        }

        if (
          queryTimestamp >= firstFixedTimestamp &&
          item.blockTimestamp > queryWithdrawTimestamp
        ) {
          acc[address].inaccurateWithdrawBalance += balance;
        }

        if (
          Number(item.blockTimestamp) + 7 * 24 * 60 * 60 > queryTimestamp &&
          item.blockTimestamp < queryTimestamp &&
          item.project === PUFFER_ETH_ADDRESS
        ) {
          acc[address].accurateWithdrawBalance += balance;
        }

        return acc;
      }, {});

      const result = Object.values<any>(aggregatedData)
        .map((entry) => {
          const inaccurateWithdrawBalance = Number(
            ethers.formatEther(entry.inaccurateWithdrawBalance),
          ).toFixed(6);
          const accurateWithdrawBalance = Number(
            ethers.formatEther(entry.accurateWithdrawBalance),
          ).toFixed(6);
          return {
            address: entry.address,
            inaccurateWithdrawBalance,
            accurateWithdrawBalance,
            slash:
              Number(inaccurateWithdrawBalance) -
              Number(accurateWithdrawBalance),
          };
        })
        .filter((item) => item.slash > 0)
        .sort((a, b) => b.slash - a.slash);

      this.logger.log(`get puffer slash data success at ${query.time}`);
      return {
        errno: 0,
        errmsg: "no error",
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `get puffer slash data failed at ${query.time}, ${error.message}`,
      );
      return {
        errno: 1,
        errmsg: "service internal error",
        data: [],
      };
    }
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
    const holdingPufferPoint =
      await this.puffPointsService.getUserPufferPoint(address);

    const data = await this.puffPointsService.getPuffElPointsByAddress(address);
    if (!data) {
      throw new NotFoundException();
    }
    const { userPosition } = data;
    try {
      const lpPufferPositions =
        await this.puffPointsService.getUserStakedPosition(address);

      const [lpPufferPoint, lpPufferBalance] = lpPufferPositions.reduce(
        (result, cur) => {
          return [result[0] + cur.point, result[1] + BigInt(cur.balance)];
        },
        [0, 0n],
      );

      const pufferPoints = holdingPufferPoint + lpPufferPoint;

      const withdrawingBalance =
        userPosition?.withdrawHistory.reduce((prev, cur) => {
          return prev + BigInt(cur.balance);
        }, BigInt(0)) ?? BigInt(0);

      const liquidityDetails =
        lpPufferPositions
          .map((position) => {
            return {
              dappName: position.dappName,
              balance: Number(ethers.formatEther(position.balance)).toFixed(6),
            };
          })
          .filter((i) => !!i) ?? [];

      const res = {
        userAddress: address,
        pufEthAddress: PUFFER_ETH_ADDRESS,
        pufferPoints: pufferPoints.toFixed(6),
        totalBalance: Number(
          ethers.formatEther(
            BigInt(userPosition?.balance ?? 0) +
              lpPufferBalance +
              withdrawingBalance,
          ),
        ).toFixed(6),
        withdrawingBalance: Number(
          ethers.formatEther(withdrawingBalance),
        ).toFixed(6),
        userBalance: Number(
          ethers.formatEther(userPosition?.balance ?? 0),
        ).toFixed(6),
        liquidityBalance: Number(ethers.formatEther(lpPufferBalance)).toFixed(
          6,
        ),
        liquidityDetails,
        updatedAt: Math.floor(Date.now() / 1000),
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
      const data = await this.puffPointsService.getPointsData();
      const allPointsFilter = data.items; //.filter((p) => p.realPoints >= 0.001);
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
    const data = await this.puffPointsService.getPointsData();
    const allPointsFilter = data.items; //.filter((p) => p.realPoints >= 0.001);
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
    const data = await this.puffPointsService.getPointsData();
    const allPointsFilter = data.items; //.filter((p) => p.realPoints >= 0.001);
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
      const data = await this.puffPointsService.getPointsData();
      const allPointsFilter = data.items; //.filter((p) => p.realPoints >= 0.001);
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
    const pufferTotalPoint = await this.puffPointsService.getRealPointsData();

    const stakedPointsMap =
      await this.puffPointsService.getPufferLPAddressMap(pufferTotalPoint);

    const allStakedAddresses = Array.from(stakedPointsMap.keys());
    const userData =
      await this.redistributeBalanceRepository.getPaginatedUserData(
        [PUFFER_ETH_ADDRESS],
        allStakedAddresses,
        (pagingOptions.page ?? 1) - 1,
        pagingOptions.limit,
      );

    const resultData = userData.map((userInfo) => {
      const liquidityDetails = userInfo.userStaked.map((item) => {
        const poolInfo = stakedPointsMap.get(item.poolAddress);
        return {
          dappName: poolInfo.dappName,
          balance: item.balance,
          point: poolInfo.points * item.pointWeightPercentage,
        };
      });

      const userStakedLiquidityBalance = liquidityDetails.reduce(
        (result, item) => result + BigInt(item.balance),
        BigInt(0),
      );
      const userStakedLiquidityPoint = liquidityDetails.reduce(
        (result, item) => result + item.point,
        0,
      );
      const userWithdrawBalance =
        userInfo.userWithdraw.reduce(
          (result, item) => result + BigInt(item.balance),
          BigInt(0),
        ) ?? BigInt(0);

      const userTotalPufEthBalance = BigInt(
        userInfo.userHolding[0]?.balance ?? "0",
      );
      const userTotalPufEthPoint =
        (userInfo.userHolding[0]?.pointWeightPercentage ?? 0) *
        pufferTotalPoint;

      return {
        userAddress: userInfo.userAddress,
        pufEthAddress: PUFFER_ETH_ADDRESS,
        pufferPoints: Number(
          userTotalPufEthPoint + userStakedLiquidityPoint,
        ).toFixed(6),
        totalBalance: Number(
          ethers.formatEther(
            userStakedLiquidityBalance +
              userWithdrawBalance +
              userTotalPufEthBalance,
          ),
        ).toFixed(6),
        withdrawingBalance: Number(
          ethers.formatEther(userWithdrawBalance),
        ).toFixed(6),
        userBalance: Number(ethers.formatEther(userTotalPufEthBalance)).toFixed(
          6,
        ),
        liquidityBalance: Number(
          ethers.formatEther(userStakedLiquidityBalance),
        ).toFixed(6),
        liquidityDetails: liquidityDetails.map((i) => ({
          balance: Number(ethers.formatEther(i.balance)).toFixed(6),
          dappName: i.dappName,
        })),
        updatedAt: Math.floor(Date.now() / 1000),
      };
    });

    const res = {
      errno: 0,
      errmsg: "no error",
      data: {
        totalPufferPoints: pufferTotalPoint.toString(),
        list: resultData,
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
    @Query() queryOptions: TimeQueryOptionsDto,
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

  @Get("/puffer/:address/balanceOfTimestamp")
  @ApiOkResponse({
    description:
      "Return users' puffer balance at a specific time. Including the withdrawing and staked balance in dapp.",
    type: UserPufferDateBalanceDto,
  })
  public async queryUserPufferDateBalance(
    @Param("address", new ParseAddressPipe()) address: string,
    @Query("timestamp") timestamp: number,
  ) {
    try {
      const data = await this.puffPointsService.getBalanceByAddress(
        address,
        timestamp,
      );
      const res = {
        errno: 0,
        errmsg: "no error",
        data: data,
      };
      return res;
    } catch (err) {
      this.logger.error(
        `get puffer balance at a specific time failed: ${err.stack}`,
      );
      return {
        errno: 1,
        errmsg: err.message,
        data: null,
      };
    }
  }
}
