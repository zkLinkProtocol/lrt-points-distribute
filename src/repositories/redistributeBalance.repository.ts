import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../unitOfWork";
import { BaseRepository } from "./base.repository";
import { RedistributeBalance } from "../entities/redistributeBalance.entity";

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
      balance: BigInt(record.balance ?? 0),
    };
  }
}
