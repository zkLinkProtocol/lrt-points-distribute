import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { GraphQueryService, GraphWithdrawPoint } from "./graphQuery.service";

export interface WithdrawPoint {
  project: string;
  address: string;
  point: bigint;
}

export interface WithdrawPointData {
  totalPoint: bigint;
  pointPerAddress: bigint;
}

const timeToPeriod = [
  {
    start: 1713024000, // 2024-04-14 00:00:00
    end: 1713628800, // 2024-04-21 00:00:00
    period: 14 * 24 * 3600,
  },
  {
    start: 1713628800, // 2024-04-21 00:00:00
    end: 1713715200, // 2024-04-22 00:00:00
    period: 13 * 24 * 3600,
  },
  {
    start: 1713715200, // 2024-04-22 00:00:00
    end: 1713801600, // 2024-04-23 00:00:00
    period: 12 * 24 * 3600,
  },
  {
    start: 1713801600, // 2024-04-23 00:00:00
    end: 1713888000, // 2024-04-24 00:00:00
    period: 11 * 24 * 3600,
  },
  {
    start: 1713888000, // 2024-04-24 00:00:00
    end: 1713974400, // 2024-04-25 00:00:00
    period: 10 * 24 * 3600,
  },
  {
    start: 1713974400, // 2024-04-25 00:00:00
    end: 1714060800, // 2024-04-26 00:00:00
    period: 9 * 24 * 3600,
  },
  {
    start: 1714060800, // 2024-04-26 00:00:00
    end: 1714147200, // 2024-04-27 00:00:00
    period: 8 * 24 * 3600,
  },
  {
    start: 1714147200, // 2024-04-27 00:00:00
    end: 1714233600, // 2024-04-28 00:00:00
    period: 7 * 24 * 3600,
  },
  {
    start: 1714147200, // 2024-04-28 00:00:00
    end: 2029766400, // 2034-04-28 00:00:00
    period: 7 * 24 * 3600,
  },
];

@Injectable()
export class WithdrawService implements OnModuleInit {
  private readonly logger: Logger;
  private readonly graphQueryService: GraphQueryService;
  private withdrawPointsAllList: Map<string, Map<string, WithdrawPoint>> =
    new Map();
  private withdrawTotalPoint: Map<string, bigint> = new Map();

  public constructor(graphQueryService: GraphQueryService) {
    this.graphQueryService = graphQueryService;
    this.logger = new Logger(WithdrawService.name);
  }

  public async onModuleInit() {
    const func = async () => {
      try {
        await this.loadAllWithdrawPointsData();
      } catch (err) {
        this.logger.error(`${WithdrawService.name} init failed`, err.stack);
      }
    };
    func();
    setInterval(func, 1000 * 60);
  }

  public async loadAllWithdrawPointsData() {
    const limit = 1000;
    let page = 1,
      lastPageNumber = limit,
      graphWithdrawPointsList: GraphWithdrawPoint[] = [];
    const withdrawPointsAllList: Map<
        string,
        Map<string, WithdrawPoint>
      > = new Map(),
      withdrawTotalPoint: Map<string, bigint> = new Map();
    while (lastPageNumber == limit) {
      const tmpItems = await this.graphQueryService.queryWithdrawPoints(
        page,
        limit,
      );
      lastPageNumber = tmpItems.length;
      page++;
      graphWithdrawPointsList = [...graphWithdrawPointsList, ...tmpItems];
    }

    for (const item of graphWithdrawPointsList) {
      const now = (new Date().getTime() / 1000) | 0;
      let pointEndTime = 0;
      const tmpEndTime = this.findWithdrawEndTime(item.blockTimestamp);
      // if deadline before current time
      if (tmpEndTime < now) {
        pointEndTime = tmpEndTime;
      } else {
        pointEndTime = now;
      }
      const tmpPoint = GraphQueryService.calcuPoint(
        item.weightBalance,
        item.timeWeightAmountIn,
        item.timeWeightAmountOut,
        pointEndTime,
      );

      if (withdrawTotalPoint.has(item.project)) {
        const _orgTotalPoint = withdrawTotalPoint.get(item.project);
        withdrawTotalPoint.set(item.project, _orgTotalPoint + tmpPoint);
      } else {
        withdrawTotalPoint.set(item.project, tmpPoint);
      }
      const tmpItem = {
        project: item.project.toLocaleLowerCase(),
        address: item.address.toLocaleLowerCase(),
        point: tmpPoint,
      } as WithdrawPoint;
      const withdrawPointsPerProject =
        withdrawPointsAllList.get(item.project) ||
        new Map<string, WithdrawPoint>();
      withdrawPointsAllList.set(item.project, withdrawPointsPerProject);
      if (!withdrawPointsPerProject.has(item.address)) {
        withdrawPointsPerProject.set(item.address, { ...tmpItem });
      } else {
        const existingPoint = withdrawPointsPerProject.get(item.address);
        existingPoint.point += tmpPoint;
      }
    }

    this.withdrawPointsAllList = withdrawPointsAllList;
    this.withdrawTotalPoint = withdrawTotalPoint;
  }

  public getWithdrawPointDataPerToken(
    token: string,
    address: string,
  ): WithdrawPointData {
    return {
      totalPoint: this.withdrawTotalPoint.get(token),
      pointPerAddress: this.withdrawPointsAllList.get(token).get(address).point,
    } as WithdrawPointData;
  }

  public getWithdrawTotalPoint(token: string): bigint {
    return this.withdrawTotalPoint.get(token) ?? 0n;
  }

  public getWithdrawPoint(token: string, address: string): bigint {
    return this.withdrawPointsAllList.get(token)?.get(address)?.point ?? 0n;
  }

  private findWithdrawEndTime(withdrawTime: number): number {
    const t = Number(withdrawTime);
    for (const item of timeToPeriod) {
      if (t >= item.start && t < item.end) {
        return t + item.period;
      }
    }
    return t;
  }
}
