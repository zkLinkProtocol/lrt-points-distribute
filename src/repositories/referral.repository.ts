import { Injectable } from "@nestjs/common";
import { BaseRepository } from "./base.repository";
import { ReferralUnitOfWork as UnitOfWork } from "../unitOfWork";
import { Referral } from "../entities";

@Injectable()
export class ReferralRepository extends BaseRepository<Referral> {
  public constructor(unitOfWork: UnitOfWork) {
    super(Referral, unitOfWork);
  }

  public async getReferral(address: string): Promise<string[]> {
    const addressBuffer = Buffer.from(address.slice(2), "hex");
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `SELECT address, referrer FROM referrers WHERE referrer=$1;`,
      [addressBuffer],
    );
    return result.map((row) => "0x" + row.address.toString("hex"));
  }
}
