import { Injectable, Logger } from '@nestjs/common';
import {
    GraphPoint,
    GraphQueryService,
    GraphTotalPoint,
  } from 'src/explorer/graphQuery.service';
  import { ethers } from 'ethers';

@Injectable()
export class ProjectService {
  private readonly graphQueryService: GraphQueryService;
  public constructor(graphQueryService: GraphQueryService) {
    this.graphQueryService = graphQueryService;
  }

  public async getPoints(
    projectName: string,
    address: string,
  ): Promise<[any[], string]> {
    let finalTotalPoints = BigInt(0),
        finalPoints = [],
        points: GraphPoint[], 
        totalPoints: GraphTotalPoint;

    const projectIds = this.graphQueryService.getAllProjectIds(projectName);

    for (const key in projectIds) {
      if (Object.prototype.hasOwnProperty.call(projectIds, key)) {
        const projectId = projectIds[key];
        [points, totalPoints] =
            await this.graphQueryService.queryPointsRedistributedByAddress(
              address,
              projectId,
            ); 
        if (Array.isArray(points) && totalPoints) {
          const [tmpPoints, tmpTotalPoints] = this.getPointData(points, totalPoints);
          finalTotalPoints += tmpTotalPoints;
          finalPoints = [...finalPoints, ...tmpPoints];
        } else {
          return [undefined, ""];
        }
      }
    }
    return [finalPoints, ethers.formatEther(finalTotalPoints)];
  }

  public async getAllPoints(
    projectName: string,
  ): Promise<[any[], string]> {
    let finalTotalPoints = BigInt(0),
        finalPoints = [],
        points: GraphPoint[], 
        totalPoints: GraphTotalPoint,
        addressPoints : Map<string, Map<string, any>> = new Map();
  
    const projectIds = this.graphQueryService.getAllProjectIds(projectName);
  
    for (const key in projectIds) {
      if (Object.prototype.hasOwnProperty.call(projectIds, key)) {
        const projectId = projectIds[key];
        [points, totalPoints] =
            await this.graphQueryService.queryPointsRedistributed(
              projectId,
            ); 
        if (Array.isArray(points) && totalPoints) {
          const now = (new Date().getTime() / 1000) | 0;
          const totalPointsTmp = GraphQueryService.getTotalPoints(totalPoints, now);
          finalTotalPoints += totalPointsTmp;
          
          points.map((point) => {
            const tmpPoint= GraphQueryService.getPoints(point, now);
            if(!addressPoints.has(point.address)){
              let tmpMap = new Map();
              tmpMap.set("points", tmpPoint);
              tmpMap.set("updateAt", now);
              addressPoints.set(point.address, tmpMap);
            }else{
              addressPoints.get(point.address).set("points", BigInt(addressPoints.get(point.address).get("points")) + tmpPoint);
            }
          });
        } else {
          return [undefined, ""];
        }
      }
    }
  
    for(const [key, addressPoint] of addressPoints) {
      const newPoint = {
        address: key,
        points: ethers.formatEther(addressPoint.get("points")),
        updated_at: addressPoint.get("updateAt"),
      };
      finalPoints.push(newPoint);
    }
    return [finalPoints, ethers.formatEther(finalTotalPoints)];
  }

  public async getAllPointsWithBalance(
    projectName: string,
  ): Promise<[any[], string]> {
    let finalTotalPoints = BigInt(0),
        finalPoints = [],
        points: GraphPoint[], 
        totalPoints: GraphTotalPoint;

    const projectIds = this.graphQueryService.getAllProjectIds(projectName);
    
    for (const key in projectIds) {
      if (Object.prototype.hasOwnProperty.call(projectIds, key)) {
        const projectId = projectIds[key];
        [points, totalPoints] =
            await this.graphQueryService.queryPointsRedistributed(
              projectId,
            );
        if (Array.isArray(points) && totalPoints) {
          const [tmpPoints, tmpTotalPoints] = this.getPointData(points, totalPoints);
          finalTotalPoints += tmpTotalPoints;
          finalPoints = [...finalPoints, ...tmpPoints];
        } else {
          return [undefined, ""];
        }
      }
    }

    return [finalPoints, ethers.formatEther(finalTotalPoints)];
  }

  private getPointData(
    points: GraphPoint[],
    totalPoints: GraphTotalPoint,
  ): [
    finalPoints: any[], 
    finalTotalPoints: bigint
  ] {
    let finalPoints = [];
    const now = (new Date().getTime() / 1000) | 0;
    const finalTotalPoints = GraphQueryService.getTotalPoints(totalPoints, now);
    
    points.map((point) => {
      const projectArr = point.project.split('-');
      const tokenAddress = projectArr[1];
      const newPoint = {
        address: point.address,
        points: ethers.formatEther(GraphQueryService.getPoints(point, now)),
        tokenAddress: tokenAddress,
        balance: point.balance,
        updated_at: now,
      };
      finalPoints.push(newPoint);
    });

    return [finalPoints, finalTotalPoints];
  }
}
