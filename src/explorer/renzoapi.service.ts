import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    if (!this.l1Erc20Bridges[0] || !this.l1Erc20Bridges[1]) {
      throw new Error('No l1Erc20Bridges');
    }
  }

  public async fetchRenzoPoints(): Promise<RenzoPoints> {
    const allRenzoPoints = await Promise.all(
      this.l1Erc20Bridges.map((bridgeAddress) =>
        this._fetchRenzoPoints(bridgeAddress),
      ),
    );
    return allRenzoPoints.reduce(
      (acc, renzoPoints) => {
        acc.renzoPoints += renzoPoints.renzoPoints;
        acc.eigenLayerPoints += renzoPoints.eigenLayerPoints;
        return acc;
      },
      { renzoPoints: 0, eigenLayerPoints: 0 },
    );
  }

  public async _fetchRenzoPoints(bridgeAddress: string): Promise<RenzoPoints> {
    const realData = await fetch(`${this.renzoApiBaseurl}${bridgeAddress}`, {
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
      },
    });
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

    return {
      renzoPoints: totals.renzoPoints,
      eigenLayerPoints: totals.eigenLayerPoints,
    };
  }
}
