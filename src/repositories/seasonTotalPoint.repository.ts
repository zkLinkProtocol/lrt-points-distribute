import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../unitOfWork";
import { BaseRepository } from "./base.repository";
import { SeasonTotalPoint } from "../entities/seasonTotalPoint.entity";
import removeAddress from "src/config/removeAddress";

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
      `SELECT "userAddress", "pairAddress", "userName", sum(point) AS "totalPoint" FROM "seasonTotalPoint" WHERE "userAddress"=ANY($1) AND season=$2 AND type!='referral' GROUP BY "userAddress", "pairAddress", "userName";`,
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
    const removeAddressBuffer = removeAddress.map((address) =>
      Buffer.from(address.slice(2), "hex"),
    );
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `SELECT "userAddress", "userName", sum(point) AS "totalPoints" FROM "seasonTotalPoint" WHERE "pairAddress"=ANY($1) AND season=$2 AND "userAddress"!=ALL($3) GROUP BY "userAddress","userName" ORDER BY "totalPoints" DESC;`,
      [pairAddressesBuffer, season, removeAddressBuffer],
    );

    const data = result.map((row) => {
      row.userAddress = "0x" + row.userAddress.toString("hex");
      row.userName = row.userName.toString();
      row.totalPoints = Number.isFinite(Number(row.totalPoints))
        ? Number(row.totalPoints).toFixed(10)
        : 0;
      return row;
    });
    return data;
  }

  public async getSeasonTotalPointGroupByPairAddresses(season: number): Promise<
    {
      pairAddress: string;
      totalPoints: number;
    }[]
  > {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `SELECT "pairAddress", sum(point) AS "totalPoints" FROM "seasonTotalPoint" WHERE season=$1 GROUP BY "pairAddress";`,
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

  public async getSeasonTotalPointGroupByPairAddressesType(
    season: number,
  ): Promise<
    {
      pairAddress: string;
      totalPoints: number;
      type: string;
    }[]
  > {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `SELECT "pairAddress", type, sum(point) AS "totalPoints" FROM "seasonTotalPoint" WHERE season=$1 GROUP BY "pairAddress", type;`,
      [season],
    );
    return result.map((row) => {
      row.pairAddress = "0x" + row.pairAddress.toString("hex");
      row.totalPoints = Number.isFinite(Number(row.totalPoints))
        ? Number(row.totalPoints)
        : 0;
      row.type = row.type;
      return row;
    });
  }

  public async getSeasonTotalOtherPoint(
    season: number,
    address: string,
  ): Promise<number> {
    const addressBuffer = Buffer.from(address.slice(2), "hex");
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `SELECT sum(point) AS "totalPoints" FROM "seasonTotalPoint" WHERE season=$1 AND "userAddress"=$2 AND type = 'other';`,
      [season, addressBuffer],
    );
    const totalPoints =
      result.length > 0 && Number.isFinite(Number(result[0].totalPoints))
        ? Number(result[0].totalPoints)
        : 0;
    return totalPoints;
  }

  public async getSeasonTotalPointByType(
    address: string,
    season: number,
    type: string,
  ): Promise<number> {
    const addressBuffer = Buffer.from(address.slice(2), "hex");
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `SELECT sum(point) AS "totalPoints" FROM "seasonTotalPoint" WHERE season=$1  AND "userAddress"=$2 AND type = '${type}'`,
      [season, addressBuffer],
    );
    return result.length > 0 && Number.isFinite(Number(result[0].totalPoints))
      ? Number(result[0].totalPoints)
      : 0;
  }

  public async getSeasonTotalPointByAddress(
    season: number,
    address: string,
  ): Promise<
    {
      pairAddress: string;
      type: string;
      totalPoint: number;
    }[]
  > {
    const addressBuffer = Buffer.from(address.slice(2), "hex");
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `SELECT "pairAddress", "type", sum(point) AS "totalPoint" FROM "seasonTotalPoint" WHERE "userAddress"=$1 AND season=$2 GROUP BY "pairAddress", "type";`,
      [addressBuffer, season],
    );
    return result.map((row) => {
      row.pairAddress = "0x" + row.pairAddress.toString("hex");
      row.totalPoint = Number.isFinite(Number(row.totalPoint))
        ? Number(row.totalPoint)
        : 0;
      return row;
    });
  }

  public async getSeasons(): Promise<number[]> {
    const entityManager = this.unitOfWork.getTransactionManager();
    const result = await entityManager
      .createQueryBuilder(SeasonTotalPoint, "a")
      .select("season")
      .groupBy("season")
      .orderBy("season", "ASC")
      .getRawMany();
    return result.map((row) => row.season);
  }
}
