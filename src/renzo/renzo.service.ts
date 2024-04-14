import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserBalances } from 'src/type/userBalances';
import { LocalPointData, LocalPointsItem, ProjectGraphService } from 'src/project/projectGraph.service';
import { GraphQueryService } from 'src/explorer/graphQuery.service';
import { RenzoApiService, RenzoPoints } from 'src/explorer/renzoapi.service';
import { ExplorerService } from 'src/explorer/explorer.service';
import { RenzoPointsWithoutDecimalsDto } from 'src/controller/pointsWithoutDecimals.dto';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';

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
  private realTotalRenzoPoints: number = 0;
  private realTotalEigenLayerPoints: number = 0;
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
    setInterval(func, 1000 * 30);
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
          .div(point.perTokenTotalPoints.toString())
          .toFixed(6),
      );
      realTotalRenzoPoints += realRenzoPoints;
      const realEigenLayerPoints = Number(
        new BigNumber(point.points.toString())
          .multipliedBy(renzoPoints.eigenLayerPoints)
          .div(point.perTokenTotalPoints.toString())
          .toFixed(6),
      );
      realTotalEigenLayerPoints += realEigenLayerPoints;
      const pointsItem: RenzoPointItem = {
        address: point.address,
        tokenAddress: point.token,
        balance: point.balance,
        localPoints: point.points,
        localTotalPointsPerToken: point.perTokenTotalPoints,
        localTotalPointsPerTokenMau: point.perTokenTotalPointsMau,
        realTotalRenzoPointsPerToken: renzoPoints.renzoPoints,
        realTotalEigenLayerPointsPerToken: renzoPoints.eigenLayerPoints,
        realRenzoPoints: realRenzoPoints,
        realEigenLayerPoints: realEigenLayerPoints,
        updatedAt: point.updatedAt
      };
      data.push(pointsItem);
    }

    this.renzoData = {
      localTotalPoints: localTotalPoints,
      realTotalRenzoPoints: realTotalRenzoPoints,
      realTotalEigenLayerPoints: realTotalEigenLayerPoints,
      items: data
    };
  }

  // return points data
  public getPointsData():RenzoData;
  public getPointsData(address: string): RenzoData;
  public getPointsData(address?: string): RenzoData
  {
    let result: RenzoData = this.renzoData;
    if(address){
      result.items = this.renzoData.items.filter(
        (item) => item.address === address
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


// key : address, value : 0x16a0ef40142cdab0560d20fb7faa974313199df1
// key : tokenAddress, value : 0x3fdb1939dab8e2d4f7a04212f142469cd52d6402
// key : balance, value : 250000000000000000
// key : localPoints, value : 241935250000000000000000
// key : localTotalPointsPerToken, value : 2493454034512533155194237939
// key : localTotalPointsPerTokenMau, value : 2494450514144126755194237939
// key : realTotalRenzoPointsPerToken, value : 826747.4083813288
// key : realTotalEigenLayerPointsPerToken, value : 826747.4083813288
// key : realRenzoPoints, value : 80.217777
// key : realEigenLayerPoints, value : 80.217777
// key : updatedAt, value : 1712904020

// 241935250000000000000000
// 2493454034512533155194237939
// 2494450514144126755194237939

// pgsql: 0.0000818317381092166898025541874343064404184896348973936397980567...
// graph: 0.0000972053236520520791229004406850192849629019078313516093180946...