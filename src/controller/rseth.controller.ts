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
    let finalPoints: any[], finalTotalPoints: string;

    try{
      [finalPoints, finalTotalPoints] = await this.projectService.getPoints(GRAPH_QUERY_PROJECT_ID, address);
    } catch (err) {
      this.logger.error('Get rsETH all points failed', err);
      return SERVICE_EXCEPTION;
    }

    if(!finalPoints || !finalTotalPoints){
      return NOT_FOUND_EXCEPTION
    }

    return {
      errno: 0,
      errmsg: 'no error',
      total_points: finalTotalPoints,
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
    let cacheData: TokenPointsWithoutDecimalsDto, finalPoints: any[], finalTotalPoints: string;

    try{
      [finalPoints, finalTotalPoints] = await this.projectService.getAllPoints(GRAPH_QUERY_PROJECT_ID);
    } catch (err) {
      this.logger.error('Get rsETH all points failed', err);
      return SERVICE_EXCEPTION;
    }

    if(!finalPoints || !finalTotalPoints){
      return NOT_FOUND_EXCEPTION
    }

    cacheData = {
      errno: 0,
      errmsg: 'no error',
      total_points: finalTotalPoints,
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
    let cacheData: TokenPointsWithoutDecimalsDto, finalPoints: any[], finalTotalPoints: string;

    try{
      [finalPoints, finalTotalPoints] = await this.projectService.getAllPointsWithBalance(GRAPH_QUERY_PROJECT_ID);
    } catch (err) {
      this.logger.error('Get rsETH all points failed', err);
      return SERVICE_EXCEPTION;
    }

    if(!finalPoints || !finalTotalPoints){
      return NOT_FOUND_EXCEPTION
    }

    cacheData = {
      errno: 0,
      errmsg: 'no error',
      total_points: finalTotalPoints,
      data: finalPoints
    };
    cache.set(RSETH_ALL_POINTS_WITH_BALANCE_CACHE_KEY, cacheData);
    return cacheData;
  }
}
