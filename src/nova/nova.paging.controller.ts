import { Controller, Get, Logger, Query } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { ParseAddressPipe } from 'src/common/pipes/parseAddress.pipe';
import { NOT_FOUND_EXCEPTION, SERVICE_EXCEPTION } from '../puffer/tokenPointsWithoutDecimals.dto';
import { NovaPointsWithoutDecimalsDto } from 'src/nova/novaPointsWithoutDecimalsDto.dto';
import { NovaService } from 'src/nova/nova.service';
import { NovaApiService, NovaPoints } from 'src/nova/novaapi.service';
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PointData } from 'src/nova/nova.service';
import { PagingOptionsDto } from 'src/common/pagingOptionsDto.dto';
import { PaginationUtil } from 'src/common/pagination.util';
import { PagingMetaDto } from 'src/common/paging.dto';

const options = {
  // how long to live in ms
  ttl: 1000 * 20,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const NOVA_ALL_POINTS_CACHE_KEY = 'allNovaPointsData';
const NOVA_ALL_POINTS_WITH_BALANCE_CACHE_KEY = 'allNovaPointsWithBalanceData';

@ApiTags('nova')
@ApiExcludeController(false)
@Controller('nova')
export class NovaPagingController {
  private readonly logger = new Logger(NovaPagingController.name);

  constructor(
    private novaService: NovaService, 
    private novaApiService: NovaApiService
  ) {}

  @Get('/points/paging')
  @ApiOperation({ summary: 'Get paginated token personal points' })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getNovaPoints(
    @Query('address', new ParseAddressPipe()) address: string,
    @Query('tokenAddress', new ParseAddressPipe()) tokenAddress: string,
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<NovaPointsWithoutDecimalsDto> {
    let pointData: PointData;
    try{
      pointData = await this.novaService.getPoints(tokenAddress, address);
      if(!pointData.finalPoints || !pointData.finalTotalPoints){
        return NOT_FOUND_EXCEPTION
      }
    } catch (err) {
      this.logger.error('Get nova all points failed', err.stack);
      return SERVICE_EXCEPTION;
    }

    // Get real points.
    let points: NovaPoints;
    try{
      points = await this.novaApiService.getNovaPoint(tokenAddress);
    } catch (err) {
      this.logger.error('Get paginated nova real points failed', err.stack);
      return SERVICE_EXCEPTION;
    }
    if(!points){
      return NOT_FOUND_EXCEPTION;
    }
    return this.getReturnData(pointData, pagingOptions, points.novaPoint);
  }

  @Get('/all/points/paging')
  @ApiOperation({
    summary:
      'Get paginated nova point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return paginated all users' nova points.",
    type: NovaPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllNovaPoints(
    @Query() pagingOptions: PagingOptionsDto,
    @Query('tokenAddress', new ParseAddressPipe()) tokenAddress: string
  ): Promise<Partial<NovaPointsWithoutDecimalsDto>> {
    const cacheKey = NOVA_ALL_POINTS_CACHE_KEY + tokenAddress;
    let pointData = cache.get(cacheKey) as PointData;
    if (!pointData) {
      try{
        pointData = await this.novaService.getAllPoints(tokenAddress);
        if(!pointData.finalPoints || !pointData.finalTotalPoints){
          return NOT_FOUND_EXCEPTION
        }
        cache.set(cacheKey, pointData);
      } catch (err) {
        this.logger.error('Get nova all points failed', err.stack);
        return SERVICE_EXCEPTION;
      }
    }

    // Get real points.
    let points: NovaPoints;
    try{
      points = await this.novaApiService.getNovaPoint(tokenAddress);
    } catch (err) {
      this.logger.error('Get nova real points failed', err.stack);
      return SERVICE_EXCEPTION;
    }
    if(!points){
      return NOT_FOUND_EXCEPTION;
    }
    return this.getReturnData(pointData, pagingOptions, points.novaPoint);
  }

  @Get('/all/points-with-balance/paging')
  @ApiOperation({
    summary:
      'Get paginated nova point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return paginated all users' nova points with balance.",
    type: NovaPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllNovaPointsWithBalance(
    @Query() pagingOptions: PagingOptionsDto,
    @Query('tokenAddress', new ParseAddressPipe()) tokenAddress: string,
  ): Promise<Partial<NovaPointsWithoutDecimalsDto>> {
    const cacheKey = NOVA_ALL_POINTS_WITH_BALANCE_CACHE_KEY + tokenAddress;
    let pointData = cache.get(cacheKey) as PointData;
    if (!pointData) {
      try{
        pointData = await this.novaService.getAllPointsWithBalance(tokenAddress);
        if(!pointData.finalPoints || !pointData.finalTotalPoints){
          return NOT_FOUND_EXCEPTION
        }
        cache.set(cacheKey, pointData);
      } catch (err) {
        this.logger.error('Get nova all points failed', err.stack);
        return SERVICE_EXCEPTION;
      }
    }

    // Get real points.
    let points: NovaPoints;
    try{
      points = await this.novaApiService.getNovaPoint(tokenAddress);
    } catch (err) {
      this.logger.error('Get nova real points failed', err.stack);
      return SERVICE_EXCEPTION;
    }
    if(!points){
      return NOT_FOUND_EXCEPTION;
    }
    return this.getReturnData(pointData, pagingOptions, points.novaPoint);
  }

  private getReturnData(
    pointData: PointData,
    pagingOptions: PagingOptionsDto,
    novaPoint: number,
  ): NovaPointsWithoutDecimalsDto {
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
      total_points: novaPoint.toString(),
      meta: meta,
      data: list.map(point => {
        const tmpPoints = point.points;
        point.points = this.novaService.getRealPoints(tmpPoints, pointData.finalTotalPoints, novaPoint);
        return point;
      })
    } as NovaPointsWithoutDecimalsDto;
  }
}
