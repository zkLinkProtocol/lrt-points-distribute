import { Injectable } from "@nestjs/common";
import { BalanceOfLpRepository } from "src/repositories/balanceOfLp.repository";
import { GetUserPositionsDto } from "./positions.dto";
import { ethers } from "ethers";
import { PaginationUtil } from "src/common/pagination.util";

@Injectable()
export class PositionsService {
  constructor(private balanceOfRepository: BalanceOfLpRepository) {}

  async getPositionsByProjectAndAddress(
    params: GetUserPositionsDto & { projectName: string },
  ) {
    const { tokenAddresses, limit = 100, page = 1 } = params;
    const formattedParams = {
      ...params,
      tokenAddresses: tokenAddresses?.split(",") ?? [],
      limit,
      page,
    };
    const { list, totalCount } =
      await this.balanceOfRepository.getProjectPositionsByAddress(
        formattedParams,
      );
    const meta = PaginationUtil.genPaginateMetaByTotalCount(
      totalCount,
      page,
      limit,
    );
    return { data: list, meta: meta };
  }

  async getAgxEtherfiPositionsByBlock(blockNumber: number) {
    let result: Array<{ address: string; effective_balance: number }> = [];

    const data = await this.balanceOfRepository.getAgxEtherfiPositions({
      blockNumber,
    });

    result = data.map((i) => ({
      address: i.userAddress,
      effective_balance: Number(ethers.formatUnits(i.balance)),
    }));

    return {
      Result: result,
    };
  }
}
