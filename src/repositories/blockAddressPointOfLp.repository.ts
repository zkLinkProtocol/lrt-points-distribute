import { Injectable } from "@nestjs/common";
import { BaseRepository } from "./base.repository";
import { UnitOfWork } from "../unitOfWork";
import { BlockAddressPointOfLp } from "../entities/blockAddressPointOfLp.entity";

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
}
