import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface MagpieGraphTotalPoint {
  id: string;
  eigenpiePoints: bigint;
  eigenLayerPoints: bigint;
}

@Injectable()
export class MagpieGraphQueryService {
  private readonly logger: Logger;
  private readonly magpiePointRedistributeGraphApi: string =
    "https://gateway-arbitrum.network.thegraph.com/api/db54be382da0a4d60b8ea908242dda0c/subgraphs/id/F2wKriMMFuc8sMtFxYd3Kew46DHvBGfGdTvhvvNAWg8x";
  private readonly magpieUserinfoId: string;

  public constructor(configService: ConfigService) {
    this.logger = new Logger(MagpieGraphQueryService.name);
    this.magpieUserinfoId = configService.get<string>("l1Erc20BridgeEthereum");
  }

  public async getRealData(): Promise<MagpieGraphTotalPoint> {
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
      return data.data.userInfo as MagpieGraphTotalPoint;
    } else {
      // Exception in fetching Magpie GraphQL data.
      this.logger.error("Exception in fetching Magpie GraphQL data.");
    }
  }

  private async query(query: string) {
    try {
      const body = {
        query: query,
      };
      const response = await fetch(this.magpiePointRedistributeGraphApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
