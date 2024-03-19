import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../unitOfWork';
import { BaseRepository } from './base.repository';
import { Points } from 'src/entities/points.entity';
import { PointsHistoryRepository } from './pointsHistory.repository';

@Injectable()
export class PointsRepository extends BaseRepository<Points> {
  public constructor(
    unitOfWork: UnitOfWork,
    private readonly pointsHistoryRepository: PointsHistoryRepository,
  ) {
    super(Points, unitOfWork);
  }

  public async update(points: Partial<Points>): Promise<void> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    await transactionManager.update(
      this.entityTarget,
      { address: points.address, token: points.token },
      { points: points.points, updatedAt: points.updatedAt },
    );
  }

  public async updatePointsDb(
    pufPoint: Partial<Points>,
    addPoints: bigint,
  ): Promise<void> {
    await this.update(pufPoint);

    await this.pointsHistoryRepository.add({
      address: pufPoint.address,
      token: pufPoint.token,
      points: addPoints,
      updatedAt: new Date(),
    });
  }
}
