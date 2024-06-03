import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../unitOfWork";
import { PointsOfLp } from "../entities/pointsOfLp.entity";
import { SumPointsGroupByProjectNameAndAddress } from "../type/sumPointsGroupByProjectNameAndAddress";
@Injectable()
export class PointsOfLpRepository {
  public constructor(private readonly unitOfWork: UnitOfWork) {}

  // find stakePoint from pointsOfLp where address = address and pairAddress in (pairAddresses)
  public async getStakePoints(
    pairAddresses: Buffer[],
    address: string,
  ): Promise<PointsOfLp[]> {
    const addrBuf = Buffer.from(address.substring(2), "hex");
    const transactionManager = this.unitOfWork.getTransactionManager();
    const query = `SELECT * FROM "pointsOfLp" WHERE "address" = $1 AND "pairAddress" = ANY($2)`;
    const results = await transactionManager.query(query, [
      addrBuf,
      pairAddresses,
    ]);
    return results.map((row: any) => {
      row.address = "0x" + row.address.toString("hex");
      row.pairAddress = "0x" + row.pairAddress.toString("hex");
      return row;
    });
  }

  public async getTotalNovaPointsByPairAddresses(
    pairAddresses: Buffer[],
  ): Promise<string> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const query = `
      SELECT SUM("stakePoint") as sum
      FROM "pointsOfLp"
      WHERE "pairAddress" = ANY($1)
    `;
    const results = await transactionManager.query(query, [pairAddresses]);

    if (results.length === 0 || !results[0].sum) {
      return "0";
    }

    return results[0].sum;
  }

  public async getPointByAddress(
    address: string,
    pairAddress: string,
  ): Promise<PointsOfLp> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    return await transactionManager.findOne<PointsOfLp>(PointsOfLp, {
      where: { address, pairAddress },
    });
  }

  public async getAddressPagingOrderBySumPoints(
    page: number,
    limit: number,
  ): Promise<Buffer[]> {
    page = page - 1;
    const transactionManager = this.unitOfWork.getTransactionManager();
    const query = `SELECT * FROM (SELECT "address", SUM("stakePoint") AS "totalPoints" FROM "pointsOfLp" GROUP BY "address") AS a ORDER BY "totalPoints" DESC LIMIT ${limit} OFFSET ${page * limit}`;
    const result = await transactionManager.query(query);
    return result.map((row: any) => row.address);
  }

  public async getAddressCount(): Promise<number> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const query = `SELECT COUNT(DISTINCT "address") FROM "pointsOfLp"`;
    const result = await transactionManager.query(query);
    return parseInt(result[0].count);
  }

  // project left join "pointsOfLp" on project.pairaddress = "pointsOfLp".pairaddress, group by project.name and project.address
  public async getSumPointsGroupByProjectNameAndAddress(
    addresses: Buffer[],
  ): Promise<SumPointsGroupByProjectNameAndAddress[]> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const query = `SELECT b.name, a."address", SUM(a."stakePoint") AS "totalPoints" FROM "pointsOfLp" AS a LEFT JOIN project AS b ON a."pairAddress" = b."pairAddress" WHERE a.address = ANY($1) GROUP BY b.name, a."address"`;
    const result = await transactionManager.query(query, [addresses]);
    return result.map((row: any) => {
      row.name = row.name == "owlet" ? "owlto" : row.name;
      row.address = "0x" + row.address.toString("hex");
      return row;
    });
  }
}
