import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import waitFor from '../utils/waitFor';
import { Worker } from '../common/worker';
import { PuffPointsProcessor } from './puffPoints.processor';
import { Transfer } from 'src/type/transfer';
import { UserBalances } from 'src/type/userBalances';
import { PointsRepository } from 'src/repositories/points.repository';

@Injectable()
export class PuffPointsService extends Worker {
  private readonly logger: Logger;
  private readonly waitForInterval: number;
  private readonly waitForRetry: number;
  private readonly puffPointsTokenAddress: string;
  private readonly explorerApi: string;
  public constructor(
    private readonly puffPointsProcessor: PuffPointsProcessor,
    private readonly pointsRepository: PointsRepository,

    configService: ConfigService,
  ) {
    super();
    this.waitForInterval = configService.get<number>(
      'puffPoints.waitForInterval',
    );
    this.puffPointsTokenAddress = configService.get<string>(
      'puffPoints.tokenAddress',
    );
    this.waitForRetry = configService.get<number>('puffPoints.waitForRetry');
    this.logger = new Logger(PuffPointsService.name);
    this.explorerApi = configService.get<string>('explorerApiUrl');
  }

  protected async runProcess(): Promise<void> {
    let nextIterationDelay = this.waitForInterval;

    try {
      const allBalances = await this.getAllBalance(this.puffPointsTokenAddress);
      this.logger.log(`LOAD PUFFER BALANCE ${allBalances.length} users`);
      for (const balance of allBalances) {
        const address = balance.address;
        // const address = '0x017932354d7db8a000922b28f53dd9424a3bf0a6';
        const next = await this.puffPointsProcessor.processNextUser(
          balance,
          this.puffPointsTokenAddress,
        );
        if (!next) {
          const firstDeposit = await this.getFirstDeposit(
            address,
            this.puffPointsTokenAddress,
          );
          if (firstDeposit) {
            await this.initPuffPoints(firstDeposit);
            //immidiately retry
            await this.puffPointsProcessor.processNextUser(
              balance,
              this.puffPointsTokenAddress,
            );
          } else {
            this.logger.error(
              `No first deposit for address: ${address} tokenAddress: ${this.puffPointsTokenAddress}`,
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

  private async getAllBalance(tokenAddress: string): Promise<UserBalances[]> {
    const allBalancesRes: any = await fetch(
      `${this.explorerApi}/api?module=account&action=tokenbalanceall&contractaddress=${tokenAddress}`,
      {
        method: 'get',
      },
    );
    const allBalances = await allBalancesRes.json();
    if (!allBalances || !allBalances.result) {
      this.logger.error(`No user balance tokenAddress: ${tokenAddress}`);
      return [];
    }
    return allBalances.result;
  }

  private async getFirstDeposit(
    address: string,
    tokenAddress: string,
  ): Promise<Transfer> {
    const checkDeposit = await fetch(
      `${this.explorerApi}/address/${address}/firstdeposit?token=${tokenAddress}`,
      {
        method: 'get',
      },
    );
    const firstDeposit: Transfer = await checkDeposit.json();
    firstDeposit.timestamp = new Date(firstDeposit.timestamp);
    if (!firstDeposit || !firstDeposit.timestamp) {
      this.logger.error(
        `No first deposit for address: ${address} tokenAddress: ${tokenAddress}`,
      );
      return null;
    }
    return firstDeposit;
  }

  private async initPuffPoints(transfer: Transfer) {
    await this.pointsRepository.add({
      address: transfer.to,
      token: transfer.tokenAddress,
      points: 0n,
      updatedAt: transfer.timestamp,
    });
    this.logger.log(
      `First deposit for PUFFER ${transfer.to} timestamp:${transfer.timestamp.toUTCString()}`,
    );
  }
}
