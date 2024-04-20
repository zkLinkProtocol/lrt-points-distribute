import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
export interface GraphPoint {
  address: string;
  balance: string;
  weightBalance: string;
  timeWeightAmountIn: string;
  timeWeightAmountOut: string;
  project: string;
}
export interface GraphTotalPoint {
  id: string;
  project: string;
  totalBalance: string;
  totalWeightBalance: string;
  totalTimeWeightAmountIn: string;
  totalTimeWeightAmountOut: string;
}
export interface GraphWithdrawPoint {
  id: string;
  project: string;
  address: string;
  balance: string;
  weightBalance: string;
  timeWeightAmountIn: string;
  timeWeightAmountOut: string;
  blockTimestamp: number;
}

@Injectable()
export class GraphQueryService implements OnModuleInit {
  private readonly logger: Logger;
  private readonly novaPointRedistributeGraphApi: string;
  private projectTokenMap: Map<string, Map<string, string>> = new Map();
  
  public constructor(configService: ConfigService) {
    this.logger = new Logger(GraphQueryService.name);
    this.novaPointRedistributeGraphApi = configService.get<string>(
      'novaPointRedistributeGraphApi',
    );
  }

  public async onModuleInit(){
    this.logger.log('GraphQueryService has been initialized.');
    const func = async () => {
      try {
        await this.loadGraphData();
      } catch (err) {
        this.logger.error("GraphQueryService init failed", err.stack);
      }
    };
    func();
    setInterval(func, 1000 * 600);
  }

  private async loadGraphData() {
    const query = `
{
  totalPoints{
    id
    project
    totalBalance
    totalWeightBalance
    totalTimeWeightAmountIn
    totalTimeWeightAmountOut
  }
}
    `;
    const data = await this.query(query);
    if (data && data.data && Array.isArray(data.data.totalPoints)) {
      const allPoints = data.data.totalPoints as GraphTotalPoint[];
      allPoints.forEach((totalPoint) => {
        const projectArr = totalPoint.project.split('-');
        const projectName = projectArr[0].toLocaleLowerCase();
        const tokenAddress = projectArr[1].toLocaleLowerCase();
        if (!this.projectTokenMap.has(projectName)) {
          this.projectTokenMap.set(projectName, new Map());
          this.logger.log(`GraphQueryService ${projectName} had save to cache.`);
        }
        this.projectTokenMap
          .get(projectName)
          .set(tokenAddress, totalPoint.project);
      });
    }
  }

  public getAllTokenAddresses(projectName: string): string[] {
    const project = this.projectTokenMap.get(projectName);
    return project ? Array.from(project.keys()) : [];
  }

  public getAllProjectIds(projectName: string): string[] {
    return Array.from(this.projectTokenMap.get(projectName).values());
  }

  public static getPoints(points: GraphPoint, timestamp: number): bigint {
    return this.calcuPoint(
      points.weightBalance,
      points.timeWeightAmountIn,
      points.timeWeightAmountOut,
      timestamp,
    );
  }
  public static getTotalPoints(
    totalPoints: GraphTotalPoint,
    timestamp: number,
  ): bigint {
    return this.calcuPoint(
      totalPoints.totalWeightBalance,
      totalPoints.totalTimeWeightAmountIn,
      totalPoints.totalTimeWeightAmountOut,
      timestamp,
    );
  }
  public static calcuPoint(
    weightBalance: string,
    timeWeightAmountIn: string,
    timeWeightAmountOut: string,
    timestamp: number,
  ): bigint {
    return (
      BigInt(weightBalance) * BigInt(timestamp) -
      (BigInt(timeWeightAmountIn) - BigInt(timeWeightAmountOut))
    );
  }

  public async queryPointsRedistributed(
    projectId: string,
    ): Promise<[GraphPoint[], GraphTotalPoint]> {
    const id = ethers.keccak256(ethers.toUtf8Bytes(projectId));
    const query = `
{
  totalPoint(id:"${id}"){
    id
    project
    totalBalance
    totalWeightBalance
    totalTimeWeightAmountIn
    totalTimeWeightAmountOut
  }
  points(first:1000,where:{project: "${projectId}"}) {
    address
    balance
    weightBalance
    timeWeightAmountIn
    timeWeightAmountOut
    project
  }
}
    `;
    const data = await this.query(query);
    if (data && data.data && data.data.totalPoint && Array.isArray(data.data.points)) {
      return [
        data.data.points as GraphPoint[],
        data.data.totalPoint as GraphTotalPoint,
      ];
    }
    return [[], undefined];
  }

  public async queryPointsRedistributedByAddress(
    address: string,
    projectId: string,
  ): Promise<[GraphPoint[], GraphTotalPoint]> {
    const id = ethers.keccak256(ethers.toUtf8Bytes(projectId));
    const query = `
{
  totalPoint(id: "${id}") {
    project
    totalBalance
    totalWeightBalance
    totalTimeWeightAmountIn
    totalTimeWeightAmountOut
  }
  points(first:1000, where: {project: "${projectId}", address: "${address}"}) {
    address
    balance
    weightBalance
    timeWeightAmountIn
    timeWeightAmountOut
    project
  }
}
    `;
    const data = await this.query(query);
    if (data && data.data && data.data.totalPoint && Array.isArray(data.data.points)) {
      return [
        data.data.points as GraphPoint[],
        data.data.totalPoint as GraphTotalPoint,
      ];
    }
    return [[], undefined];
  }

  public async queryPointsRedistributedByProjectName(
    projectName: string,
    page?: number,
    limit?: number
  ): Promise<[GraphPoint[], GraphTotalPoint[]]> {
    const {_page = 1, _limit = 1000} = {_page: page, _limit: limit};
    let skip = (_page - 1) * _limit;
    skip = skip < 0 ? 0 : skip;
    const query = `
{
  totalPoints(where:{project_contains: "${projectName}"}){
    id
    project
    totalBalance
    totalWeightBalance
    totalTimeWeightAmountIn
    totalTimeWeightAmountOut
  }
  points(first: ${_limit}, skip: ${skip}, where:{project_contains: "${projectName}"}) {
    address
    balance
    weightBalance
    timeWeightAmountIn
    timeWeightAmountOut
    project
  }
}
    `;
    const data = await this.query(query);
    if (data && data.data && Array.isArray(data.data.totalPoints) && Array.isArray(data.data.points)) {
      return [
        data.data.points as GraphPoint[],
        data.data.totalPoints as GraphTotalPoint[],
      ];
    }else{
      throw new Error(`Exception in fetching GraphQL data, project is : ${projectName}, query is : ${query}.`);
    }
  }

  public async queryPointsRedistributedByProjectNameAndAddress(
    address: string,
    projectName: string,
    subProject: string = ""
  ): Promise<[GraphPoint[], GraphTotalPoint[]]> {
    const query = subProject == "" ? `
{
  totalPoints(where:{project_contains: "${projectName}"}){
    project
    totalBalance
    totalWeightBalance
    totalTimeWeightAmountIn
    totalTimeWeightAmountOut
  }
  points(first:1000, where: {project_contains: "${projectName}", address: "${address}"}) {
    address
    balance
    weightBalance
    timeWeightAmountIn
    timeWeightAmountOut
    project
  }
}
    `
    :
    `
{
  totalPoints(where:{project_contains: "${projectName}"}){
    project
    totalBalance
    totalWeightBalance
    totalTimeWeightAmountIn
    totalTimeWeightAmountOut
  }
  points(first:1000, where: {project_contains: "${projectName}", address: "${address}", subProject: "${subProject}"}) {
    address
    balance
    weightBalance
    timeWeightAmountIn
    timeWeightAmountOut
    project
  }
}
    `;
    const data = await this.query(query);
    if (data && data.data && Array.isArray(data.data.totalPoints) && Array.isArray(data.data.points)) {
      return [
        data.data.points as GraphPoint[],
        data.data.totalPoints as GraphTotalPoint[],
      ];
    }else{
      throw new Error(`Exception in fetching GraphQL data, project is : ${projectName}, query is : ${query}.`);
    }
  }

  public async queryWithdrawPoints(page:number, limit:number): Promise<GraphWithdrawPoint[]> {
    const {_page = 1, _limit = 1000} = {_page: page, _limit: limit};
    let skip = (_page-1) * _limit;
    skip = skip < 0 ? 0 : skip;
    const query = `
{
  withdrawPoints(
    first:${_limit}
    skip:${skip}
  ){
    id
    project
    balance
    weightBalance
    address
    timeWeightAmountIn
    timeWeightAmountOut
    blockTimestamp
  }
}
    `;
    const data = await this.query(query);
    if (data && data.data && Array.isArray(data.data.withdrawPoints)) {
      return data.data.withdrawPoints as GraphWithdrawPoint[];
    }else{
      throw new Error(`Exception in fetching GraphQL data, project is WithdrawPoints.`);
    }
  }

  private async query(query: string) {
    const body = {
      query: query,
    };

    const response = await fetch(this.novaPointRedistributeGraphApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return data;
  }
}
