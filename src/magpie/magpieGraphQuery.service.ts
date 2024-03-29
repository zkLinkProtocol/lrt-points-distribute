import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MagpieGraphTotalPoint {
  id: string;
  eigenpiePoints: bigint;
  eigenLayerPoints: bigint;
}

@Injectable()
export class MagpieGraphQueryService implements OnModuleInit {
  private readonly logger: Logger;
  private readonly magpiePointRedistributeGraphApi: string;
  private readonly magpieUserinfoId: string;

  private eigenpiePoints: bigint = BigInt(0);
  private eigenLayerPoints: bigint = BigInt(0);
  
  public constructor(configService: ConfigService) {
    this.logger = new Logger(MagpieGraphQueryService.name);
    this.magpieUserinfoId = configService.get<string>(
      'magpie.magpieUserinfoId',
    );
    this.magpiePointRedistributeGraphApi = configService.get<string>(
      'magpie.magpiePointRedistributeGraphApi',
    );
  }

  public async onModuleInit() {
    // setInterval will wait for 100s, so it's necessary to execute the loadMagpieData function once first.
    this.loadMagpieData();
    setInterval(() => {
      this.loadMagpieData();
    }, 100000);
  }

  public async loadMagpieData() {
    this.logger.log('loadMagpieData has been load.');
    const query = `
{
  userInfo(id:"${this.magpieUserinfoId}") {
    id
    eigenpiePoints
    eigenLayerPoints
  }
}
    `;
    const data = await this.query(query);
    if (data && data.data && data.data.userInfo) {
      const magpieGraphTotalPoint = data.data.userInfo as MagpieGraphTotalPoint;
      this.eigenpiePoints = magpieGraphTotalPoint.eigenpiePoints;
      this.eigenLayerPoints = magpieGraphTotalPoint.eigenLayerPoints;
    } else {
      // Exception in fetching Magpie GraphQL data.
      this.logger.error("Exception in fetching Magpie GraphQL data.");
    }
  }

  public getTotalPoints(): [bigint, bigint] {
    return [this.eigenpiePoints, this.eigenLayerPoints];
  }

  private async query(query: string) {
    const body = {
      query: query,
    };

    const response = await fetch(this.magpiePointRedistributeGraphApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return data;
  }
}
