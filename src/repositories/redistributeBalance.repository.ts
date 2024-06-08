import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../unitOfWork";
import { BaseRepository } from "./base.repository";
import { RedistributeBalance } from "../entities/redistributeBalance.entity";
import { User, UserHolding, UserStaked, UserWithdraw } from "src/entities";

@Injectable()
export class RedistributeBalanceRepository extends BaseRepository<RedistributeBalance> {
  public constructor(unitOfWork: UnitOfWork) {
    super(RedistributeBalance, unitOfWork);
  }

  public async getPercentageByAddress(
    userAddress: string,
    tokenAddress: string,
    pairAddress: string,
  ): Promise<{ percentage: number; balance: bigint }> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const record = await transactionManager.findOne(RedistributeBalance, {
      where: {
        userAddress: userAddress,
        tokenAddress: tokenAddress,
        pairAddress: pairAddress,
      },
    });

    return {
      percentage: record ? Number(record.percentage) : 0,
      balance: BigInt(record?.balance ?? 0),
    };
  }

  async getPaginatedUserData(
    tokenAddresses: string[],
    poolAddresses: string[],
    page: number = 0,
    pageSize: number = 100,
  ): Promise<
    Array<{
      userAddress: string;
      userStaked: UserStaked[];
      userHolding: UserHolding[];
      userWithdraw: UserWithdraw[];
    }>
  > {
    const entityManager = this.unitOfWork.getTransactionManager();
    const tokenBuffers = tokenAddresses.map((addr) =>
      Buffer.from(addr.slice(2), "hex"),
    );
    const poolBuffers = poolAddresses.map((addr) =>
      Buffer.from(addr.slice(2), "hex"),
    );

    // Step 1: Get unique user addresses from UserHolding and UserStaked, with pagination
    const userHoldingSubQuery = `
      SELECT uh."userAddress"
      FROM "userHolding" uh
      WHERE uh."tokenAddress" = ANY($1)
    `;

    const userStakedSubQuery = `
      SELECT us."userAddress"
      FROM "userStaked" us
      WHERE us."tokenAddress" = ANY($1) AND us."poolAddress" = ANY($2)
    `;

    const combinedSubQuery = `
      (${userHoldingSubQuery}) 
      UNION 
      (${userStakedSubQuery})
      LIMIT $3 OFFSET $4
    `;

    const combinedUserAddresses = await entityManager.query(combinedSubQuery, [
      tokenBuffers,
      poolBuffers,
      pageSize,
      page * pageSize,
    ]);

    if (combinedUserAddresses.length === 0) {
      return [];
    }

    const userAddresses = combinedUserAddresses.map((row) => row.userAddress);

    // Step 2: Get user data
    const users = await entityManager
      .createQueryBuilder(User, "user")
      .leftJoinAndSelect(
        "user.holdings",
        "uh",
        "uh.tokenAddress IN (:...tokenBuffers)",
        { tokenBuffers },
      )
      .leftJoinAndSelect(
        "user.stakes",
        "us",
        "us.tokenAddress IN (:...tokenBuffers) AND us.poolAddress IN (:...poolBuffers)",
        { tokenBuffers, poolBuffers },
      )
      .leftJoinAndSelect("user.withdraws", "uw")
      .where("user.userAddress IN (:...userAddresses)", {
        userAddresses: userAddresses.map((addr) => Buffer.from(addr, "hex")),
      })
      .getMany();

    // Step 3: Organize data into the desired structure
    const result = users.map((user) => ({
      userAddress: user.userAddress,
      userHolding: user.holdings.map((holding) => ({
        ...holding,
        userAddress: holding.userAddress,
        tokenAddress: holding.tokenAddress,
      })),
      userStaked: user.stakes.map((stake) => ({
        ...stake,
        userAddress: stake.userAddress,
        tokenAddress: stake.tokenAddress,
        poolAddress: stake.poolAddress,
      })),
      userWithdraw: user.withdraws.map((withdraw) => ({
        ...withdraw,
        userAddress: withdraw.userAddress,
        tokenAddress: withdraw.tokenAddress,
      })),
    }));

    return result;
  }

  async getRedistributePointsList(
    vaultAddresses: string[],
    tokenAddress: string,
  ) {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const vaultAddressBuffers = vaultAddresses.map((addr) =>
      Buffer.from(addr.slice(2), "hex"),
    );
    const tokenAddressBuffer = Buffer.from(tokenAddress.slice(2), "hex");
    const userRedistributePoints = await transactionManager
      .createQueryBuilder(UserHolding, "uh")
      .leftJoinAndSelect("uh.userAddress", "user")
      .where("uh.userAddress IN (:...vaultAddressBuffers)", {
        vaultAddressBuffers,
      })
      .andWhere("uh.tokenAddress = :tokenAddressBuffer", {
        tokenAddressBuffer,
      })
      .getMany();

    return userRedistributePoints;
  }
}
