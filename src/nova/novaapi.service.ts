import { Injectable, Logger } from '@nestjs/common';
import {
  GraphQueryService,
} from 'src/explorer/graphQuery.service';

export interface NovaPoints {
  novaPoint: number;
  referPoint: number;
}

@Injectable()
export class NovaApiService {
  private readonly logger: Logger;
  private readonly novaApiBaseurl: string = "https://app-api.zklink.io/points/addressTokenTvl/getAccountPoint?address=";
  private readonly graphQueryService: GraphQueryService;
  private readonly projectName: string = "nova";
  private tokenNovaPoints: Map<String, NovaPoints> = new Map();

  public constructor(graphQueryService: GraphQueryService) {
    this.logger = new Logger(NovaApiService.name);
    this.graphQueryService = graphQueryService;
  }

  public async onModuleInit(){
    this.logger.log('NovaApiService has been initialized.');
    const func = async () => {
      try {
        await this.loadData();
      } catch (error) {
        this.logger.error("NovaApiService init failed", error);
        this.logger.error(error.message, error.stack);
      }
    };
    await func();
    setInterval(func, 1000 * 10);
  }

  public async loadData(){
    const tokenAddress = this.graphQueryService.getAllTokenAddresses(this.projectName);
    for (const key in tokenAddress) {
      this.tokenNovaPoints.set(tokenAddress[key], await this.fetchNovaPoints(tokenAddress[key]));
    }
  }

  public getNovaPoint(tokenAddress: String): NovaPoints{
    return this.tokenNovaPoints.get(tokenAddress);
  }

  public async fetchNovaPoints(tokenAddress: string): Promise<NovaPoints> {
    this.logger.debug(`start fetchNovaPoints tokenAddress: ${tokenAddress}`);
    const responseStr = await fetch(`${this.novaApiBaseurl}${tokenAddress}`, {
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.logger.debug(`end fetchNovaPoints tokenAddress: ${tokenAddress}`);
    const response = await responseStr.json();
    if (!response || response.status != "1" || !response.result) {
      this.logger.error(`No nova realpoints, tokenAddress: ${tokenAddress}`);
      return { novaPoint: 0, referPoint: 0 };
    }
    const points = response.result;
    if (!points || !points.novaPoint) {
      this.logger.error(`No nova realpoints, tokenAddress: ${tokenAddress}`);
      return { novaPoint: 0, referPoint: 0 };
    }

    return {
      novaPoint: points.novaPoint,
      referPoint: points.referPoint,
    } as NovaPoints;
  }
}
