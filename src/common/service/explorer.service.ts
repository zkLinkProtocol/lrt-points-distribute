import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transfer } from 'src/type/transfer';
import { Token } from 'src/type/token';
import { UserBalances } from 'src/type/userBalances';

@Injectable()
export class ExplorerService {
  private readonly logger: Logger;
  private readonly explorerApi: string;
  public constructor(configService: ConfigService) {
    this.logger = new Logger(ExplorerService.name);
    this.explorerApi = configService.get<string>('explorerApiUrl');
  }
  public async getAllBalance(
    tokenAddress: string[] | string,
  ): Promise<UserBalances[]> {
    const tokenAddresses = Array.isArray(tokenAddress)
      ? tokenAddress
      : [tokenAddress];
    const allBalances = await Promise.all(
      tokenAddresses.map((tokenAddress) => this._getAllBalance(tokenAddress)),
    );
    return allBalances.flat();
  }

  private async _getAllBalance(tokenAddress: string): Promise<UserBalances[]> {
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
    const res = allBalances.result as UserBalances[];

    return res.map((balance) => {
      balance.tokenAddress = tokenAddress;
      return balance;
    });
  }

  public async getFirstDeposit(
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
    if (!firstDeposit || !firstDeposit.timestamp) {
      this.logger.error(
        `No first deposit for address: ${address} tokenAddress: ${tokenAddress}`,
      );
      return null;
    }
    firstDeposit.timestamp = new Date(firstDeposit.timestamp);
    return firstDeposit;
  }

  public async getTokens(): Promise<Token[]> {
    const response = await fetch(
      `${this.explorerApi}/tokens?page=1&limit=200`,
      {
        method: 'get',
      },
    );
    const responseJson = await response.json();
    if (!responseJson || !responseJson.items) {
      this.logger.error(
        `No tokens`,
      );
      return null;
    }
    return responseJson.items;
  }
}
