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
import { MagiePointsWithoutDecimalsDto } from 'src/magpie/magiePointsWithoutDecimalsDto.dto';
import { ProjectService } from 'src/project/project.service';
import { MagpieGraphQueryService } from 'src/magpie/magpieGraphQuery.service';
import { PointData } from 'src/project/project.service';
import { PagingMetaDto } from 'src/common/paging.dto';
import { PagingOptionsDto } from 'src/common/pagingOptionsDto.dto';
import { PaginationUtil } from 'src/common/pagination.util';
import { NOT_FOUND_EXCEPTION, SERVICE_EXCEPTION } from '../tokenPointsWithoutDecimals.dto';

const options = {
  // how long to live in ms
  ttl: 1000 * 10,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const MAGPIE_ALL_POINTS_CACHE_KEY = 'allMagpiePointsData';
const MAGPIE_ALL_POINTS_WITH_BALANCE_CACHE_KEY = 'allMagpiePointsWithBalanceData';
const GRAPH_QUERY_PROJECT_ID = 'magpie';

@ApiTags('magpie')
@ApiExcludeController(false)
@Controller('magpie')
export class MagpiePagingController {
  private readonly logger = new Logger(MagpiePagingController.name);

  constructor(
    private projectService: ProjectService, 
    private magpieGraphQueryService: MagpieGraphQueryService
  ) {}

  @Get('/points/paging')
  @ApiOperation({ summary: 'Get paginated magpie personal points' })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getMagpiePoints(
    @Query('address', new ParseAddressPipe()) address: string,
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<MagiePointsWithoutDecimalsDto> {
    let pointData: PointData;
    try{
      pointData = await this.projectService.getPoints(GRAPH_QUERY_PROJECT_ID, address);
      if(!pointData.finalPoints || !pointData.finalTotalPoints){
        return NOT_FOUND_EXCEPTION
      }
    } catch (err) {
      this.logger.error('Get magpie all points failed', err.stack);
      return SERVICE_EXCEPTION;
    }

    // Get real points.
    const [eigenpiePoints, eigenLayerPoints] = this.magpieGraphQueryService.getTotalPoints();
    return this.getReturnData(pointData, pagingOptions, eigenpiePoints, eigenLayerPoints);
  }

  @Get('/all/points/paging')
  @ApiOperation({
    summary:
      'Get paginated magpie point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return all users' magpie points.",
    type: MagiePointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllMagpiePoints(
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<
    Partial<MagiePointsWithoutDecimalsDto>
  > {
    let pointData = cache.get(MAGPIE_ALL_POINTS_CACHE_KEY) as PointData;
    if (!pointData) {
      try{
        pointData = await this.projectService.getAllPoints(GRAPH_QUERY_PROJECT_ID);
        if(!pointData.finalPoints || !pointData.finalTotalPoints){
          return NOT_FOUND_EXCEPTION
        }
        cache.set(MAGPIE_ALL_POINTS_CACHE_KEY, pointData);
      } catch (err) {
        this.logger.error('Get magpie all points failed', err.stack);
        return SERVICE_EXCEPTION;
      }
    }

    // Get real points.
    const [eigenpiePoints, eigenLayerPoints] = this.magpieGraphQueryService.getTotalPoints();
    return this.getReturnData(pointData, pagingOptions, eigenpiePoints, eigenLayerPoints);
  }

  @Get('/all/points-with-balance/paging')
  @ApiOperation({
    summary:
      'Get paginated magpie point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return all users' magpie points with balance.",
    type: MagiePointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllMagpiePointsWithBalance(
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<
    Partial<MagiePointsWithoutDecimalsDto>
  > {
    let pointData = cache.get(MAGPIE_ALL_POINTS_WITH_BALANCE_CACHE_KEY) as PointData;
    if (!pointData) {
      try{
        pointData = await this.projectService.getAllPointsWithBalance(GRAPH_QUERY_PROJECT_ID);
        if(!pointData.finalPoints || !pointData.finalTotalPoints){
          return NOT_FOUND_EXCEPTION
        }
        cache.set(MAGPIE_ALL_POINTS_WITH_BALANCE_CACHE_KEY, pointData);
      } catch (err) {
        this.logger.error('Get magpie all points failed', err.stack);
        return SERVICE_EXCEPTION;
      }
    }

    // Get real points.
    const [eigenpiePoints, eigenLayerPoints] = this.magpieGraphQueryService.getTotalPoints();
    return this.getReturnData(pointData, pagingOptions, eigenpiePoints, eigenLayerPoints);
  }

  private getReturnData(
    pointData: PointData,
    pagingOptions: PagingOptionsDto,
    eigenpiePoints: bigint,
    eigenLayerPoints: bigint
  ): MagiePointsWithoutDecimalsDto {
    let list = pointData.finalPoints;
    let meta: PagingMetaDto;
    if(null != pagingOptions){
      const {page = 1, limit = 100} = pagingOptions;
      const paging = PaginationUtil.paginate(pointData.finalPoints, page, limit);
      list = paging.items;
      meta = paging.meta;
    }

    return {
      errno: 0,
      errmsg: 'no error',
      totals: {
        eigenpiePoints: ethers.formatEther(eigenpiePoints),
        eigenLayerPoints: ethers.formatEther(eigenLayerPoints),
      },
      meta: meta,
      data: list.map(point => {
        let tmpPoint = { ...point }; 
        const tmpPoints = tmpPoint.points;
        tmpPoint.points = {
          eigenpiePoints: ethers.formatEther(this.projectService.getRealPoints(tmpPoints, pointData.finalTotalPoints, eigenpiePoints)),
          eigenLayerPoints: ethers.formatEther(this.projectService.getRealPoints(tmpPoints, pointData.finalTotalPoints, eigenLayerPoints)),
        };
        return tmpPoint;
      })
    } as MagiePointsWithoutDecimalsDto;
  }
}
