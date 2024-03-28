import { Controller, Get, Logger, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LRUCache } from 'lru-cache';
import { ParseAddressPipe } from 'src/common/pipes/parseAddress.pipe';
import {
  NOT_FOUND_EXCEPTION,
  SERVICE_EXCEPTION,
  TokenPointsWithoutDecimalsDto,
} from './tokenPointsWithoutDecimals.dto';
import {
  GraphPoint,
  GraphQueryService,
  GraphTotalPoint,
} from 'src/explorer/graphQuery.service';
import { ethers } from 'ethers';

const options = {
  // how long to live in ms
  ttl: 1000 * 10,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const RSETH_ALL_POINTS_CACHE_KEY = 'allRsethPoints';
const GRAPH_QUERY_PROJECT_ID = 'rseth';

@ApiTags('rseth')
@ApiExcludeController(false)
@Controller('rseth')
export class RsethController {
  private readonly logger = new Logger(RsethController.name);

  constructor(private graphQueryService: GraphQueryService) {}

  @Get('/points')
  @ApiOperation({ summary: 'Get rsETH personal points' })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getRsethPoints(
    @Query('address', new ParseAddressPipe()) address: string,
  ): Promise<TokenPointsWithoutDecimalsDto> {
    let points: GraphPoint[], totalPoints: GraphTotalPoint;
    try {
      [points, totalPoints] =
        await this.graphQueryService.queryPointsRedistributedByAddress(
          address,
          GRAPH_QUERY_PROJECT_ID,
        );
    } catch (err) {
      this.logger.error('Get rsETH points failed', err);
      return SERVICE_EXCEPTION;
    }

    if (Array.isArray(points) && !totalPoints) {
      return this.getFinalData(points, totalPoints);
    } else {
      return NOT_FOUND_EXCEPTION;
    }
  }

  @Get('/all/points')
  @ApiOperation({
    summary:
      'Get rsETH point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return all users' rsETH points.",
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllRsethPoints(): Promise<
    Partial<TokenPointsWithoutDecimalsDto>
  > {
    const allPoints = cache.get(
      RSETH_ALL_POINTS_CACHE_KEY,
    ) as TokenPointsWithoutDecimalsDto;
    if (allPoints) {
      return allPoints;
    }
    let points: GraphPoint[],
      totalPoints: GraphTotalPoint,
      cacheData: TokenPointsWithoutDecimalsDto;

    const projectIds = this.graphQueryService.getAllProjectIds(
      GRAPH_QUERY_PROJECT_ID,
    );
    //TODO 1. query all points by projectIds
    //TODO 2. get total points
    //TODO 3. get final data and sum all points

    /**
     *
     * {
     * "errno": 0,
     * "errmsg": "no error",
     * "total_points": "0.000000000000000000", // actually total points
     * "data": [
     *  {
     *   "address": "0x"
     *   "points": "0.000000000000000000",
     *   --"tokenAddress": "0.000000000000000000",
     *   --"balance": "0.000000000000000000",
     *   "updated_at": 1630000000
     * }
     * ]
     * }
     */
    try {
      [points, totalPoints] =
        await this.graphQueryService.queryPointsRedistributed(
          GRAPH_QUERY_PROJECT_ID,
        );
      if (Array.isArray(points) && !totalPoints) {
        cacheData = this.getFinalData(points, totalPoints);
        cache.set(RSETH_ALL_POINTS_CACHE_KEY, cacheData);
        return cacheData;
      } else {
        return NOT_FOUND_EXCEPTION;
      }
    } catch (err) {
      this.logger.error('Get rsETH all points failed', err);
      return SERVICE_EXCEPTION;
    }
  }
  //TODO
  public async getAllRsethPointsWithBalance(): Promise<
    Partial<TokenPointsWithoutDecimalsDto>
  > {}

  private getFinalData(
    points: GraphPoint[],
    totalPoints: GraphTotalPoint,
  ): TokenPointsWithoutDecimalsDto {
    const now = (new Date().getTime() / 1000) | 0;
    return {
      errno: 0,
      errmsg: 'no error',
      total_points: ethers.formatEther(
        GraphQueryService.getTotalPoints(totalPoints, now),
      ),
      data: points.map((point) => ({
        address: point.address,
        points: ethers.formatEther(GraphQueryService.getPoints(point, now)),
        balance: ethers.formatEther(point.balance),
        updated_at: now,
      })),
    };
  }
}
