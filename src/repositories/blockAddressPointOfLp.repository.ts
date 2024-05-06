import { Injectable } from "@nestjs/common";
import { BaseRepository } from "./base.repository";
import { UnitOfWork } from "../unitOfWork";
import { BlockAddressPointOfLp } from "../entities/blockAddressPointOfLp.entity";
import { SumPointsGroupByProjectNameAndAddress } from "../type/sumPointsGroupByProjectNameAndAddress";

@Injectable()
export class BlockAddressPointOfLpRepository extends BaseRepository<BlockAddressPointOfLp> {
  public constructor(unitOfWork: UnitOfWork) {
    super(BlockAddressPointOfLp, unitOfWork);
  }

  public async getBlockAddressPoint(
    blockNumber: number,
    address: string,
    pairAddress: string,
  ): Promise<BlockAddressPointOfLp> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    return await transactionManager.findOne<BlockAddressPointOfLp>(
      BlockAddressPointOfLp,
      {
        where: { blockNumber, address, pairAddress },
      },
    );
  }

  public async getAddressPagingOrderBySumDailyPoints(
    page: number,
    limit: number,
    startTime: string,
    endTime: string,
  ): Promise<Buffer[]> {
    page = page - 1;
    page = page < 0 ? 0 : page;
    const transactionManager = this.unitOfWork.getTransactionManager();
    const query = `SELECT * FROM (
            SELECT "address", SUM("holdPoint") as "totalPoints"
            FROM "blockAddressPointOfLp"
            WHERE "createdAt" >= '${startTime}' AND "createdAt" <= '${endTime}'
            GROUP BY "address"
        ) AS a ORDER BY "totalPoints" DESC LIMIT ${limit} OFFSET ${page * limit}`;
    const result = await transactionManager.query(query);
    return result.map((row: any) => row.address);
  }

  public async getAddressDailyCount(
    startTime: string,
    endTime: string,
  ): Promise<number> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const query = `SELECT COUNT(DISTINCT "address") FROM "blockAddressPointOfLp" WHERE "createdAt" >= '${startTime}' AND "createdAt" < '${endTime}'`;
    const result = await transactionManager.query(query);
    return parseInt(result[0].count);
  }

  public async getSumDailyPointsGroupByProjectNameAndAddress(
    addresses: Buffer[],
    startTime: string,
    endTime: string,
  ): Promise<SumPointsGroupByProjectNameAndAddress[]> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const query = `SELECT b.name, a."address", SUM(a."holdPoint") as "totalPoints" FROM "blockAddressPointOfLp" AS a LEFT JOIN project AS b ON a."pairAddress" = b."pairAddress" WHERE a.address = ANY($1) AND a."createdAt" >= '${startTime}' AND a."createdAt" < '${endTime}' GROUP BY b.name, a."address"`;
    const result = await transactionManager.query(query, [addresses]);
    return result.map((row: any) => {
      row.name = row.name == "owlet" ? "owlto" : row.name;
      row.address = "0x" + row.address.toString("hex");
      return row;
    });
  }
}
