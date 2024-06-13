import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiNotFoundResponse,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { BalanceOfLpRepository } from "src/repositories/balanceOfLp.repository";
import { GetUserPositionsDto, UserPositionsResponseDto } from "./positions.dto";
import { ethers } from "ethers";

@ApiTags("positions")
@ApiExcludeController(false)
@Controller("positions")
export class PositionController {
  constructor(private balanceOfRepository: BalanceOfLpRepository) {}

  @Get(":projectName/tokens")
  @ApiParam({
    name: "projectName",
    required: true,
    description: "Project name",
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  async getUserPositionsByProjectAndTokens(
    @Param("projectName") projectName: string,
    @Query() queryParams: GetUserPositionsDto,
  ): Promise<UserPositionsResponseDto> {
    const { tokenAddresses, page, limit, blockNumber } = queryParams;
    const balances =
      await this.balanceOfRepository.getUserPositionsByProjectAndTokens({
        projectName,
        tokenAddresses,
        page,
        limit,
        blockNumber,
      });

    return {
      errmsg: "no error",
      errno: 0,
      data: balances,
    };
  }

  @Get("agx/etherfi")
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  async getAgxUserEtherFiPositions(
    @Query("blockNumber") blockNumber?: string,
  ): Promise<{ Result: { address: string; effective_balance: number }[] }> {
    const page = 1;
    const limit = 100;
    const tokenAddresses = [
      "0x35D5f1b41319e0ebb5a10e55C3BD23f121072da8",
      "0xE227155217513f1ACaA2849A872ab933cF2d6a9A",
    ].join(",");

    let result: Array<{ address: string; effective_balance: number }> = [];
    let hasNextPage = true;

    while (hasNextPage) {
      const balances =
        await this.balanceOfRepository.getUserPositionsByProjectAndTokens({
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
