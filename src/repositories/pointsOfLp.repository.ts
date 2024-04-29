import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../unitOfWork";
import { PointsOfLp } from "../entities/pointsOfLp.entity";

export interface SumPointsGroupByProjectNameAndAddress {
  name: string;
  address: string;
  totalPoints: number;
}

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
    const transactionManager = this.unitOfWork.getTransactionManager();
    const query = `SELECT "pointsOfLp"."address", SUM("pointsOfLp"."stakePoint") as "totalPoints" FROM "pointsOfLp" left join project on "pointsOfLp"."pairAddress" = project."pairAddress" where project.name is not null GROUP BY "address" ORDER BY "totalPoints" DESC LIMIT ${limit} OFFSET ${page * limit}`;
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
    const query = `SELECT project.name, "pointsOfLp"."address", SUM("pointsOfLp"."stakePoint") as "totalPoints" FROM "pointsOfLp" LEFT JOIN project ON project."pairAddress" = "pointsOfLp"."pairAddress" WHERE project.name is not null and "pointsOfLp".address = ANY($1) GROUP BY project.name, "pointsOfLp"."address"`;
    const result = await transactionManager.query(query, [addresses]);
    return result.map((row: any) => {
      row.name = row.name == "owlet" ? "owlto" : row.name;
      row.address = "0x" + row.address.toString("hex");
      return row;
    });
  }
}
