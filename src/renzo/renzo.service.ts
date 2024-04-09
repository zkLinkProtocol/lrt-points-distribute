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
export class RenzoService extends Worker {
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
    super();
    this.waitForInterval = configService.get<number>('renzo.waitForInterval');
    this.renzoTokenAddress = configService.get<string[]>('renzo.tokenAddress');
    this.waitForRetry = configService.get<number>('renzo.waitForRetry');
    this.logger = new Logger(RenzoService.name);
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
    setInterval(func, 1000 * 10);
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
        balance: ((item) => {
          if (item && item.balance) {
            return BigNumber(ethers.formatEther(item.balance)).toFixed(6);
          }
          return '0';
        })(this.findUserBalance(point.address)),
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
    const points = await this.getAllPoints();
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

  public getPointData(): PointData {
    return {
      renzoPoints: this.pointData.get("renzoPoints"),
      eigenLayerPoints: this.pointData.get("eigenLayerPoints"),
      data: this.pointData.get("data")
    } as PointData;
  }

  public async getPoints(address: string) {
    const points = await this.pointsRepository.find({
      where: {
        address,
        token: In(this.renzoTokenAddress),
      },
    });
    return points;
  }

  public async getAllPoints() {
    let result: Points[] = [];
    let page: number = 1;
    const pageSize = 300;
    while (true) {
      const points = await this.pointsRepository.find({
        where: {
          token: In(this.renzoTokenAddress),
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

      result.push(...points);
      if (points.length < pageSize) {
        break;
      }

      ++page;
    }

    return result;
  }

  public findUserBalance(address: string): UserBalances {
    return this.allUserBalance.find(
      (balance) => balance.address.toLowerCase() === address.toLowerCase(),
    );
  }

  protected async runProcess(): Promise<void> {
    let nextIterationDelay = this.waitForInterval;

    try {
      const allBalances = await this.explorerService.getAllBalance(
        this.renzoTokenAddress,
      );
      this.allUserBalance = allBalances;
      this.logger.log(`LOAD RENZO BALANCE ${allBalances.length} users`);
      for (const balance of allBalances) {
        const address = balance.address;
        const next = await this.processNextUser(balance);
        if (!next) {
          const firstDeposit = await this.explorerService.getFirstDeposit(
            address,
            balance.tokenAddress,
          );
          if (firstDeposit) {
            await this.initRenzo(firstDeposit);
            //immidiately retry
            await this.processNextUser(balance);
          } else {
            this.logger.error(
              `No first deposit for address: ${address} tokenAddress: ${this.renzoTokenAddress}`,
            );
          }
        }
      }
    } catch (error) {
      nextIterationDelay = this.waitForRetry;
      this.logger.error(
        `Error on processing next block range, waiting ${nextIterationDelay} ms to retry`,
        error.stack,
      );
    }

    await waitFor(() => !this.currentProcessPromise, nextIterationDelay);

    if (!this.currentProcessPromise) {
      return;
    }
    return this.runProcess();
  }

  private async processNextUser(userBalance: UserBalances): Promise<boolean> {
    const address = userBalance.address;
    const balance = BigInt(userBalance.balance);
    const tokenAddress = userBalance.tokenAddress;
    const puffPoints = await this.pointsRepository.find({
      where: {
        address: address,
        token: tokenAddress,
      },
    });
    if (puffPoints.length > 0) {
      const [newPoints, addPointsNumber] = this.updatePoints(
        puffPoints[0],
        balance,
      );
      if (newPoints) {
        await this.pointsRepository.updatePointsDb(newPoints, addPointsNumber);
      }

      return true;
    }

    // return and run init
    return false;
  }

  private async initRenzo(transfer: Transfer) {
    await this.pointsRepository.add({
      address: transfer.to,
      token: transfer.tokenAddress,
      points: 0n,
      updatedAt: transfer.timestamp,
    });
    // this.logger.log(
    //   `First deposit for RENZO ${transfer.to} timestamp:${transfer.timestamp.toUTCString()}`,
    // );
  }

  public updatePoints(
    pufPoint: Points,
    balance: bigint,
  ): [Partial<Points>, bigint] {
    const address = pufPoint.address;
    const tokenAddress = pufPoint.token;
    const diffInMs = Date.now() - pufPoint.updatedAt.getTime();
    const diffInHours = Math.floor(diffInMs / this.unitInterval);
    if (diffInHours < 1) {
      // return true to prevent try again
      // this.logger.debug(
      //   `diffInHours < 1 for address: ${address} tokenAddress: ${tokenAddress} updateAt: ${pufPoint.updatedAt.toUTCString()} diffInHours:${diffInHours}`,
      // );
      return [null, 0n];
    }
    const addPointsNumber = this.unitPoints * BigInt(diffInHours) * balance;
    const newPoints = {
      ...pufPoint,
      points: BigInt(pufPoint.points) + addPointsNumber,
      updatedAt: new Date(
        pufPoint.updatedAt.getTime() + diffInHours * this.unitInterval,
      ),
    };
    // update points and timestamp
    // this.logger.log(
    //   `UPDATE RENZO ${address} add:${formatEther(addPointsNumber)} total:${formatEther(pufPoint.points + addPointsNumber)} tokenAddress:${tokenAddress}`,
    // );
    return [newPoints, addPointsNumber];
  }
}