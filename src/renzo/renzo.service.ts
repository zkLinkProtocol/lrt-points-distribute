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
import { RenzoPointsWithoutDecimalsDto } from 'src/Controller/pointsWithoutDecimals.dto';
import { In } from 'typeorm';

@Injectable()
export class RenzoService extends Worker {
  private readonly logger: Logger;
  private readonly waitForInterval: number;
  private readonly waitForRetry: number;
  private readonly renzoTokenAddress: string[];
  private readonly unitPoints: bigint;
  private readonly unitInterval: number;
  private allUserBalance: UserBalances[] = [];
  private pointData: Map<string, string|number|RenzoPointsWithoutDecimalsDto[]> = new Map();

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
  }

  public async onModuleInit() {
    this.logger.log("Init RenzoService onmoduleinit");
    // setInterval will wait for 100s, so it's necessary to execute the fetchApiData function once first.
    await this.loadPointData();
    setInterval(async () => {
      await this.loadPointData();
    }, 1000 * 10);
  }

  public async loadPointData() {
    const { renzoPoints, eigenLayerPoints, totalPoints, points } =
      await this.getLocalPointAndRealPoint();
    let data: RenzoPointsWithoutDecimalsDto[] = [];
    for (const point of points) {
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
          renzoPoints: Number(
            new BigNumber(point.points.toString())
              .multipliedBy(renzoPoints)
              .div(totalPoints.toString())
              .toFixed(6),
          ),
          eigenLayerPoints: Number(
            new BigNumber(point.points.toString())
              .multipliedBy(eigenLayerPoints)
              .div(totalPoints.toString())
              .toFixed(6),
          ),
        },
        updatedAt: (point.updatedAt.getTime() / 1000) | 0,
      };
      data.push(dto);
    }
    this.pointData.set("renzoPoints", renzoPoints);
    this.pointData.set("eigenLayerPoints", eigenLayerPoints);
    this.pointData.set("data", data);
  }

  private async getLocalPointAndRealPoint() {
    const { renzoPoints, eigenLayerPoints } =
      await this.renzoApiService.fetchRenzoPoints();
    this.logger.debug(`renzoPoints: ${renzoPoints}, eigenLayerPoints: ${eigenLayerPoints}`);
    this.logger.debug('start get all points');
    const points = await this.getAllPoints();
    this.logger.debug('end get all points');
    const totalPoints = points.reduce((acc, point) => {
      return acc + point.points;
    }, 0n);
    return {
      renzoPoints,
      eigenLayerPoints,
      totalPoints,
      points,
    };
  }

  public async getPointData(): Promise<any> {
    const timeout = 15000; // 15 seconds in milliseconds
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkRenzoPoints = () => {
        if (this.pointData !== null && this.pointData.size > 0) {
          resolve(this.pointData);
        } else if (Date.now() - startTime > timeout) {
          resolve(null);
        } else {
          setTimeout(checkRenzoPoints, 100); // Check again after 100 milliseconds
        }
      };

      checkRenzoPoints();
    });
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
    this.logger.log(
      `First deposit for RENZO ${transfer.to} timestamp:${transfer.timestamp.toUTCString()}`,
    );
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
      this.logger.debug(
        `diffInHours < 1 for address: ${address} tokenAddress: ${tokenAddress} updateAt: ${pufPoint.updatedAt.toUTCString()} diffInHours:${diffInHours}`,
      );
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
    this.logger.log(
      `UPDATE RENZO ${address} add:${formatEther(addPointsNumber)} total:${formatEther(pufPoint.points + addPointsNumber)} tokenAddress:${tokenAddress}`,
    );
    return [newPoints, addPointsNumber];
  }
}
