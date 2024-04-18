import { Controller, Get, Logger, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ParseAddressPipe } from 'src/common/pipes/parseAddress.pipe';
import { SERVICE_EXCEPTION } from '../puffer/tokenPointsWithoutDecimals.dto';
import { ethers } from 'ethers';
import { RsethData, RsethPointItemWithBalance, RsethPointItemWithoutBalance, RsethService } from './rseth.service';
import { PagingOptionsDto } from 'src/common/pagingOptionsDto.dto';
import { PagingMetaDto } from 'src/common/paging.dto';
import { PaginationUtil } from 'src/common/pagination.util';
import { RsethPointItem, RsethReturnDto } from './rseth.dto';

@ApiTags('rseth')
@ApiExcludeController(false)
@Controller('rseth')
export class RsethController {
  private readonly logger = new Logger(RsethController.name);

  constructor(private rsethService: RsethService) {}

  @Get('/points')
  @ApiOperation({ summary: 'Get rsETH personal points' })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getRsethPoints(
    @Query('address', new ParseAddressPipe()) address: string,
  ): Promise<RsethReturnDto> {
    let pointData: RsethData;
    try{
      pointData = await this.rsethService.getPointsData(address);
    } catch (err) {
      this.logger.error('Get rsETH all points failed', err.stack);
      return SERVICE_EXCEPTION;
    }

    return this.getReturnData(pointData.items, pointData.realTotalElPoints, pointData.realTotalKelpMiles);
  }

  @Get('/all/points')
  @ApiOperation({
    summary:
      'Get rsETH point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return all users' rsETH points.",
    type: RsethReturnDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllRsethPoints(): Promise<
    Partial<RsethReturnDto>
  > {
    let pointData: RsethData;
    try{
      pointData = await this.rsethService.getPointsData();
    } catch (err) {
      this.logger.error('Get rsETH all points failed', err.stack);
      return SERVICE_EXCEPTION;
    }

    return this.getReturnData(pointData.items, pointData.realTotalElPoints, pointData.realTotalKelpMiles);
  }

  @Get('/all/points/paging')
  @ApiOperation({
    summary:
      'Get rsETH paging point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return all users' rsETH points.",
    type: RsethReturnDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getPagingRsethPoints(
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<
    Partial<RsethReturnDto>
  > {
    let pointData: RsethData;
    try{
      pointData = await this.rsethService.getPointsData();
    } catch (err) {
      this.logger.error('Get rsETH all points failed', err.stack);
      return SERVICE_EXCEPTION;
    }

    return this.getReturnData(pointData.items, pointData.realTotalElPoints, pointData.realTotalKelpMiles, pagingOptions);
  }

  @Get('/all/points-with-balance')
  @ApiOperation({
    summary:
      'Get rsETH point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return all users' rsETH points with balance.",
    type: RsethReturnDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllRsethPointsWithBalance(): Promise<
    Partial<RsethReturnDto>
  > {
    let pointData: RsethData;
    try{
      pointData = await this.rsethService.getPointsData();
    } catch (err) {
      this.logger.error('Get rsETH all points failed', err.stack);
      return SERVICE_EXCEPTION;
    }

    return this.getReturnData(pointData.items, pointData.realTotalElPoints, pointData.realTotalKelpMiles);
  }

  @Get('/all/points-with-balance/paging')
  @ApiOperation({
    summary:
      'Get rsETH paging point for all users, point are based on user token dimension',
  })
  @ApiOkResponse({
    description: "Return all users' rsETH points with balance.",
    type: RsethReturnDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getPagingRsethPointsWithBalance(
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<
    Partial<RsethReturnDto>
  > {
    let pointData: RsethData;
    try{
      pointData = await this.rsethService.getPointsData();
    } catch (err) {
      this.logger.error('Get rsETH all points failed', err.stack);
      return SERVICE_EXCEPTION;
    }

    return this.getReturnData(pointData.items, pointData.realTotalElPoints, pointData.realTotalKelpMiles, pagingOptions);
  }

  private getReturnData(
    finalPoints: RsethPointItemWithBalance[] | RsethPointItemWithoutBalance[],
    finnalTotalElPoints: number,
    finnalTotalKelpMiles: number,
    pagingOptions?: PagingOptionsDto
  ): RsethReturnDto{
    let list = finalPoints;
    let meta: PagingMetaDto;
    if(null != pagingOptions){
      const {page = 1, limit = 100} = pagingOptions;
      const paging = PaginationUtil.paginate(list, page, limit);
      list = paging.items;
      meta = paging.meta;
    }
    let result = {
      errno: 0,
      errmsg: 'no error',
      points: {
        elPoints: finnalTotalElPoints.toString(),
        kelpMiles: finnalTotalKelpMiles.toString()
      },
      data: list.map(item => {
        return item.tokenAddress ?
          {
            address: item.address,
            tokenAddress: item.tokenAddress,
            balance: Number(ethers.formatEther(item.balance)).toFixed(6),
            points:{
              elPoints: item.realElPoints.toString(),
              kelpMiles: item.realKelpMiles.toString()
            },
            updated_at: item.updatedAt
          } as RsethPointItem
        :
          {
            address: item.address,
            points:{
              elPoints: item.realElPoints.toString(),
              kelpMiles: item.realKelpMiles.toString()
            },
            updated_at: item.updatedAt
          } as RsethPointItem;
      })
    };
    if(meta){
      result["meta"] = meta;
    }
    return result as RsethReturnDto;
  }
}
