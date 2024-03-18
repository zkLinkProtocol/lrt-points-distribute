import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../unitOfWork';
import { BaseRepository } from './base.repository';
import { PointsHistory } from 'src/entities/pointsHistory.entity';

@Injectable()
export class PointsHistoryRepository extends BaseRepository<PointsHistory> {
  public constructor(unitOfWork: UnitOfWork) {
    super(PointsHistory, unitOfWork);
  }
}
