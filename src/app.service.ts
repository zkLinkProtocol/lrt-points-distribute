import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import runMigrations from './utils/runMigrations';
import { PuffPointsService } from './puffPoints/puffPoints.service';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger;

  public constructor(
    private readonly puffPointsService: PuffPointsService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.logger = new Logger(AppService.name);
  }

  public onModuleInit() {
    this.startWorkers();
  }

  public onModuleDestroy() {
    this.stopWorkers();
  }

  private startWorkers() {
    return Promise.all([this.puffPointsService.start()]);
  }

  private stopWorkers() {
    return Promise.all([this.puffPointsService.stop()]);
  }
}
