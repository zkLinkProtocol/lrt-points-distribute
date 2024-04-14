import { Injectable, Logger } from '@nestjs/common';
import {
  GraphPoint,
  GraphQueryService,
  GraphTotalPoint,
} from 'src/explorer/graphQuery.service';
import { NovaApiService, NovaPoints } from 'src/nova/novaapi.service';
import { BigNumber } from 'bignumber.js';

export interface PointData {
  finalPoints: any[],
  finalTotalPoints: bigint
}

@Injectable()
export class NovaService {
  private readonly logger: Logger;
  private readonly graphQueryService: GraphQueryService;
  private readonly projectName: string = "nova";

  public constructor(private novaApiService: NovaApiService, graphQueryService: GraphQueryService) {
    this.graphQueryService = graphQueryService;
    this.logger = new Logger(NovaService.name);
  }

  public async getPoints(
    tokenAddress: string,
    address: string,
  ): Promise<PointData> {
    let finalTotalPoints = BigInt(0),
        finalPoints = [],
        points: GraphPoint[], 
        totalPoints: GraphTotalPoint;

    const projects = this.graphQueryService.getAllProjectIds(this.projectName);
    const project = `${this.projectName}-${tokenAddress}`;
    if (!projects.includes(project)) {
      this.logger.error(`Notfound GraphQL data, project is : ${project} .`);
      return {finalPoints, finalTotalPoints};
    }

    [points, totalPoints] =
        await this.graphQueryService.queryPointsRedistributedByAddress(
          address,
          project,
        ); 
    if (Array.isArray(points) && totalPoints) {
      return this.getPointData(points, totalPoints);
    } else {
      // Exception in fetching GraphQL data.
      throw new Error(`Exception in fetching GraphQL data, project is : ${project}.`);
    }
  }

  public async getAllTokensPoints( address: string ): Promise<PointData> {
    const [points, totalPoints] = 
      await this.graphQueryService.queryPointsRedistributedByProjectNameAndAddress(
        address, 
        this.projectName
      );
    
    let tempProjectIdGraphTotalPoint: Map<String, bigint> = new Map;
    let tempProjectIdTotalPoints: Map<String, number> = new Map;
    let finalTotalPoints: bigint = BigInt(0);
    for (const item of totalPoints) {
      const projectArr = item.project.split('-');
      const tokenAddress = projectArr[1];
      // Get real points.
      let points: NovaPoints;
      try{
        points = await this.novaApiService.getNovaPoint(tokenAddress);
      } catch (err) {
        this.logger.error('Get nova real points failed.', err.stack);
        throw new Error(`Get nova real points failed: ${tokenAddress}.`);
      }
      const tempFinalTotalPoints = this.caulTotalPoint(item);
      tempProjectIdGraphTotalPoint.set(item.project, tempFinalTotalPoints);
      tempProjectIdTotalPoints.set(item.project, points.novaPoint);
      finalTotalPoints += tempFinalTotalPoints;
    }

    let finalPoints = [];
    const now = (new Date().getTime() / 1000) | 0;
    for (const point of points) {
      const projectArr = point.project.split('-');
      const tempPoint = GraphQueryService.getPoints(point, now);
      const tempOrgTotaoPoint = tempProjectIdGraphTotalPoint.get(point.project);
      const tempRealTotaoPoint = tempProjectIdTotalPoints.get(point.project);
      const newPoint = {
        address: point.address,
        points: tempPoint,
        realPoints: this.getRealPoints(tempPoint, tempOrgTotaoPoint, tempRealTotaoPoint),
        balance: point.balance,
        tokenAddress: projectArr[1],
        updated_at: now,
      };
      finalPoints.push(newPoint);
    }

    return {finalPoints, finalTotalPoints};
  }

  public async getAllPoints(
    tokenAddress: string,
  ): Promise<PointData> {
    let finalTotalPoints = BigInt(0),
        finalPoints = [],
        points: GraphPoint[], 
        totalPoints: GraphTotalPoint,
        addressPoints : Map<string, Map<string, any>> = new Map();
  
    const projects = this.graphQueryService.getAllProjectIds(this.projectName);
    const project = `${this.projectName}-${tokenAddress}`;
    if (!projects.includes(project)) {
      this.logger.error(`Notfound GraphQL data, project is : ${project} .`);
      return {finalPoints, finalTotalPoints};
    }
  
    [points, totalPoints] =
        await this.graphQueryService.queryPointsRedistributed(
          project,
        ); 
    if (Array.isArray(points) && totalPoints) {
      const now = (new Date().getTime() / 1000) | 0;
      finalTotalPoints = GraphQueryService.getTotalPoints(totalPoints, now);
      
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
      throw new Error(`Exception in fetching GraphQL data, project is : ${project}.`);
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
    tokenAddress: string,
  ): Promise<PointData> {
    let finalTotalPoints = BigInt(0),
        finalPoints = [],
        points: GraphPoint[], 
        totalPoints: GraphTotalPoint;

    const projects = this.graphQueryService.getAllProjectIds(this.projectName);
    const project = `${this.projectName}-${tokenAddress}`;
    if (!projects.includes(project)) {
      this.logger.error(`Notfound GraphQL data, project is : ${project} .`);
      return {finalPoints, finalTotalPoints};
    }
    
    [points, totalPoints] =
        await this.graphQueryService.queryPointsRedistributed(
          project,
        );
    if (Array.isArray(points) && totalPoints) {
      return this.getPointData(points, totalPoints);
    } else {
      // Exception in fetching GraphQL data.
      throw new Error(`Exception in fetching GraphQL data, project is : ${project}.`);
    }
  }

  private getPointData(
    points: GraphPoint[],
    totalPoints: GraphTotalPoint,
  ): PointData {
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

    return {finalPoints, finalTotalPoints};
  }

  private caulTotalPoint(totalPoint: GraphTotalPoint): bigint{
    const now = (new Date().getTime() / 1000) | 0;
    return GraphQueryService.getTotalPoints(totalPoint, now);
  }

  public getRealPoints(
    points: bigint,
    totalPoint: bigint,
    realTotalPoint: number
  ): number {
    return Number(
      new BigNumber(points.toString())
          .multipliedBy(new BigNumber(realTotalPoint))
          .dividedBy(new BigNumber(totalPoint.toString()))
          .toFixed(6)
    );
  }
}
