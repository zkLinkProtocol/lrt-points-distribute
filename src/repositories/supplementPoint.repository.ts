import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../unitOfWork";
import { BaseRepository } from "./base.repository";
import {
  SupplementPointType,
  supplementPoint,
} from "../entities/supplementPoint.entity";

@Injectable()
export class SupplementPointRepository extends BaseRepository<supplementPoint> {
  public constructor(unitOfWork: UnitOfWork) {
    super(supplementPoint, unitOfWork);
  }

  async addManyDirectPoint(
    points: { address: string; point: number }[],
    batchString: string,
  ): Promise<void> {
    const insertData = points.map((item) => {
      return {
        address: item.address,
        point: item.point,
        batchString: batchString,
        type: SupplementPointType.DirectHold,
      };
    });
    await this.addManyOrUpdate(
      insertData,
      ["point"],
      ["address", "batchString", "type"],
    );
  }
}
