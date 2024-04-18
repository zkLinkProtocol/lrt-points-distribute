import { Controller, Get, Logger, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ethers } from 'ethers';
import { ParseAddressPipe } from 'src/common/pipes/parseAddress.pipe';
import { NOT_FOUND_EXCEPTION, SERVICE_EXCEPTION } from '../puffer/tokenPointsWithoutDecimals.dto';
import { MagiePointsWithoutDecimalsDto, PointsWithoutDecimalsDto } from 'src/magpie/magiePointsWithoutDecimalsDto.dto';
import { MagpieData, MagpiePointItemWithBalance, MagpiePointItemWithoutBalance, MagpieService } from './magpie.service';
import { PagingOptionsDto } from 'src/common/pagingOptionsDto.dto';
import { PaginationUtil } from 'src/common/pagination.util';
import { PagingMetaDto } from 'src/common/paging.dto';

@ApiTags('magpie')
@ApiExcludeController(false)
@Controller('magpie')
export class MagpieController {
  private readonly logger = new Logger(MagpieController.name);

  constructor( private magpieService: MagpieService ) {}

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
  ): Promise<MagiePointsWithoutDecimalsDto> {
    let pointData: MagpieData;
    try{
      pointData = await this.magpieService.getPointsData(address);
    } catch (err) {
      this.logger.error('Get magpie all points failed', err);
      return SERVICE_EXCEPTION;
    }
    return this.getReturnData(pointData.items, pointData.realTotalEigenpiePoints, pointData.realTotalEigenLayerPoints);
  }

  @Get('/all/points')
  @ApiOperation({
    summary:
      'Get magpie point for all users, point are based on user token dimension',
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
  public async getAllMagpiePoints(): Promise<
    Partial<MagiePointsWithoutDecimalsDto>
  > {
    let pointData: MagpieData;
    try{
      pointData = await this.magpieService.getPointsDataGroupByAddress();
    } catch (err) {
      this.logger.error('Get magpie all points failed', err);
      return SERVICE_EXCEPTION;
    }
    return this.getReturnData(pointData.items, pointData.realTotalEigenpiePoints, pointData.realTotalEigenLayerPoints);
  }

  @Get('/all/points/paging')
  @ApiOperation({
    summary:
      'Get magpie point for all users, point are based on user token dimension',
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
  public async getPagingMagpiePoints(
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<
    Partial<MagiePointsWithoutDecimalsDto>
  > {
    let pointData: MagpieData;
    try{
      pointData = await this.magpieService.getPointsDataGroupByAddress();
    } catch (err) {
      this.logger.error('Get magpie all points failed', err);
      return SERVICE_EXCEPTION;
    }
    return this.getReturnData(pointData.items, pointData.realTotalEigenpiePoints, pointData.realTotalEigenLayerPoints, pagingOptions);
  }

  @Get('/all/points-with-balance')
  @ApiOperation({
    summary:
      'Get magpie point for all users, point are based on user token dimension',
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
  public async getAllMagpiePointsWithBalance(): Promise<
    Partial<MagiePointsWithoutDecimalsDto>
  > {
    let pointData: MagpieData;
    try{
      pointData = await this.magpieService.getPointsData();
    } catch (err) {
      this.logger.error('Get magpie all points failed', err);
      return SERVICE_EXCEPTION;
    }
    return this.getReturnData(pointData.items, pointData.realTotalEigenpiePoints, pointData.realTotalEigenLayerPoints);
  }

  @Get('/all/points-with-balance/paging')
  @ApiOperation({
    summary:
      'Get paging magpie point for all users, point are based on user token dimension',
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
  public async getPagingMagpiePointsWithBalance(
    @Query() pagingOptions: PagingOptionsDto
  ): Promise<
    Partial<MagiePointsWithoutDecimalsDto>
  > {
    let pointData: MagpieData;
    try{
      pointData = await this.magpieService.getPointsData();
    } catch (err) {
      this.logger.error('Get magpie all points failed', err);
      return SERVICE_EXCEPTION;
    }
    return this.getReturnData(pointData.items, pointData.realTotalEigenpiePoints, pointData.realTotalEigenLayerPoints, pagingOptions);
  }

  private getReturnData(
    finalPoints: MagpiePointItemWithBalance[] | MagpiePointItemWithoutBalance[],
    eigenpiePoints: bigint,
    eigenLayerPoints: bigint,
    pagingOptions?: PagingOptionsDto
  ): MagiePointsWithoutDecimalsDto {
    let list = finalPoints;
    let meta: PagingMetaDto;
    if(undefined != pagingOptions){
      const {page = 1, limit = 100} = pagingOptions;
      const paging = PaginationUtil.paginate(finalPoints, page, limit);
      list = paging.items;
      meta = paging.meta;
    }
    const res =  {
      errno: 0,
      errmsg: 'no error',
      totals: {
        eigenpiePoints: Number(ethers.formatEther(eigenpiePoints)).toFixed(6),
        eigenLayerPoints: Number(ethers.formatEther(eigenLayerPoints)).toFixed(6),
      },
      data: finalPoints.map(item => {
        return  item.tokenAddress ?
           {
            address: item.address,
            tokenAddress: item.tokenAddress,
            balance: Number(ethers.formatEther(item.balance)).toFixed(6),
            points:{
              eigenpiePoints: Number(ethers.formatEther(item.realEigenpiePoints)).toFixed(6),
              eigenLayerPoints: Number(ethers.formatEther(item.realEigenLayerPoints)).toFixed(6)
            },
            updated_at: item.updatedAt
          } as PointsWithoutDecimalsDto
        :
           {
            address: item.address,
            points:{
              eigenpiePoints: Number(ethers.formatEther(item.realEigenpiePoints)).toFixed(6),
              eigenLayerPoints: Number(ethers.formatEther(item.realEigenLayerPoints)).toFixed(6)
            },
            updated_at: item.updatedAt
          } as PointsWithoutDecimalsDto;
      })
    };
    if(meta){
      res["meta"] = meta;
    }
    return res as MagiePointsWithoutDecimalsDto;
  }
}