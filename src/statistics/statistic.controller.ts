import { StatisticService } from "./statistic.service";
import { Controller, Get, Logger, Query } from "@nestjs/common";
import {
  ApiExcludeController,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { ProtocolDau } from "src/entities/dau.entity";
import { Between, Repository } from "typeorm";

@ApiTags("statistic")
@ApiExcludeController(false)
@Controller("statistic")
export class StatisticController {
  private readonly logger = new Logger(StatisticController.name);

  constructor(
    @InjectRepository(ProtocolDau)
    private readonly protocolDauRepository: Repository<ProtocolDau>,
    private readonly statisticService: StatisticService,
  ) {}

  @Get("/protocol/dau")
  @ApiQuery({ name: "name", type: String, required: false })
  @ApiOperation({ summary: "get protocol dau" })
  public async getProtocolDau(
    @Query("page") page: number = 1,
    @Query("size") size: number = 30,
    @Query("name") name?: string,
  ) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - page * size);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1 - (page - 1) * size);

    const data = await this.protocolDauRepository.find({
      where: {
        name,
        date: Between(startDate, endDate),
      },
      order: {
        date: "desc",
      },
    });
    return {
      errno: 0,
      errmsg: "no error",
      data,
    };
  }

  @Get("/protocol/test")
  public async test() {
    await this.statisticService.statisticHistoryProtocolDau();
    return {
      errno: 0,
      errmsg: "no error",
    };
  }

  @Get("/protocol/abc")
  public async abc() {
    await this.statisticService.statisticProtocolDau();
    return {
      errno: 0,
      errmsg: "no error",
    };
  }
}
