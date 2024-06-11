import { Injectable, Logger } from "@nestjs/common";
import { SwethApiService } from "./sweth.api.service";
import BigNumber from "bignumber.js";
import waitFor from "src/utils/waitFor";
import { Worker } from "src/common/worker";
import {
  RedistributeBalanceRepository,
  RedistributePointsWeight,
} from "src/repositories/redistributeBalance.repository";

export interface PointsItem {
  address: string;
  balance: bigint;
  points: number;
}

@Injectable()
export class SwethService extends Worker {
  private readonly logger: Logger;
  private readonly tokens: string[] = [
    "0x2957AbFF50A6FF88336599Cc9E9E0c664F729f40".toLocaleLowerCase(),
    "0x78aDF06756c5F3368c003FFbF675Fc03a938a145".toLocaleLowerCase(),
  ];
  private realTotalPoints: number = 0;

  public tokenAddress: string[];
  public constructor(
    private readonly swethApiService: SwethApiService,
    private readonly redistributeBalanceRepository: RedistributeBalanceRepository,
  ) {
    super();
    this.logger = new Logger(SwethService.name);
  }

  public async runProcess() {
    this.logger.log(`Init ${SwethService.name} onmoduleinit`);
    try {
      await this.loadPointsData();
    } catch (err) {
      this.logger.error(`${SwethService.name} init failed.`, err.stack);
    }
    await waitFor(() => !this.currentProcessPromise, 60 * 1000, 60 * 1000);
    if (!this.currentProcessPromise) {
      return;
    }
    return this.runProcess();
  }

  private async loadPointsData() {
    this.realTotalPoints = await this.getRealTotalPoints();
  }

  public async getPointsList(
    page: number = 1,
    pageSize: number = 100,
  ): Promise<[PointsItem[], number]> {
    const [pointsWeight, totalCount] = await this.getPointsWeightPaginaed(
      page,
      pageSize,
    );
    if (pointsWeight.length === 0) {
      return [[], 0];
    }
    const totalPointsWeight = await this.getTotalPointWeight();
    const realTotalPoints = this.realTotalPoints ?? 0;
    const result = pointsWeight.map((item) => {
      const realPoints = new BigNumber(item.pointWeight.toString())
        .multipliedBy(realTotalPoints)
        .div(BigNumber(totalPointsWeight.toString()))
        .toFixed(2);
      return {
        address: item.userAddress,
        balance: item.balance,
        realPoints: realPoints,
      };
    });
    return [
      result.map((item) => ({
        address: item.address,
        balance: item.balance,
        points: Number(item.realPoints),
      })) as PointsItem[],
      totalCount,
    ];
  }

  public async getPoints(address: string): Promise<PointsItem> {
    const pointsWeight: RedistributePointsWeight[] =
      await this.redistributeBalanceRepository.getRedistributePointsWeight(
        this.tokens,
        [address],
      );
    if (pointsWeight.length == 0) {
      return null;
    }
    if (pointsWeight.length !== 1) {
      throw new Error(
        `getPointsWeight error: ${address}, data: ${JSON.stringify(pointsWeight)}`,
      );
    }
    const item = pointsWeight[0];
    const totalPointsWeight = await this.getTotalPointWeight();
    const realTotalPoints = await this.realTotalPoints;
    const realPoints = new BigNumber(item.pointWeight.toString())
      .multipliedBy(realTotalPoints)
      .div(BigNumber(totalPointsWeight.toString()))
      .toFixed(2);
    const result = {
      address: item.userAddress,
      balance: item.balance,
      points: Number(realPoints),
    };
    return result;
  }

  // return points weight
  private async getPointsWeightPaginaed(
    page: number = 1,
    pageSize: number = 100,
  ): Promise<[RedistributePointsWeight[], number]> {
    const [addresses, totalCount] =
      await this.redistributeBalanceRepository.getPaginatedUserAddress(
        this.tokens,
        page,
        pageSize,
      );
    if (addresses.length === 0) {
      return [[], 0];
    }
    const data =
      await this.redistributeBalanceRepository.getRedistributePointsWeight(
        this.tokens,
        addresses,
      );
    return [data, totalCount];
  }

  // return total points weight
  private async getTotalPointWeight(): Promise<bigint> {
    return await this.redistributeBalanceRepository.getTotalRedistributePointsWeight(
      this.tokens,
    );
  }

  // return real totalPoints
  private async getRealTotalPoints(): Promise<number> {
    return await this.swethApiService.fetchPoints();
  }
}
