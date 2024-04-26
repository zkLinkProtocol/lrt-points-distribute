import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface RsethPoints {
  elPoints: number;
  kelpMiles: number;
}

@Injectable()
export class RsethApiService {
  private readonly logger: Logger;
  private readonly rsethApiBaseurl: string;
  private readonly l1Erc20Bridges: string[];
  public constructor(configService: ConfigService) {
    this.logger = new Logger(RsethApiService.name);
    this.rsethApiBaseurl = "https://common.kelpdao.xyz/km-el-points/user/";
    this.l1Erc20Bridges = [
      configService.get<string>("l1Erc20BridgeEthereum"),
      configService.get<string>("l1Erc20BridgeArbitrum"),
    ];
  }

  public async fetchTokensRsethPoints(): Promise<Map<string, RsethPoints>> {
    const allRsethPoints: Map<string, RsethPoints> = new Map();

    for (const bridgeAddress of this.l1Erc20Bridges) {
      const rsethPoints = await this._fetchRsethPoints(bridgeAddress);
      allRsethPoints.set(bridgeAddress.toLocaleLowerCase(), rsethPoints);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // wait 1s
    }
    return allRsethPoints;
  }

  public async _fetchRsethPoints(bridgeAddress: string): Promise<RsethPoints> {
    this.logger.log(`start fetchRsethPoints bridgeAddress: ${bridgeAddress}`);
    const responseStr = await fetch(`${this.rsethApiBaseurl}${bridgeAddress}`, {
      method: "get",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
      },
    });
    this.logger.log(`end fetchRsethPoints bridgeAddress: ${bridgeAddress}`);
    const response = await responseStr.json();
    if (
      (response?.value?.elPoints ?? undefined) === undefined ||
      (response?.value?.kelpMiles ?? undefined) === undefined
    ) {
      this.logger.error(`No rseth points bridgeAddress: ${bridgeAddress}`);
      return { elPoints: 0, kelpMiles: 0 };
    }
    this.logger.log(
      `success fetchRsethPoints bridgeAddress: ${bridgeAddress}, elPoints:${response.value.elPoints}, kelpMiles:${response.value.kelpMiles} `,
    );
    return {
      elPoints: response.value.elPoints,
      kelpMiles: response.value.kelpMiles,
    };
  }
}
