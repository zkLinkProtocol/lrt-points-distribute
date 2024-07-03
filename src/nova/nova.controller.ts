import { Controller, Get, Logger, Param, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { LRUCache } from "lru-cache";
import { ethers } from "ethers";
import { ParseAddressPipe } from "src/common/pipes/parseAddress.pipe";
import {
  NOT_FOUND_EXCEPTION,
  SERVICE_EXCEPTION,
} from "../puffer/tokenPointsWithoutDecimals.dto";
import {
  NovaPointsWithoutDecimalsDto,
  ProjectNovaPoint,
} from "src/nova/novaPointsWithoutDecimalsDto.dto";
import { NovaService } from "src/nova/nova.service";
import { NovaApiService, NovaPoints } from "src/nova/novaapi.service";
import { BigNumber } from "bignumber.js";
import { PuffPointsService } from "src/puffer/puffPoints.service";
import { NovaBalanceService } from "./nova.balance.service";
import { PagingOptionsDto } from "../common/pagingOptionsDto.dto";
import { PagingMetaDto } from "../common/paging.dto";
import { ResponseDto } from "src/common/response.dto";
import {
  CategoryPointsDto,
  CategoryPointsListDto,
  CategoryPointsUserListWithCurrentDto,
  UserPointsListDto,
} from "./nova.dto";
import { ReferralService } from "src/referral/referral.service";

const options = {
  // how long to live in ms
  ttl: 1000 * 20,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const NOVA_ALL_POINTS_CACHE_KEY = "allNovaPoints";
const NOVA_ALL_POINTS_WITH_BALANCE_CACHE_KEY = "allNovaPointsWithBalance";

@ApiTags("nova")
@ApiExcludeController(false)
@Controller("nova")
export class NovaController {
  private readonly logger = new Logger(NovaController.name);

  constructor(
    private novaService: NovaService,
    private novaApiService: NovaApiService,
    private pufferPointsSercie: PuffPointsService,
    private novaBalanceService: NovaBalanceService,
    private referralService: ReferralService,
  ) {}

  @Get("/points")
  @ApiOperation({ summary: "Get token personal points" })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getNovaPoints(
    @Query("address", new ParseAddressPipe()) address: string,
  ): Promise<NovaPointsWithoutDecimalsDto> {
    let finalPoints: any[], finalTotalPoints: bigint;
    try {
      const pointData = await this.novaService.getAllTokensPoints(address);
      finalPoints = pointData.finalPoints;
      finalTotalPoints = pointData.finalTotalPoints;
    } catch (err) {
      this.logger.error("Get nova all points failed", err.stack);
      return SERVICE_EXCEPTION;
    }
    if (!finalPoints || !finalTotalPoints) {
      return NOT_FOUND_EXCEPTION;
    }

    return {
      errno: 0,
      errmsg: "no error",
      total_points: finalTotalPoints.toString(),
      data: finalPoints.map((point) => {
        point.points = BigNumber(point.points);
        point.balance = BigNumber(ethers.formatEther(point.balance)).toFixed(6);
        return point;
      }),
    } as NovaPointsWithoutDecimalsDto;
  }

  @Get("/points/project")
  @ApiOperation({ summary: "Get project personal points" })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getNovaProjectPoints(
    @Query("address", new ParseAddressPipe()) address: string,
    @Query("project") project: string,
  ): Promise<NovaPointsWithoutDecimalsDto> {
    let pointData;
    try {
      pointData = await this.novaBalanceService.getPoints(address, project);
    } catch (err) {
      this.logger.error("Get nova all points failed", err.stack);
      return SERVICE_EXCEPTION;
    }

    return {
      errno: 0,
      errmsg: "no error",
      data: pointData.map((item) => {
        return {
          address: item.address,
          poolAddress: item.pairAddress,
          points: BigNumber(item.stakePoint).toFixed(6),
          updated_at: item.updatedAt,
        };
      }),
    } as NovaPointsWithoutDecimalsDto;
  }

  @Get("/points/:project")
  @ApiOperation({ summary: "Get project total points" })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getNovaProjectPoint(
    @Param("project") project: string,
  ): Promise<ProjectNovaPoint> {
    try {
      const pointData =
        await this.novaBalanceService.getProjectTotalPoints(project);

      return {
        errno: 0,
        errmsg: "no error",
        data: pointData,
      };
    } catch (err) {
      this.logger.error("Get nova all points failed", err.stack);
      return SERVICE_EXCEPTION;
    }
  }

  @Get("/points/token")
  @ApiOperation({ summary: "Get all token personal points" })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getNovaTokenPoints(
    @Query("address", new ParseAddressPipe()) address: string,
    @Query("tokenAddress", new ParseAddressPipe()) tokenAddress: string,
  ): Promise<NovaPointsWithoutDecimalsDto> {
    let finalPoints: any[], finalTotalPoints: bigint;
    try {
      const pointData = await this.novaService.getPoints(tokenAddress, [
        address,
      ]);
      finalPoints = pointData.finalPoints;
      finalTotalPoints = pointData.finalTotalPoints;
    } catch (err) {
      this.logger.error("Get nova all points failed", err.stack);
      return SERVICE_EXCEPTION;
    }
    if (!finalPoints || !finalTotalPoints) {
      return NOT_FOUND_EXCEPTION;
    }

    // Get real points.
    let points: NovaPoints;
    try {
      points = await this.novaApiService.getNovaPoint(tokenAddress);
    } catch (err) {
      this.logger.error("Get nova real points failed", err.stack);
      return SERVICE_EXCEPTION;
    }
    if (!points) {
      return NOT_FOUND_EXCEPTION;
    }
    return this.getReturnData(finalPoints, finalTotalPoints, points.novaPoint);
  }

  @Get("/points/puffer")
  @ApiOperation({ summary: "Get puffer personal points in layerbank" })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getNovaPufferPoints(
    @Query("address", new ParseAddressPipe()) address: string,
    @Query("tokenAddress", new ParseAddressPipe()) tokenAddress: string,
  ): Promise<NovaPointsWithoutDecimalsDto> {
    let finalPoints: any[], finalTotalPoints: bigint;
    try {
      const pointData = await this.novaService.getPoints(tokenAddress, [
        address,
      ]);
      finalPoints = pointData.finalPoints;
      finalTotalPoints = pointData.finalTotalPoints;
    } catch (err) {
      this.logger.error("Get nova all points failed", err.stack);
      return SERVICE_EXCEPTION;
    }
    if (!finalPoints || !finalTotalPoints) {
      return NOT_FOUND_EXCEPTION;
    }
    // Get real puffer points in layerbank.
    let points: number = 0;
    try {
      const tokenData =
        this.pufferPointsSercie.getPoolPufferPoints(tokenAddress);
      if (tokenData) {
        points = tokenData.realPoints ?? 0;
      }
    } catch (err) {
      this.logger.error(
        "Get puffer real points in layerbank failed",
        err.stack,
      );
      return SERVICE_EXCEPTION;
    }
    if (!points) {
      return NOT_FOUND_EXCEPTION;
    }
    return this.getReturnData(finalPoints, finalTotalPoints, points);
  }

  @Get("/points/address/projects/all")
  @ApiOperation({ summary: "Get all address's project points" })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllAddressProjectPoints(
    @Query() pagingOptions: PagingOptionsDto,
  ): Promise<any> {
    let pointData, totalCount;
    const { page = 1, limit = 100 } = pagingOptions;
    try {
      pointData = await this.novaBalanceService.getAddressByTotalPoints(
        page,
        limit,
      );
      totalCount = await this.novaBalanceService.getAddressCount();
    } catch (err) {
      this.logger.error("Get nova all points failed", err.stack);
      return SERVICE_EXCEPTION;
    }

    const pagingMeta = {
      currentPage: Number(page),
      itemCount: pointData.length,
      itemsPerPage: Number(limit),
      totalItems: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    } as PagingMetaDto;

    return {
      errno: 0,
      errmsg: "no error",
      meta: pagingMeta,
      data: pointData,
    };
  }

  @Get("/points/address/projects/daily")
  @ApiOperation({ summary: "Get all address's project daily points" })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllAddressProjectDailyPoints(
    @Query() pagingOptions: PagingOptionsDto,
  ): Promise<any> {
    let pointData, totalCount;
    const { page = 1, limit = 100 } = pagingOptions;
    try {
      pointData = await this.novaBalanceService.getAddressByDailyTotalPoints(
        page,
        limit,
      );
      totalCount = await this.novaBalanceService.getAddressDailyCount();
    } catch (err) {
      this.logger.error("Get nova all points failed", err.stack);
      return SERVICE_EXCEPTION;
    }

    const pagingMeta = {
      currentPage: Number(page),
      itemCount: pointData.length,
      itemsPerPage: Number(limit),
      totalItems: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    } as PagingMetaDto;

    return {
      errno: 0,
      errmsg: "no error",
      meta: pagingMeta,
      data: pointData,
    };
  }

  @Get("/all/points")
  @ApiOperation({
    summary:
      "Get nova point for all users, point are based on user token dimension",
  })
  @ApiOkResponse({
    description: "Return all users' nova points.",
    type: NovaPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllNovaPoints(
    @Query("tokenAddress", new ParseAddressPipe()) tokenAddress: string,
  ): Promise<Partial<NovaPointsWithoutDecimalsDto>> {
    const cacheKey = NOVA_ALL_POINTS_CACHE_KEY + tokenAddress;
    const allPoints = cache.get(cacheKey) as NovaPointsWithoutDecimalsDto;
    if (allPoints) {
      return allPoints;
    }

    let finalPoints: any[], finalTotalPoints: bigint;
    try {
      const pointData = await this.novaService.getAllPoints(tokenAddress);
      finalPoints = pointData.finalPoints;
      finalTotalPoints = pointData.finalTotalPoints;
    } catch (err) {
      this.logger.error("Get nova all points failed", err);
      this.logger.error(err.message, err.stack);
      return SERVICE_EXCEPTION;
    }
    if (!finalPoints || !finalTotalPoints) {
      return NOT_FOUND_EXCEPTION;
    }

    // Get real points.
    let points: NovaPoints;
    try {
      points = await this.novaApiService.getNovaPoint(tokenAddress);
    } catch (err) {
      this.logger.error("Get nova real points failed", err);
      this.logger.error(err.message, err.stack);
      return SERVICE_EXCEPTION;
    }
    if (!points) {
      return NOT_FOUND_EXCEPTION;
    }
    const cacheData = this.getReturnData(
      finalPoints,
      finalTotalPoints,
      points.novaPoint,
    );
    cache.set(cacheKey, cacheData);
    return cacheData;
  }

  @Get("/all/points-with-balance")
  @ApiOperation({
    summary:
      "Get nova point for all users, point are based on user token dimension",
  })
  @ApiOkResponse({
    description: "Return all users' nova points with balance.",
    type: NovaPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllNovaPointsWithBalance(
    @Query("tokenAddress", new ParseAddressPipe()) tokenAddress: string,
  ): Promise<Partial<NovaPointsWithoutDecimalsDto>> {
    const cacheKey = NOVA_ALL_POINTS_WITH_BALANCE_CACHE_KEY + tokenAddress;
    const allPoints = cache.get(cacheKey) as NovaPointsWithoutDecimalsDto;
    if (allPoints) {
      return allPoints;
    }

    let finalPoints: any[], finalTotalPoints: bigint;
    try {
      const pointData =
        await this.novaService.getAllPointsWithBalance(tokenAddress);
      finalPoints = pointData.finalPoints;
      finalTotalPoints = pointData.finalTotalPoints;
    } catch (err) {
      this.logger.error("Get nova all points failed", err.stack);
      return SERVICE_EXCEPTION;
    }
    if (!finalPoints || !finalTotalPoints) {
      return NOT_FOUND_EXCEPTION;
    }

    // Get real points.
    let points: NovaPoints;
    try {
      points = await this.novaApiService.getNovaPoint(tokenAddress);
    } catch (err) {
      this.logger.error("Get nova real points failed", err);
      this.logger.error(err.message, err.stack);
      return SERVICE_EXCEPTION;
    }
    if (!points) {
      return NOT_FOUND_EXCEPTION;
    }
    const cacheData = this.getReturnData(
      finalPoints,
      finalTotalPoints,
      points.novaPoint,
    );
    cache.set(cacheKey, cacheData);
    return cacheData;
  }

  @Get("/category/user/points")
  @ApiOperation({ summary: "Retrieve user points under the project category" })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getNovaCategoryUserPoints(
    @Query("address", new ParseAddressPipe()) address: string,
  ): Promise<ResponseDto<CategoryPointsDto[]>> {
    const pointsData =
      await this.novaBalanceService.getPointsByAddress(address);
    return {
      errno: 0,
      errmsg: "no error",
      data: pointsData,
    };
  }

  @Get("/category/points")
  @ApiOperation({ summary: "Retrieve total points of the category" })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getNovaCategoryPoints(): Promise<
    ResponseDto<CategoryPointsListDto[]>
  > {
    const season = 2;
    const pointsData =
      await this.novaBalanceService.getAllCategoryPoints(season);
    return {
      errno: 0,
      errmsg: "no error",
      data: pointsData,
    };
  }

  @Get("/category/:category/list")
  @ApiOperation({ summary: "User score ranking under a category" })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getNovaCategoryPointsRank(
    @Param("category") category: string,
    @Query("address", new ParseAddressPipe()) address: string,
    @Query() pagingOptions: PagingOptionsDto,
  ): Promise<ResponseDto<CategoryPointsUserListWithCurrentDto>> {
    const { limit = 100 } = pagingOptions;
    const season = 2;
    const data = await this.novaBalanceService.getPointsListByCategory(
      category,
      season,
      limit,
      address,
    );
    return {
      errno: 0,
      errmsg: "no error",
      data: {
        current: {
          userIndex: data.current.userIndex + 1,
          address: data.current.address,
          username: data.current.username,
          totalPoints: data.current.totalPoints,
        },
        list: data.data,
      },
    };
  }

  @Get("/:address/referrer")
  @ApiOperation({ summary: "User's referrer point" })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getReferrerPointsRank(
    @Param("address") address: string,
  ): Promise<ResponseDto<UserPointsListDto[]>> {
    const season = 2;
    const data = await this.referralService.getReferralPoints(address, season);
    return {
      errno: 0,
      errmsg: "no error",
      data: data.map((item) => {
        return {
          address: item.userAddress,
          username: item.userName,
          points: item.totalPoint,
        };
      }),
    };
  }

  private getReturnData(
    finalPoints: any[],
    finnalTotalPoints: bigint,
    novaPoint: number,
  ): NovaPointsWithoutDecimalsDto {
    return {
      errno: 0,
      errmsg: "no error",
      total_points: novaPoint.toString(),
      data: finalPoints.map((point) => {
        const tmpPoints = point.points;
        point.points = this.novaService.getRealPoints(
          tmpPoints,
          finnalTotalPoints,
          novaPoint,
        );
        return point;
      }),
    } as NovaPointsWithoutDecimalsDto;
  }
}
