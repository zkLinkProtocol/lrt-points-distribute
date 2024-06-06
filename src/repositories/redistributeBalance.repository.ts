import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../unitOfWork";
import { BaseRepository } from "./base.repository";
import { RedistributeBalance } from "../entities/redistributeBalance.entity";
import { UserRedistributePoint } from "src/entities/userRedistributePoint.entity";
import { In } from "typeorm";

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

  public async getPaginatedUserPoints(
    tokenAddresses: string[], // array of token addresses to filter
    page: number, // page number, starting from 0
    pageSize: number = 100, // number of users per page
  ): Promise<Array<{ userAddress: string; points: UserRedistributePoint[] }>> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const tokenBuffers = tokenAddresses.map((addr) =>
      Buffer.from(addr.slice(2), "hex"),
    );

    // Step 1: Get unique user addresses with the given token addresses
    const userAddressSubQuery = `
      SELECT DISTINCT u."userAddress"
      FROM "user" u
      JOIN user_redistribute_point urp ON u."userAddress" = urp."userAddress"
      WHERE urp."tokenAddress" = ANY($1)
      LIMIT $2 OFFSET $3
    `;

    const uniqueUserAddresses = await transactionManager.query(
      userAddressSubQuery,
      [tokenBuffers, pageSize, page * pageSize],
    );

    if (uniqueUserAddresses.length === 0) {
      return [];
    }

    const userAddresses = uniqueUserAddresses.map((row) => row.userAddress);

    // Step 2: Get UserRedistributePoint data for the paginated user addresses
    const userPointsQuery = `
      SELECT
        encode(urp."userAddress", 'hex') as "userAddress",
        encode(urp."tokenAddress", 'hex') as "tokenAddress",
        urp.balance,
        urp."exchangeRate" as "exchangeRate",
        urp."pointWeightPercentage" as "pointWeightPercentage"
      FROM user_redistribute_point urp
      WHERE urp."userAddress" = ANY($1)
        AND urp."tokenAddress" = ANY($2)
    `;

    const userPoints = await transactionManager.query(userPointsQuery, [
      userAddresses,
      tokenBuffers,
    ]);

    // Step 3: Group UserRedistributePoint data by userAddress
    const groupedUserPoints = userAddresses.map((userAddress) => {
      const points = userPoints.filter(
        (point) =>
          point.userAddress === Buffer.from(userAddress).toString("hex"),
      );
      return {
        userAddress: "0x" + Buffer.from(userAddress).toString("hex"),
        points,
      };
    });

    return groupedUserPoints;
  }

  async getRedistributePointsList(
    userAddresses: string[],
    tokenAddress: string,
  ): Promise<
    {
      userAddress: string;
      tokenAddress: string;
      balance: string;
      exchangeRate: number;
      pointWeightPercentage: number;
    }[]
  > {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const userAddressBuffers = userAddresses.map((addr) =>
      Buffer.from(addr.slice(2), "hex"),
    );
    const tokenAddressBuffer = Buffer.from(tokenAddress.slice(2), "hex");
    const userRedistributePoints = await transactionManager
      .createQueryBuilder(UserRedistributePoint, "urp")
      .leftJoinAndSelect("urp.userAddress", "user")
      .where("urp.userAddress IN (:...userAddressBuffers)", {
        userAddressBuffers,
      })
      .andWhere("urp.tokenAddress = :tokenAddressBuffer", {
        tokenAddressBuffer,
      })
      .getMany();

    return userRedistributePoints.map((point) => ({
      userAddress: point.userAddress.userAddress,
      tokenAddress: point.tokenAddress,
      balance: point.balance,
      exchangeRate: point.exchangeRate,
      pointWeightPercentage: point.pointWeightPercentage,
    }));
  }
}
