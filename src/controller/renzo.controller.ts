import { Controller, Get, Logger, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LRUCache } from 'lru-cache';
import { ParseAddressPipe } from 'src/common/pipes/parseAddress.pipe';
import {
  ExceptionResponse,
  RenzoTokenPointsWithoutDecimalsDto,
  NOT_FOUND_EXCEPTION
} from './tokenPointsWithoutDecimals.dto';
import { RenzoPointsWithoutDecimalsDto } from './pointsWithoutDecimals.dto';
import { PointData, RenzoService } from 'src/renzo/renzo.service';
import { PagingOptionsDto } from 'src/common/pagingOptionsDto.dto';
import { PaginationUtil } from 'src/common/pagination.util';

const options = {
  // how long to live in ms
  ttl: 1000 * 10,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const RENZO_ALL_POINTS_CACHE_KEY = 'allRenzoPoints';

const SERVICE_EXCEPTION: ExceptionResponse = {
  errmsg: 'Service exception',
  errno: 1,
};

@ApiTags('renzo')
@ApiExcludeController(false)
@Controller('renzo')
export class RenzoController {
  private readonly logger = new Logger(RenzoController.name);

  constructor(
    private readonly renzoService: RenzoService,
  ) {}

  @Get('/points')
  @ApiOperation({ summary: 'Get renzo personal points' })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  public async getRenzoPoints(
    @Query('address', new ParseAddressPipe()) address: string,
  ): Promise<{ data: RenzoPointsWithoutDecimalsDto[] } | ExceptionResponse> {
    const pointData = this.renzoService.getPointData();
    if(null == pointData){
      return NOT_FOUND_EXCEPTION;
    }
    const data = pointData.data;
    if (Array.isArray(data)) {
      return {
        errno: 0,
        errmsg: 'no error',
        data:
          data.filter(
            (point) => point.address.toLowerCase() === address.toLowerCase(),
          ) ?? [],
      };
    }
    return SERVICE_EXCEPTION;
  }

  @Get('/all/points')
  @ApiOperation({
    summary:
      'Get renzo point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description:
      "Return all users' RenzoPoints. The rule is to add 1 points per hour. Timing starts from the user's first deposit, with each user having an independent timer.",
    type: RenzoTokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  public async getAllRenzoPoints(
    @Query() pagingOptions: PagingOptionsDto,
  ): Promise<
    Partial<RenzoTokenPointsWithoutDecimalsDto & ExceptionResponse>
  > {
    let pointData: PointData = cache.get(RENZO_ALL_POINTS_CACHE_KEY) as PointData;
    if (!pointData) {
      try {
        pointData = this.renzoService.getPointData();
        if(!pointData?.data){
          return NOT_FOUND_EXCEPTION;
        }
        cache.set(RENZO_ALL_POINTS_CACHE_KEY, pointData);
      } catch (err) {
        this.logger.error('Get renzo all points failed', err.stack);
        return SERVICE_EXCEPTION;
      }
    }

    // data for paging
    const {page = 1, limit = 100} = pagingOptions;
    const paging = PaginationUtil.paginate(pointData.data, page, limit);
    return {
      errno: 0,
      errmsg: 'no error',
      totals: {
        renzoPoints: pointData.renzoPoints,
        eigenLayerPoints: pointData.eigenLayerPoints,
      },
      meta: paging.meta,
      data: paging.items
    };
  }
}
