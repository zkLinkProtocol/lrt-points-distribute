import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Query,
  OnModuleInit
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { BigNumber } from 'bignumber.js';
import { LRUCache } from 'lru-cache';
import { ethers } from 'ethers';
import { ADDRESS_REGEX_PATTERN, ParseAddressPipe } from 'src/common/pipes/parseAddress.pipe';
import { Points } from 'src/entities/points.entity';
import { PointsRepository } from 'src/repositories/points.repository';
import { RenzoService } from 'src/renzo/renzo.service';
import { ParseProjectNamePipe } from 'src/common/pipes/parseProjectName.pipe';
import { PagingOptionsDto } from 'src/common/pagingOptionsDto.dto';
import { PaginationUtil } from 'src/common/pagination.util';
import { PuffPointsService } from 'src/puffPoints/puffPoints.service';
import { GraphQueryService } from 'src/explorer/graphQuery.service';
import { TokenPointsDto } from './tokenPoints.dto';
import { TokenPointsWithoutDecimalsDto } from './tokenPointsWithoutDecimals.dto';
import { PointsWithoutDecimalsDto } from './pointsWithoutDecimals.dto';
import { PointsDto } from './points.dto';
import { TokensDto } from './tokens.dto';

const options = {
  // how long to live in ms
  ttl: 1000 * 60,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const ALL_PUFFER_POINTS_CACHE_KEY = 'allPufferPoints';
const TOTAL_PUFFER_POINTS_CACHE_KEY = 'totalPufferPoints';
const REAL_PUFFFER_POINTS_CACHE_KEY = 'realPufferPoints';
const RENZO_ALL_POINTS_CACHE_KEY = 'allRenzoPoints';
const PUFFER_ADDRESS_POINTS_FORWARD = 'pufferAddressPointsForward';

@ApiTags('points')
@ApiExcludeController(false)
@Controller('points')
export class PointsController implements OnModuleInit {
  private readonly logger = new Logger(PointsController.name);
  private readonly puffPointsTokenAddress: string;

  constructor(
    private readonly pointsRepository: PointsRepository,
    private readonly puffPointsService: PuffPointsService,
    private readonly renzoService: RenzoService,
    private readonly graphQueryService: GraphQueryService,
    private configService: ConfigService,
  ) {
    this.puffPointsTokenAddress = configService.get<string>(
      'puffPoints.tokenAddress',
    );
  }

  public async onModuleInit() {
    // setInterval will wait for 100s, so it's necessary to execute the loadMagpieData function once first.
    const func = async () => {
      try {
        await this.loadPointsAndTotalPoints();
      } catch (err) {
        this.logger.error("Pufferpoint init failed", err.stack);
      }
    };
    await func();
    setInterval(func, 1000 * 50);
  }

  @Get('tokens')
  @ApiOperation({ summary: 'Get all tokens' })
  public async getTokens(
    @Query('projectName', new ParseProjectNamePipe()) projectName: string,
  ): Promise<TokensDto> {
    const result = await this.graphQueryService.getAllTokenAddresses(projectName);
    return {
      errno: 0,
      errmsg: 'no error',
      data: result,
    };
  }

  @Get('renzo/points')
  @ApiOperation({ summary: 'Get renzo personal points' })
  public async getRenzoPoints(
    @Query('address', new ParseAddressPipe()) address: string,
  ): Promise<PointsDto[]> {
    const points = await this.renzoService.getPoints(address);
    const result = points.map((point: Points) => {
      const dto: PointsDto = {
        address: point.address,
        updatedAt: point.updatedAt,
        points: BigNumber(point.points.toString())
          .div(Math.pow(10, 18))
          .toFixed(6),
        tokenAddress: point.token,
      };
      return dto;
    });
    return result;
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
          points: BigNumber(point.points.toString())
            .div(Math.pow(10, 18))
            .toFixed(6),
          updated_at: point.updatedAt.getTime() / 1000,
        };
        result.push(dto);
        totalPoints += point.points;
      }

      const cachePoints: TokenPointsWithoutDecimalsDto = {
        errno: 0,
        errmsg: 'no error',
        total_points: BigNumber(totalPoints.toString())
          .div(Math.pow(10, 18))
          .toFixed(6),
        data: result,
      };
      cache.set(RENZO_ALL_POINTS_CACHE_KEY, cachePoints);
      return cachePoints;
    } catch (err) {
      this.logger.error('Get renzo all points failed', err.stack);
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
      const [allPoints, totalPoints, realPufferPoints] = this.getPointsAndTotalPoints();
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
            tokenAddress: point[0].token,
            points: new BigNumber(point[0].points.toString())
              .multipliedBy(realPufferPoints)
              .div(totalPoints.toString())
              .toFixed(6),
            balance: ((item) => {
              if (item && item.balance) {
                return BigNumber(ethers.formatEther(item.balance)).toFixed(6);
              }
              return '0';
            })(this.puffPointsService.findUserBalance(point[0].address)),
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
      const [allPoints, totalPoints, realPufferPoints] = this.getPointsAndTotalPoints();
      const allPointsFilter = allPoints.filter(
        (p) => BigNumber(p.points.toString()).comparedTo(0) > 0,
      );
      res = {
        errno: 0,
        errmsg: 'no error',
        total_points: realPufferPoints,
        data: allPointsFilter.map((p) => {
          return {
            address: p.address,
            tokenAddress: p.token,
            balance: ((item) => {
              if (item && item.balance) {
                return BigNumber(ethers.formatEther(item.balance)).toFixed(6);
              }
              return '0';
            })(this.puffPointsService.findUserBalance(p.address)),
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

  @Get('forward/puffer/zklink_point')
  public async getForwardPuffer(
    @Query('address', new ParseAddressPipe()) address: string,
  ) {
    const cacheKey = PUFFER_ADDRESS_POINTS_FORWARD+address;
    const pufReadDataCache = cache.get(
      cacheKey,
    );
    if (pufReadDataCache) {
      return pufReadDataCache;
    }
    const realData = await fetch(
      `https://quest-api.puffer.fi/puffer-quest/third/query_zklink_point?address=${address}`,
      {
        method: 'get',
        headers: {
          'Content-Type': 'application/json',
          'client-id': '08879426f59a4b038b7755b274bc19dc',
        },
      },
    );
    const pufReadData = await realData.json();
    cache.set(cacheKey, pufReadData);
    return pufReadData;
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
    const [allPoints, totalPoints, _] = this.getPointsAndTotalPoints();
    
    const allPointsFilter = allPoints.filter(
      (p) => BigNumber(p.points.toString()).comparedTo(0) > 0,
    );
    const result = allPointsFilter.map((p) => {
      return {
        address: p.address,
        updatedAt: p.updatedAt,
        tokenAddress: p.token,
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

  @Get('/allpufferpoints/paging')
  @ApiOkResponse({
    description:
      "Return paginated results of all users' PufferPoints with a decimals of 18. The rule is to add 30 points per hour.\nTiming starts from the user's first deposit, with each user having an independent timer.",
    type: TokenPointsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async allPufferPointsPaging(
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<TokenPointsDto> {
    this.logger.log('allPufferPoints');
    const [allPoints, totalPoints, _] = this.getPointsAndTotalPoints();
    const allPointsFilter = allPoints.filter(
      (p) => BigNumber(p.points.toString()).comparedTo(0) > 0,
    );
    const {page = 1, limit = 100} = pagingOptions;
    const paging = PaginationUtil.paginate(allPointsFilter, page, limit);
    const result = paging.items.map((p) => {
      return {
        address: p.address,
        updatedAt: p.updatedAt,
        tokenAddress: p.token,
        points: p.points.toString(),
      };
    });
    return {
      decimals: 18,
      tokenAddress: this.puffPointsTokenAddress,
      totalPoints: totalPoints.toString(),
      meta: paging.meta,
      result: result,
    };
  }

  @Get('/allpufferpoints2/paging')
  @ApiOkResponse({
    description:
      "Return paginated results of all users' PufferPoints. The rule is to add 30 points per hour.\nTiming starts from the user's first deposit, with each user having an independent timer.",
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "message": "Not Found", "statusCode": 404 }',
  })
  public async allPufferPointsPaging2(
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<TokenPointsWithoutDecimalsDto> {
    let res: TokenPointsWithoutDecimalsDto;
    try {
      const [allPoints, totalPoints, realPufferPoints] = this.getPointsAndTotalPoints();
      const allPointsFilter = allPoints.filter(
        (p) => BigNumber(p.points.toString()).comparedTo(0) > 0,
      );
      const {page = 1, limit = 100} = pagingOptions;
      const paging = PaginationUtil.paginate(allPointsFilter, page, limit);
      res = {
        errno: 0,
        errmsg: 'no error',
        total_points: realPufferPoints,
        meta: paging.meta,
        data: paging.items.map((p) => {
          return {
            address: p.address,
            tokenAddress: p.token,
            balance: ((item) => {
              if (item && item.balance) {
                return BigNumber(ethers.formatEther(item.balance)).toFixed(6);
              }
              return '0';
            })(this.puffPointsService.findUserBalance(p.address)),
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

  private getPointsAndTotalPoints(): [Points[], string, string]{
    let allPoints = cache.get(ALL_PUFFER_POINTS_CACHE_KEY) as Points[];
    let realPufferPoints = cache.get(REAL_PUFFFER_POINTS_CACHE_KEY) as string;
    let totalPoints = BigInt(
      (cache.get(TOTAL_PUFFER_POINTS_CACHE_KEY) as string) || 0,
    );

    return [allPoints, realPufferPoints, totalPoints.toString()];
  }

  private async loadPointsAndTotalPoints() {
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
