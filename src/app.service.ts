import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { PuffPointsService } from "./puffer/puffPoints.service";
import { RenzoService } from "./renzo/renzo.service";
import { MagpieService } from "./magpie/magpie.service";
import { RsethService } from "./rseth/rseth.service";
import { GraphQueryService } from "./common/service/graphQuery.service";
import { SwethService } from "./sweth/sweth.service";
import { NovaBalanceService } from "./nova/nova.balance.service";

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger;

  public constructor(
    private readonly puffPointsService: PuffPointsService,
    private readonly renzoService: RenzoService,
    private readonly magpieService: MagpieService,
    private readonly rsethService: RsethService,
    private readonly swethService: SwethService,
    private readonly graphQueryService: GraphQueryService,
    private readonly novaBalanceService: NovaBalanceService,
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
    return Promise.all([
      this.graphQueryService.start(),
      this.puffPointsService.start(),
      this.renzoService.start(),
      this.magpieService.start(),
      this.rsethService.start(),
      // this.swethService.start(),
      this.novaBalanceService.start(),
    ]);
  }

  private stopWorkers() {
    return Promise.all([
      this.puffPointsService.stop(),
      this.renzoService.stop(),
      this.magpieService.stop(),
      this.rsethService.stop(),
      // this.swethService.stop(),
      this.graphQueryService.stop(),
      this.novaBalanceService.stop(),
    ]);
  }
}
