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
  totalBalance: string;
  totalWeightBalance: string;
  totalTimeWeightAmountIn: string;
  totalTimeWeightAmountOut: string;
  project: string;
}
// Map<project_name,Map<tokenAddress,[project_id]>>

@Injectable()
export class GraphQueryService implements OnModuleInit {
  private readonly logger: Logger;
  private readonly novaPointRedistributeGraphApi: string;
  private readonly projectTokenMap: Map<string, Map<string, string>> =
    new Map();
  public constructor(configService: ConfigService) {
    this.logger = new Logger(GraphQueryService.name);
    this.novaPointRedistributeGraphApi = configService.get<string>(
      'novaPointRedistributeGraphApi',
    );
  }

  public async onModuleInit() {
    this.logger.log('GraphQueryService has been initialized.');
    //TODO
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
        const projectName = projectArr[0];
        const tokenAddress = projectArr[1];
        if (!this.projectTokenMap.has(projectName)) {
          this.projectTokenMap.set(projectName, new Map());
        }
        this.projectTokenMap
          .get(projectName)
          .set(tokenAddress, totalPoint.project);
        // ethers.keccak256(ethers.toUtf8Bytes(totalPoint.project))
      });
    }
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
  private static calcuPoint(
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
    /**
     *
{
  "data": {
    "totalPoint": {},
    "points": []
  }
}    
     */
    const query = `
    {
      totalPoint(id:"${projectId}"){
        project
        totalBalance
        totalWeightBalance
        totalTimeWeightAmountIn
        totalTimeWeightAmountOut
      }
      points(where:{project: "puffer-0x1b49ecf1a8323db4abf48b2f5efaa33f7ddab3fc"}) {
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
    if (data && data.data && Array.isArray(data.data.points)) {
      return [
        data.data.points as GraphPoint[],
        //TODO
        {
          totalBalance: '0',
          totalWeightBalance: '0',
          totalTimeWeightAmountIn: '0',
          totalTimeWeightAmountOut: '0',
          project: projectId,
        },
      ];
    }
    return [[], undefined];
  }

  public async queryPointsRedistributedByAddress(
    address: string,
    projectId: string,
  ): Promise<[GraphPoint[], GraphTotalPoint]> {
    const query = `
    {
      totalPoint(id: "${projectId}") {
        project
        totalBalance
        totalWeightBalance
        totalTimeWeightAmountIn
        totalTimeWeightAmountOut
      }
      points(where: {project inlcude : [] "${projectId}", address: "${address}"}) {
        address
        balance
        timeWeightAmountIn
        timeWeightAmountOut
        project
      }
    }
      `;
    const data = await this.query(query);
    if (data && data.data && Array.isArray(data.data.points)) {
      return [
        data.data.points as GraphPoint[],
        //TODO
        {
          totalBalance: '0',
          totalWeightBalance: '0',
          totalTimeWeightAmountIn: '0',
          totalTimeWeightAmountOut: '0',
          project: projectId,
        },
      ];
    }
    return [[], undefined];
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
