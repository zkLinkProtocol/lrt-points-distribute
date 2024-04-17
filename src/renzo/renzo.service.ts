import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalPointData, ProjectGraphService } from 'src/common/service/projectGraph.service';
import { GraphQueryService } from 'src/common/service/graphQuery.service';
import { RenzoApiService, RenzoPoints } from 'src/renzo/renzoapi.service';
import { ExplorerService } from 'src/common/service/explorer.service';
import {cloneDeep} from 'lodash';
import BigNumber from 'bignumber.js';

export interface RenzoPointItem{
  address: string,
  tokenAddress: string,
  balance: bigint,
  localPoints: bigint,
  localTotalPointsPerToken: bigint,
  localTotalPointsPerTokenMau: bigint,
  realTotalRenzoPointsPerToken: number,
  realTotalEigenLayerPointsPerToken: number,
  realRenzoPoints: number,
  realEigenLayerPoints: number,
  updatedAt: number
}

export interface RenzoData{
  localTotalPoints: bigint,
  realTotalRenzoPoints: number,
  realTotalEigenLayerPoints: number,
  items: RenzoPointItem[]
}

@Injectable()
export class RenzoService{
  public tokenAddress: string[];
  private readonly projectName: string = "renzo";
  private readonly logger: Logger;
  
  private renzoData: RenzoData = {localTotalPoints: BigInt(0), realTotalRenzoPoints: 0, realTotalEigenLayerPoints: 0, items:[]};
  private readonly l1Erc20BridgeEthereum: string;
  private readonly l1Erc20BridgeArbitrum: string;
  private readonly l1Erc20BridgeLinea: string;
  private readonly l1Erc20BridgeBlast: string;

  public constructor(
    private readonly explorerService: ExplorerService,
    private readonly renzoApiService: RenzoApiService,
    private readonly projectGraphService: ProjectGraphService,
    private readonly graphQueryService: GraphQueryService,
    private readonly configService: ConfigService,
  ) {
    this.logger = new Logger(RenzoService.name);
    this.l1Erc20BridgeEthereum = configService.get<string>('l1Erc20BridgeEthereum');
    this.l1Erc20BridgeArbitrum = configService.get<string>('l1Erc20BridgeArbitrum');
    this.l1Erc20BridgeLinea = configService.get<string>('l1Erc20BridgeLinea');
    this.l1Erc20BridgeBlast = configService.get<string>('l1Erc20BridgeBlast');
  }

  public async onModuleInit(){
    this.logger.log(`Init ${RenzoService.name} onmoduleinit`);
    const func = async () => {
      try {
        await this.loadPointsData();
      } catch (err) {
        this.logger.error(`${RenzoService.name} init failed.`, err.stack);
      }
    };
    func();
    setInterval(func, 1000 * 200);
  }

  // load points data
  public async loadPointsData(){
    // get tokens from graph
    const tokens = this.graphQueryService.getAllTokenAddresses(this.projectName);
    if(tokens.length <= 0){
      this.logger.log(`Graph don't have ${this.projectName} tokens`);
      return;
    }
    this.tokenAddress = tokens;

    const realTokenTotalPoints = await this.getRealPointsData();
    const pointsData = await this.getLocalPointsData();
    const localPoints = pointsData.localPoints;
    const localTotalPoints = pointsData.localTotalPoints;
    const tokensMapBridgeTokens = await this.getTokensMapBriageTokens();
    if(tokensMapBridgeTokens.size < 1 || localPoints.length < 1 || realTokenTotalPoints.size < 1) {
      throw new Error(`Fetch ${this.projectName} empty data, tokensMapBridgeTokens.size: ${tokensMapBridgeTokens.size}, tokensLocalPoints.size: ${localPoints.length}, tokensRenzoPoints.size: ${realTokenTotalPoints.size}`);
    }

    let data: RenzoPointItem[] = [],
        realTotalRenzoPoints: number = Number(0),
        realTotalEigenLayerPoints: number = Number(0);
    for (const point of localPoints) {
      const tokenAddress = point.token.toLocaleLowerCase();
      if(!tokenAddress){
        throw new Error(`Get ${this.projectName} point exception, address is ${point.address}`);
      }

      const bridgeToken = tokensMapBridgeTokens.get(tokenAddress);
      const renzoPoints = realTokenTotalPoints.get(bridgeToken);
      if(!renzoPoints){
        throw new Error(`Get ${this.projectName} realPoint per token is undefined, tokenAddress is ${tokenAddress}`);
      }
      const realRenzoPoints = Number(
        new BigNumber(point.points.toString())
          .multipliedBy(renzoPoints.renzoPoints)
          .div(point.totalPointsPerToken.toString())
          .toFixed(6),
      );
      realTotalRenzoPoints += realRenzoPoints;
      const realEigenLayerPoints = Number(
        new BigNumber(point.points.toString())
          .multipliedBy(renzoPoints.eigenLayerPoints)
          .div(point.totalPointsPerToken.toString())
          .toFixed(6),
      );
      realTotalEigenLayerPoints += realEigenLayerPoints;
      const pointsItem: RenzoPointItem = {
        address: point.address,
        tokenAddress: point.token,
        balance: point.balance,
        localPoints: point.points,
        localTotalPointsPerToken: point.totalPointsPerToken,
        localTotalPointsPerTokenMau: point.totalPointsPerTokenMau,
        realTotalRenzoPointsPerToken: renzoPoints.renzoPoints,
        realTotalEigenLayerPointsPerToken: renzoPoints.eigenLayerPoints,
        realRenzoPoints: realRenzoPoints,
        realEigenLayerPoints: realEigenLayerPoints,
        updatedAt: point.updatedAt
      };
      data.push(pointsItem);
    }
    if(data.length > 0){
      this.renzoData = {
        localTotalPoints: localTotalPoints,
        realTotalRenzoPoints: realTotalRenzoPoints,
        realTotalEigenLayerPoints: realTotalEigenLayerPoints,
        items: data
      };
    }else{
      this.logger.log(`Load renzo data empty.`);
    }
  }

  // return points data
  public getPointsData(address?: string): RenzoData
  {
    let result: RenzoData = cloneDeep(this.renzoData);
    if(address){
      const _address = address.toLocaleLowerCase();
      result.items = this.renzoData.items.filter(
        (item) => item.address === _address
      );
    }
    return result;
  }

  // return local points and totalPoints
  public async getLocalPointsData(): Promise<LocalPointData>{
    return await this.projectGraphService.getPoints(this.projectName);
  }

  // return real totalPoints
  public async getRealPointsData(): Promise<Map<string, RenzoPoints>>{
    return await this.renzoApiService.fetchTokensRenzoPoints();
  }

  private async getTokensMapBriageTokens(): Promise<Map<string, string>>{
    const tokens = this.tokenAddress.map(item=>{
      return item.toLocaleLowerCase();
    });
    const tokensMapBridgeTokens: Map<string, string> = new Map;
    const allTokens = await this.explorerService.getTokens();
    for (const item of allTokens) {
      const l2Address = item.l2Address?.toLocaleLowerCase();
      if(tokens.includes(l2Address)){
        let tmpBridgeToken = "";
        switch(item.networkKey){
          case "ethereum" :
            tmpBridgeToken = this.l1Erc20BridgeEthereum;
            break;
          case "arbitrum" :
            tmpBridgeToken = this.l1Erc20BridgeArbitrum;
            break;
          case "blast" :
            tmpBridgeToken = this.l1Erc20BridgeBlast;
            break;
          case "primary" :
            tmpBridgeToken = this.l1Erc20BridgeLinea;
            break;
        }
        if (tmpBridgeToken == "") {
          throw new Error(`There is a unknown token : ${l2Address}`);
        }
        tokensMapBridgeTokens.set(l2Address, tmpBridgeToken.toLocaleLowerCase());
      }
    }
    return tokensMapBridgeTokens;
  }
}