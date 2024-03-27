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
} from './tokenPointsWithoutDecimals.dto';
import { BigNumber } from 'bignumber.js';
import { RenzoPointsWithoutDecimalsDto } from './pointsWithoutDecimals.dto';
import { RenzoService } from 'src/renzo/renzo.service';
import { RenzoApiService } from 'src/explorer/renzoapi.service';

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
    private readonly renzoApiService: RenzoApiService,
  ) {}

  //TODO no found error's format is not ExceptionResponse
  @Get('/points')
  @ApiOperation({ summary: 'Get renzo personal points' })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  public async getRenzoPoints(
    @Query('address', new ParseAddressPipe()) address: string,
  ): Promise<{ data: RenzoPointsWithoutDecimalsDto[] } | ExceptionResponse> {
    const allPoints = await this.getAllRenzoPoints();
    if (Array.isArray(allPoints.data)) {
      return {
        errno: 0,
        errmsg: 'no error',
        data: allPoints.data.filter(
          (point) => point.address.toLowerCase() === address.toLowerCase(),
        ),
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
      const { renzoPoints, eigenLayerPoints, data } = await this.getPointData();
      const cacheData = {
        errno: 0,
        errmsg: 'no error',
        totals: {
          renzoPoints,
          eigenLayerPoints,
        },
        data,
      };

      cache.set(RENZO_ALL_POINTS_CACHE_KEY, cacheData);
      return cacheData;
    } catch (err) {
      this.logger.error('Get renzo all points failed', err);
      return SERVICE_EXCEPTION;
    }
  }

  public async getPointData() {
    const { renzoPoints, eigenLayerPoints, totalPoints, points } =
      await this.getLocalPointAndRealPoint();
    let data: RenzoPointsWithoutDecimalsDto[] = [];
    for (const point of points) {
      const dto: RenzoPointsWithoutDecimalsDto = {
        address: point.address,
        tokenAddress: point.token,
        points: {
          renzoPoints: Number(
            new BigNumber(point.points.toString())
              .multipliedBy(renzoPoints)
              .div(totalPoints.toString())
              .toFixed(6),
          ),
          eigenLayerPoints: Number(
            new BigNumber(point.points.toString())
              .multipliedBy(eigenLayerPoints)
              .div(totalPoints.toString())
              .toFixed(6),
          ),
        },
        updatedAt: point.updatedAt.getTime() / 1000,
      };
      data.push(dto);
    }
    return {
      renzoPoints,
      eigenLayerPoints,
      data,
    };
  }

  public async getLocalPointAndRealPoint() {
    const { renzoPoints, eigenLayerPoints } =
      await this.renzoApiService.fetchRenzoPoints();
    const points = await this.renzoService.getAllPoints();
    const totalPoints = points.reduce((acc, point) => {
      return acc + point.points;
    }, 0n);
    return {
      renzoPoints,
      eigenLayerPoints,
      totalPoints,
      points,
    };
  }
}
