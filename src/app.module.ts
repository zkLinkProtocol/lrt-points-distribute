import { Module, ValidationPipe } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  typeOrmModuleOptions,
  typeOrmReferModuleOptions,
} from "./typeorm.config";
import { ConfigModule } from "@nestjs/config";
import config from "./config";
import { PuffPointsService } from "./puffer/puffPoints.service";
import { MetricsModule } from "./metrics";
import { UnitOfWorkModule } from "./unitOfWork";
import { PointsController } from "./puffer/points.controller";
import { ExplorerService } from "./common/service/explorer.service";
import { RenzoService } from "./renzo/renzo.service";
import { RenzoApiService } from "./renzo/renzoapi.service";
import { RenzoController } from "./renzo/renzo.controller";
import { GraphQueryService } from "./common/service/graphQuery.service";
import { ProjectService } from "./common/service/project.service";
import { MagpieGraphQueryService } from "./magpie/magpieGraphQuery.service";
import { RsethController } from "./rseth/rseth.controller";
import { MagpieController } from "./magpie/magpie.controller";
import { NovaApiService } from "./nova/novaapi.service";
import { NovaService } from "./nova/nova.service";
import { NovaController } from "./nova/nova.controller";
import { RenzoPagingController } from "./renzo/renzo.paging.controller";
import { NovaPagingController } from "./nova/nova.paging.controller";
import { ProjectGraphService } from "./common/service/projectGraph.service";
import { WithdrawService } from "./common/service/withdraw.service";
import { MagpieService } from "./magpie/magpie.service";
import { RsethApiService } from "./rseth/rseth.api.service";
import { RsethService } from "./rseth/rseth.service";
import { Project } from "./entities/project.entity";
import { ProjectRepository } from "./repositories/project.repository";
import { PointsOfLp } from "./entities/pointsOfLp.entity";
import { PointsOfLpRepository } from "./repositories/pointsOfLp.repository";
import { BlockAddressPointOfLp } from "./entities/blockAddressPointOfLp.entity";
import { BlockAddressPointOfLpRepository } from "./repositories/blockAddressPointOfLp.repository";
import { Cache } from "./entities/cache.entity";
import { CacheRepository } from "./repositories/cache.repository";
import { BalanceOfLp } from "./entities/balanceOfLp.entity";
import { RedistributeBalance } from "./entities/redistributeBalance.entity";
import { BalanceOfLpRepository } from "./repositories/balanceOfLp.repository";
import { NovaBalanceService } from "./nova/nova.balance.service";
import { CacheController } from "./cache/cache.controller";
import { CacheService } from "./cache/cache.service";
import { RedistributeBalanceRepository } from "./repositories/redistributeBalance.repository";
import { SwethController } from "./sweth/sweth.controller";
import { SwethService } from "./sweth/sweth.service";
import { SwethApiService } from "./sweth/sweth.api.service";
import {
  Referral,
  User,
  UserHolding,
  UserStaked,
  UserWithdraw,
  SeasonTotalPoint,
} from "./entities/index";
import { PositionsService } from "./positions/positions.service";
import { PositionsController } from "./positions/positions.controller";
import { TvlController } from "./tvl/tvl.controller";
import { TvlService } from "./tvl/tvl.service";
import { TxDataOfPointsRepository } from "./repositories/txDataOfPoints.repository";
import { ReferralService } from "./referral/referral.service";
import { ReferralRepository } from "./repositories/referral.repository";
import { SeasonTotalPointRepository } from "./repositories/seasonTotalPoint.repository";
import { SupplementPointRepository } from "./repositories/supplementPoint.repository";
import { supplementPoint } from "./entities/supplementPoint.entity";
import { StatisticController } from "./statistics/statistic.controller";
import { ProtocolDau } from "./entities/dau.entity";
import { BlockTokenPrice } from "./entities/blockTokenPrice.entity";
import { ExportAllUserSeaonPoint } from "./data/exportAllUserSeaonPoint";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => {
        return {
          ...typeOrmModuleOptions,
          autoLoadEntities: true,
          retryDelay: 3000, // to cover 3 minute DB failover window
          retryAttempts: 70, // try to reconnect for 3.5 minutes,
        };
      },
    }),
    TypeOrmModule.forRootAsync({
      name: "referral",
      imports: [ConfigModule],
      useFactory: () => {
        return {
          ...typeOrmReferModuleOptions,
          autoLoadEntities: true,
          retryDelay: 3000, // to cover 3 minute DB failover window
          retryAttempts: 70, // try to reconnect for 3.5 minutes,
        };
      },
    }),
    TypeOrmModule.forFeature([
      Project,
      PointsOfLp,
      ProtocolDau,
      BlockTokenPrice,
      BlockAddressPointOfLp,
      Cache,
      BalanceOfLp,
      RedistributeBalance,
      User,
      UserHolding,
      UserStaked,
      UserWithdraw,
      SeasonTotalPoint,
      supplementPoint,
    ]),
    TypeOrmModule.forFeature([Referral], "referral"),
    MetricsModule,
    UnitOfWorkModule,
  ],
  controllers: [
    AppController,
    PointsController,
    RenzoController,
    RsethController,
    MagpieController,
    NovaController,
    RenzoPagingController,
    NovaPagingController,
    CacheController,
    SwethController,
    PositionsController,
    TvlController,
    StatisticController,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    PointsController,
    AppService,
    GraphQueryService,
    PuffPointsService,
    ExplorerService,
    RenzoService,
    RenzoApiService,
    ProjectService,
    MagpieGraphQueryService,
    NovaApiService,
    NovaService,
    ProjectGraphService,
    WithdrawService,
    MagpieService,
    RsethApiService,
    RsethService,
    NovaBalanceService,
    ProjectRepository,
    PointsOfLpRepository,
    BlockAddressPointOfLpRepository,
    BalanceOfLpRepository,
    CacheRepository,
    CacheService,
    RedistributeBalanceRepository,
    SwethService,
    SwethApiService,
    PositionsService,
    TvlService,
    TxDataOfPointsRepository,
    ReferralService,
    ReferralRepository,
    SeasonTotalPointRepository,
    SupplementPointRepository,
    ExportAllUserSeaonPoint,
  ],
})
export class AppModule {}
