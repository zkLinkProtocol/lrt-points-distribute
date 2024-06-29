import { Module } from "@nestjs/common";
import { MetricsModule } from "../metrics";
import { UnitOfWork, ReferralUnitOfWork } from "./unitOfWork.provider";

@Module({
  imports: [MetricsModule],
  providers: [UnitOfWork, ReferralUnitOfWork],
  exports: [UnitOfWork, ReferralUnitOfWork],
})
export class UnitOfWorkModule {}
