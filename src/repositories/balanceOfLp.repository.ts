import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../unitOfWork";
import { BaseRepository } from "./base.repository";
import { BalanceOfLp } from "../entities/balanceOfLp.entity";

@Injectable()
export class BalanceOfLpRepository extends BaseRepository<BalanceOfLp> {
  public constructor(unitOfWork: UnitOfWork) {
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
}
