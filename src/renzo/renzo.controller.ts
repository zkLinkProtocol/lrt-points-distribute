import { Controller, Get, Logger, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { LRUCache } from "lru-cache";
import { ParseAddressPipe } from "src/common/pipes/parseAddress.pipe";
import {
  ExceptionResponse,
  RenzoTokenPointsWithoutDecimalsDto,
  NOT_FOUND_EXCEPTION,
} from "../puffer/tokenPointsWithoutDecimals.dto";
import { RenzoPointsWithoutDecimalsDto } from "../puffer/pointsWithoutDecimals.dto";
import { RenzoService } from "src/renzo/renzo.service";
import { ethers } from "ethers";

const options = {
  // how long to live in ms
  ttl: 1000 * 10,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const RENZO_ALL_POINTS_CACHE_KEY = "allRenzoPoints";

const SERVICE_EXCEPTION: ExceptionResponse = {
  errmsg: "Service exception",
  errno: 1,
};

@ApiTags("renzo")
@ApiExcludeController(false)
@Controller("renzo")
export class RenzoController {
  private readonly logger = new Logger(RenzoController.name);

  constructor(private readonly renzoService: RenzoService) {}

  @Get("/points")
  @ApiOperation({ summary: "Get renzo personal points" })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  public async getRenzoPoints(
    @Query("address", new ParseAddressPipe()) address: string,
  ): Promise<{ data: RenzoPointsWithoutDecimalsDto[] } | ExceptionResponse> {
    const pointData = this.renzoService.getPointsData(address);
    if (null == pointData) {
      return NOT_FOUND_EXCEPTION;
    }
    const data = pointData.items;
    if (Array.isArray(data)) {
      return {
        errno: 0,
        errmsg: "no error",
        data: data.map((item) => {
          return {
            address: item.address,
            points: {
              renzoPoints: Number(item.realRenzoPoints.toFixed(6)),
              eigenLayerPoints: Number(item.realEigenLayerPoints.toFixed(6)),
            },
            tokenAddress: item.tokenAddress,
            balance: Number(ethers.formatEther(item.balance)).toFixed(6),
            updatedAt: item.updatedAt,
          };
        }),
      };
    }
    return SERVICE_EXCEPTION;
  }

  @Get("/all/points")
  @ApiOperation({
    summary:
      "Get renzo point for all users, point are based on user token dimension",
  })
  @ApiOkResponse({
    description:
      "Return all users' RenzoPoints. The rule is to add 1 points per hour. Timing starts from the user's first deposit, with each user having an independent timer.",
    type: RenzoTokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  public async getAllRenzoPoints(): Promise<
    Partial<RenzoTokenPointsWithoutDecimalsDto & ExceptionResponse>
  > {
    const allPoints = cache.get(
      RENZO_ALL_POINTS_CACHE_KEY,
    ) as RenzoTokenPointsWithoutDecimalsDto;
    if (allPoints) {
      return allPoints;
    }
    try {
      const pointData = this.renzoService.getPointsData();
      if (null == pointData) {
        return NOT_FOUND_EXCEPTION;
      }
      const renzoPoints = pointData.realTotalRenzoPoints;
      const eigenLayerPoints = pointData.realTotalEigenLayerPoints;
      const data = pointData.items;
      const cacheData = {
        errno: 0,
        errmsg: "no error",
        totals: {
          renzoPoints,
          eigenLayerPoints,
        },
        data: data.map((item) => {
          return {
            address: item.address,
            points: {
              renzoPoints: Number(item.realRenzoPoints.toFixed(6)),
              eigenLayerPoints: Number(item.realEigenLayerPoints.toFixed(6)),
            },
            tokenAddress: item.tokenAddress,
            balance: Number(ethers.formatEther(item.balance)).toFixed(6),
            updatedAt: item.updatedAt,
          };
        }),
      };

      cache.set(RENZO_ALL_POINTS_CACHE_KEY, cacheData);
      return cacheData;
    } catch (err) {
      this.logger.error("Get renzo all points failed", err.stack);
      return SERVICE_EXCEPTION;
    }
  }
}
