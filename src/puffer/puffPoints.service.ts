import { Injectable, Logger } from "@nestjs/common";
import {
  LocalPointData,
  ProjectGraphService,
  LocalPointsItem,
} from "../common/service/projectGraph.service";
import { GraphQueryService } from "../common/service/graphQuery.service";
import BigNumber from "bignumber.js";
import { NovaService } from "../nova/nova.service";
import { ConfigService } from "@nestjs/config";
import { PagingOptionsDto } from "../common/pagingOptionsDto.dto";
import { Worker } from "src/common/worker";
import waitFor from "src/utils/waitFor";
import { RedistributeBalanceRepository } from "src/repositories/redistributeBalance.repository";

import { ethers } from "ethers";
import { WithdrawService } from "src/common/service/withdraw.service";
import { ExplorerService } from "src/common/service/explorer.service";

export interface PufferPointItem {
  address: string;
  tokenAddress: string;
  balance: bigint;
  realPoints: number;
  localPoints: bigint;
  localTotalPointsPerToken: bigint;
  realTotalPointsPerToken: number;
  updatedAt: number;
}

export interface PufferData {
  localTotalPoints: bigint;
  realTotalPoints: number;
  items: PufferPointItem[];
}

interface EigenlayerPool {
  balance: string;
  decimals: string;
  id: string;
  name: string;
  symbol: string;
  totalSupplied: string;
  underlying: string;
}

interface EigenlayerPosition {
  id: string;
  balance: string;
  positions: {
    id: string;
    pool: string;
    supplied: string;
    token: string;
  }[];
  withdrawHistory: WithdrawnItem[];
}

interface PufferElPointsByAddress {
  balance: string;
  pools: EigenlayerPool[];
  userPosition: EigenlayerPosition | null;
}

interface WithdrawnItem {
  token: string;
  balance: string;
  blockTimestamp: string;
}

interface PufferElPoints {
  pools: EigenlayerPool[];
  userPositions: EigenlayerPosition[];
}

type PufferUserBalance = [
  {
    id: string;
    balance: string;
    positionHistory: {
      id: string;
      pool: string;
      supplied: string;
      token: string;
      poolName: string;
    }[];
    withdrawHistory: WithdrawnItem[];
  },
  Array<EigenlayerPool & { pool: string }>,
];
export const PUFFER_ETH_ADDRESS =
  "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC".toLowerCase();
const AQUA_VAULT =
  "0x4AC97E2727B0e92AE32F5796b97b7f98dc47F059".toLocaleLowerCase();
const AQUA_PUFF_LP =
  "0xc2be3CC06Ab964f9E22e492414399DC4A58f96D3".toLocaleLowerCase();
const LAYERBANK_VAULT =
  "0xdd6105865380984716C6B2a1591F9643e6ED1C48".toLocaleLowerCase();

@Injectable()
export class PuffPointsService extends Worker {
  public tokenAddress: string;
  private readonly projectName: string = "puffer";
  private readonly logger: Logger;
  private realTotalPoints: number = 0;
  private localTotalPoints: bigint = BigInt(0);
  private localPoints: PufferPointItem[] = [];
  private puffElPointsGraphApi: string;
  private readonly poolsName = ["LayerBank", "Aqua"];

  public constructor(
    private readonly projectGraphService: ProjectGraphService,
    private readonly graphQueryService: GraphQueryService,
    private readonly novaService: NovaService,
    private readonly configService: ConfigService,
    private readonly redistributeBalanceRepository: RedistributeBalanceRepository,
    private readonly withdrawService: WithdrawService,
    private readonly explorerService: ExplorerService,
  ) {
    super();
    this.logger = new Logger(PuffPointsService.name);
    this.puffElPointsGraphApi = this.configService.get<string>(
      "novaPointPufferElPointsGraphApi",
    );
  }

  public async runProcess() {
    this.logger.log(`Init ${PuffPointsService.name} onmoduleinit`);
    try {
      await this.loadPointsData();
    } catch (err) {
      this.logger.error(`${PuffPointsService.name} init failed.`, err.stack);
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
    this.tokenAddress = tokens[0].toLowerCase();

    this.realTotalPoints = await this.getRealPointsData();
    const pointsData = await this.getLocalPointsData();
    this.localTotalPoints = pointsData.localTotalPoints;
    const _localPoints = pointsData.localPoints;

    // start added transferFaildPoint
    const transferFaildPoints = this.projectGraphService.getTransferFaildPoints(
      [this.tokenAddress],
    );
    const localPointsMap = new Map<string, LocalPointsItem>();
    const totalPointsPerTokenMap = new Map<string, bigint>();
    const now = (new Date().getTime() / 1000) | 0;
    for (const item of _localPoints) {
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

    const localPoints = [];
    for (const [, item] of localPointsMap) {
      const realPoints = new BigNumber(item.points.toString())
        .multipliedBy(this.realTotalPoints)
        .div(item.totalPointsPerToken.toString())
        .toFixed(6);
      const _item = {
        address: item.address,
        tokenAddress: item.token,
        balance: item.balance,
        realPoints: Number(realPoints),
        localPoints: item.points,
        localTotalPointsPerToken: item.totalPointsPerToken,
        realTotalPointsPerToken: this.realTotalPoints,
        updatedAt: item.updatedAt,
      } as PufferPointItem;
      localPoints.push(_item);
    }

    this.localPoints = localPoints;
  }

  // return points data
  public async getPointsData(address?: string): Promise<PufferData> {
    const result: PufferData = {
      localTotalPoints: this.localTotalPoints,
      realTotalPoints: this.realTotalPoints,
      items: this.localPoints,
    } as PufferData;
    const lpMap = await this.getPufferLPAddressMap(0);
    const needRemoveAddress = Array.from(lpMap.values()).map(
      (item) => item.vaultAddress,
    );
    if (address && this.localPoints.length > 0) {
      const _address = address.toLocaleLowerCase();
      if (needRemoveAddress.includes(_address)) {
        result.items = [];
      } else {
        result.items = this.localPoints.filter(
          (item) => item.address === _address,
        );
      }
    }
    return result;
  }

  // return local points and totalPoints
  public async getLocalPointsData(): Promise<LocalPointData> {
    return await this.projectGraphService.getPoints(this.projectName);
  }

  // return local points and totalPoints by address
  public async getLocalPointsDataByAddress(
    address: string,
  ): Promise<LocalPointData> {
    return await this.projectGraphService.getPoints(this.projectName, address);
  }

  public getPoolPufferPoints(poolAddress: string): PufferPointItem {
    const _poolAddress = poolAddress.toLowerCase();
    const result = this.localPoints.filter(
      (item) => item.address === _poolAddress,
    );
    return result[0];
  }

  // return real totalPoints
  public async getRealPointsData(): Promise<number> {
    const realData = await fetch(
      "https://quest-api.puffer.fi/puffer-quest/third/query_zklink_pufpoint",
      {
        method: "get",
        headers: {
          "Content-Type": "application/json",
          "client-id": "08879426f59a4b038b7755b274bc19dc",
        },
      },
    );
    const pufReadData = await realData.json();
    if (
      pufReadData &&
      pufReadData.errno === 0 &&
      pufReadData.data &&
      pufReadData.data.pufeth_points_detail
    ) {
      return pufReadData.data.pufeth_points_detail["latest_points"] as number;
    } else {
      throw new Error(`Failed to get real ${this.projectName} points`);
    }
  }

  public async getPuffElPointsByAddress(
    address: string,
  ): Promise<PufferElPointsByAddress> {
    const protocolName = this.poolsName;
    const withdrawTime = Math.floor(
      (new Date().getTime() - 7 * 24 * 60 * 60 * 1000) / 1000,
    );
    try {
      const body = {
        query: `{
          pools(first: 1000) {
            decimals
            id
            name
            symbol
            totalSupplied
            underlying
            balance
          }
          userPosition(id: "${address}") {
            id
            balance
            positions( where: {poolName_in: ${JSON.stringify(protocolName)}}) {
              id
              pool
              supplied
              token
            }
            withdrawHistory(first: 1000, where: {blockTimestamp_gt: "${withdrawTime}", token: "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC"}) {
              token
              id
              blockTimestamp
              blockNumber
              balance
            }
          }
        }`,
      };

      const response = await fetch(this.puffElPointsGraphApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      return data.data;
    } catch (err) {
      this.logger.error("Fetch puffer points by address data fail", err.stack);
      return undefined;
    }
  }

  public async getPufferUserBalance(
    address: string,
    date: string,
  ): Promise<PufferUserBalance> {
    const protocolName = this.poolsName; // "Aqua" to be added

    const specialDateTime = new Date("2024-05-05 00:00:00").getTime();
    const queryDateTime = new Date(date).getTime();

    const queryUnixTime = Math.floor(queryDateTime) / 1000;
    const queryWithdrawnUnixTime =
      queryDateTime > specialDateTime
        ? Math.floor((queryDateTime - 7 * 24 * 60 * 60 * 1000) / 1000)
        : Math.floor((queryDateTime - 14 * 24 * 60 * 60 * 1000) / 1000);

    try {
      const balanceQueryBody = {
        query: `{
          userPosition(id: "${address}") {
            id
            balance
            positionHistory(
              where: {
                poolName_in: ${JSON.stringify(protocolName)}
                blockTimestamp_lte: "${queryUnixTime}"
              }
              first: 1
              orderBy: blockNumber
              orderDirection: desc
            ) {
              id
              pool
              supplied
              token
              poolName
              blockNumber
              blockTimestamp
            }
            withdrawHistory(first: 1000, where: {
                blockTimestamp_gte: "${queryWithdrawnUnixTime}",
                blockTimestamp_lte: "${queryUnixTime}",
                token: "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC"}
              ) {
              token
              id
              blockTimestamp
              blockNumber
              balance
            }
          }
        }`,
      };

      const response = await fetch(this.puffElPointsGraphApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(balanceQueryBody),
      });
      const { data } = await response.json();

      const historicData = data.userPosition.positionHistory.map((i) => ({
        poolId: i.pool,
      }));

      const genPoolQueryBody = (poolId: string) => ({
        query: `{
          poolHistoricItems(
            where: {
              pool: "${poolId}"
              blockTimestamp_lte: "${queryUnixTime}"
            }
            orderBy: blockTimestamp
            orderDirection: desc
            first: 1
          ) {
            decimals
            id
            pool
            name
            symbol
            totalSupplied
            underlying
            balance
            blockTimestamp
            blockNumber
          }
        }`,
      });

      const poolData = await Promise.all(
        historicData.map(async (item) => {
          const queryString = genPoolQueryBody(item.poolId);
          const response = await fetch(this.puffElPointsGraphApi, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(queryString),
          });
          const { data } = await response.json();
          return data.poolHistoricItems[0];
        }),
      );

      return [data.userPosition, poolData];
    } catch (err) {
      this.logger.error("Fetch puffer points by address data fail", err.stack);
      return undefined;
    }
  }

  public async getPuffElPoints(
    pagingOption: PagingOptionsDto,
  ): Promise<PufferElPoints> {
    const { limit = 10, page = 1 } = pagingOption;
    const protocolName = this.poolsName;
    const withdrawTime = Math.floor(
      (new Date().getTime() - 7 * 24 * 60 * 60 * 1000) / 1000,
    );
    try {
      const body = {
        query: `{
          pools(first: 1000) {
            decimals
            id
            name
            symbol
            totalSupplied
            underlying
            balance
          }
          userPositions(
            where: {
              id_not: "0x000000000000000000000000000000000000dead",
              validate: true
            }
            first: ${limit}
            skip: ${(page - 1) * limit}
          ) {
            id
            balance
            positions(first: 1000, where: {poolName_in: ${JSON.stringify(protocolName)}}) {
              id
              pool
              poolName
              supplied
              token
            }
            withdrawHistory(first: 1000, where: {blockTimestamp_gt: "${withdrawTime}", token: "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC"}) {
              token
              id
              blockTimestamp
              blockNumber
              balance
            }
          }
        }`,
      };

      const response = await fetch(this.puffElPointsGraphApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      return data.data;
    } catch (err) {
      this.logger.error(
        "Fetch getPuffElPoints graph query data fail",
        err.stack,
      );
      return undefined;
    }
  }

  /**
   *
   * @param name project name
   * @returns
   */
  public async getPoolInfoByProject() {
    const poolsInfo = await this.redistributeBalanceRepository.getPoolsByToken(
      Buffer.from(PUFFER_ETH_ADDRESS.slice(2), "hex"),
    );
    return poolsInfo.map((pool) => {
      if (pool.name === "aqua") {
        return {
          vaultAddress: AQUA_VAULT,
          poolAddress: pool.poolAddress,
          dappName: pool.name,
        };
      }
      return {
        vaultAddress: pool.poolAddress,
        poolAddress: pool.poolAddress,
        dappName: pool.name,
      };
    });
  }

  /**
   *
   * @param pufferTotalPoint
   * @returns Promise<Map<string, number>>
   * @description return a Map which key is the poolAddress, value is {points: number, dappName: string}
   */
  public async getPufferLPAddressMap(pufferTotalPoint: number) {
    const redistributeList = await this.getPoolInfoByProject();

    const vaultAddresses = redistributeList.map(
      (config) => config.vaultAddress,
    );

    const redistributePointsList =
      await this.redistributeBalanceRepository.getRedistributePointsList(
        vaultAddresses,
        PUFFER_ETH_ADDRESS,
      );

    const vaultToPoolMap = new Map(
      redistributeList.map((info) => [
        info.vaultAddress,
        { poolAddress: info.poolAddress, dappName: info.dappName },
      ]),
    );

    const stakedPointsMap = new Map(
      redistributePointsList.map((stakedInfo) => {
        const info = vaultToPoolMap.get(stakedInfo.userAddress);
        return [
          info.poolAddress,
          {
            points: stakedInfo.pointWeightPercentage * pufferTotalPoint,
            dappName: info.dappName,
            vaultAddress: stakedInfo.userAddress,
          },
        ];
      }),
    );

    return stakedPointsMap;
  }

  public async getUserStakedPosition(address: string) {
    const totalPufferPoints = await this.getRealPointsData();
    const pufferLPAddressMap =
      await this.getPufferLPAddressMap(totalPufferPoints);
    const data =
      await this.redistributeBalanceRepository.getUserStakedPositionsByToken(
        Buffer.from(PUFFER_ETH_ADDRESS.slice(2), "hex"),
        Buffer.from(address.slice(2), "hex"),
      );

    const result = data.map((position) => {
      const pointData = pufferLPAddressMap.get(position.poolAddress);

      return {
        point: pointData.points * position.pointWeightPercentage,
        balance: position.balance,
        dappName: pointData.dappName,
      };
    });
    return result;
  }

  public async getUserPufferPoint(address: string) {
    const pufferTotalPoint = await this.getRealPointsData();

    const userPufferPosition = (
      await this.redistributeBalanceRepository.getRedistributePointsList(
        [address],
        PUFFER_ETH_ADDRESS,
      )
    )[0];
    const holdingPufferPoint =
      (userPufferPosition?.pointWeightPercentage ?? 0) * pufferTotalPoint;

    return holdingPufferPoint;
  }

  public async getBalanceByAddress(address: string, toTimestamp: number) {
    const blocks = await this.explorerService.getLastBlocks(toTimestamp);
    if (!blocks || blocks.length === 0) {
      throw new Error("Failed to get blocks.");
    }
    const blockNumber = blocks[0].number ?? 0;
    if (blockNumber === 0) {
      throw new Error("Failed to get block number.");
    }
    const tokenAddress = PUFFER_ETH_ADDRESS;
    let directBalance = BigInt(0);
    let withdrawBalance = BigInt(0);
    let layerBankBalance = BigInt(0);
    let aquaBalance = BigInt(0);

    const provider = new ethers.JsonRpcProvider("https://rpc.zklink.io");
    const block = await provider.getBlock(Number(blockNumber));
    const balanceOfMethod = "0x70a08231";
    const totalSupplyMethod = "0x18160ddd";
    const promiseList = [];

    // puffer eth balance of address
    promiseList.push(
      provider.call({
        to: tokenAddress,
        data: balanceOfMethod + address.replace("0x", "").padStart(64, "0"),
        blockTag: Number(blockNumber),
      }),
    );

    // puffer eth balance of aqua pairaddress
    promiseList.push(
      provider.call({
        to: tokenAddress,
        data: balanceOfMethod + AQUA_VAULT.replace("0x", "").padStart(64, "0"),
        blockTag: Number(blockNumber),
      }),
    );

    // puffer eth balance of layerbank pairaddress
    promiseList.push(
      provider.call({
        to: tokenAddress,
        data:
          balanceOfMethod + LAYERBANK_VAULT.replace("0x", "").padStart(64, "0"),
        blockTag: Number(blockNumber),
      }),
    );

    // lpuffer balance of address
    promiseList.push(
      provider.call({
        to: LAYERBANK_VAULT,
        data: balanceOfMethod + address.replace("0x", "").padStart(64, "0"),
        blockTag: Number(blockNumber),
      }),
    );

    // aq-lpuffer balance of address
    promiseList.push(
      provider.call({
        to: AQUA_PUFF_LP,
        data: balanceOfMethod + address.replace("0x", "").padStart(64, "0"),
        blockTag: Number(blockNumber),
      }),
    );

    // lpuffer total supply
    promiseList.push(
      provider.call({
        to: LAYERBANK_VAULT,
        data: totalSupplyMethod,
        blockTag: Number(blockNumber),
      }),
    );

    // aq-lpuffer total supply
    promiseList.push(
      provider.call({
        to: AQUA_PUFF_LP,
        data: totalSupplyMethod,
        blockTag: Number(blockNumber),
      }),
    );

    const [
      pufferEthAddress,
      pufferEthAqua,
      pufferEthLayerbank,
      lpufferAddress,
      aqpufferAddress,
      lpufferTotalSupply,
      aqpufferTotalSupply,
    ] = await Promise.all(promiseList);

    directBalance = BigInt(pufferEthAddress);

    const lpufferAddressBigInt = BigNumber(lpufferAddress);
    const pufferEthLayerbankBigInt = BigNumber(pufferEthLayerbank);
    const lpufferTotalSupplyBigInt = BigNumber(lpufferTotalSupply);
    const aqpufferAddressBigInt = BigNumber(aqpufferAddress);
    const pufferEthAquaBigInt = BigNumber(pufferEthAqua);
    const aqpufferTotalSupplyBigInt = BigNumber(aqpufferTotalSupply);

    // layerbank balance
    const layerBankBalanceBg = lpufferAddressBigInt
      .multipliedBy(pufferEthLayerbankBigInt)
      .div(lpufferTotalSupplyBigInt);
    layerBankBalance = BigInt(layerBankBalanceBg.toFixed(0));

    // aqua balance
    const aquaBalanceBg = aqpufferAddressBigInt
      .multipliedBy(pufferEthAquaBigInt)
      .div(aqpufferTotalSupplyBigInt);
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

    const totalBalance =
      directBalance + withdrawBalance + layerBankBalance + aquaBalance;
    return {
      totalBalance: ethers.formatEther(totalBalance).toString(),
      withdrawingBalance: ethers.formatEther(withdrawBalance).toString(),
      userBalance: ethers.formatEther(directBalance).toString(),
      liquidityBalance: ethers
        .formatEther(layerBankBalance + aquaBalance)
        .toString(),
      liquidityDetails: [
        {
          dappName: "LayerBank",
          balance: ethers.formatEther(layerBankBalance).toString(),
        },
        {
          dappName: "aqua",
          balance: ethers.formatEther(aquaBalance).toString(),
        },
      ],
    };
  }
}
