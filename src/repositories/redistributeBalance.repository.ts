import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../unitOfWork";
import { BaseRepository } from "./base.repository";
import { RedistributeBalance } from "../entities/redistributeBalance.entity";
import { User, UserHolding, UserStaked, UserWithdraw } from "src/entities";
import { Project } from "src/entities/project.entity";

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
    const withdrawCutoffTimestamp = Math.floor(
      (new Date().getTime() - 7 * 24 * 60 * 60 * 1000) / 1000,
    );
    const withdrawCutoffDate = new Date(withdrawCutoffTimestamp * 1000);
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
      .leftJoinAndSelect(
        "user.withdraws",
        "uw",
        "uw.timestamp > :withdrawCutoffDate AND uw.tokenAddress IN (:...tokenBuffers)",
        {
          withdrawCutoffDate,
          tokenBuffers,
        },
      )
      .where("user.userAddress IN (:...userAddresses)", {
        userAddresses: userAddresses.map((addr) => Buffer.from(addr, "hex")),
      })
      .orderBy("user.createdAt", "DESC")
      .addOrderBy("user.userAddress", "ASC")
      .getMany();

    // Step 3: Organize data into the desired structure
    const result = users
      .map((user) => ({
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
      }))
      .filter(
        (item) =>
          ![
            "0xdd6105865380984716C6B2a1591F9643e6ED1C48".toLowerCase(), // lbank vault
            "0x4AC97E2727B0e92AE32F5796b97b7f98dc47F059".toLowerCase(), // aqua vault
            "0xc48F99afe872c2541f530C6c87E3A6427e0C40d5".toLowerCase(), // agx vault
          ].includes(item.userAddress),
      );

    return result;
  }

  async getRedistributePointsList(
    userAddresses: string[],
    tokenAddress: string,
  ) {
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
      ...point,
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

  async getPoolsByToken(tokenAddress: Buffer) {
    const entityManager = this.unitOfWork.getTransactionManager();

    const result = await entityManager
      .createQueryBuilder(UserStaked, "us")
      .select([
        'DISTINCT us.poolAddress AS "poolAddress"',
        "project.name AS name",
      ])
      .innerJoin(Project, "project", "project.pairAddress = us.poolAddress")
      .where("us.tokenAddress = :tokenAddress", { tokenAddress })
      .getRawMany<{ poolAddress: Buffer; name: string }>();

    return result.map((row) => ({
      poolAddress: "0x" + row.poolAddress.toString("hex"),
      name: row.name,
    }));
  }

  async getUserStakedPositionsByToken(
    tokenAddress: Buffer,
    userAddress: Buffer,
  ) {
    const entityManager = this.unitOfWork.getTransactionManager();
    const positions = await entityManager
      .createQueryBuilder(UserStaked, "us")
      .where("us.tokenAddress = :tokenAddress", { tokenAddress })
      .andWhere("us.userAddress = :userAddress", { userAddress })
      .getMany();
    return positions;
  }
}
