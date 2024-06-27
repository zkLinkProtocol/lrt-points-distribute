import { Injectable } from "@nestjs/common";
import { UnitOfWork as UnitOfWork } from "../unitOfWork";
import { BaseRepository } from "./base.repository";
import { TransactionDataOfPoints } from "../entities";

export interface TransactionDataOfPointsDto {
  userAddress: string;
  contractAddress: string;
  tokenAddress: string;
  decimals: number;
  price: string;
  quantity: bigint;
  nonce: string;
  timestamp: Date;
  txHash: string;
  blockNumber: number;
  projectName: string;
}
@Injectable()
export class TxDataOfPointsRepository extends BaseRepository<TransactionDataOfPoints> {
  public constructor(unitOfWork: UnitOfWork) {
    super(TransactionDataOfPoints, unitOfWork);
  }

  public async getListByTime(
    startTime: string,
    endTime: string,
    pairAddress: string[],
  ): Promise<TransactionDataOfPointsDto[]> {
    const pairAddressBuffer = pairAddress.map((item) =>
      Buffer.from(item.slice(2), "hex"),
    );
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `SELECT * FROM public."transactionDataOfPoints" WHERE "timestamp">='${startTime}' AND "timestamp"<'${endTime}' AND "contractAddress"=ANY($1);`,
      [pairAddressBuffer],
    );
    return result.map((row: any) => {
      row.userAddress = "0x" + row.userAddress.toString("hex").toLowerCase();
      row.contractAddress =
        "0x" + row.contractAddress.toString("hex").toLowerCase();
      row.tokenAddress = "0x" + row.tokenAddress.toString("hex").toLowerCase();
      row.txHash = "0x" + row.txHash.toString("hex").toLowerCase();
      row.timestamp = new Date(row.timestamp);
      return row;
    });
  }
}
