import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../unitOfWork';
import { BaseRepository } from './base.repository';
import { Points } from 'src/entities/points.entity';

@Injectable()
export class PointsRepository extends BaseRepository<Points> {
  public constructor(unitOfWork: UnitOfWork) {
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
}
