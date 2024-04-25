import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../unitOfWork";
import { PointsOfLp } from "../entities/pointsOfLp.entity";

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
}
