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
import { fork } from 'child_process';

const options = {
  // how long to live in ms
  ttl: 1000 * 10,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const RSETH_ALL_POINTS_CACHE_KEY = 'allRsethPoints';
const RSETH_ALL_POINTS_WITH_BALANCE_CACHE_KEY = 'allRsethPointsWithBalance';
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

    const projectIds = this.graphQueryService.getAllProjectIds(
      GRAPH_QUERY_PROJECT_ID,
    );

    let finalTotalPoints = BigInt(0),
      finalPoints = [];
    for (const key in projectIds) {
      if (Object.prototype.hasOwnProperty.call(projectIds, key)) {
        const projectId = projectIds[key];
        try {
          [points, totalPoints] =
            await this.graphQueryService.queryPointsRedistributedByAddress(
              address,
              projectId,
            ); 
        } catch (err) {
          this.logger.error('Get rsETH personal points failed', err);
          return SERVICE_EXCEPTION;
        } 
        if (Array.isArray(points) && totalPoints) {
          const [tmpPoints, tmpTotalPoints] = this.getPointData(points, totalPoints);
          finalTotalPoints += tmpTotalPoints;
          finalPoints = [...finalPoints, ...tmpPoints];
        } else {
          return NOT_FOUND_EXCEPTION;
        }
      }
    }

    return {
      errno: 0,
      errmsg: 'no error',
      total_points: ethers.formatEther(finalTotalPoints),
      data: finalPoints
    };

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

    let addressPoints : Map<string, Map<string, any>> = new Map(),
      finalTotalPoints = BigInt(0),
      finalPoints = [];
    for (const key in projectIds) {
      if (Object.prototype.hasOwnProperty.call(projectIds, key)) {
        const projectId = projectIds[key];
        try {
          [points, totalPoints] =
            await this.graphQueryService.queryPointsRedistributed(
              projectId,
            ); 
        } catch (err) {
          this.logger.error('Get rsETH all points failed', err);
          return SERVICE_EXCEPTION;
        } 
        if (Array.isArray(points) && totalPoints) {
          const now = (new Date().getTime() / 1000) | 0;
          const totalPointsTmp = GraphQueryService.getTotalPoints(totalPoints, now);
          finalTotalPoints += totalPointsTmp;
          
          points.map((point) => {
            const tmpPoint= GraphQueryService.getPoints(point, now);
            if(!addressPoints.has(point.address)){
              let tmpMap = new Map();
              tmpMap.set("points", tmpPoint);
              tmpMap.set("updateAt", now);
              addressPoints.set(point.address, tmpMap);
            }else{
              addressPoints.get(point.address).set("points", BigInt(addressPoints.get(point.address).get("points")) + tmpPoint);
            }
          });
        } else {
          return NOT_FOUND_EXCEPTION;
        }
      }
    }

    for(const [key, addressPoint] of addressPoints) {
      const newPoint = {
        address: key,
        points: ethers.formatEther(addressPoint.get("points")),
        updated_at: addressPoint.get("updateAt"),
      };
      finalPoints.push(newPoint);
    }
    cacheData = {
      errno: 0,
      errmsg: 'no error',
      total_points: ethers.formatEther(finalTotalPoints),
      data: finalPoints
    };
    cache.set(RSETH_ALL_POINTS_CACHE_KEY, cacheData);
    return cacheData;
  }

  @Get('/all/points-with-balance')
  @ApiOperation({
    summary:
      'Get rsETH point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return all users' rsETH points with balance.",
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllRsethPointsWithBalance(): Promise<
    Partial<TokenPointsWithoutDecimalsDto>
  > {
    const allPoints = cache.get(
      RSETH_ALL_POINTS_WITH_BALANCE_CACHE_KEY,
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

    let finalTotalPoints = BigInt(0),
      finalPoints = [];
    for (const key in projectIds) {
      if (Object.prototype.hasOwnProperty.call(projectIds, key)) {
        const projectId = projectIds[key];
        try {
          [points, totalPoints] =
            await this.graphQueryService.queryPointsRedistributed(
              projectId,
            ); 
        } catch (err) {
          this.logger.error('Get rsETH all points with balance failed', err);
          return SERVICE_EXCEPTION;
        } 
        if (Array.isArray(points) && totalPoints) {
          const [tmpPoints, tmpTotalPoints] = this.getPointData(points, totalPoints);
          finalTotalPoints += tmpTotalPoints;
          finalPoints = [...finalPoints, ...tmpPoints];
        } else {
          return NOT_FOUND_EXCEPTION;
        }
      }
    }

    cacheData = {
      errno: 0,
      errmsg: 'no error',
      total_points: ethers.formatEther(finalTotalPoints),
      data: finalPoints
    };
    cache.set(RSETH_ALL_POINTS_WITH_BALANCE_CACHE_KEY, cacheData);
    return cacheData;
  }

  private getPointData(
    points: GraphPoint[],
    totalPoints: GraphTotalPoint,
  ): [
    finalPoints: any[], 
    finalTotalPoints: bigint
  ] {
    let finalPoints = [];
    const now = (new Date().getTime() / 1000) | 0;
    const finalTotalPoints = GraphQueryService.getTotalPoints(totalPoints, now);
    
    points.map((point) => {
      const projectArr = point.project.split('-');
      const tokenAddress = projectArr[1];
      const newPoint = {
        address: point.address,
        points: ethers.formatEther(GraphQueryService.getPoints(point, now)),
        tokenAddress: tokenAddress,
        balance: point.balance,
        updated_at: now,
      };
      finalPoints.push(newPoint);
    });

    return [finalPoints, finalTotalPoints];
  }
}
