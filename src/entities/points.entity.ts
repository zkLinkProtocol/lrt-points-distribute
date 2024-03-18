import {
  BaseEntity,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigNumberTransformer } from '../transformers/bigNumber.transformer';
import { hexTransformer } from '../transformers/hex.transformer';

@Entity({ name: 'lrt_points' })
@Index(['address', 'token'], { unique: true })
export class Points extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bytea', transformer: hexTransformer })
  public readonly address: string;

  @Column({ type: 'bytea', nullable: false, transformer: hexTransformer })
  public readonly token: string;

  @Column({
    type: 'varchar',
    length: 256,
    transformer: bigNumberTransformer,
    default: 0n,
    nullable: true,
  })
  public readonly points: bigint;

  @Index()
  @Column({ type: 'timestamp', nullable: false })
  public readonly updatedAt: Date;
}
