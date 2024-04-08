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
import {
  NOT_FOUND_EXCEPTION,
  SERVICE_EXCEPTION,
} from './tokenPointsWithoutDecimals.dto';
import { NovaPointsWithoutDecimalsDto } from 'src/nova/novaPointsWithoutDecimalsDto.dto';
import { NovaService } from 'src/nova/nova.service';
import { NovaApiService, NovaPoints } from 'src/nova/novaapi.service';
import { BigNumber } from 'bignumber.js';

const options = {
  // how long to live in ms
  ttl: 1000 * 20,
  // return stale items before removing from cache?
  allowStale: false,
  ttlAutopurge: true,
};

const cache = new LRUCache(options);
const NOVA_ALL_POINTS_CACHE_KEY = 'allNovaPoints';
const NOVA_ALL_POINTS_WITH_BALANCE_CACHE_KEY = 'allNovaPointsWithBalance';

@ApiTags('nova')
@ApiExcludeController(false)
@Controller('nova')
export class NovaController {
  private readonly logger = new Logger(NovaController.name);

  constructor(
    private novaService: NovaService, 
    private novaApiService: NovaApiService
  ) {}

  @Get('/points')
  @ApiOperation({ summary: 'Get token personal points' })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getNovaPoints(
    @Query('address', new ParseAddressPipe()) address: string
  ): Promise<NovaPointsWithoutDecimalsDto> {
    let finalPoints: any[], finalTotalPoints: bigint;
    try{
      const pointData = await this.novaService.getAllTokensPoints(address);
      finalPoints = pointData.finalPoints;
      finalTotalPoints = pointData.finalTotalPoints;
    } catch (err) {
      this.logger.error('Get nova all points failed', err.stack);
      return SERVICE_EXCEPTION;
    }
    if(!finalPoints || !finalTotalPoints){
      return NOT_FOUND_EXCEPTION
    }

    return {
      errno: 0,
      errmsg: 'no error',
      total_points: finalTotalPoints.toString(),
      data: finalPoints.map(point => {
        point.points = BigNumber(ethers.formatEther(point.points)).toFixed(6);
        point.balance = BigNumber(ethers.formatEther(point.balance)).toFixed(6);
        return point;
      }),
    } as NovaPointsWithoutDecimalsDto;
  }

  @Get('/points/token')
  @ApiOperation({ summary: 'Get all token personal points' })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getNovaTokenPoints(
    @Query('address', new ParseAddressPipe()) address: string,
    @Query('tokenAddress', new ParseAddressPipe()) tokenAddress: string,
  ): Promise<NovaPointsWithoutDecimalsDto> {
    let finalPoints: any[], finalTotalPoints: bigint;
    try{
      const pointData = await this.novaService.getPoints(tokenAddress, address);
      finalPoints = pointData.finalPoints;
      finalTotalPoints = pointData.finalTotalPoints;
    } catch (err) {
      this.logger.error('Get nova all points failed', err.stack);
      return SERVICE_EXCEPTION;
    }
    if(!finalPoints || !finalTotalPoints){
      return NOT_FOUND_EXCEPTION
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
    return this.getReturnData(finalPoints, finalTotalPoints, points.novaPoint);
  }

  @Get('/all/points')
  @ApiOperation({
    summary:
      'Get nova point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return all users' nova points.",
    type: NovaPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllNovaPoints(
    @Query('tokenAddress', new ParseAddressPipe()) tokenAddress: string,
  ): Promise<Partial<NovaPointsWithoutDecimalsDto>> {
    const cacheKey = NOVA_ALL_POINTS_CACHE_KEY + tokenAddress;
    const allPoints = cache.get(
      cacheKey,
    ) as NovaPointsWithoutDecimalsDto;
    if (allPoints) {
      return allPoints;
    }

    let cacheData: NovaPointsWithoutDecimalsDto, finalPoints: any[], finalTotalPoints: bigint;
    try{
      const pointData = await this.novaService.getAllPoints(tokenAddress);
      finalPoints = pointData.finalPoints;
      finalTotalPoints = pointData.finalTotalPoints;
    } catch (err) {
      this.logger.error('Get nova all points failed', err);
      this.logger.error(err.message, err.stack);
      return SERVICE_EXCEPTION;
    }
    if(!finalPoints || !finalTotalPoints){
      return NOT_FOUND_EXCEPTION
    }

    // Get real points.
    let points: NovaPoints;
    try{
      points = await this.novaApiService.getNovaPoint(tokenAddress);
    } catch (err) {
      this.logger.error('Get nova real points failed', err);
      this.logger.error(err.message, err.stack);
      return SERVICE_EXCEPTION;
    }
    if(!points){
      return NOT_FOUND_EXCEPTION;
    }
    cacheData = this.getReturnData(finalPoints, finalTotalPoints, points.novaPoint);
    cache.set(cacheKey, cacheData);
    return cacheData;
  }

  @Get('/all/points-with-balance')
  @ApiOperation({
    summary:
      'Get nova point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return all users' nova points with balance.",
    type: NovaPointsWithoutDecimalsDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllNovaPointsWithBalance(
    @Query('tokenAddress', new ParseAddressPipe()) tokenAddress: string,
  ): Promise<Partial<NovaPointsWithoutDecimalsDto>> {
    const cacheKey = NOVA_ALL_POINTS_WITH_BALANCE_CACHE_KEY + tokenAddress;
    const allPoints = cache.get(
      cacheKey,
    ) as NovaPointsWithoutDecimalsDto;
    if (allPoints) {
      return allPoints;
    }

    let cacheData: NovaPointsWithoutDecimalsDto, finalPoints: any[], finalTotalPoints: bigint;
    try{
      const pointData = await this.novaService.getAllPointsWithBalance(tokenAddress);
      finalPoints = pointData.finalPoints;
      finalTotalPoints = pointData.finalTotalPoints;
    } catch (err) {
      this.logger.error('Get nova all points failed', err.stack);
      return SERVICE_EXCEPTION;
    }
    if(!finalPoints || !finalTotalPoints){
      return NOT_FOUND_EXCEPTION
    }

    // Get real points.
    let points: NovaPoints;
    try{
      points = await this.novaApiService.getNovaPoint(tokenAddress);
    } catch (err) {
      this.logger.error('Get nova real points failed', err);
      this.logger.error(err.message, err.stack);
      return SERVICE_EXCEPTION;
    }
    if(!points){
      return NOT_FOUND_EXCEPTION;
    }
    cacheData = this.getReturnData(finalPoints, finalTotalPoints, points.novaPoint);
    cache.set(cacheKey, cacheData);
    return cacheData;
  }

  private getReturnData(
    finalPoints: any[],
    finnalTotalPoints: bigint,
    novaPoint: number,
  ): NovaPointsWithoutDecimalsDto {
    return {
      errno: 0,
      errmsg: 'no error',
      total_points: novaPoint.toString(),
      data: finalPoints.map(point => {
        const tmpPoints = point.points;
        point.points = this.novaService.getRealPoints(tmpPoints, finnalTotalPoints, novaPoint);
        return point;
      })
    } as NovaPointsWithoutDecimalsDto;
  }
}
