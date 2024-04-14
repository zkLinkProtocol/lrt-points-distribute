import { Injectable, Logger } from '@nestjs/common';
import { GraphPoint, GraphQueryService, GraphTotalPoint } from 'src/explorer/graphQuery.service';
import { BigNumber } from 'bignumber.js';

export interface LocalPointsItem {
  address: string,
  points: bigint,
  perTokenTotalPoints: bigint,
  perTokenTotalPointsMau: bigint,
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

  public constructor(private readonly graphQueryService: GraphQueryService) {
    this.logger = new Logger(ProjectGraphService.name);
  }
  
  public async getPoints(projectName: string): Promise<LocalPointData>;
  public async getPoints(projectName: string, address: string): Promise<LocalPointData>;
  public async getPoints(projectName: string, address?: string): Promise<LocalPointData> 
  {
    this.logger.log(`Start query ${projectName} graph data.`);
    let points: GraphPoint[] = [], totalPoints: GraphTotalPoint[] = [];
    if(address){
      [points, totalPoints] = await this.graphQueryService.queryPointsRedistributedByProjectNameAndAddress(address, projectName);
    }else{
      let page = 1, limit = 1000, lastPageNum = 1000;
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
      const newPoint = {
        address: point.address,
        points: GraphQueryService.getPoints(point, now),
        perTokenTotalPoints: localTokenTotalPoint.get(point.project),
        balance: BigInt(point.balance),
        token: projectArr[1],
        updatedAt: now,
      } as LocalPointsItem;
      localPoints.push(newPoint);
    }

    const perTokenTotalPointsMau: Map<string, bigint> = new Map;
    for (const item of localPoints) {
      if(!perTokenTotalPointsMau.has(item.token)){
        perTokenTotalPointsMau.set(item.token, item.points);
      }else{
        const tempPerTokenTotalPointsMau = perTokenTotalPointsMau.get(item.token);
        perTokenTotalPointsMau.set(item.token, tempPerTokenTotalPointsMau + item.points);
      }
    }

    localPoints.map(item => {
      item.perTokenTotalPointsMau = perTokenTotalPointsMau.get(item.token);
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
