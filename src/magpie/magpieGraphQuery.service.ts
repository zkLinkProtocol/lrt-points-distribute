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
  private readonly magpiePointRedistributeGraphApi: string = "https://gateway-arbitrum.network.thegraph.com/api/db54be382da0a4d60b8ea908242dda0c/subgraphs/id/F2wKriMMFuc8sMtFxYd3Kew46DHvBGfGdTvhvvNAWg8x";
  private readonly magpieUserinfoId: string;

  private eigenpiePoints: bigint = BigInt(0);
  private eigenLayerPoints: bigint = BigInt(0);
  
  public constructor(configService: ConfigService) {
    this.logger = new Logger(MagpieGraphQueryService.name);
    this.magpieUserinfoId = configService.get<string>(
      'l1Erc20BridgeEthereum',
    );
  }

  public async onModuleInit() {
    // setInterval will wait for 100s, so it's necessary to execute the loadMagpieData function once first.
    const func = async () => {
      try {
        await this.loadMagpieData();
      } catch (err) {
        this.logger.error("MagpieGraphQueryService init failed", err.stack);
      }
    };
    await func();
    setInterval(func, 1000 * 300);
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
    try{
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
    } catch (err) {
      this.logger.error("Fetch magpie graph query data faild", err.stack);
      return undefined;
    }
  }
}
