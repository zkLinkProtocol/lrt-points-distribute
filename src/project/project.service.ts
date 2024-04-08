import { Injectable, Logger } from '@nestjs/common';
import {
  GraphPoint,
  GraphQueryService,
  GraphTotalPoint,
} from 'src/explorer/graphQuery.service';

export interface PointData {
  finalPoints: any[],
  finalTotalPoints: bigint
}

@Injectable()
export class ProjectService {
  private readonly logger: Logger;
  private readonly graphQueryService: GraphQueryService;

  public constructor(graphQueryService: GraphQueryService) {
    this.graphQueryService = graphQueryService;
    this.logger = new Logger(ProjectService.name);
  }

  public async getPoints(
    projectName: string,
    address: string,
  ): Promise<PointData> {
    let finalTotalPoints = BigInt(0),
        finalPoints = [],
        points: GraphPoint[], 
        totalPoints: GraphTotalPoint;

    const projectIds = this.graphQueryService.getAllProjectIds(projectName);

    for (const key in projectIds) {
      if (Object.prototype.hasOwnProperty.call(projectIds, key)) {
        const projectId = projectIds[key];
        [points, totalPoints] = await this.graphQueryService.queryPointsRedistributedByAddress(address, projectId); 
        if (Array.isArray(points) && totalPoints) {
          const [tmpPoints, tmpTotalPoints] = this.getPointData(points, totalPoints);
          finalTotalPoints += tmpTotalPoints;
          finalPoints = [...finalPoints, ...tmpPoints];
        } else {
          // Exception in fetching GraphQL data.
          throw new Error('Exception in fetching GraphQL data.');
        }
      }
    }
    return {finalPoints, finalTotalPoints};
  }

  public async getAllPoints(
    projectName: string,
  ): Promise<PointData> {
    let finalTotalPoints = BigInt(0),
        finalPoints = [],
        points: GraphPoint[], 
        totalPoints: GraphTotalPoint,
        addressPoints : Map<string, Map<string, any>> = new Map();
  
    const projectIds = this.graphQueryService.getAllProjectIds(projectName);
  
    for (const projectId of projectIds) {
      [points, totalPoints] = await this.graphQueryService.queryPointsRedistributed(projectId); 
      if (Array.isArray(points) && totalPoints) {
        const now = (new Date().getTime() / 1000) | 0;
        const totalPointsTmp = GraphQueryService.getTotalPoints(totalPoints, now);
        finalTotalPoints += totalPointsTmp;
        
        for (const point of points) {
          const tmpPoint= GraphQueryService.getPoints(point, now);
          if(!addressPoints.has(point.address)){
            let tmpMap = new Map();
            tmpMap.set("points", tmpPoint);
            tmpMap.set("updateAt", now);
            addressPoints.set(point.address, tmpMap);
          }else{
            addressPoints.get(point.address).set("points", BigInt(addressPoints.get(point.address).get("points")) + tmpPoint);
          }
        }
      } else {
        // Exception in fetching GraphQL data.
        throw new Error('Exception in fetching GraphQL data.');
      }
    }
  
    for(const [key, addressPoint] of addressPoints) {
      const newPoint = {
        address: key,
        points: addressPoint.get("points"),
        updated_at: addressPoint.get("updateAt"),
      };
      finalPoints.push(newPoint);
    }
    return {finalPoints, finalTotalPoints};
  }

  public async getAllPointsWithBalance(
    projectName: string,
  ): Promise<PointData> {
    let finalTotalPoints = BigInt(0),
        finalPoints = [],
        points: GraphPoint[], 
        totalPoints: GraphTotalPoint;

    const projectIds = this.graphQueryService.getAllProjectIds(projectName);
    
    for (const projectId of projectIds) {
      [points, totalPoints] = await this.graphQueryService.queryPointsRedistributed(projectId);
      if (Array.isArray(points) && totalPoints) {
        const [tmpPoints, tmpTotalPoints] = this.getPointData(points, totalPoints);
        finalTotalPoints += tmpTotalPoints;
        finalPoints = [...finalPoints, ...tmpPoints];
      } else {
        // Exception in fetching GraphQL data.
        throw new Error('Exception in fetching GraphQL data.');
      }
    }
    return {finalPoints, finalTotalPoints};
  }

  private getPointData(
    points: GraphPoint[],
    totalPoints: GraphTotalPoint,
  ): [any[], bigint] {
    let finalPoints = [];
    const now = (new Date().getTime() / 1000) | 0;
    const finalTotalPoints = GraphQueryService.getTotalPoints(totalPoints, now);
    
    for (const point of points) {
      const projectArr = point.project.split('-');
      const tokenAddress = projectArr[1];
      const newPoint = {
        address: point.address,
        points: GraphQueryService.getPoints(point, now),
        tokenAddress: tokenAddress,
        balance: point.balance,
        updated_at: now,
      };
      finalPoints.push(newPoint);
    }

    return [finalPoints, finalTotalPoints];
  }

  public getRealPoints(
    points: bigint,
    totalPoint: bigint,
    realTotalPoint: bigint
  ): bigint {
    return (BigInt(points) * BigInt(realTotalPoint)) / BigInt(totalPoint);
  }
}
