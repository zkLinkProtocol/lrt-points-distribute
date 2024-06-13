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
    const data =
      await this.balanceOfRepository.getUserPositionsByProjectAndTokens(params);
    return data;
  }

  async getAgxEtherfiPositionsByBlock(blockNumber: string) {
    const page = 1;
    const limit = 100;
    const tokenAddresses = [
      "0x35D5f1b41319e0ebb5a10e55C3BD23f121072da8",
      "0xE227155217513f1ACaA2849A872ab933cF2d6a9A",
    ].join(",");

    let result: Array<{ address: string; effective_balance: number }> = [];
    let hasNextPage = true;

    while (hasNextPage) {
      const balances = await this.getUserPositionsByProjectAndTokens({
        projectName: "agx",
        tokenAddresses,
        page,
        limit,
        blockNumber,
      });
      if (result.length < limit) {
        hasNextPage = false;
      }
      result = result.concat(
        balances.map((i) => ({
          address: i.userAddress,
          effective_balance: Number(ethers.formatUnits(i.balance)),
        })),
      );
    }

    return {
      Result: result,
    };
  }
}
