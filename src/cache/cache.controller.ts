import { Controller, Get, Logger, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { ParseAddressPipe } from "src/common/pipes/parseAddress.pipe";
import { SERVICE_EXCEPTION } from "../puffer/tokenPointsWithoutDecimals.dto";
import { CachePointsWithoutDecimalsDto } from "src/cache/cachePointsWithoutDecimalsDto.dto";
import { CacheService } from "src/cache/cache.service";

@ApiTags("cache")
@ApiExcludeController(false)
@Controller("cache")
export class CacheController {
  private readonly logger = new Logger(CacheController.name);

  constructor(private cacheService: CacheService) {}

  @Get("/active")
  @ApiOperation({ summary: "Get address active status(true/false)." })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAddressStatus(
    @Query("address", new ParseAddressPipe()) address: string,
  ): Promise<CachePointsWithoutDecimalsDto> {
    let result: boolean;
    try {
      result = await this.cacheService.getAddressStatus(address);
    } catch (err) {
      this.logger.error("Get address status failed", err.stack);
      return SERVICE_EXCEPTION;
    }

    return {
      errno: 0,
      errmsg: "no error",
      data: result || false,
    } as CachePointsWithoutDecimalsDto;
  }

  @Get("/bridge/latest/points")
  @ApiOperation({ summary: "Get bridge latest points." })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getBridgeLastesPoints(
    @Query("name") bridgeName: string,
  ): Promise<CachePointsWithoutDecimalsDto> {
    let result: number;
    try {
      result = await this.cacheService.getBridgeAddressNextPoints(bridgeName);
    } catch (err) {
      this.logger.error("Get address status failed", err.stack);
      return SERVICE_EXCEPTION;
    }

    return {
      errno: 0,
      errmsg: "no error",
      data: result || 5,
    } as CachePointsWithoutDecimalsDto;
  }
}
