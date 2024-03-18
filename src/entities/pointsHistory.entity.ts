import {
  BaseEntity,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BigNumberish } from 'ethers';
import { bigNumberTransformer } from '../transformers/bigNumber.transformer';
import { hexTransformer } from '../transformers/hex.transformer';

@Entity({ name: 'lrt_points_history' })
export class PointsHistory extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'bytea', nullable: false, transformer: hexTransformer })
  public readonly address: string;

  @Index()
  @Column({ type: 'bytea', nullable: false, transformer: hexTransformer })
  public readonly token: string;

  @Column({
    type: 'varchar',
    length: 256,
    transformer: bigNumberTransformer,
    default: 0n,
    nullable: true,
  })
  public readonly points: BigNumberish;

  @Column({ type: 'timestamp', nullable: false })
  public readonly updatedAt: Date;
}
