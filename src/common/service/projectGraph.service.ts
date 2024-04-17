import { Injectable, Logger } from '@nestjs/common';
import { GraphPoint, GraphQueryService, GraphTotalPoint } from 'src/common/service/graphQuery.service';
import { BigNumber } from 'bignumber.js';
import { WithdrawService } from 'src/common/service/withdraw.service';

export interface LocalPointsItem {
  address: string,
  points: bigint,
  withdrawPoints: bigint,
  withdrawTotalPointsPerToken: bigint,
  totalPointsPerToken: bigint,
  totalPointsPerTokenMau: bigint,
  balance: bigint,
  token: string,
  updatedAt: number,
}

export interface LocalPointData {
  localPoints: LocalPointsItem[],
  localTotalPoints: bigint
}

@Injectable()
export class ProjectGraphService {
  private readonly logger: Logger;

  public constructor(
    private readonly graphQueryService: GraphQueryService,
    private readonly withdrawService: WithdrawService
  ) {
    this.logger = new Logger(ProjectGraphService.name);
  }
  
  public async getPoints(projectName: string, address?: string): Promise<LocalPointData> 
  {
    this.logger.log(`Start query ${projectName} graph data.`);
    let points: GraphPoint[] = [], totalPoints: GraphTotalPoint[] = [];
    if(address){
      [points, totalPoints] = await this.graphQueryService.queryPointsRedistributedByProjectNameAndAddress(address, projectName);
    }else{
      let page = 1, limit = 1000, lastPageNum = limit;
      while(lastPageNum >= limit){
        const [_points, _totalPoints] = await this.graphQueryService.queryPointsRedistributedByProjectName(projectName, page, limit);
        lastPageNum = _points.length;
        totalPoints = _totalPoints;
        if(lastPageNum > 0){
          points = [...points, ..._points];
        }
        page++;
      }
    }
    this.logger.log(`End query ${projectName} graph data.`);
    if(points.length < 1){
      this.logger.log(`Not found ${projectName} graph data.`);
      return {localPoints : [], localTotalPoints : BigInt(0)};
    }
    let localTokenTotalPoint: Map<String, bigint> = new Map;
    let localTotalPoints: bigint = BigInt(0);
    for (const item of totalPoints) {
      const tempTokenTotalPoints = this.calculateTotalPoint(item);
      localTokenTotalPoint.set(item.project, tempTokenTotalPoints);
      localTotalPoints += tempTokenTotalPoints;
    }

    let localPoints: LocalPointsItem[] = [];
    const now = (new Date().getTime() / 1000) | 0;
    for (const point of points) {
      const projectArr = point.project.split('-');
      const token = projectArr[1].toLocaleLowerCase();
      const withdrawPoints = this.withdrawService.getWithdrawPoint(token, point.address.toLocaleLowerCase());
      const withdrawTotalPoint = this.withdrawService.getWithdrawTotalPoint(token);
      const newPoint = {
        address: point.address.toLocaleLowerCase(),
        points: GraphQueryService.getPoints(point, now) + withdrawPoints,
        withdrawPoints: withdrawPoints,
        withdrawTotalPointsPerToken: withdrawTotalPoint,
        totalPointsPerToken: localTokenTotalPoint.get(point.project) + withdrawTotalPoint,
        balance: BigInt(point.balance),
        token: token,
        updatedAt: now,
      } as LocalPointsItem;
      localPoints.push(newPoint);
    }

    const totalPointsPerTokenMau: Map<string, bigint> = new Map;
    for (const item of localPoints) {
      if(!totalPointsPerTokenMau.has(item.token)){
        totalPointsPerTokenMau.set(item.token, item.points);
      }else{
        const temptotalPointsPerTokenMau = totalPointsPerTokenMau.get(item.token);
        totalPointsPerTokenMau.set(item.token, temptotalPointsPerTokenMau + item.points);
      }
    }

    localPoints.map(item => {
      item.totalPointsPerTokenMau = totalPointsPerTokenMau.get(item.token);
      return item;
    });

    this.logger.log(`Success load ${projectName} graph data length : ${localPoints.length}, localTotalPoints : ${localTotalPoints}.`);
    return {localPoints, localTotalPoints};
  }

  private calculateTotalPoint(totalPoint: GraphTotalPoint): bigint{
    const now = (new Date().getTime() / 1000) | 0;
    return GraphQueryService.getTotalPoints(totalPoint, now);
  }

  public calculateRealPoints(
    points: bigint,
    totalPoint: bigint,
    realTotalPoint: number
  ): number {
    return Number(
      new BigNumber(points.toString())
          .multipliedBy(new BigNumber(realTotalPoint))
          .dividedBy(new BigNumber(totalPoint.toString()))
          .toFixed(18)
    );
  }
}