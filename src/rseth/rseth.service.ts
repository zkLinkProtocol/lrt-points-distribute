import { Injectable, Logger } from "@nestjs/common";
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
import { LocalPointsItem } from "../common/service/projectGraph.service";
import { Worker } from "src/common/worker";
import { ethers } from "ethers";
import { WithdrawService } from "src/common/service/withdraw.service";

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
  itemMaps?: Map<
    string,
    RsethPointItemWithBalance[] | RsethPointItemWithoutBalance[]
  >;
  items: RsethPointItemWithBalance[] | RsethPointItemWithoutBalance[];
}

const RSETH_ETHEREUM = "0x186c0c42C617f1Ce65C4f7DF31842eD7C5fD8260";
const RSETH_ARBITRUM = "0x4A2da287deB06163fB4D77c52901683d69bD06f4";
const AQUA_VAULT =
  "0x4AC97E2727B0e92AE32F5796b97b7f98dc47F059".toLocaleLowerCase();
const AQUA_RSETH_LP =
  "0xae8AF9bdFE0099f6d0A5234009b78642EfAC1b00".toLocaleLowerCase();

@Injectable()
export class RsethService extends Worker {
  private readonly projectName: string = "rseth";
  private readonly logger: Logger;

  public tokenAddress: string[];
  private rsethData: RsethData = {
    localTotalPoints: BigInt(0),
    realTotalElPoints: 0,
    realTotalKelpMiles: 0,
    itemMaps: new Map(),
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
    private readonly withdrawService: WithdrawService,
  ) {
    super();
    this.logger = new Logger(RsethService.name);
    this.l1Erc20BridgeEthereum = configService.get<string>(
      "l1Erc20BridgeEthereum",
    );
    this.l1Erc20BridgeArbitrum = configService.get<string>(
      "l1Erc20BridgeArbitrum",
    );
  }

  public async runProcess() {
    this.logger.log(`Init ${RsethService.name} onmoduleinit`);
    try {
      await this.loadPointsData();
    } catch (err) {
      this.logger.error(`${RsethService.name} init failed.`, err.stack);
    }
    await waitFor(() => !this.currentProcessPromise, 60 * 1000, 60 * 1000);
    if (!this.currentProcessPromise) {
      return;
    }
    return this.runProcess();
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

    // define a variable to store the matched bridge token
    const tokensMapBridgeTokens = await this.getTokensMapBriageTokens();
    // define a variable to store the real total el points and kelp miles
    let realTotalElPoints = 0,
      realTotalKelpMiles = 0;

    const data: RsethPointItemWithBalance[] = [];
    // calculate real points  = local points * real total points / local total points
    for (const [, item] of localPointsMap) {
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
      this.rsethData = {
        localTotalPoints: localTotalPoints,
        realTotalElPoints: realTotalElPoints,
        realTotalKelpMiles: realTotalKelpMiles,
        itemMaps: itemMaps,
        items: data,
      };
    } else {
      this.logger.log(`Load ${this.projectName} data empty.`);
    }
  }

  // return points data
  public getPointsData(address?: string): RsethData {
    return {
      localTotalPoints: this.rsethData.localTotalPoints,
      realTotalElPoints: this.rsethData.realTotalElPoints,
      realTotalKelpMiles: this.rsethData.realTotalKelpMiles,
      items: address
        ? this.rsethData.itemMaps.get(address) ?? []
        : this.rsethData.items,
    };
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
    return {
      localTotalPoints: this.rsethData.localTotalPoints,
      realTotalElPoints: this.rsethData.realTotalElPoints,
      realTotalKelpMiles: this.rsethData.realTotalKelpMiles,
      items: Array.from(data.values()),
    };
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

  public async getBalanceByAddresses(address: string, toTimestamp: number) {
    const rsethEthereum = await this.getBalanceByAddress(
      address,
      toTimestamp,
      RSETH_ETHEREUM,
    );
    const rsethArbitrum = await this.getBalanceByAddress(
      address,
      toTimestamp,
      RSETH_ARBITRUM,
    );
    return {
      rsethEthereum,
      rsethArbitrum,
    };
  }

  public async getBalanceByAddress(
    address: string,
    toTimestamp: number,
    tokenAddress: string,
  ) {
    const blocks = await this.explorerService.getLastBlocks(toTimestamp);
    if (!blocks || blocks.length === 0) {
      throw new Error("Failed to get blocks.");
    }
    const blockNumber = blocks[0].number ?? 0;
    if (blockNumber === 0) {
      throw new Error("Failed to get block number.");
    }
    let directBalance = BigInt(0);
    let withdrawBalance = BigInt(0);
    let aquaBalance = BigInt(0);

    const provider = new ethers.JsonRpcProvider("https://rpc.zklink.io");
    const block = await provider.getBlock(Number(blockNumber));
    const balanceOfMethod = "0x70a08231";
    const totalSupplyMethod = "0x18160ddd";
    const promiseList = [];

    // rsseth balance of address
    promiseList.push(
      provider.call({
        to: tokenAddress,
        data: balanceOfMethod + address.replace("0x", "").padStart(64, "0"),
        blockTag: Number(blockNumber),
      }),
    );

    // rsseth balance of aqua pairaddress
    promiseList.push(
      provider.call({
        to: tokenAddress,
        data: balanceOfMethod + AQUA_VAULT.replace("0x", "").padStart(64, "0"),
        blockTag: Number(blockNumber),
      }),
    );

    // aq-lrseth balance of address
    promiseList.push(
      provider.call({
        to: AQUA_RSETH_LP,
        data: balanceOfMethod + address.replace("0x", "").padStart(64, "0"),
        blockTag: Number(blockNumber),
      }),
    );

    // aq-lrseth total supply
    promiseList.push(
      provider.call({
        to: AQUA_RSETH_LP,
        data: totalSupplyMethod,
        blockTag: Number(blockNumber),
      }),
    );

    const [
      rsethEthAddress,
      rsethEthAqua,
      aqlrsethAddress,
      aqlrsethTotalSupply,
    ] = await Promise.all(promiseList);

    directBalance = BigInt(rsethEthAddress);

    const rsethAquaBigInt = BigNumber(rsethEthAqua);
    const aqlrsethAddressBigInt = BigNumber(aqlrsethAddress);
    const aqlrsethTotalSupplyBigInt = BigNumber(aqlrsethTotalSupply);

    // aqua balance
    const aquaBalanceBg = aqlrsethAddressBigInt
      .multipliedBy(rsethAquaBigInt)
      .div(aqlrsethTotalSupplyBigInt);
    aquaBalance = BigInt(aquaBalanceBg.toFixed(0));

    // withdrawHistory
    const withdrawHistory = await this.withdrawService.getWithdrawHistory(
      address,
      tokenAddress,
      block.timestamp,
    );
    const blockTimestamp = block.timestamp;
    for (const item of withdrawHistory) {
      const tmpEndTime = this.withdrawService.findWithdrawEndTime(
        item.blockTimestamp,
      );
      // if withdrawTime is in the future, add balance to withdrawBalance
      if (tmpEndTime > blockTimestamp) {
        withdrawBalance = withdrawBalance + BigInt(item.balance);
      }
    }

    const totalBalance = directBalance + withdrawBalance + aquaBalance;
    return {
      totalBalance: ethers.formatEther(totalBalance).toString(),
      withdrawingBalance: ethers.formatEther(withdrawBalance).toString(),
      userBalance: ethers.formatEther(directBalance).toString(),
      liquidityBalance: ethers.formatEther(aquaBalance).toString(),
      liquidityDetails: [
        {
          dappName: "aqua",
          balance: ethers.formatEther(aquaBalance).toString(),
        },
      ],
    };
  }
}
