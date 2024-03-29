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
import { MagpieGraphQueryService } from 'src/magpie/magpieGraphQuery.service';
import { ethers } from 'ethers';

const options = {
  // how long to live in ms
  ttl: 1000 * 10,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const MAGPIE_ALL_POINTS_CACHE_KEY = 'allMagpiePoints';
const MAGPIE_ALL_POINTS_WITH_BALANCE_CACHE_KEY = 'allMagpiePointsWithBalance';
const GRAPH_QUERY_PROJECT_ID = 'magpie';

@ApiTags('magpie')
@ApiExcludeController(false)
@Controller('magpie')
export class MagpieController {
  private readonly logger = new Logger(MagpieController.name);

  constructor(
    private projectService: ProjectService, 
    private magpieGraphQueryService: MagpieGraphQueryService
  ) {}

  @Get('/points')
  @ApiOperation({ summary: 'Get magpie personal points' })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getMagpiePoints(
    @Query('address', new ParseAddressPipe()) address: string,
  ): Promise<TokenPointsWithoutDecimalsDto> {
    let finalPoints: any[], finalTotalPoints: bigint;
    try{
      [finalPoints, finalTotalPoints] = await this.projectService.getPoints(GRAPH_QUERY_PROJECT_ID, address);
    } catch (err) {
      this.logger.error('Get magpie all points failed', err);
      return SERVICE_EXCEPTION;
    }
    if(!finalPoints || !finalTotalPoints){
      return NOT_FOUND_EXCEPTION
    }

    // Get real points.
    const [eigenpiePoints, eigenLayerPoints] = this.magpieGraphQueryService.getTotalPoints();

    return this.getReturnData(finalPoints, finalTotalPoints, eigenpiePoints, eigenLayerPoints);
  }

  @Get('/all/points')
  @ApiOperation({
    summary:
      'Get magpie point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return all users' magpie points.",
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllMagpiePoints(): Promise<
    Partial<TokenPointsWithoutDecimalsDto>
  > {
    const allPoints = cache.get(
      MAGPIE_ALL_POINTS_CACHE_KEY,
    ) as TokenPointsWithoutDecimalsDto;
    if (allPoints) {
      return allPoints;
    }

    let cacheData: TokenPointsWithoutDecimalsDto, finalPoints: any[], finalTotalPoints: bigint;
    try{
      [finalPoints, finalTotalPoints] = await this.projectService.getAllPoints(GRAPH_QUERY_PROJECT_ID);
    } catch (err) {
      this.logger.error('Get magpie all points failed', err);
      return SERVICE_EXCEPTION;
    }
    if(!finalPoints || !finalTotalPoints){
      return NOT_FOUND_EXCEPTION
    }

    // Get real points.
    const [eigenpiePoints, eigenLayerPoints] = this.magpieGraphQueryService.getTotalPoints();
    cacheData = this.getReturnData(finalPoints, finalTotalPoints, eigenpiePoints, eigenLayerPoints);
    cache.set(MAGPIE_ALL_POINTS_CACHE_KEY, cacheData);
    return cacheData;
  }

  @Get('/all/points-with-balance')
  @ApiOperation({
    summary:
      'Get magpie point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return all users' magpie points with balance.",
    type: TokenPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllMagpiePointsWithBalance(): Promise<
    Partial<TokenPointsWithoutDecimalsDto>
  > {
    const allPoints = cache.get(
      MAGPIE_ALL_POINTS_WITH_BALANCE_CACHE_KEY,
    ) as TokenPointsWithoutDecimalsDto;
    if (allPoints) {
      return allPoints;
    }

    let cacheData: TokenPointsWithoutDecimalsDto, finalPoints: any[], finalTotalPoints: bigint;
    try{
      [finalPoints, finalTotalPoints] = await this.projectService.getAllPointsWithBalance(GRAPH_QUERY_PROJECT_ID);
    } catch (err) {
      this.logger.error('Get magpie all points failed', err);
      return SERVICE_EXCEPTION;
    }
    if(!finalPoints || !finalTotalPoints){
      return NOT_FOUND_EXCEPTION
    }

    // Get real points.
    const [eigenpiePoints, eigenLayerPoints] = this.magpieGraphQueryService.getTotalPoints();
    cacheData = this.getReturnData(finalPoints, finalTotalPoints, eigenpiePoints, eigenLayerPoints);
    cache.set(MAGPIE_ALL_POINTS_WITH_BALANCE_CACHE_KEY, cacheData);
    return cacheData;
  }

  private getReturnData(
    finalPoints: any[],
    finnalTotalPoints: bigint,
    eigenpiePoints: bigint,
    eigenLayerPoints: bigint,
  ){
    return {
      errno: 0,
      errmsg: 'no error',
      totals: {
        eigenpiePoints: ethers.formatEther(eigenpiePoints),
        eigenLayerPoints: ethers.formatEther(eigenLayerPoints),
      },
      data: finalPoints.map(point => {
        const tmpPoints = point.points;
        point.points = {
          eigenpiePoints: ethers.formatEther(this.projectService.getRealPoints(tmpPoints, finnalTotalPoints, eigenpiePoints)),
          eigenLayerPoints: ethers.formatEther(this.projectService.getRealPoints(tmpPoints, finnalTotalPoints, eigenLayerPoints)),
        };
        return point;
      })
    };
  }
}
