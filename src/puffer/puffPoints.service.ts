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
import { ProjectRepository } from "src/repositories/project.repository";

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
    private readonly projectRepository: ProjectRepository,
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
  public async getPoolInfoByProject(name: string) {
    const pairAddresses = await this.projectRepository.getPairAddresses(name);
    const poolAddresses =
      await this.redistributeBalanceRepository.getPoolsByToken(
        Buffer.from(PUFFER_ETH_ADDRESS.slice(2), "hex"),
        pairAddresses,
      );
    return poolAddresses.map((poolAddress) => {
      if (name === "aqua") {
        return {
          vaultAddress: AQUA_VAULT,
          poolAddress: poolAddress,
        };
      }
      return {
        vaultAddress: poolAddress,
        poolAddress: poolAddress,
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
    const projects = [
      { name: "aqua", displayName: "Aqua" },
      { name: "layerbank", displayName: "LayerBank" },
      { name: "agx", displayName: "AGX" },
      { name: "novaswap", displayName: "NovaSwap" },
      { name: "shoebill", displayName: "Shoebill Finance" },
    ];

    const redistributeList = (
      await Promise.all(
        projects.map(async (project) => {
          const info = await this.getPoolInfoByProject(project.name);
          return info.map((i) => ({ ...i, dappName: project.displayName }));
        }),
      )
    ).flat();

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
    const map = await this.getPufferLPAddressMap(totalPufferPoints);
    const data =
      await this.redistributeBalanceRepository.getUserStakedPositionsByToken(
        Buffer.from(PUFFER_ETH_ADDRESS.slice(2), "hex"),
        Buffer.from(address.slice(2), "hex"),
      );

    const result = data.map((position) => {
      const pointData = map.get(position.poolAddress);
      return {
        point: pointData.points * position.pointWeightPercentage,
        balance: position.balance,
        dappName: pointData.dappName,
      };
    });
    return result;
  }
}
