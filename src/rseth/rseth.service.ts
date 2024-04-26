import { Injectable, Logger } from "@nestjs/common";
import { cloneDeep } from "lodash";
import {
  LocalPointData,
  ProjectGraphService,
} from "src/common/service/projectGraph.service";
import { RsethApiService, RsethPoints } from "./rseth.api.service";
import { GraphQueryService } from "src/common/service/graphQuery.service";
import { ExplorerService } from "src/common/service/explorer.service";
import { ConfigService } from "@nestjs/config";
import BigNumber from "bignumber.js";
import waitFor from "src/utils/waitFor";

export interface RsethPointItemWithBalance {
  address: string;
  tokenAddress: string;
  balance: bigint;
  localPoints: bigint;
  realElPoints: number;
  realKelpMiles: number;
  localTotalPointsPerToken: bigint;
  realTotalElPointsPerToken: number;
  realTotalKelpMilesPerToken: number;
  updatedAt: number;
}

export interface RsethPointItemWithoutBalance {
  address: string;
  realElPoints: number;
  realKelpMiles: number;
  updatedAt: number;
}

export interface RsethData {
  localTotalPoints: bigint;
  realTotalElPoints: number;
  realTotalKelpMiles: number;
  items: RsethPointItemWithBalance[] | RsethPointItemWithoutBalance[];
}

@Injectable()
export class RsethService {
  private readonly projectName: string = "rseth";
  private readonly logger: Logger;

  public tokenAddress: string[];
  private rsethData: RsethData = {
    localTotalPoints: BigInt(0),
    realTotalElPoints: 0,
    realTotalKelpMiles: 0,
    items: [],
  };
  private readonly l1Erc20BridgeEthereum: string;
  private readonly l1Erc20BridgeArbitrum: string;
  public constructor(
    private readonly projectGraphService: ProjectGraphService,
    private readonly rsethApiService: RsethApiService,
    private readonly graphQueryService: GraphQueryService,
    private readonly explorerService: ExplorerService,
    private readonly configService: ConfigService,
  ) {
    this.logger = new Logger(RsethService.name);
    this.l1Erc20BridgeEthereum = configService.get<string>(
      "l1Erc20BridgeEthereum",
    );
    this.l1Erc20BridgeArbitrum = configService.get<string>(
      "l1Erc20BridgeArbitrum",
    );
  }

  public async onModuleInit() {
    await waitFor(() => false, 5 * 1000, 5 * 1000);
    this.logger.log(`Init ${RsethService.name} onmoduleinit`);
    const func = async () => {
      try {
        await this.loadPointsData();
      } catch (err) {
        this.logger.error(`${RsethService.name} init failed.`, err.stack);
      }
    };
    func();
    setInterval(func, 1000 * 200);
  }

  // load points data
  public async loadPointsData() {
    // get tokens from graph
    const tokens = this.graphQueryService.getAllTokenAddresses(
      this.projectName,
    );
    if (tokens.length <= 0) {
      this.logger.log(`Graph don't have ${this.projectName} tokens`);
      return;
    }
    this.tokenAddress = tokens;

    const realTotalPointsData = await this.getRealPointsData();
    const localPointsData = await this.getLocalPointsData();
    const localPoints = localPointsData.localPoints;
    const localTotalPoints = localPointsData.localTotalPoints;

    // define a variable to store the matched bridge token
    const tokensMapBridgeTokens = await this.getTokensMapBriageTokens();
    // define a variable to store the real total el points and kelp miles
    let realTotalElPoints = 0,
      realTotalKelpMiles = 0;

    const data: RsethPointItemWithBalance[] = [];
    // calculate real points  = local points * real total points / local total points
    for (const item of localPoints) {
      const bridgeToken = tokensMapBridgeTokens.get(item.token);
      // if the token is not in the bridge token list, skip it
      if (!bridgeToken) {
        this.logger.log(`Token ${item.token} is not in the bridge token list.`);
        continue;
      }
      const elPointsPerToken =
        realTotalPointsData.get(bridgeToken)?.elPoints ?? 0;
      const kelpMilesPerToken =
        realTotalPointsData.get(bridgeToken)?.kelpMiles ?? 0;
      const realElPoints = Number(
        new BigNumber(item.points.toString())
          .multipliedBy(elPointsPerToken.toString())
          .div(item.totalPointsPerToken.toString())
          .toFixed(6),
      );
      realTotalElPoints += realElPoints;
      const realKelpMiles = Number(
        new BigNumber(item.points.toString())
          .multipliedBy(kelpMilesPerToken.toString())
          .div(item.totalPointsPerToken.toString())
          .toFixed(6),
      );
      realTotalKelpMiles += realKelpMiles;
      const pointsItem: RsethPointItemWithBalance = {
        address: item.address,
        tokenAddress: item.token,
        balance: item.balance,
        localPoints: item.points,
        realElPoints: realElPoints,
        realKelpMiles: realKelpMiles,
        localTotalPointsPerToken: item.totalPointsPerToken,
        realTotalElPointsPerToken: elPointsPerToken,
        realTotalKelpMilesPerToken: kelpMilesPerToken,
        updatedAt: item.updatedAt,
      };
      data.push(pointsItem);
    }
    if (data.length > 0) {
      this.rsethData = {
        localTotalPoints: localTotalPoints,
        realTotalElPoints: realTotalElPoints,
        realTotalKelpMiles: realTotalKelpMiles,
        items: data,
      };
    } else {
      this.logger.log(`Load ${this.projectName} data empty.`);
    }
  }

  // return points data
  public getPointsData(address?: string): RsethData {
    const result: RsethData = cloneDeep(this.rsethData);
    if (address) {
      const _address = address.toLocaleLowerCase();
      result.items = this.rsethData.items.filter(
        (item) => item.address === _address,
      );
    }
    return result;
  }

  // return local points and totalPoints
  public async getLocalPointsData(): Promise<LocalPointData> {
    return await this.projectGraphService.getPoints(this.projectName);
  }

  // return real totalPoints
  public async getRealPointsData(): Promise<Map<string, RsethPoints>> {
    return await this.rsethApiService.fetchTokensRsethPoints();
  }

  // return real points group by address
  public getPointsDataGroupByAddress(): RsethData {
    const result: RsethData = cloneDeep(this.rsethData);
    const data: Map<string, RsethPointItemWithoutBalance> = new Map();
    const now = (new Date().getTime() / 1000) | 0;
    for (let i = 0; i < this.rsethData.items.length; i++) {
      const item = this.rsethData.items[i];
      if (!data.has(item.address)) {
        data.set(item.address, {
          address: item.address,
          realElPoints: item.realElPoints,
          realKelpMiles: item.realKelpMiles,
          updatedAt: now,
        } as RsethPointItemWithoutBalance);
      } else {
        const tmpItem = data.get(item.address);
        tmpItem.realKelpMiles += item.realKelpMiles;
        tmpItem.realElPoints += item.realElPoints;
      }
    }
    result.items = Array.from(data.values());
    return result;
  }

  // token match bridge token
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
