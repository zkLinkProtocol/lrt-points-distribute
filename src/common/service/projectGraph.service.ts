import { Injectable, Logger } from "@nestjs/common";
import {
  GraphPoint,
  GraphQueryService,
  GraphTotalPoint,
} from "./graphQuery.service";
import { BigNumber } from "bignumber.js";
import { WithdrawService } from "./withdraw.service";
import transferFaildData from "../transferFaild.json";

export interface LocalPointsItem {
  address: string;
  points: bigint;
  withdrawPoints: bigint;
  withdrawTotalPointsPerToken: bigint;
  totalPointsPerToken: bigint;
  totalPointsPerTokenMau?: bigint;
  balance: bigint;
  token: string;
  updatedAt: number;
}

export interface LocalPointData {
  localPoints: LocalPointsItem[];
  localTotalPoints: bigint;
}

@Injectable()
export class ProjectGraphService {
  private readonly logger: Logger;
  // withdrawTime:2024-04-29 18:00:00 +8UTC
  private readonly withdrawTime: number = 1714356000;
  // transfer faild startTime:2024-04-09 21:18:35 +8UTC
  private readonly transferFaildStartTime: number = 1712639915;

  public constructor(
    private readonly graphQueryService: GraphQueryService,
    private readonly withdrawService: WithdrawService,
  ) {
    this.logger = new Logger(ProjectGraphService.name);
  }

  public async getPoints(
    projectName: string,
    address?: string,
  ): Promise<LocalPointData> {
    this.logger.log(`Start query ${projectName} graph data.`);
    let points: GraphPoint[] = [],
      totalPoints: GraphTotalPoint[] = [];
    if (address) {
      [points, totalPoints] =
        await this.graphQueryService.queryPointsRedistributedByProjectNameAndAddress(
          address,
          projectName,
        );
    } else {
      const limit = 1000;
      let page = 1,
        lastPageNum = limit;
      while (lastPageNum >= limit) {
        const [_points, _totalPoints] =
          await this.graphQueryService.queryPointsRedistributedByProjectName(
            projectName,
            page,
            limit,
          );
        lastPageNum = _points.length;
        totalPoints = _totalPoints;
        if (lastPageNum > 0) {
          points = [...points, ..._points];
        }
        page++;
      }
    }
    this.logger.log(`End query ${projectName} graph data.`);
    if (points.length < 1) {
      this.logger.log(`Not found ${projectName} graph data.`);
      return { localPoints: [], localTotalPoints: BigInt(0) };
    }
    const localTokenTotalPoint: Map<string, bigint> = new Map();
    let localTotalPoints: bigint = BigInt(0);
    for (const item of totalPoints) {
      const tempTokenTotalPoints = this.calculateTotalPoint(item);
      localTokenTotalPoint.set(item.project, tempTokenTotalPoints);
      localTotalPoints += tempTokenTotalPoints;
    }

    const localPoints: LocalPointsItem[] = [];
    const now = (new Date().getTime() / 1000) | 0;
    for (const point of points) {
      const projectArr = point.project.split("-");
      const token = projectArr[1].toLocaleLowerCase();
      const withdrawPoints = this.withdrawService.getWithdrawPoint(
        token,
        point.address.toLocaleLowerCase(),
      );
      const withdrawTotalPoint =
        this.withdrawService.getWithdrawTotalPoint(token);
      if (
        token.toLocaleLowerCase() ==
          "0x78adf06756c5f3368c003ffbf675fc03a938a145".toLocaleLowerCase() &&
        point.address.toLocaleLowerCase() ==
          "0x0002605f551ea9a4b4aae99d2cb11865b13f2d91"
      ) {
        this.logger.log(
          `token:${token}, withdrawTotalPoint:${withdrawTotalPoint},point.address:${point.address},withdrawPoints:${withdrawPoints}`,
        );
      }
      const newPoint = {
        address: point.address.toLocaleLowerCase(),
        points: GraphQueryService.getPoints(point, now) + withdrawPoints,
        withdrawPoints: withdrawPoints,
        withdrawTotalPointsPerToken: withdrawTotalPoint,
        totalPointsPerToken:
          localTokenTotalPoint.get(point.project) + withdrawTotalPoint,
        balance: BigInt(point.balance),
        token: token,
        updatedAt: now,
      } as LocalPointsItem;
      localPoints.push(newPoint);
    }

    // calculate totalPointsPerTokenMau
    const totalPointsPerTokenMau: Map<string, bigint> = new Map();
    for (const item of localPoints) {
      if (!totalPointsPerTokenMau.has(item.token)) {
        totalPointsPerTokenMau.set(item.token, item.points);
      } else {
        const temptotalPointsPerTokenMau = totalPointsPerTokenMau.get(
          item.token,
        );
        totalPointsPerTokenMau.set(
          item.token,
          temptotalPointsPerTokenMau + item.points,
        );
      }
    }

    localPoints.map((item) => {
      item.totalPointsPerTokenMau = totalPointsPerTokenMau.get(item.token);
      return item;
    });

    this.logger.log(
      `Success load ${projectName} graph data length : ${localPoints.length}, localTotalPoints : ${localTotalPoints}.`,
    );
    return { localPoints, localTotalPoints };
  }

  private calculateTotalPoint(totalPoint: GraphTotalPoint): bigint {
    const now = (new Date().getTime() / 1000) | 0;
    return GraphQueryService.getTotalPoints(totalPoint, now);
  }

  public calculateRealPoints(
    points: bigint,
    totalPoint: bigint,
    realTotalPoint: number,
  ): number {
    return Number(
      new BigNumber(points.toString())
        .multipliedBy(new BigNumber(realTotalPoint))
        .dividedBy(new BigNumber(totalPoint.toString()))
        .toFixed(18),
    );
  }

  // get transferFaildPoints by tokenAddress
  public getTransferFaildPoints(tokenAddresses: string[]): any[] {
    const now = (new Date().getTime() / 1000) | 0;
    const calcuTime = Math.min(now, this.withdrawTime);
    const data = transferFaildData.filter((item) => {
      return tokenAddresses.includes(item[1].toLocaleLowerCase());
    });
    return data.map((item) => {
      return {
        address: item[0].toLocaleLowerCase(),
        tokenAddress: item[1].toLocaleLowerCase(),
        balance: BigInt(
          BigNumber(item[2])
            .multipliedBy(10 ** Number(item[3]))
            .toString(),
        ),
        points:
          BigInt(
            BigNumber(item[2])
              .multipliedBy(10 ** Number(item[3]))
              .toString(),
          ) * BigInt(calcuTime - this.transferFaildStartTime),
      };
    });
  }

  public getTransferFaildTotalPoint(tokenAddress: string): bigint {
    const now = (new Date().getTime() / 1000) | 0;
    const calcuTime = Math.min(now, this.withdrawTime);
    let totalPoint = BigInt(0);
    // loop transferFaildData
    // item[0] is address, item[1] is tokenAddress, item[2] is balance, item[3] is decimal
    for (const item of transferFaildData) {
      if (item[1].toLocaleLowerCase() == tokenAddress) {
        totalPoint +=
          BigInt(
            BigNumber(item[2])
              .multipliedBy(10 ** Number(item[3]))
              .toString(),
          ) * BigInt(calcuTime - this.transferFaildStartTime);
      }
    }
    return totalPoint;
  }
}
