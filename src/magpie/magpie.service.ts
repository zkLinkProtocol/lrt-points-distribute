import { Injectable, Logger } from "@nestjs/common";
import { GraphQueryService } from "../common/service/graphQuery.service";
import { LocalPointsItem } from "../common/service/projectGraph.service";
import waitFor from "src/utils/waitFor";
import {
  LocalPointData,
  ProjectGraphService,
} from "src/common/service/projectGraph.service";
import {
  MagpieGraphQueryService,
  MagpieGraphTotalPoint,
} from "./magpieGraphQuery.service";
import { Worker } from "src/common/worker";

export interface MagpiePointItemWithBalance {
  address: string;
  tokenAddress: string;
  balance: bigint;
  localPoints: bigint;
  localTotalPointsPerToken: bigint;
  realEigenpiePoints: bigint;
  realEigenLayerPoints: bigint;
  realTotalEigenpiePointsPerToken: bigint;
  realTotalEigenLayerPointsPerToken: bigint;
  updatedAt: number;
}

export interface MagpiePointItemWithoutBalance {
  address: string;
  realEigenpiePoints: bigint;
  realEigenLayerPoints: bigint;
  updatedAt: number;
}

export interface MagpieData {
  localTotalPoints: bigint;
  realTotalEigenpiePoints: bigint;
  realTotalEigenLayerPoints: bigint;
  itemMaps?: Map<
    string,
    MagpiePointItemWithBalance[] | MagpiePointItemWithoutBalance[]
  >;
  items: MagpiePointItemWithBalance[] | MagpiePointItemWithoutBalance[];
}

@Injectable()
export class MagpieService extends Worker {
  private readonly projectName: string = "magpie";
  private readonly logger: Logger;
  public tokenAddress: string[];

  private magpieData: MagpieData = {
    localTotalPoints: 0n,
    realTotalEigenpiePoints: 0n,
    realTotalEigenLayerPoints: 0n,
    itemMaps: new Map(),
    items: [],
  };

  public constructor(
    private readonly graphQueryService: GraphQueryService,
    private readonly projectGraphService: ProjectGraphService,
    private readonly magpieGraphQueryService: MagpieGraphQueryService,
  ) {
    super();
    this.logger = new Logger(MagpieService.name);
  }

  public async runProcess() {
    this.logger.log(`Init ${MagpieService.name} onmoduleinit`);
    try {
      await this.loadPointsData();
    } catch (err) {
      this.logger.error(`${MagpieService.name} init failed.`, err.stack);
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

    let data: MagpiePointItemWithBalance[] = [];
    for (const [, item] of localPointsMap) {
      const realEigenpiePoints =
        (BigInt(item.points) * BigInt(realTotalPointsData.eigenpiePoints)) /
        BigInt(localTotalPoints);
      const realEigenLayerPoints =
        (BigInt(item.points) * BigInt(realTotalPointsData.eigenLayerPoints)) /
        BigInt(localTotalPoints);
      const pointsItem: MagpiePointItemWithBalance = {
        address: item.address,
        tokenAddress: item.token,
        balance: item.balance,
        localPoints: item.points,
        localTotalPointsPerToken: item.totalPointsPerToken,
        realEigenpiePoints: realEigenpiePoints,
        realEigenLayerPoints: realEigenLayerPoints,
        realTotalEigenpiePointsPerToken: realTotalPointsData.eigenpiePoints,
        realTotalEigenLayerPointsPerToken: realTotalPointsData.eigenLayerPoints,
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
      this.magpieData = {
        localTotalPoints: localTotalPoints,
        realTotalEigenpiePoints: realTotalPointsData.eigenpiePoints,
        realTotalEigenLayerPoints: realTotalPointsData.eigenLayerPoints,
        itemMaps: itemMaps,
        items: data,
      };
    } else {
      this.logger.log(`Load ${this.projectName} data empty.`);
    }
  }

  // return points data
  public getPointsData(address?: string): MagpieData {
    return {
      localTotalPoints: this.magpieData.localTotalPoints,
      realTotalEigenpiePoints: this.magpieData.realTotalEigenpiePoints,
      realTotalEigenLayerPoints: this.magpieData.realTotalEigenLayerPoints,
      items: address
        ? this.magpieData.itemMaps.get(address) ?? []
        : this.magpieData.items,
    };
  }

  // return local points and totalPoints
  public async getLocalPointsData(): Promise<LocalPointData> {
    return await this.projectGraphService.getPoints(this.projectName);
  }

  // return real totalPoints
  public async getRealPointsData(): Promise<MagpieGraphTotalPoint> {
    return await this.magpieGraphQueryService.getRealData();
  }

  // return real points group by address
  public getPointsDataGroupByAddress(): MagpieData {
    let data: Map<string, MagpiePointItemWithoutBalance> = new Map();
    const now = (new Date().getTime() / 1000) | 0;
    for (let i = 0; i < this.magpieData.items.length; i++) {
      const item = this.magpieData.items[i];
      if (!data.has(item.address)) {
        data.set(item.address, {
          address: item.address,
          realEigenpiePoints: item.realEigenpiePoints,
          realEigenLayerPoints: item.realEigenLayerPoints,
          updatedAt: now,
        } as MagpiePointItemWithoutBalance);
      } else {
        const tmpItem = data.get(item.address);
        tmpItem.realEigenLayerPoints += item.realEigenLayerPoints;
        tmpItem.realEigenpiePoints += item.realEigenpiePoints;
      }
    }
    return {
      localTotalPoints: this.magpieData.localTotalPoints,
      realTotalEigenpiePoints: this.magpieData.realTotalEigenpiePoints,
      realTotalEigenLayerPoints: this.magpieData.realTotalEigenLayerPoints,
      items: Array.from(data.values()),
    };
  }
}
