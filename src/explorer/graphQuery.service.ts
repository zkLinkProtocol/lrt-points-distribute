import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface GraphPoint {
  address: string;
  balance: string;
  weightBalance: string;
  timeWeightAmountIn: string;
  timeWeightAmountOut: string;
  project: string;
}
export interface GraphTotalPoint {
  totalBalance: string;
  totalWeightBalance: string;
  totalTimeWeightAmountIn: string;
  totalTimeWeightAmountOut: string;
  project: string;
}
@Injectable()
export class GraphQueryService {
  private readonly logger: Logger;
  private readonly novaPointRedistributeGraphApi: string;
  public constructor(configService: ConfigService) {
    this.logger = new Logger(GraphQueryService.name);
    this.novaPointRedistributeGraphApi = configService.get<string>(
      'novaPointRedistributeGraphApi',
    );
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
      totalPoint(id:"0x1ab07a4e9453f8a28ac1a900c0e356ed6322f51602531d99191ceb2bfeb1f8cb"){
        project
        totalBalance
        totalWeightBalance
        totalTimeWeightAmountIn
        totalTimeWeightAmountOut
      }
      points(where:{project:"puffer-0x1b49ecf1a8323db4abf48b2f5efaa33f7ddab3fc"}) {
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
      points(where: {project: "${projectId}", address: "${address}"}) {
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
