import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import waitFor from "src/utils/waitFor";

export interface RsethPoints {
  elPoints: number;
  kelpMiles: number;
}

@Injectable()
export class SwethApiService {
  private readonly logger: Logger;
  private readonly url: string;
  private readonly l1Erc20Bridges: string[];
  public constructor(configService: ConfigService) {
    this.logger = new Logger(SwethApiService.name);
    this.url =
      "https://v3-public.svc.swellnetwork.io/swell.v3.VoyageService/VoyageUser?encoding=json&message=";
    this.l1Erc20Bridges = [configService.get<string>("l1Erc20BridgeEthereum")];
  }

  public async fetchPoints(): Promise<number> {
    let totalPoints: number = 0;

    for (const bridgeAddress of this.l1Erc20Bridges) {
      const points: number = await this.fetchSinglePoints(bridgeAddress);
      totalPoints += points;
      await waitFor(() => false, 1 * 1000, 1 * 1000);
    }
    return totalPoints;
  }

  private async fetchSinglePoints(bridgeAddress: string): Promise<number> {
    this.logger.log(`start fetchSwethPoints bridgeAddress: ${bridgeAddress}`);
    const bridgeParams = JSON.stringify({
      address: `${bridgeAddress}`,
    });
    const responseStr = await fetch(`${this.url}${bridgeParams}`, {
      method: "get",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
      },
    });
    this.logger.log(
      `success fetchSwethPoints bridgeAddress: ${bridgeAddress}, url:${this.url}${bridgeParams},responseStr:${JSON.stringify(responseStr)} `,
    );
    const response = await responseStr.json();
    return response?.points ?? 0;
  }
}
