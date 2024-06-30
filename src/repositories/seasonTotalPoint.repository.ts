import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../unitOfWork";
import { BaseRepository } from "./base.repository";
import { SeasonTotalPoint } from "../entities";

@Injectable()
export class SeasonTotalPointRepository extends BaseRepository<SeasonTotalPoint> {
  public constructor(unitOfWork: UnitOfWork) {
    super(SeasonTotalPoint, unitOfWork);
  }

  public async getSeasonTotalPoint(
    addresses: string[],
    season: number,
  ): Promise<
    {
      userAddress: string;
      pairAddress: string;
      userName: string;
      totalPoint: number;
    }[]
  > {
    const addressesBuffer = addresses.map((address) =>
      Buffer.from(address.slice(2), "hex"),
    );
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `SELECT "userAddress", "pairAddress", "userName", sum(point) AS "totalPoint" FROM "seasonTotalPoint" WHERE "userAddress"=ANY($1) AND season=$2 AND type != 'referral' GROUP BY "userAddress", "pairAddress", "userName";`,
      [addressesBuffer, season],
    );
    return result.map((row) => {
      row.userAddress = "0x" + row.userAddress.toString("hex");
      row.pairAddress = "0x" + row.pairAddress.toString("hex");
      row.totalPoint = Number.isFinite(Number(row.totalPoint))
        ? Number(row.totalPoint)
        : 0;
      return row;
    });
  }

  public async getSeasonTotalPointByPairAddresses(
    pairAddresses: string[],
    season: number,
    page: number,
    limit: number,
  ): Promise<
    {
      userAddress: string;
      userName: string;
      totalPoints: number;
    }[]
  > {
    const pairAddressesBuffer = pairAddresses.map((address) =>
      Buffer.from(address.slice(2), "hex"),
    );
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `SELECT "userAddress", "userName", sum(point) AS "totalPoints" FROM "seasonTotalPoint" WHERE "pairAddress"=ANY($1) AND season=$2 AND type != 'referral' GROUP BY "userAddress","userName" ORDER BY "totalPoints" DESC LIMIT $3 OFFSET $4;`,
      [pairAddressesBuffer, season, limit, (page - 1) * limit],
    );
    return result.map((row) => {
      row.userAddress = "0x" + row.userAddress.toString("hex");
      row.userName = row.userName.toString();
      row.totalPoints = Number.isFinite(Number(row.totalPoints))
        ? Number(row.totalPoints)
        : 0;
      return row;
    });
  }

  public async getSeasonTotalPointGroupByPairAddresses(season: number): Promise<
    {
      pairAddress: string;
      totalPoints: number;
    }[]
  > {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `SELECT "pairAddress", sum(point) AS "totalPoints" FROM "seasonTotalPoint" WHERE season=$1 AND type != 'referral' GROUP BY "pairAddress";`,
      [season],
    );
    return result.map((row) => {
      row.pairAddress = "0x" + row.pairAddress.toString("hex");
      row.totalPoints = Number.isFinite(Number(row.totalPoints))
        ? Number(row.totalPoints)
        : 0;
      return row;
    });
  }
}
