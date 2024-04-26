import { Injectable, Logger } from "@nestjs/common";
import { cloneDeep } from "lodash";
import {
  LocalPointData,
  ProjectGraphService,
} from "src/common/service/projectGraph.service";
import {
  MagpieGraphQueryService,
  MagpieGraphTotalPoint,
} from "./magpieGraphQuery.service";

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
  items: MagpiePointItemWithBalance[] | MagpiePointItemWithoutBalance[];
}

@Injectable()
export class MagpieService {
  private readonly projectName: string = "magpie";
  private readonly logger: Logger;

  private magpieData: MagpieData = {
    localTotalPoints: 0n,
    realTotalEigenpiePoints: 0n,
    realTotalEigenLayerPoints: 0n,
    items: [],
  };

  public constructor(
    private readonly projectGraphService: ProjectGraphService,
    private readonly magpieGraphQueryService: MagpieGraphQueryService,
  ) {
    this.logger = new Logger(MagpieService.name);
  }

  public async onModuleInit() {
    this.logger.log(`Init ${MagpieService.name} onmoduleinit`);
    const func = async () => {
      try {
        await this.loadPointsData();
      } catch (err) {
        this.logger.error(`${MagpieService.name} init failed.`, err.stack);
      }
    };
    func();
    setInterval(func, 1000 * 60);
  }

  // load points data
  public async loadPointsData() {
    const realTotalPointsData = await this.getRealPointsData();
    const localPointsData = await this.getLocalPointsData();
    const localPoints = localPointsData.localPoints;
    const localTotalPoints = localPointsData.localTotalPoints;

    let data: MagpiePointItemWithBalance[] = [];
    for (const item of localPoints) {
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
    if (data.length > 0) {
      this.magpieData = {
        localTotalPoints: localTotalPoints,
        realTotalEigenpiePoints: realTotalPointsData.eigenpiePoints,
        realTotalEigenLayerPoints: realTotalPointsData.eigenLayerPoints,
        items: data,
      };
    } else {
      this.logger.log(`Load ${this.projectName} data empty.`);
    }
  }

  // return points data
  public getPointsData(address?: string): MagpieData {
    let result: MagpieData = cloneDeep(this.magpieData);
    if (address) {
      const _address = address.toLocaleLowerCase();
      result.items = this.magpieData.items.filter(
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
  public async getRealPointsData(): Promise<MagpieGraphTotalPoint> {
    return await this.magpieGraphQueryService.getRealData();
  }

  // return real points group by address
  public getPointsDataGroupByAddress(): MagpieData {
    let result: MagpieData = cloneDeep(this.magpieData);
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
    result.items = Array.from(data.values());
    return result;
  }
}
