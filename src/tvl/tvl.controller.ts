import { Controller, Get, Logger } from "@nestjs/common";
import { ApiExcludeController, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ResponseDto } from "src/common/response.dto";
import { CategoryTvlDto } from "./tvl.dto";
import { TvlService } from "./tvl.service";

@ApiTags("tvl")
@ApiExcludeController(false)
@Controller("tvl")
export class TvlController {
  private readonly logger = new Logger(TvlController.name);

  constructor(private tvlService: TvlService) {}

  @Get("/category")
  @ApiOperation({ summary: "Get token personal points" })
  public async getNovaPoints(): Promise<ResponseDto<CategoryTvlDto[]>> {
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
}
