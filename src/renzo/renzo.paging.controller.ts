import { Controller, Get, Logger, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LRUCache } from 'lru-cache';
import { RenzoData, RenzoService } from 'src/renzo/renzo.service';
import { PagingOptionsDto } from 'src/common/pagingOptionsDto.dto';
import { PaginationUtil } from 'src/common/pagination.util';
import {
  ExceptionResponse,
  RenzoTokenPointsWithoutDecimalsDto,
  NOT_FOUND_EXCEPTION
} from '../puffer/tokenPointsWithoutDecimals.dto';
import { ethers } from 'ethers';

const options = {
  // how long to live in ms
  ttl: 1000 * 10,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const RENZO_ALL_POINTS_CACHE_KEY = 'allRenzoPointsData';

const SERVICE_EXCEPTION: ExceptionResponse = {
  errmsg: 'Service exception',
  errno: 1,
};

@ApiTags('renzo')
@ApiExcludeController(false)
@Controller('renzo')
export class RenzoPagingController {
  private readonly logger = new Logger(RenzoPagingController.name);

  constructor(
    private readonly renzoService: RenzoService,
  ) {}

  @Get('/all/points/paging')
  @ApiOperation({
    summary:
      'Get paginated renzo point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description:
      "Return paginated all users' RenzoPoints. The rule is to add 1 points per hour. Timing starts from the user's first deposit, with each user having an independent timer.",
    type: RenzoTokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  public async getAllRenzoPoints(
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<
    Partial<RenzoTokenPointsWithoutDecimalsDto & ExceptionResponse>
  > {
    let pointData: RenzoData = cache.get(RENZO_ALL_POINTS_CACHE_KEY) as RenzoData;
    if (!pointData) {
      try {
        pointData = this.renzoService.getPointsData();
        if(!pointData?.items){
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
    const paging = PaginationUtil.paginate(pointData.items, page, limit);
    return {
      errno: 0,
      errmsg: 'no error',
      totals: {
        renzoPoints: pointData.realTotalRenzoPoints,
        eigenLayerPoints: pointData.realTotalEigenLayerPoints,
      },
      meta: paging.meta,
      data: paging.items.map(item=>{
        return {
          address: item.address,
          points: {
            renzoPoints: Number(item.realRenzoPoints.toFixed(6)),
            eigenLayerPoints: Number(item.realEigenLayerPoints.toFixed(6))
          },
          tokenAddress: item.tokenAddress,
          balance: Number(ethers.formatEther(item.balance)).toFixed(6),
          updatedAt: item.updatedAt
        }
      })
    };
  }
}
