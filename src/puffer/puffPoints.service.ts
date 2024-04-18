import { Injectable, Logger } from '@nestjs/common';
import { LocalPointData, ProjectGraphService } from 'src/common/service/projectGraph.service';
import { GraphQueryService } from 'src/common/service/graphQuery.service';
import BigNumber from 'bignumber.js';
import { NovaService } from 'src/nova/nova.service';

export interface PufferPointItem{
  address: string,
  tokenAddress: string,
  balance: bigint,
  realPoints: number,
  localPoints: bigint,
  localTotalPointsPerToken: bigint,
  realTotalPointsPerToken: number,
  updatedAt: number
}

export interface PufferData{
  localTotalPoints: bigint,
  realTotalPoints: number,
  items: PufferPointItem[]
}

const LAYERBANK_LPUFFER = "0xdd6105865380984716C6B2a1591F9643e6ED1C48".toLocaleLowerCase();

@Injectable()
export class PuffPointsService{
  public tokenAddress: string;
  private readonly projectName: string = "puffer";
  private readonly logger: Logger;
  private realTotalPoints: number = 0;
  private localTotalPoints: bigint = BigInt(0);
  private localPoints: PufferPointItem[] = [];

  public constructor(
    private readonly projectGraphService: ProjectGraphService,
    private readonly graphQueryService: GraphQueryService,
    private readonly novaService: NovaService
  ) {
    this.logger = new Logger(PuffPointsService.name);
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
    func();
    setInterval(func, 1000 * 200);
  }

  // load points data
  public async loadPointsData(){
    // get tokens from graph
    const tokens = this.graphQueryService.getAllTokenAddresses(this.projectName);
    if(tokens.length > 0){
      this.tokenAddress = tokens[0];
    }

    this.realTotalPoints = await this.getRealPointsData();
    const pointsData = await this.getLocalPointsData();
    this.localTotalPoints = pointsData.localTotalPoints;
    const _localPoints = pointsData.localPoints;
    let localPoints = [];
    for (let i = 0; i < _localPoints.length; i++) {
      const item = _localPoints[i];
      const realPoints = new BigNumber(item.points.toString())
                        .multipliedBy(this.realTotalPoints)
                        .div(item.totalPointsPerToken.toString())
                        .toFixed(6);
      const _item = {
        address: item.address,
        tokenAddress: item.token,
        balance: item.balance,
        realPoints: Number(realPoints),
        localPoints: item.points,
        localTotalPointsPerToken: item.totalPointsPerToken,
        realTotalPointsPerToken: this.realTotalPoints,
        updatedAt: item.updatedAt
      } as PufferPointItem
      localPoints.push(_item);
    }
    this.localPoints = localPoints;
  }

  // return points data
  public getPointsData(address?: string): PufferData{
    let result: PufferData = {
      localTotalPoints: this.localTotalPoints,
      realTotalPoints: this.realTotalPoints,
      items: this.localPoints
    } as PufferData;
    if(address && this.localPoints.length > 0){
      const _address = address.toLocaleLowerCase();
      result.items = this.localPoints.filter(
        (item) => item.address === _address
      );
    }
    return result;
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

  //get layerbank point
  public async getLayerBankPoint(address: string): Promise<number>{
    const _lpuffer = this.localPoints.filter(
      (item) => item.address === LAYERBANK_LPUFFER
    );
    if(_lpuffer.length == 0){
      return 0;
    }
    const lpuffer = _lpuffer[0];
    const lpufferPointData = await this.novaService.getPoints(LAYERBANK_LPUFFER, address);
    const lpufferFinalPoints = lpufferPointData.finalPoints;
    const lpufferFinalTotalPoints = lpufferPointData.finalTotalPoints;
    if(lpufferFinalPoints.length > 0) {
      return new BigNumber(lpufferFinalPoints[0].points.toString())
        .multipliedBy(lpuffer.realPoints)
        .div(lpufferFinalTotalPoints.toString())
        .toNumber();
    }
    return 0;
  }
}
