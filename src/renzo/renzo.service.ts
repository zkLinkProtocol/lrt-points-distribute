import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import waitFor from '../utils/waitFor';
import { Worker } from '../common/worker';
import { Transfer } from 'src/type/transfer';
import { UserBalances } from 'src/type/userBalances';
import { PointsRepository } from 'src/repositories/points.repository';
import { Points } from 'src/entities/points.entity';
import { formatEther } from 'ethers';
import { ExplorerService } from 'src/explorer/explorer.service';
import { In } from 'typeorm';

@Injectable()
export class RenzoService extends Worker {
  private readonly logger: Logger;
  private readonly waitForInterval: number;
  private readonly waitForRetry: number;
  private readonly renzoTokenAddress: string[];
  private readonly unitPoints: bigint;
  private readonly unitInterval: number;
  public constructor(
    private readonly pointsRepository: PointsRepository,
    private readonly explorerService: ExplorerService,
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

  protected async runProcess(): Promise<void> {
    let nextIterationDelay = this.waitForInterval;

    try {
      const allBalances = await this.explorerService.getAllBalance(
        this.renzoTokenAddress,
      );
      console.log(allBalances);
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
      console.error(error);
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
