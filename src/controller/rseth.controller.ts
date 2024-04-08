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
import { ProjectService } from 'src/project/project.service';
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
const RSETH_ALL_POINTS_WITH_BALANCE_CACHE_KEY = 'allRsethPointsWithBalance';
const GRAPH_QUERY_PROJECT_ID = 'rseth';

@ApiTags('rseth')
@ApiExcludeController(false)
@Controller('rseth')
export class RsethController {
  private readonly logger = new Logger(RsethController.name);

  constructor(private projectService: ProjectService) {}

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
    let finalPoints: any[], finalTotalPoints: bigint;

    try{
      const pointData = await this.projectService.getPoints(GRAPH_QUERY_PROJECT_ID, address);
      finalPoints = pointData.finalPoints;
      finalTotalPoints = pointData.finalTotalPoints;
    } catch (err) {
      this.logger.error('Get rsETH all points failed', err);
      return SERVICE_EXCEPTION;
    }
    if(!finalPoints || !finalTotalPoints){
      return NOT_FOUND_EXCEPTION
    }

    return this.getReturnData(finalPoints, finalTotalPoints);
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

    let cacheData: TokenPointsWithoutDecimalsDto, finalPoints: any[], finalTotalPoints: bigint;
    try{
      const pointData = await this.projectService.getAllPoints(GRAPH_QUERY_PROJECT_ID);
      finalPoints = pointData.finalPoints;
      finalTotalPoints = pointData.finalTotalPoints;
    } catch (err) {
      this.logger.error('Get rsETH all points failed', err);
      return SERVICE_EXCEPTION;
    }
    if(!finalPoints || !finalTotalPoints){
      return NOT_FOUND_EXCEPTION
    }

    cacheData = this.getReturnData(finalPoints, finalTotalPoints);;
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

    let cacheData: TokenPointsWithoutDecimalsDto, finalPoints: any[], finalTotalPoints: bigint;
    try{
      const pointData = await this.projectService.getAllPointsWithBalance(GRAPH_QUERY_PROJECT_ID);
      finalPoints = pointData.finalPoints;
      finalTotalPoints = pointData.finalTotalPoints;
    } catch (err) {
      this.logger.error('Get rsETH all points failed', err);
      return SERVICE_EXCEPTION;
    }
    if(!finalPoints || !finalTotalPoints){
      return NOT_FOUND_EXCEPTION
    }

    cacheData = this.getReturnData(finalPoints, finalTotalPoints);;
    cache.set(RSETH_ALL_POINTS_WITH_BALANCE_CACHE_KEY, cacheData);
    return cacheData;
  }

  private getReturnData(
    finalPoints: any[],
    finnalTotalPoints: bigint,
  ): TokenPointsWithoutDecimalsDto{
    return {
      errno: 0,
      errmsg: 'no error',
      total_points: ethers.formatEther(finnalTotalPoints),
      data: finalPoints.map(point => {
        point.points = ethers.formatEther(point.points);
        return point;
      })
    } as TokenPointsWithoutDecimalsDto;
  }
}
