import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PointsRepository } from 'src/repositories/points.repository';
import { TokenPointsDto } from './tokenPoints.dto';
import { LRUCache } from 'lru-cache';
import { Points } from 'src/entities/points.entity';
import {
  ADDRESS_REGEX_PATTERN,
  ParseAddressPipe,
} from 'src/common/pipes/parseAddress.pipe';
import { TokenPointsWithoutDecimalsDto } from './tokenPointsWithoutDecimals.dto';
import { BigNumber } from 'bignumber.js';
import { PointsWithoutDecimalsDto } from './pointsWithoutDecimals.dto';
import { RenzoService } from 'src/renzo/renzo.service';

const options = {
  // how long to live in ms
  ttl: 1000 * 5,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const ALL_PUFFER_POINTS_CACHE_KEY = 'allPufferPoints';
const TOTAL_PUFFER_POINTS_CACHE_KEY = 'totalPufferPoints';
const REAL_PUFFFER_POINTS_CACHE_KEY = 'realPufferPoints';
const RENZO_ALL_POINTS_CACHE_KEY = 'allRenzoPoints';

@ApiTags('points')
@ApiExcludeController(false)
@Controller('points')
export class PointsController {
  private readonly logger = new Logger(PointsController.name);
  private readonly puffPointsTokenAddress: string;

  constructor(
    private readonly pointsRepository: PointsRepository,
    private readonly renzoService: RenzoService,
    private configService: ConfigService,
  ) {
    this.puffPointsTokenAddress = configService.get<string>(
      'puffPoints.tokenAddress',
    );
  }

  @Get('renzo/points')
  @ApiParam({
    name: 'address',
    schema: { pattern: ADDRESS_REGEX_PATTERN },
    description: 'Valid hex address',
  })
  @ApiOperation({ summary: 'Get renzo personal points' })
  public async getRenzoPoints(
    @Query('address', new ParseAddressPipe()) address: string,
  ) {
    const points = await this.renzoService.getPoints(address);
    return points;
  }

  @Get('renzo/all/points')
  @ApiOperation({
    summary:
      'Get renzo point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description:
      "Return all users' RenzoPoints. The rule is to add 1 points per hour. Timing starts from the user's first deposit, with each user having an independent timer.",
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async getAllRenzoPoints(): Promise<TokenPointsWithoutDecimalsDto> {
    const allPoints = cache.get(
      RENZO_ALL_POINTS_CACHE_KEY,
    ) as TokenPointsWithoutDecimalsDto;
    if (allPoints) {
      return allPoints;
    }

    try {
      const points = await this.renzoService.getAllPoints();
      let result: PointsWithoutDecimalsDto[] = [];
      let totalPoints = 0n;
      for (const point of points) {
        const dto: PointsWithoutDecimalsDto = {
          address: point.address,
          tokenAddress: point.token,
          points: point.points.toString(),
          updated_at: point.updatedAt.getTime() / 1000,
        };
        result.push(dto);
        totalPoints += point.points;
      }

      const cachePoints: TokenPointsWithoutDecimalsDto = {
        errno: 0,
        errmsg: 'no error',
        total_points: totalPoints.toString(),
        data: result,
      };
      cache.set(RENZO_ALL_POINTS_CACHE_KEY, cachePoints);
      return cachePoints;
    } catch (err) {
      this.logger.error('Get renzo all points failed', err);
      return {
        errno: 1,
        errmsg: 'Service exception',
        total_points: '0',
        data: [],
      };
    }
  }

  @Get(':address/pufferpoints')
  @ApiParam({
    name: 'address',
    schema: { pattern: ADDRESS_REGEX_PATTERN },
    description: 'Valid hex address',
  })
  @ApiOkResponse({
    description: 'Return the user puff points',
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async pufferPoints(
    @Param('address', new ParseAddressPipe()) address: string,
  ): Promise<TokenPointsWithoutDecimalsDto> {
    let res: TokenPointsWithoutDecimalsDto;
    try {
      const [allPoints, totalPoints, realPufferPoints] =
        await this.getPointsAndTotalPoints();
      const point = allPoints.filter(
        (p) => p.address.toLowerCase() === address.toLowerCase(),
      );

      if (point.length === 0) {
        throw new NotFoundException();
      }
      res = {
        errno: 0,
        errmsg: 'no error',
        total_points: realPufferPoints,
        data: [
          {
            address: point[0].address,
            points: new BigNumber(point[0].points.toString())
              .multipliedBy(realPufferPoints)
              .div(totalPoints.toString())
              .toFixed(6),
            updated_at: (point[0].updatedAt.getTime() / 1000) | 0,
          },
        ],
      };
    } catch (e) {
      res = {
        errno: 1,
        errmsg: 'Service exception',
        total_points: '0',
        data: [] as PointsWithoutDecimalsDto[],
      };
    }

    return res;
  }

  @Get('/allpufferpoints2')
  @ApiOkResponse({
    description:
      "Return all users' PufferPoints. The rule is to add 30 points per hour.\nTiming starts from the user's first deposit, with each user having an independent timer.",
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async allPufferPoints2(): Promise<TokenPointsWithoutDecimalsDto> {
    let res: TokenPointsWithoutDecimalsDto;
    try {
      const [allPoints, totalPoints, realPufferPoints] =
        await this.getPointsAndTotalPoints();

      res = {
        errno: 0,
        errmsg: 'no error',
        total_points: realPufferPoints,
        data: allPoints.map((p) => {
          return {
            address: p.address,
            updated_at: (p.updatedAt.getTime() / 1000) | 0,
            points: new BigNumber(p.points.toString())
              .multipliedBy(realPufferPoints)
              .div(totalPoints.toString())
              .toFixed(6),
          };
        }),
      };
    } catch (e) {
      res = {
        errno: 1,
        errmsg: 'Not Found',
        total_points: '0',
        data: [] as PointsWithoutDecimalsDto[],
      };
    }

    return res;
  }

  @Get('/allpufferpoints')
  @ApiOkResponse({
    description:
      "Return all users' PufferPoints with a decimals of 18. The rule is to add 30 points per hour.\nTiming starts from the user's first deposit, with each user having an independent timer.",
    type: TokenPointsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async allPufferPoints(): Promise<TokenPointsDto> {
    this.logger.log('allPufferPoints');
    const [allPoints, totalPoints, _] = await this.getPointsAndTotalPoints();
    const result = allPoints.map((p) => {
      return {
        address: p.address,
        updatedAt: p.updatedAt,
        points: p.points.toString(),
      };
    });
    return {
      decimals: 18,
      tokenAddress: this.puffPointsTokenAddress,
      totalPoints: totalPoints.toString(),
      result: result,
    };
  }

  private async getPointsAndTotalPoints(): Promise<[Points[], BigInt, string]> {
    let allPoints = cache.get(ALL_PUFFER_POINTS_CACHE_KEY) as Points[];
    let realPufferPoints = cache.get(REAL_PUFFFER_POINTS_CACHE_KEY) as string;
    let totalPoints = BigInt(
      (cache.get(TOTAL_PUFFER_POINTS_CACHE_KEY) as string) || 0,
    );
    if (!allPoints || !realPufferPoints || !totalPoints) {
      try {
        const realData = await fetch(
          'https://quest-api.puffer.fi/puffer-quest/third/query_zklink_pufpoint',
          {
            method: 'get',
            headers: {
              'Content-Type': 'application/json',
              'client-id': '08879426f59a4b038b7755b274bc19dc',
            },
          },
        );
        const pufReadData = await realData.json();
        if (
          pufReadData &&
          pufReadData.errno === 0 &&
          pufReadData.data &&
          pufReadData.data.pufeth_points_detail
        ) {
          /**
           *"pufeth_points_detail": {
            "balance": "271.314758",
            "last_updated_at": 1710834827,
            "points_per_hour": 30,
            "last_points": "437936.342254",
            "latest_points": "450864.490477"
            }
           */
          realPufferPoints = pufReadData.data.pufeth_points_detail[
            'latest_points'
          ] as string;
        } else {
          this.logger.error('Failed to get real puffer points');
          throw new NotFoundException();
        }

        allPoints = await this.getAllPufferPoints();
        allPoints.forEach((p) => {
          totalPoints += p.points;
        });
      } catch (e) {
        this.logger.error(e);
        throw new NotFoundException();
      }

      cache.set(REAL_PUFFFER_POINTS_CACHE_KEY, realPufferPoints);
      cache.set(TOTAL_PUFFER_POINTS_CACHE_KEY, totalPoints.toString());
      cache.set(ALL_PUFFER_POINTS_CACHE_KEY, allPoints);
    }

    return [allPoints, totalPoints, realPufferPoints];
  }

  public async getAllPufferPoints() {
    let result: Points[] = [];
    let page: number = 1;
    const pageSize = 300;
    while (true) {
      const points = await this.pointsRepository.find({
        where: {
          token: this.puffPointsTokenAddress,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

      result.push(...points);
      if (points.length < pageSize) {
        break;
      }

      ++page;
    }

    return result;
  }
}
