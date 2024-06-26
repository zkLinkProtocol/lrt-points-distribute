import { Injectable, Logger, Module } from "@nestjs/common";
import { GraphQueryService } from "src/common/service/graphQuery.service";

export interface NovaPoints {
  novaPoint: number;
  referPoint: number;
}

@Module({
  imports: [GraphQueryService],
})
@Injectable()
export class NovaApiService {
  private readonly logger: Logger;
  private readonly novaApiBaseurl: string =
    "https://app-api.zklink.io/points/addressTokenTvl/getAccountPoint?address=";
  private readonly graphQueryService: GraphQueryService;
  private readonly projectName: string = "nova";
  private tokenNovaPoints: Map<string, NovaPoints> = new Map();

  public constructor(graphQueryService: GraphQueryService) {
    this.logger = new Logger(NovaApiService.name);
    this.graphQueryService = graphQueryService;
  }

  public async onModuleInit() {
    this.logger.log("NovaApiService has been initialized.");
    const func = async () => {
      try {
        await this.loadData();
      } catch (err) {
        this.logger.error("NovaApiService init failed", err.stack);
      }
    };
    func();
    setInterval(func, 1000 * 10);
  }

  public async loadData() {
    const tokenAddress = this.graphQueryService.getAllTokenAddresses(
      this.projectName,
    );
    for (const val of tokenAddress) {
      this.tokenNovaPoints.set(val, await this.fetchNovaPoints(val));
    }
  }

  public getNovaPoint(tokenAddress: string): NovaPoints {
    for (const [key, value] of this.tokenNovaPoints) {
      if (key == tokenAddress) {
        return value;
      }
    }
    return { novaPoint: 0, referPoint: 0 };
    // return this.tokenNovaPoints.get(tokenAddress);
  }

  public async fetchNovaPoints(tokenAddress: string): Promise<NovaPoints> {
    const responseStr = await fetch(`${this.novaApiBaseurl}${tokenAddress}`, {
      method: "get",
      headers: {
        "Content-Type": "application/json",
      },
    });
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
