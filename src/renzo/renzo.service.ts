import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  LocalPointData,
  LocalPointsItem,
  ProjectGraphService,
} from "src/common/service/projectGraph.service";
import { GraphQueryService } from "src/common/service/graphQuery.service";
import { RenzoApiService, RenzoPoints } from "src/renzo/renzoapi.service";
import { ExplorerService } from "src/common/service/explorer.service";
import BigNumber from "bignumber.js";
import waitFor from "src/utils/waitFor";
import { Worker } from "src/common/worker";

export interface RenzoPointItem {
  address: string;
  tokenAddress: string;
  balance: bigint;
  localPoints: bigint;
  localTotalPointsPerToken: bigint;
  realTotalRenzoPointsPerToken: number;
  realTotalEigenLayerPointsPerToken: number;
  realRenzoPoints: number;
  realEigenLayerPoints: number;
  updatedAt: number;
}

export interface RenzoData {
  localTotalPoints: bigint;
  realTotalRenzoPoints: number;
  realTotalEigenLayerPoints: number;
  itemMaps?: Map<string, RenzoPointItem[]>;
  items: RenzoPointItem[];
}

@Injectable()
export class RenzoService extends Worker {
  public tokenAddress: string[];
  private readonly projectName: string = "renzo";
  private readonly logger: Logger;

  private renzoData: RenzoData = {
    localTotalPoints: BigInt(0),
    realTotalRenzoPoints: 0,
    realTotalEigenLayerPoints: 0,
    itemMaps: new Map(),
    items: [],
  };
  private readonly l1Erc20BridgeEthereum: string;
  private readonly l1Erc20BridgeArbitrum: string;
  private readonly l1Erc20BridgeLinea: string;
  private readonly l1Erc20BridgeBlast: string;

  public constructor(
    private readonly explorerService: ExplorerService,
    private readonly renzoApiService: RenzoApiService,
    private readonly projectGraphService: ProjectGraphService,
    private readonly graphQueryService: GraphQueryService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.logger = new Logger(RenzoService.name);
    this.l1Erc20BridgeEthereum = configService.get<string>(
      "l1Erc20BridgeEthereum",
    );
    this.l1Erc20BridgeArbitrum = configService.get<string>(
      "l1Erc20BridgeArbitrum",
    );
    this.l1Erc20BridgeLinea = configService.get<string>("l1Erc20BridgeLinea");
    this.l1Erc20BridgeBlast = configService.get<string>("l1Erc20BridgeBlast");
  }

  public async runProcess() {
    this.logger.log(`Init ${RenzoService.name} onmoduleinit`);
    try {
      await this.loadPointsData();
    } catch (err) {
      this.logger.error(`${RenzoService.name} init failed.`, err.stack);
    }
    await waitFor(() => !this.currentProcessPromise, 60 * 1000, 60 * 1000);
    if (!this.currentProcessPromise) {
      return;
    }
    return this.runProcess();
  }

  // load points data
  private async loadPointsData() {
    // get tokens from graph
    const tokens = this.graphQueryService.getAllTokenAddresses(
      this.projectName,
    );
    if (tokens.length <= 0) {
      this.logger.log(`Graph don't have ${this.projectName} tokens`);
      return;
    }
    this.tokenAddress = tokens;

    const realTokenTotalPoints = await this.getRealPointsData();
    const pointsData = await this.getLocalPointsData();
    const localPoints = pointsData.localPoints;
    const localTotalPoints = pointsData.localTotalPoints;
    const tokensMapBridgeTokens = await this.getTokensMapBriageTokens();
    if (
      tokensMapBridgeTokens.size < 1 ||
      localPoints.length < 1 ||
      realTokenTotalPoints.size < 1
    ) {
      throw new Error(
        `Fetch ${this.projectName} empty data, tokensMapBridgeTokens.size: ${tokensMapBridgeTokens.size}, tokensLocalPoints.size: ${localPoints.length}, tokensRenzoPoints.size: ${realTokenTotalPoints.size}`,
      );
    }

    const data: RenzoPointItem[] = [];
    let realTotalRenzoPoints: number = Number(0),
      realTotalEigenLayerPoints: number = Number(0);

    // start added transferFaildPoint
    const transferFaildPoints = this.projectGraphService.getTransferFaildPoints(
      this.tokenAddress,
    );
    const localPointsMap = new Map<string, LocalPointsItem>();
    const totalPointsPerTokenMap = new Map<string, bigint>();
    const now = (new Date().getTime() / 1000) | 0;
    for (const item of localPoints) {
      const key = `${item.address}_${item.token}`;
      totalPointsPerTokenMap.set(item.token, item.totalPointsPerToken);
      localPointsMap.set(key, item);
    }

    // loop transferFaildData, and added transferFaildPoint to localPoints
    for (const item of transferFaildPoints) {
      const key = `${item.address}_${item.tokenAddress}`;
      const transferFaildTotalPoint =
        this.projectGraphService.getTransferFaildTotalPoint(item.tokenAddress);
      if (!localPointsMap.has(key)) {
        const tmpTotalPointsPerToken =
          totalPointsPerTokenMap.get(item.tokenAddress) ?? BigInt(0);
        localPointsMap.set(key, {
          address: item.address,
          points: item.points,
          withdrawPoints: BigInt(0),
          withdrawTotalPointsPerToken: BigInt(0),
          totalPointsPerToken: tmpTotalPointsPerToken + transferFaildTotalPoint,
          balance: BigInt(0),
          token: item.tokenAddress,
          updatedAt: now,
        });
      } else {
        const localPoint = localPointsMap.get(key);
        localPoint.totalPointsPerToken =
          localPoint.totalPointsPerToken + transferFaildTotalPoint;
        localPoint.points = localPoint.points + item.points;
      }
    }
    // end added transferFaildPoint
    for (const [, point] of localPointsMap) {
      const tokenAddress = point.token.toLocaleLowerCase();
      if (!tokenAddress) {
        throw new Error(
          `Get ${this.projectName} point exception, address is ${point.address}`,
        );
      }

      const bridgeToken = tokensMapBridgeTokens.get(tokenAddress);
      const renzoPoints = realTokenTotalPoints.get(bridgeToken);
      if (!renzoPoints) {
        throw new Error(
          `Get ${this.projectName} realPoint per token is undefined, tokenAddress is ${tokenAddress}`,
        );
      }
      const realRenzoPoints = Number(
        new BigNumber(point.points.toString())
          .multipliedBy(renzoPoints.renzoPoints)
          .div(point.totalPointsPerToken.toString())
          .toFixed(6),
      );
      realTotalRenzoPoints += realRenzoPoints;
      const realEigenLayerPoints = Number(
        new BigNumber(point.points.toString())
          .multipliedBy(renzoPoints.eigenLayerPoints)
          .div(point.totalPointsPerToken.toString())
          .toFixed(6),
      );
      realTotalEigenLayerPoints += realEigenLayerPoints;
      const pointsItem: RenzoPointItem = {
        address: point.address,
        tokenAddress: point.token,
        balance: point.balance,
        localPoints: point.points,
        localTotalPointsPerToken: point.totalPointsPerToken,
        realTotalRenzoPointsPerToken: renzoPoints.renzoPoints,
        realTotalEigenLayerPointsPerToken: renzoPoints.eigenLayerPoints,
        realRenzoPoints: realRenzoPoints,
        realEigenLayerPoints: realEigenLayerPoints,
        updatedAt: point.updatedAt,
      };
      data.push(pointsItem);
    }

    const itemMaps = new Map();
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (!itemMaps.has(item.address)) {
        itemMaps.set(item.address, [item]);
      } else {
        const tmpItems = itemMaps.get(item.address);
        itemMaps.set(item.address, [...tmpItems, item]);
      }
    }
    if (data.length > 0) {
      this.renzoData = {
        localTotalPoints: localTotalPoints,
        realTotalRenzoPoints: realTotalRenzoPoints,
        realTotalEigenLayerPoints: realTotalEigenLayerPoints,
        itemMaps: itemMaps,
        items: data,
      };
    } else {
      this.logger.log(`Load renzo data empty.`);
    }
  }

  // return points data
  public getPointsData(address?: string): RenzoData {
    const result: RenzoData = {
      localTotalPoints: this.renzoData.localTotalPoints,
      realTotalRenzoPoints: this.renzoData.realTotalRenzoPoints,
      realTotalEigenLayerPoints: this.renzoData.realTotalEigenLayerPoints,
      items: address
        ? this.renzoData.itemMaps.get(address) ?? []
        : this.renzoData.items,
    };
    return result;
  }

  // return local points and totalPoints
  private async getLocalPointsData(): Promise<LocalPointData> {
    return await this.projectGraphService.getPoints(this.projectName);
  }

  // return real totalPoints
  private async getRealPointsData(): Promise<Map<string, RenzoPoints>> {
    return await this.renzoApiService.fetchTokensRenzoPoints();
  }

  private async getTokensMapBriageTokens(): Promise<Map<string, string>> {
    const tokens = this.tokenAddress;
    const tokensMapBridgeTokens: Map<string, string> = new Map();
    const allTokens = await this.explorerService.getTokens();
    for (const item of allTokens) {
      const l2Address = item.l2Address?.toLocaleLowerCase();
      if (tokens.includes(l2Address)) {
        let tmpBridgeToken = "";
        switch (item.networkKey) {
          case "ethereum":
            tmpBridgeToken = this.l1Erc20BridgeEthereum;
            break;
          case "arbitrum":
            tmpBridgeToken = this.l1Erc20BridgeArbitrum;
            break;
          case "blast":
            tmpBridgeToken = this.l1Erc20BridgeBlast;
            break;
          case "primary":
            tmpBridgeToken = this.l1Erc20BridgeLinea;
            break;
        }
        if (tmpBridgeToken == "") {
          throw new Error(`There is a unknown token : ${l2Address}`);
        }
        tokensMapBridgeTokens.set(
          l2Address,
          tmpBridgeToken.toLocaleLowerCase(),
        );
      }
    }
    return tokensMapBridgeTokens;
  }
}
