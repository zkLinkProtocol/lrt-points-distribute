import { Controller, Get, Logger, Query } from "@nestjs/common";
import { ApiExcludeController, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ResponseDto } from "src/common/response.dto";
import { CategoryMilestoneDto, CategoryTvlDto } from "./tvl.dto";
import { TvlService } from "./tvl.service";
import s2_1Milestone from "../config/season2-1.milestone";
import { ParseNumberPipe } from "src/common/pipes/parseNumber.pipe";
import { NovaBalanceService } from "src/nova/nova.balance.service";

@ApiTags("tvl")
@ApiExcludeController(false)
@Controller("tvl")
export class TvlController {
  private readonly logger = new Logger(TvlController.name);

  constructor(
    private tvlService: TvlService,
    private readonly novaBalanceService: NovaBalanceService,
  ) {}

  @Get("/category")
  @ApiOperation({ summary: "Retrieve tvl of the project category" })
  public async getCategoryTvl(): Promise<ResponseDto<CategoryTvlDto[]>> {
    const data = await this.tvlService.getCategoryTvl();
    return {
      errno: 0,
      errmsg: "no error",
      data: data.map((item) => {
        return {
          name: item.name,
          tvl: item.tvl.toFixed(4),
        };
      }),
    };
  }

  @Get("/category/milestone")
  @ApiOperation({ summary: "Retrieve milestone of the project category" })
  public async getCategoryMilestone(): Promise<
    ResponseDto<CategoryMilestoneDto[]>
  > {
    const data = await this.tvlService.getCategoryMilestone();
    return {
      errno: 0,
      errmsg: "no error",
      data: data.map((item) => {
        return {
          name: item.name,
          data: item.data.toFixed(4),
          type: item.type,
        };
      }),
    };
  }

  @Get("/category/milestone/s2-1")
  @ApiOperation({ summary: "Retrieve milestone of the s2-1 project category" })
  public async getCategoryMilestoneS2_1(): Promise<
    ResponseDto<CategoryMilestoneDto[]>
  > {
    const data = s2_1Milestone;
    return {
      errno: 0,
      errmsg: "no error",
      data: data.map((item) => {
        return {
          name: item.name,
          data: item.data.toFixed(4),
          type: item.type,
          zkl: item.zkl,
        };
      }),
    };
  }

  @Get("/category/milestone/season")
  @ApiOperation({
    summary: "Retrieve milestone of the season project category",
  })
  public async getCategoryMilestoneSeason(
    @Query("season", new ParseNumberPipe(4)) season: number,
  ): Promise<ResponseDto<CategoryMilestoneDto[]>> {
    const data = this.novaBalanceService.getSeasonCategoryMilestone(season);

    return {
      errno: 0,
      errmsg: "no error",
      data: data.map((item) => {
        return {
          name: item.name,
          data: item.data.toFixed(4),
          type: item.type,
          zkl: item.zkl,
        };
      }),
    };
  }
}
