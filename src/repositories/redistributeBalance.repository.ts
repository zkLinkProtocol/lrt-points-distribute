import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../unitOfWork";
import { BaseRepository } from "./base.repository";
import { RedistributeBalance } from "../entities/redistributeBalance.entity";
import { User, UserHolding, UserStaked, UserWithdraw } from "src/entities";

//{ userAddress: string; pointWeight: bigint }
export interface RedistributePointsWeight {
  userAddress: string;
  pointWeight: bigint;
  balance: bigint;
}

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
      .orderBy("user.createdAt", "DESC")
      .orderBy("user.userAddress", "ASC")
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
    userAddresses: string[],
    tokenAddress: string,
  ): Promise<
    {
      userAddress: string;
      tokenAddress: string;
      balance: string;
      pointWeightPercentage: number;
      pointWeight: bigint;
    }[]
  > {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const userAddressBuffers = userAddresses.map((addr) =>
      Buffer.from(addr.slice(2), "hex"),
    );
    const tokenAddressBuffer = Buffer.from(tokenAddress.slice(2), "hex");
    const userRedistributePoints = await transactionManager
      .createQueryBuilder(UserHolding, "uh")
      .where("uh.userAddress IN (:...userAddressBuffers)", {
        userAddressBuffers,
      })
      .andWhere("uh.tokenAddress = :tokenAddressBuffer", {
        tokenAddressBuffer,
      })
      .getMany();
    return userRedistributePoints.map((point) => ({
      userAddress: point.userAddress,
      tokenAddress: point.tokenAddress,
      balance: point.balance,
      pointWeightPercentage: point.pointWeightPercentage,
      pointWeight: BigInt(point.pointWeight),
    }));
  }

  async getRedistributePointsWeight(
    tokenAddresses: string[],
    userAddresses: string[],
  ): Promise<RedistributePointsWeight[]> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const tokenAddressBuffers = tokenAddresses.map((addr) =>
      Buffer.from(addr.slice(2), "hex"),
    );
    const userAddressBuffers = userAddresses.map((addr) =>
      Buffer.from(addr.slice(2), "hex"),
    );
    const data = await transactionManager
      .createQueryBuilder(UserHolding, "urp")
      .select(
        "urp.userAddress, SUM(cast(urp.pointWeight as numeric)) as pointWeight, SUM(cast(urp.balance as numeric)) as balance, MIN(urp.createdAt) as createdAt",
      )
      .where("urp.tokenAddress IN (:...tokenAddressBuffers)", {
        tokenAddressBuffers,
      })
      .andWhere("urp.userAddress IN(:...userAddressBuffers)", {
        userAddressBuffers,
      })
      .groupBy("urp.userAddress")
      .orderBy("createdAt", "ASC")
      .orderBy("urp.userAddress", "ASC")
      .getRawMany();

    return data.map((row) => ({
      userAddress: "0x" + row.userAddress.toString("hex"),
      pointWeight: BigInt(row.pointweight),
      balance: BigInt(row.balance),
    }));
  }

  async getRedistributePointsWeightList(
    tokenAddresses: string[],
    page: number = 1,
    pageSize: number = 100,
  ): Promise<[RedistributePointsWeight[], number]> {
    page = Math.max(0, page - 1);
    const transactionManager = this.unitOfWork.getTransactionManager();
    const tokenAddressBuffers = tokenAddresses.map((addr) =>
      Buffer.from(addr.slice(2), "hex"),
    );
    const queryBuilder = await transactionManager
      .createQueryBuilder(UserHolding, "urp")
      .select(
        "urp.userAddress, SUM(cast(urp.pointWeight as numeric)) as pointWeight, SUM(cast(urp.balance as numeric)) as balance, MIN(urp.createdAt) as createdAt",
      )
      .where("urp.tokenAddress IN (:...tokenAddressBuffers)", {
        tokenAddressBuffers,
      })
      .groupBy("urp.userAddress");
    const data = await queryBuilder
      .orderBy("createdAt", "ASC")
      .orderBy("urp.userAddress", "ASC")
      .offset(page * pageSize)
      .limit(pageSize)
      .getRawMany();
    const totalCount = (await queryBuilder.getRawMany())?.length ?? 0;

    return [
      data.map((row) => ({
        userAddress: "0x" + row.userAddress.toString("hex"),
        pointWeight: BigInt(row.pointweight),
        balance: BigInt(row.balance),
      })),
      totalCount,
    ];
  }

  async getTotalRedistributePointsWeight(
    tokenAddresses: string[],
  ): Promise<bigint> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const tokenAddressBuffers = tokenAddresses.map((addr) =>
      Buffer.from(addr.slice(2), "hex"),
    );
    const data = await transactionManager
      .createQueryBuilder(UserHolding, "urp")
      .select("SUM(cast(urp.pointWeight as numeric))", "pointWeight")
      .where("urp.tokenAddress IN (:...tokenAddressBuffers)", {
        tokenAddressBuffers,
      })
      .getRawOne();

    return BigInt(data.pointWeight);
  }
}
