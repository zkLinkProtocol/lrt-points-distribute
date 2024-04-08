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
import { ethers } from 'ethers';
import { ParseAddressPipe } from 'src/common/pipes/parseAddress.pipe';
import { ProjectService } from 'src/project/project.service';
import { PagingOptionsDto } from 'src/common/pagingOptionsDto.dto';
import { PaginationUtil } from 'src/common/pagination.util';
import { PointData } from 'src/project/project.service';
import { PagingMetaDto } from 'src/common/paging.dto';
import {
  NOT_FOUND_EXCEPTION,
  SERVICE_EXCEPTION,
  TokenPointsWithoutDecimalsDto,
} from '../tokenPointsWithoutDecimals.dto';

const options = {
  // how long to live in ms
  ttl: 1000 * 10,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const RSETH_ALL_POINTS_CACHE_KEY = 'allRsethPointsData';
const RSETH_ALL_POINTS_WITH_BALANCE_CACHE_KEY = 'allRsethPointsWithBalanceData';
const GRAPH_QUERY_PROJECT_ID = 'rseth';

@ApiTags('rseth')
@ApiExcludeController(false)
@Controller('rseth')
export class RsethPagingController {
  private readonly logger = new Logger(RsethPagingController.name);

  constructor(private projectService: ProjectService) {}

  @Get('/points/paging')
  @ApiOperation({ summary: 'Get paginated rsETH personal points' })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getRsethPoints(
    @Query('address', new ParseAddressPipe()) address: string,
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<TokenPointsWithoutDecimalsDto> {
    let pointData: PointData;

    try{
      pointData = await this.projectService.getPoints(GRAPH_QUERY_PROJECT_ID, address);
      if(!pointData.finalPoints || !pointData.finalTotalPoints){
        return NOT_FOUND_EXCEPTION
      }
    } catch (err) {
      this.logger.error('Get rsETH all points failed', err.stack);
      return SERVICE_EXCEPTION;
    }

    return this.getReturnData(pointData, pagingOptions);
  }

  @Get('/all/points/paging')
  @ApiOperation({
    summary:
      'Get paginated rsETH point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return paginated all users' rsETH points.",
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllRsethPoints(
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<
    Partial<TokenPointsWithoutDecimalsDto>
  > {
    let pointData: PointData;
    pointData = cache.get(RSETH_ALL_POINTS_CACHE_KEY) as PointData;
    if (!pointData) {
      try{
        pointData = await this.projectService.getAllPoints(GRAPH_QUERY_PROJECT_ID);
        if(!pointData.finalPoints || !pointData.finalTotalPoints){
          return NOT_FOUND_EXCEPTION
        }
        cache.set(RSETH_ALL_POINTS_CACHE_KEY, pointData);
      } catch (err) {
        this.logger.error('Get rsETH all points failed', err.stack);
        return SERVICE_EXCEPTION;
      }
    }

    return this.getReturnData(pointData, pagingOptions);
  }

  @Get('/all/points-with-balance/paging')
  @ApiOperation({
    summary:
      'Get paginated rsETH point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return paginated all users' rsETH points with balance.",
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllRsethPointsWithBalance(
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<
    Partial<TokenPointsWithoutDecimalsDto>
  > {
    let pointData: PointData;
    pointData = cache.get(RSETH_ALL_POINTS_WITH_BALANCE_CACHE_KEY) as PointData;
    if (!pointData) {
      try{
        pointData = await this.projectService.getAllPointsWithBalance(GRAPH_QUERY_PROJECT_ID);
        if(!pointData.finalPoints || !pointData.finalTotalPoints){
          return NOT_FOUND_EXCEPTION
        }
        cache.set(RSETH_ALL_POINTS_WITH_BALANCE_CACHE_KEY, pointData);
      } catch (err) {
        this.logger.error('Get rsETH all points failed', err.stack);
        return SERVICE_EXCEPTION;
      }
    }

    return this.getReturnData(pointData, pagingOptions);
  }

  private getReturnData(
    pointData: PointData,
    pagingOptions: PagingOptionsDto
  ): TokenPointsWithoutDecimalsDto{
    let list = pointData.finalPoints;
    let meta: PagingMetaDto;
    if(null != pagingOptions){
      const {page = 1, limit = 100} = pagingOptions;
      const paging = PaginationUtil.paginate(list, page, limit);
      list = paging.items;
      meta = paging.meta;
    }

    return {
      errno: 0,
      errmsg: 'no error',
      total_points: ethers.formatEther(pointData.finalTotalPoints),
      meta: meta,
      data: list.map(point => {
        let tmpPoint = { ...point }; 
        tmpPoint.points = ethers.formatEther(tmpPoint.points);
        return tmpPoint;
      })
    } as TokenPointsWithoutDecimalsDto;
  }
}
