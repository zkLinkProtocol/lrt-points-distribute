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
import { PointsDto } from "./points.dto";
import { TokensDto } from "./tokens.dto";
import { NovaService } from "src/nova/nova.service";

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
        updatedAt: new Date(point.updatedAt * 1000),
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
    if (data.items.length === 0) {
      throw new NotFoundException();
    }

    // layerbank point
    const layerbankPoint =
      await this.puffPointsService.getLayerBankPoint(address);
    const point = data.items[0];
    res = {
      errno: 0,
      errmsg: "no error",
      total_points: data.realTotalPoints.toString(),
      data: [
        {
          address: point.address,
          tokenAddress: point.tokenAddress,
          points: (point.realPoints + layerbankPoint).toString(),
          balance: Number(ethers.formatEther(point.balance)).toFixed(6),
          updated_at: point.updatedAt,
        },
      ],
    };
    return res;
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
        updatedAt: new Date(p.updatedAt * 1000),
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
}
