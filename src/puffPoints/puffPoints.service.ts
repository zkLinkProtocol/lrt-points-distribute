import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import waitFor from '../utils/waitFor';
import { PuffPointsProcessor } from './puffPoints.processor';
import { Transfer } from 'src/type/transfer';
import { UserBalances } from 'src/type/userBalances';
import { PointsRepository } from 'src/repositories/points.repository';
import { LocalPointData, LocalPointsItem, ProjectGraphService } from 'src/project/projectGraph.service';
import { GraphQueryService } from 'src/explorer/graphQuery.service';

@Injectable()
export class PuffPointsService{
  public tokenAddress: string;
  private readonly projectName: string = "puffer";
  private readonly logger: Logger;
  private realTotalPoints: number = 0;
  private localTotalPoints: bigint = BigInt(0);
  private localPoints: LocalPointsItem[];

  private readonly waitForInterval: number;
  private readonly waitForRetry: number;
  private readonly explorerApi: string;
  private allUserBalance: UserBalances[] = [];

  public constructor(
    private readonly puffPointsProcessor: PuffPointsProcessor,
    private readonly pointsRepository: PointsRepository,
    private readonly projectGraphService: ProjectGraphService,
    private readonly graphQueryService: GraphQueryService,
    configService: ConfigService,
  ) {
    this.waitForInterval = configService.get<number>(
      'puffPoints.waitForInterval',
    );
    
    this.waitForRetry = configService.get<number>('puffPoints.waitForRetry');
    this.logger = new Logger(PuffPointsService.name);
    this.explorerApi = configService.get<string>('explorerApiUrl');
  }

  public async onModuleInit(){
    this.logger.log(`Init ${PuffPointsService.name} onmoduleinit`);
    const func = async () => {
      try {
        await this.loadPointsData();
      } catch (err) {
        this.logger.error(`${PuffPointsService.name} init failed.`, err.stack);
      }
    };
    // func();
    // setInterval(func, 1000 * 60);
  }

  // load points data
  public async loadPointsData(){
    this.realTotalPoints = await this.getRealPointsData();
    const pointsData = await this.getLocalPointsData();
    this.localPoints = pointsData.localPoints;
    this.localTotalPoints = pointsData.localTotalPoints;

    // get tokens from graph
    const tokens = this.graphQueryService.getAllTokenAddresses(this.projectName);
    if(tokens.length > 0){
      this.tokenAddress = tokens[0];
    }
  }

  // return points data
  public getPointsData():[LocalPointsItem[], bigint, number]{
    return [this.localPoints, this.localTotalPoints, this.realTotalPoints];
  }

  // return local points and totalPoints
  public async getLocalPointsData(): Promise<LocalPointData>{
    return await this.projectGraphService.getPoints(this.projectName);
  }

  // return local points and totalPoints by address
  public async getLocalPointsDataByAddress(address: string): Promise<LocalPointData>{
    return await this.projectGraphService.getPoints(this.projectName, address);
  }

  // return real totalPoints
  public async getRealPointsData(): Promise<number>{
    const realData = await fetch(
      'https://quest-api.puffer.fi/puffer-quest/third/query_zklink_pufpoint',
      {
        method: 'get',
        headers: {
          'Content-Type': 'application/json',
          'client-id': '08879426f59a4b038b7755b274bc19dc',
        },
      },
    );
    const pufReadData = await realData.json();
    if (
      pufReadData &&
      pufReadData.errno === 0 &&
      pufReadData.data &&
      pufReadData.data.pufeth_points_detail
    ) {
      return pufReadData.data.pufeth_points_detail['latest_points'] as number;
    } else {
      throw new Error(`Failed to get real ${this.projectName} points`);
    }
  }
}
