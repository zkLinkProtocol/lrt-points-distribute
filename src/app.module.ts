import { Module, ValidationPipe } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { typeOrmModuleOptions } from "./typeorm.config";
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
import { NovaBalanceService } from "./nova/nova.balance.service";
import { CacheController } from "./cache/cache.controller";
import { CacheService } from "./cache/cache.service";

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
    TypeOrmModule.forFeature([
      Project,
      PointsOfLp,
      BlockAddressPointOfLp,
      Cache,
    ]),
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
    CacheRepository,
    CacheService,
  ],
})
export class AppModule {}
