import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParseAddressPipe } from 'src/common/pipes/parseAddress.pipe';

export interface RenzoPoints {
  renzoPoints: number;
  eigenLayerPoints: number;
}

@Injectable()
export class RenzoApiService {
  private readonly logger: Logger;
  private readonly renzoApiBaseurl: string;
  private readonly l1Erc20Bridges: string[];
  public constructor(configService: ConfigService) {
    this.logger = new Logger(RenzoApiService.name);
    this.renzoApiBaseurl = 'https://app.renzoprotocol.com/api/points/';
    this.l1Erc20Bridges = [
      configService.get<string>('l1Erc20BridgeEthereum'),
      configService.get<string>('l1Erc20BridgeArbitrum'),
      configService.get<string>('l1Erc20BridgeLinea'),
      configService.get<string>('l1Erc20BridgeBlast'),
    ];

    if (
      configService.get<string[]>(`renzo.tokenAddress`).length !==
      this.l1Erc20Bridges.length
    ) {
      throw new Error('No l1Erc20Bridges');
    }
    if (
      !this.l1Erc20Bridges.every((address) =>
        ParseAddressPipe.addressRegexp.test(address),
      )
    ) {
      throw new Error('l1Erc20Bridges config error');
    }
  }

  public async fetchTokensRenzoPoints(): Promise<Map<string, RenzoPoints>> {
    const allRenzoPoints: Map<string, RenzoPoints> = new Map;

    for (const bridgeAddress of this.l1Erc20Bridges) {
      const renzoPoints = await this._fetchRenzoPoints(bridgeAddress);
      allRenzoPoints.set(bridgeAddress.toLocaleLowerCase(), renzoPoints);
      await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1s
    }
    return allRenzoPoints;
  }

  public async _fetchRenzoPoints(bridgeAddress: string): Promise<RenzoPoints> {
    this.logger.log(`start fetchRenzoPoints bridgeAddress: ${bridgeAddress}`);
    const realData = await fetch(`${this.renzoApiBaseurl}${bridgeAddress}`, {
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
        'Host': 'app.renzoprotocol.com',
      },
    });
    this.logger.log(`end fetchRenzoPoints bridgeAddress: ${bridgeAddress}`);
    const pufReadData = await realData.json();
    if (!pufReadData || pufReadData.success !== true || !pufReadData.data) {
      this.logger.error(`No renzo points bridgeAddress: ${bridgeAddress}`);
      return { renzoPoints: 0, eigenLayerPoints: 0 };
    }
    const totals = pufReadData.data.totals;
    if (!totals || !totals.renzoPoints || !totals.eigenLayerPoints) {
      this.logger.error(`No renzo points bridgeAddress: ${bridgeAddress}`);
      return { renzoPoints: 0, eigenLayerPoints: 0 };
    }
    this.logger.log(`success fetchRenzoPoints bridgeAddress: ${bridgeAddress}, renzoPoints:${totals.renzoPoints}, eigenLayerPoints:${totals.eigenLayerPoints} `);

    return {
      renzoPoints: totals.renzoPoints,
      eigenLayerPoints: totals.eigenLayerPoints,
    };
  }
}