import { Controller, Get, Logger, Param, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  BalanceQueryDto,
  BalanceReturnDto,
  GetAGXPositionDto,
  GetUserPositionsDto,
  UserPositionsResponseDto,
} from "./positions.dto";
import { PositionsService } from "./positions.service";
import { PaginationUtil } from "src/common/pagination.util";
import { ParseAddressPipe } from "src/common/pipes/parseAddress.pipe";
import { SERVICE_EXCEPTION } from "src/puffer/tokenPointsWithoutDecimals.dto";

@ApiTags("positions")
@ApiExcludeController(false)
@Controller("positions")
export class PositionsController {
  private readonly logger = new Logger(PositionsController.name);
  constructor(private positionsService: PositionsService) {}

  @Get(":projectName")
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
  async getProjectPositions(
    @Param("projectName") projectName: string,
    @Query() queryParams: GetUserPositionsDto,
  ): Promise<UserPositionsResponseDto> {
    const { data, meta } =
      await this.positionsService.getPositionsByProjectAndAddress({
        projectName,
        ...queryParams,
      });

    return {
      errmsg: "no error",
      errno: 0,
      meta: meta,
      data: data,
    };
  }

  @Get("agx/etherfi")
  async getAgxUserEtherFiPositions(@Query() queryString: GetAGXPositionDto) {
    const { blockNumber } = queryString;
    const data =
      await this.positionsService.getAgxEtherfiPositionsByBlock(blockNumber);

    return data;
  }

  @Get("/balance/:token")
  @ApiOperation({
    summary: "Get balance list by block",
  })
  @ApiOkResponse({
    description: "Return all users' balance.",
    type: BalanceReturnDto,
  })
  @ApiBadRequestResponse({
    description: '{ "errno": 1, "errmsg": "Service exception" }',
  })
  @ApiNotFoundResponse({
    description: '{ "errno": 1, "errmsg": "not found" }',
  })
  public async getAllBalance(
    @Param("token", new ParseAddressPipe()) token: string,
    @Query() rsethQueryDto: BalanceQueryDto,
  ): Promise<Partial<BalanceReturnDto>> {
    const { block, page = 1, limit = 500 } = rsethQueryDto;
    try {
      // If more tokens need to be supported, please modify the subgraph.
      // Currently, only rsETH.eth and rsETH.arb are supported.
      const userPositions = await this.positionsService.getUserPositionByToken({
        token,
        block,
        page,
        limit,
      });
      const data = userPositions.map((position) => {
        const account = position.id;
        const liquidityPosition = position.liquidityPositions.reduce(
          (acc, cur) =>
            acc +
            (BigInt(cur.supplied) * BigInt(cur.pool.balance)) /
              BigInt(cur.pool.totalSupplied),
          BigInt(0),
        );
        const balancePosition = position.balances[0]
          ? BigInt(position.balances[0].balance)
          : BigInt(0);
        const balance = (balancePosition + liquidityPosition).toString();

        return { account, balance };
      });
      const totalBalance = data.reduce(
        (acc, cur) => BigInt(cur.balance) + acc,
        BigInt(0),
      );
      const paging = PaginationUtil.paginate(data, page, limit);
      const list = paging.items;
      const meta = paging.meta;
      return {
        errno: 0,
        errmsg: "no error",
        data: { totalBalance: totalBalance.toString(), list },
        meta,
      };
    } catch (err) {
      this.logger.error(
        `Get balance ${token} on block ${block} failed`,
        err.stack,
      );
      return SERVICE_EXCEPTION;
    }
  }
}
