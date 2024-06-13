import { Injectable } from "@nestjs/common";
import { BalanceOfLpRepository } from "src/repositories/balanceOfLp.repository";
import { GetUserPositionsDto } from "./positions.dto";
import { ethers } from "ethers";

@Injectable()
export class PositionsService {
  constructor(private balanceOfRepository: BalanceOfLpRepository) {}

  async getUserPositionsByProjectAndTokens(
    params: GetUserPositionsDto & { projectName: string },
  ) {
    const { tokenAddresses, limit = 100, page = 1 } = params;
    const formattedParams = {
      ...params,
      tokenAddresses: tokenAddresses?.split(",") ?? [],
      limit,
      page,
    };
    const data =
      await this.balanceOfRepository.getUserPositionsByProjectAndTokens(
        formattedParams,
      );
    return data;
  }

  async getAgxEtherfiPositionsByBlock(blockNumber: number) {
    const tokenAddresses = [
      "0x35D5f1b41319e0ebb5a10e55C3BD23f121072da8",
      "0xE227155217513f1ACaA2849A872ab933cF2d6a9A",
    ];

    let result: Array<{ address: string; effective_balance: number }> = [];

    const balances =
      await this.balanceOfRepository.getUserPositionsByProjectAndTokens({
        projectName: "agx",
        tokenAddresses,
        blockNumber: blockNumber,
      });

    result = balances.map((i) => ({
      address: i.userAddress,
      effective_balance: Number(ethers.formatUnits(i.balance)),
    }));

    return {
      Result: result,
    };
  }
}
