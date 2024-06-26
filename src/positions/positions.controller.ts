import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiNotFoundResponse,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  GetAGXPositionDto,
  GetUserPositionsDto,
  UserPositionsResponseDto,
} from "./positions.dto";
import { PositionsService } from "./positions.service";

@ApiTags("positions")
@ApiExcludeController(false)
@Controller("positions")
export class PositionsController {
  constructor(private positionsService: PositionsService) {}

  @Get(":projectName")
  @ApiParam({
    name: "projectName",
    required: true,
    description: "Project name",
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  async getProjectPositions(
    @Param("projectName") projectName: string,
    @Query() queryParams: GetUserPositionsDto,
  ): Promise<UserPositionsResponseDto> {
    const { data, meta } =
      await this.positionsService.getPositionsByProjectAndAddress({
        projectName,
        ...queryParams,
      });

    return {
      errmsg: "no error",
      errno: 0,
      meta: meta,
      data: data,
    };
  }

  @Get("agx/etherfi")
  async getAgxUserEtherFiPositions(@Query() queryString: GetAGXPositionDto) {
    const { blockNumber } = queryString;
    const data =
      await this.positionsService.getAgxEtherfiPositionsByBlock(blockNumber);

    return data;
  }
}
