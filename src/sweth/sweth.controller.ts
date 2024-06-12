import { Controller, Get, Logger, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { ParseAddressPipe } from "src/common/pipes/parseAddress.pipe";
import { SERVICE_EXCEPTION } from "../puffer/tokenPointsWithoutDecimals.dto";
import { ethers } from "ethers";
import { PagingOptionsDto } from "src/common/pagingOptionsDto.dto";
import { SwethReturnDto } from "./sweth.dto";
import { SwethService, PointsItem } from "./sweth.service";

@ApiTags("sweth")
@ApiExcludeController(false)
@Controller("sweth")
export class SwethController {
  private readonly logger = new Logger(SwethController.name);

  constructor(private swethService: SwethService) {}

  @Get("/points")
  @ApiOperation({ summary: "Get sweth personal points" })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getPoints(
    @Query("address", new ParseAddressPipe()) address: string,
  ): Promise<SwethReturnDto> {
    let pointsData: PointsItem;
    const now = Date.now();
    try {
      pointsData = await this.swethService.getPoints(address);
    } catch (err) {
      this.logger.error("Get sweth all points failed", err.stack);
      return SERVICE_EXCEPTION;
    }

    return {
      errno: 0,
      errmsg: "no error",
      data: pointsData
        ? [
            {
              ...pointsData,
              balance: Number(
                Number(ethers.formatEther(pointsData?.balance)).toFixed(6),
              ),
              updated_at: now,
            },
          ]
        : [],
    };
  }

  @Get("/all/points/paging")
  @ApiOperation({
    summary:
      "Get sweth paging point for all users, point are based on user token dimension",
  })
  @ApiOkResponse({
    description: "Return all users' sweth points.",
    type: SwethReturnDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getPagingSwethPoints(
    @Query() pagingOptions: PagingOptionsDto,
  ): Promise<Partial<SwethReturnDto>> {
    let pointsData: PointsItem[], totalCount: number;
    const { page = 1, limit = 100 } = pagingOptions;
    try {
      [pointsData, totalCount] = await this.swethService.getPointsList(
        page,
        limit,
      );
    } catch (err) {
      this.logger.error("Get sweth all points failed", err.stack);
      return SERVICE_EXCEPTION;
    }

    const now = Date.now();
    return {
      errno: 0,
      errmsg: "no error",
      meta: {
        currentPage: Number(page),
        itemCount: pointsData.length,
        itemsPerPage: Number(limit),
        totalItems: Number(totalCount),
        totalPages: Math.ceil(totalCount / limit),
      },
      data: pointsData.map((item) => {
        return {
          ...item,
          balance: Number(Number(ethers.formatEther(item.balance)).toFixed(6)),
          updated_at: now,
        };
      }),
    };
  }
}
