import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StatisticService } from "./statistic.service";
import { StatisticController } from "./statistic.controller";
import { ProtocolDau } from "src/entities/dau.entity";
import { BalanceOfLp } from "src/entities/balanceOfLp.entity";
import { Project } from "src/entities/project.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([ProtocolDau, BalanceOfLp, Project]),
    ScheduleModule.forRoot(),
  ],
  providers: [StatisticService],
  controllers: [StatisticController],
})
export class StatisticModule {}
