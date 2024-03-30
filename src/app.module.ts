import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmModuleOptions } from './typeorm.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from './config';
import { Points } from './entities/points.entity';
import { PointsHistory } from './entities/pointsHistory.entity';
import { PuffPointsService } from './puffPoints/puffPoints.service';
import { PuffPointsProcessor } from './puffPoints/puffPoints.processor';
import { PointsRepository } from './repositories/points.repository';
import { MetricsModule } from './metrics';
import { UnitOfWorkModule } from './unitOfWork';
import { PointsHistoryRepository } from './repositories/pointsHistory.repository';
import { PointsController } from './controller/points.controller';
import { ExplorerService } from './explorer/explorer.service';
import { RenzoService } from './renzo/renzo.service';
import { RenzoApiService } from './explorer/renzoapi.service';
import { RenzoController } from './controller/renzo.controller';
import { GraphQueryService } from './explorer/graphQuery.service';
import { ProjectService } from './project/project.service';
import { MagpieGraphQueryService } from './magpie/magpieGraphQuery.service';
import { RsethController } from './controller/rseth.controller';
import { MagpieController } from './controller/magpie.controller';

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
    TypeOrmModule.forFeature([Points, PointsHistory]),
    MetricsModule,
    UnitOfWorkModule,
  ],
  controllers: [AppController, PointsController, RenzoController, RsethController, MagpieController],
  providers: [
    AppService,
    Points,
    PointsHistory,
    PuffPointsService,
    PuffPointsProcessor,
    PointsRepository,
    PointsHistoryRepository,
    ExplorerService,
    RenzoService,
    RenzoApiService,
    GraphQueryService,
    ProjectService,
    MagpieGraphQueryService,
  ],
})
export class AppModule {}
