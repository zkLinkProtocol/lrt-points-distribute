import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface NovaPoints {
  novaPoint: number;
  referPoint: number;
}

@Injectable()
export class NovaApiService {
  private readonly logger: Logger;
  private readonly novaApiBaseurl: string = "https://app-api.zklink.io/points/addressTokenTvl/getAccountPoint?address=";
  
  public constructor() {
    this.logger = new Logger(NovaApiService.name);
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
