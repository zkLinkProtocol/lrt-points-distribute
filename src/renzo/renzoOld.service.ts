import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import waitFor from '../utils/waitFor';
import { Worker } from '../common/worker';
import { Transfer } from 'src/type/transfer';
import { UserBalances } from 'src/type/userBalances';
import { PointsRepository } from 'src/repositories/points.repository';
import { Points } from 'src/entities/points.entity';
import { ethers } from 'ethers';
import { BigNumber } from 'bignumber.js';
import { ExplorerService } from 'src/explorer/explorer.service';
import { RenzoApiService } from 'src/explorer/renzoapi.service';
import { RenzoPointsWithoutDecimalsDto } from 'src/controller/pointsWithoutDecimals.dto';
import { In } from 'typeorm';
import { formatEther } from 'ethers';

export interface PointData {
  renzoPoints: number;
  eigenLayerPoints: number;
  data: RenzoPointsWithoutDecimalsDto[];
}

@Injectable()
export class RenzoOldService {
  private readonly logger: Logger;
  private readonly waitForInterval: number;
  private readonly waitForRetry: number;
  private readonly renzoTokenAddress: string[];
  private readonly unitPoints: bigint;
  private readonly unitInterval: number;
  private readonly l1Erc20BridgeEthereum: string;
  private readonly l1Erc20BridgeArbitrum: string;
  private readonly l1Erc20BridgeLinea: string;
  private readonly l1Erc20BridgeBlast: string;
  private allUserBalance: UserBalances[] = [];
  private pointData: Map<string, any>;

  public constructor(
    private readonly pointsRepository: PointsRepository,
    private readonly explorerService: ExplorerService,
    private readonly renzoApiService: RenzoApiService,
    configService: ConfigService,
  ) {
    this.waitForInterval = configService.get<number>('renzo.waitForInterval');
    this.renzoTokenAddress = configService.get<string[]>('renzo.tokenAddress');
    this.waitForRetry = configService.get<number>('renzo.waitForRetry');
    this.logger = new Logger(RenzoOldService.name);
    this.unitPoints = configService.get<bigint>('renzo.unitPoints');
    this.unitInterval = configService.get<number>('renzo.unitInterval');
    this.l1Erc20BridgeEthereum = configService.get<string>('l1Erc20BridgeEthereum');
    this.l1Erc20BridgeArbitrum = configService.get<string>('l1Erc20BridgeArbitrum');
    this.l1Erc20BridgeLinea = configService.get<string>('l1Erc20BridgeLinea');
    this.l1Erc20BridgeBlast = configService.get<string>('l1Erc20BridgeBlast');
    
    this.pointData = new Map;
  }

  public async onModuleInit() {
    this.logger.log('Init RenzoService onmoduleinit');
    // setInterval will wait for 100s, so it's necessary to execute the fetchApiData function once first.
    const func = async () => {
      try {
        await this.loadPointData();
      } catch (err) {
        this.logger.error('RenzoService init failed.', err.stack);
      }
    };
    await func();
    setInterval(func, 1000 * 100);
  }

  public async loadPointData() {
    this.logger.log('loadRenzoData has been load.');
    const tokensRenzoPoints = await this.renzoApiService.fetchTokensRenzoPoints();
    const [points, tokensLocalPoints] = await this.getLocalPoint();
    const tokensMapBridgeTokens = await this.getTokensMapBriageTokens();
    if(tokensMapBridgeTokens.size < 1 || tokensLocalPoints.size < 1 || tokensRenzoPoints.size < 1) {
      throw new Error(`Fetch empty data, tokensMapBridgeTokens.size: ${tokensMapBridgeTokens.size}, tokensLocalPoints.size: ${tokensLocalPoints.size}, tokensRenzoPoints.size: ${tokensRenzoPoints.size}`);
    }
    
    let data: RenzoPointsWithoutDecimalsDto[] = [],
        totalRealRenzoPoints: number = Number(0),
        totalRealEigenLayerPoints: number = Number(0);
    for (const point of points) {
      const tokenAddress = point.token.toLocaleLowerCase();
      if(!tokenAddress){
        throw new Error(`Get renzo point exception, address is ${point.address}`);
      }
      const totalPoints = tokensLocalPoints.get(tokenAddress);
      if(totalPoints <= 0){
        this.logger.log(`Get renzo local totalPoints is zero, tokenAddress is ${tokenAddress}`);
        continue;
      }

      const bridgeToken = tokensMapBridgeTokens.get(tokenAddress);
      const renzoPoints = tokensRenzoPoints.get(bridgeToken);
      if(!renzoPoints){
        this.logger.log(`Get renzo renzoPoints is undefined, tokenAddress is ${tokenAddress}`);
        continue;
      }
      const realRenzoPoints = Number(
        new BigNumber(point.points.toString())
          .multipliedBy(renzoPoints.renzoPoints)
          .div(totalPoints.toString())
          .toFixed(6),
      );
      totalRealRenzoPoints += realRenzoPoints;
      const realEigenLayerPoints = Number(
        new BigNumber(point.points.toString())
          .multipliedBy(renzoPoints.eigenLayerPoints)
          .div(totalPoints.toString())
          .toFixed(6),
      );
      totalRealEigenLayerPoints += realEigenLayerPoints;
      const dto: RenzoPointsWithoutDecimalsDto = {
        address: point.address,
        tokenAddress: point.token,
        balance: "0",
        points: {
          renzoPoints: realRenzoPoints,
          eigenLayerPoints: realEigenLayerPoints,
        },
        updatedAt: (point.updatedAt.getTime() / 1000) | 0,
      };
      data.push(dto);
    }
    this.pointData.set("renzoPoints", totalRealRenzoPoints);
    this.pointData.set("eigenLayerPoints", totalRealEigenLayerPoints);
    this.pointData.set("data", data);
  }

  private async getLocalPoint(): Promise<[Points[], Map<String, bigint>]> {
    const points = [];//await this.getAllPoints();
    const tokenPoins: Map<String, bigint> = new Map;
    for (const item of points) {
      const tokenAddress = item.token.toLocaleLowerCase();
      const tempPoint = tokenPoins.get(tokenAddress);
      if(undefined == tempPoint){
        tokenPoins.set(tokenAddress, BigInt(item.points));
      }else{
        tokenPoins.set(tokenAddress, tempPoint + BigInt(item.points))
      }
    }

    return [points, tokenPoins];
  }

  private async getTokensMapBriageTokens(): Promise<Map<string, string>>{
    const tokens = this.renzoTokenAddress.map(item=>{
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
