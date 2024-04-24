import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PuffPointsService } from './puffer/puffPoints.service';
import { RenzoService } from './renzo/renzo.service';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger;

  public constructor(
    private readonly puffPointsService: PuffPointsService,
    private readonly renzoService: RenzoService,
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
    const tasks = [];
    if (this.configService.get<boolean>('enablePuff')) {
      // tasks.push(this.puffPointsService.start());
    }
    if (this.configService.get<boolean>('enableRenzo')) {
      //tasks.push(this.renzoService.start());
    }
    return Promise.all(tasks);
  }

  private stopWorkers() {
    return Promise.all([
      // this.puffPointsService.stop(),
      //this.renzoService.stop(),
    ]);
  }
}
