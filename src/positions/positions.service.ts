import { Injectable } from "@nestjs/common";
import { BalanceOfLpRepository } from "src/repositories/balanceOfLp.repository";
import { GetUserPositionsDto } from "./positions.dto";
import { ethers } from "ethers";
import { PaginationUtil } from "src/common/pagination.util";
import { fetchGraphQLData } from "src/utils/fetchDataFromGraph";

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

  async getUserPositionByToken(params: {
    token: string;
    limit: number;
    page: number;
    block: number;
  }) {
    const { token, block, limit, page } = params;
    const data = await fetchGraphQLData<{ userPositions: any[] }>(
      "https://graph.zklink.io/subgraphs/name/rseth-balance", // If more tokens need to be supported, please modify the subgraph
      `query MyQuery($token: Bytes = \"${token}\") {
        userPositions(
          first: ${limit}, 
          skip: ${(page - 1) * limit}, 
          block: {number: ${block}}
          where: {
            and: [
              {
                id_not_in: ["0x4ac97e2727b0e92ae32f5796b97b7f98dc47f059"]
                valid: true
              },
              {
                or: [
                  {
                    balances_: {
                      tokenAddress: $token, 
                      balance_gt: 0
                    }
                  },
                  {
                    liquidityPositions_: {
                      token: $token, 
                      supplied_gt: 0
                    }
                  }
                ]
              }
            ]
          }
        ) {
          id
          valid
          balances(
            where: {
              tokenAddress: $token
            }
          ) {
            symbol
            id
            decimals
            balance
            tokenAddress
          }
          liquidityPositions(
            where: {
              token: $token
            }
          )  {
            id
            supplied
            token
            pool {
              balance
              totalSupplied
              symbol
            }
          }
        }
      }
      `,
    );

    return data.userPositions;
  }
}
