import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../unitOfWork";
import { BaseRepository } from "./base.repository";
import { BalanceOfLp } from "../entities/balanceOfLp.entity";
import { ProjectRepository } from "./project.repository";
import { GetUserPositionsDto } from "src/positions/positions.dto";
@Injectable()
export class BalanceOfLpRepository extends BaseRepository<BalanceOfLp> {
  public constructor(
    unitOfWork: UnitOfWork,
    readonly projectRepository: ProjectRepository,
  ) {
    super(BalanceOfLp, unitOfWork);
  }

  public async getLastList(
    addresses: string[],
    tokenAddress: string,
    pairAddress: string,
  ): Promise<BalanceOfLp[]> {
    const addressesBuffer = addresses.map((address) =>
      Buffer.from(address.substring(2), "hex"),
    );
    const transactionManager = this.unitOfWork.getTransactionManager();
    const query = `
        SELECT * FROM "balancesOfLp" AS a
        LEFT JOIN
        (
            SELECT address, "pairAddress", "tokenAddress", MAX("blockNumber") AS "blockNumber"
            FROM "balancesOfLp"
            WHERE "tokenAddress" = $1 AND "pairAddress" = $2 AND address = ANY($3)
            GROUP BY address, "pairAddress", "tokenAddress"
        ) AS b
        ON a.address = b.address
        AND a."tokenAddress" = b."tokenAddress"
        AND a."pairAddress" = b."pairAddress"
        AND a."blockNumber" = b."blockNumber";
    `;
    const result = await transactionManager.query(query, [
      tokenAddress,
      pairAddress,
      addressesBuffer,
    ]);
    return result.map((row) => {
      row.address = "0x" + row.address.toString("hex");
      row.tokenAddress = "0x" + row.tokenAddress.toString("hex");
      row.pairAddress = "0x" + row.pairAddress.toString("hex");
      return row;
    });
  }

  public async getListByBlockNumber(
    addresses: string[],
    tokenAddress: string,
    pairAddress: string,
    blockNumber: number,
  ): Promise<BalanceOfLp[]> {
    const addressesBuffer = addresses.map((address) =>
      Buffer.from(address.substring(2), "hex"),
    );
    const transactionManager = this.unitOfWork.getTransactionManager();
    const query = `
        SELECT * FROM "balancesOfLp" WHERE "tokenAddress" = $1 AND "pairAddress" = $2 AND address = ANY($3) AND "blockNumber" = $4;
    `;
    const result = await transactionManager.query(query, [
      tokenAddress,
      pairAddress,
      addressesBuffer,
      blockNumber,
    ]);
    return result.map((row) => {
      row.address = "0x" + row.address.toString("hex");
      row.tokenAddress = "0x" + row.tokenAddress.toString("hex");
      row.pairAddress = "0x" + row.pairAddress.toString("hex");
      return row;
    });
  }

  async getClosestBlockNumber(
    blockNumber: number,
    pairAddressBuffers: Buffer[],
  ) {
    let result: number | undefined;
    const entityManager = this.unitOfWork.getTransactionManager();
    if (blockNumber === undefined) {
      const latestBlock = await entityManager
        .createQueryBuilder(BalanceOfLp, "b")
        .select("MAX(b.blockNumber)", "max")
        .where("b.pairAddress IN (:...pairAddresses)", {
          pairAddresses: pairAddressBuffers,
        })
        .getRawOne();

      result = latestBlock ? Number(latestBlock.max) : undefined;
    } else {
      const closestBlock = await entityManager
        .createQueryBuilder(BalanceOfLp, "b")
        .select("b.blockNumber")
        .where("b.blockNumber <= :blockNumber", { blockNumber })
        .andWhere("b.pairAddress IN (:...pairAddresses)", {
          pairAddresses: pairAddressBuffers,
        })
        .orderBy("b.blockNumber", "DESC")
        .getOne();

      result = closestBlock?.blockNumber;
    }
    return result;
  }

  async getUserPositionsByProjectAndTokens({
    projectName,
    tokenAddresses,
    page = 1,
    limit = 10,
    blockNumber,
    userAddress,
  }: Omit<GetUserPositionsDto, "tokenAddresses"> & {
    projectName: string;
    tokenAddresses: string[];
  }): Promise<
    {
      userAddress: string;
      tokenAddress: string;
      balance: string;
    }[]
  > {
    const pairAddressBuffers =
      await this.projectRepository.getPairAddresses(projectName);

    const entityManager = this.unitOfWork.getTransactionManager();

    const closestBlockNumber = await this.getClosestBlockNumber(
      blockNumber,
      pairAddressBuffers,
    );

    if (!closestBlockNumber) {
      return [];
    }

    let queryBuilder = entityManager
      .createQueryBuilder(BalanceOfLp, "b")
      .select([
        'b.address AS "userAddress"',
        'b.tokenAddress AS "tokenAddress"',
        'SUM(CAST(b.balance AS numeric)) AS "balance"',
      ])
      .where("b.blockNumber = :blockNumber", {
        blockNumber: closestBlockNumber,
      })
      .andWhere("b.pairAddress IN (:...pairAddresses)", {
        pairAddresses: pairAddressBuffers,
      })
      .groupBy("b.address, b.tokenAddress");

    if (tokenAddresses.length > 0) {
      const tokenAddressBuffers = tokenAddresses.map((addr) =>
        Buffer.from(addr.slice(2), "hex"),
      );

      queryBuilder = queryBuilder.andWhere(
        "b.tokenAddress IN (:...tokenAddressList)",
        { tokenAddressList: tokenAddressBuffers },
      );
    }

    if (limit) {
      if (page) {
        queryBuilder = queryBuilder.skip((page - 1) * limit).take(limit);
      } else {
        queryBuilder = queryBuilder.take(limit);
      }
    }

    if (userAddress) {
      const userAddressBuffer = Buffer.from(userAddress.slice(2), "hex");

      queryBuilder = queryBuilder.andWhere("b.address = :userAddress", {
        userAddress: userAddressBuffer,
      });
    }

    const balances = await queryBuilder.getRawMany<{
      userAddress: Buffer;
      tokenAddress: Buffer;
      balance: string;
    }>();

    return balances.map((item) => ({
      ...item,
      userAddress: "0x" + item.userAddress.toString("hex"),
      tokenAddress: "0x" + item.tokenAddress.toString("hex"),
    }));
  }
}
