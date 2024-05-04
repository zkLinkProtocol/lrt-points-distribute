import { Injectable, Logger } from "@nestjs/common";
import {
  LocalPointData,
  ProjectGraphService,
} from "src/common/service/projectGraph.service";
import { GraphQueryService } from "src/common/service/graphQuery.service";
import BigNumber from "bignumber.js";
import { NovaService } from "src/nova/nova.service";
import { ConfigService } from "@nestjs/config";
import { PagingOptionsDto } from "src/common/pagingOptionsDto.dto";

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
  EigenlayerPool[],
];

const LAYERBANK_LPUFFER =
  "0xdd6105865380984716C6B2a1591F9643e6ED1C48".toLocaleLowerCase();

@Injectable()
export class PuffPointsService {
  public tokenAddress: string;
  private readonly projectName: string = "puffer";
  private readonly logger: Logger;
  private realTotalPoints: number = 0;
  private localTotalPoints: bigint = BigInt(0);
  private localPoints: PufferPointItem[] = [];
  private puffElPointsGraphApi: string;

  public constructor(
    private readonly projectGraphService: ProjectGraphService,
    private readonly graphQueryService: GraphQueryService,
    private readonly novaService: NovaService,
    private readonly configService: ConfigService,
  ) {
    this.logger = new Logger(PuffPointsService.name);
    this.puffElPointsGraphApi = this.configService.get<string>(
      "novaPointPufferElPointsGraphApi",
    );
  }

  public async onModuleInit() {
    this.logger.log(`Init ${PuffPointsService.name} onmoduleinit`);
    const func = async () => {
      try {
        await this.loadPointsData();
      } catch (err) {
        this.logger.error(`${PuffPointsService.name} init failed.`, err.stack);
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
    if (tokens.length > 0) {
      this.tokenAddress = tokens[0];
    }

    this.realTotalPoints = await this.getRealPointsData();
    const pointsData = await this.getLocalPointsData();
    this.localTotalPoints = pointsData.localTotalPoints;
    const _localPoints = pointsData.localPoints;
    const localPoints = [];
    for (let i = 0; i < _localPoints.length; i++) {
      const item = _localPoints[i];
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
  public getPointsData(address?: string): PufferData {
    const result: PufferData = {
      localTotalPoints: this.localTotalPoints,
      realTotalPoints: this.realTotalPoints,
      items: this.localPoints,
    } as PufferData;
    if (address && this.localPoints.length > 0) {
      const _address = address.toLocaleLowerCase();
      result.items = this.localPoints.filter(
        (item) => item.address === _address,
      );
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

  //get layerbank point
  public async getLayerBankPoint(address: string): Promise<number> {
    const _lpuffer = this.localPoints.filter(
      (item) => item.address === LAYERBANK_LPUFFER,
    );
    if (_lpuffer.length == 0) {
      return 0;
    }
    const lpuffer = _lpuffer[0];
    const lpufferPointData = await this.novaService.getPoints(
      LAYERBANK_LPUFFER,
      [address],
    );
    const lpufferFinalPoints = lpufferPointData.finalPoints;
    const lpufferFinalTotalPoints = lpufferPointData.finalTotalPoints;
    if (lpufferFinalPoints.length > 0) {
      return new BigNumber(lpufferFinalPoints[0].points.toString())
        .multipliedBy(lpuffer.realPoints)
        .div(lpufferFinalTotalPoints.toString())
        .toNumber();
    }
    return 0;
  }

  //get layerbank point
  public async getLayerBankPointList(
    addresses: string[],
  ): Promise<Array<{ layerbankPoint: number; address: string }>> {
    const lpuffer = this.localPoints.find(
      (item) => item.address === LAYERBANK_LPUFFER,
    );

    const lpufferPointData = await this.novaService.getPoints(
      LAYERBANK_LPUFFER,
      addresses,
    );
    const lpufferFinalPoints = lpufferPointData.finalPoints;
    const lpufferFinalTotalPoints = lpufferPointData.finalTotalPoints;

    return lpufferFinalPoints.map((lpufferFinalPoint) => ({
      address: lpufferFinalPoint.address,
      layerbankPoint: new BigNumber(lpufferFinalPoint.points.toString())
        .multipliedBy(lpuffer?.realPoints ?? 0)
        .div(lpufferFinalTotalPoints.toString())
        .toNumber(),
    }));
  }

  public async getPuffElPointsByAddress(
    address: string,
  ): Promise<PufferElPointsByAddress> {
    const protocolName = "LayerBank";
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
            positions( where: {poolName: ${JSON.stringify(protocolName)}}) {
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

  public async getPufferLBPoints(
    address: string,
    date: string,
  ): Promise<PufferUserBalance> {
    const protocolName = ["LayerBank"]; // "Aqua" to be added

    const specialDateTime = new Date("2015-07-30 00:00:00").getTime();
    const queryDateTime = new Date(date).getTime();

    const queryUnixTime =
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
            withdrawHistory(first: 1000, where: {blockTimestamp_gt: "${queryUnixTime}", token: "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC"}) {
              token
              id
              blockTimestamp
              blockNumber
              balance
            }
          }
        }`,
      };

      const response = await fetch(
        "http://3.114.68.110:8000/subgraphs/name/puffer-el-points-v2",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(balanceQueryBody),
        },
      );
      const { data } = await response.json();

      const historicData = data.userPosition.positionHistory.map((i) => ({
        poolId: i.pool,
        blockNumber: i.blockNumber,
      }));

      const genPoolQueryBody = (id: string, blockNumber: number) => ({
        query: `{
          pool(block: {number: ${blockNumber}}, id: "${id}") {
            decimals
            id
            name
            symbol
            totalSupplied
            underlying
            balance
          }
        }`,
      });

      const poolData = await Promise.all(
        historicData.map(async (item) => {
          const queryString = genPoolQueryBody(item.poolId, item.blockNumber);
          const response = await fetch(
            "http://3.114.68.110:8000/subgraphs/name/puffer-el-points-v2",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(queryString),
            },
          );
          const { data } = await response.json();
          return data.pool;
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
    const protocolName = "LayerBank";
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
            positions(first: 1000, where: {poolName: ${JSON.stringify(protocolName)}}) {
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
}
