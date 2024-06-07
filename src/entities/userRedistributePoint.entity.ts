import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { WithdrawHistory } from "./withdrawHistory.entity";
import { hexTransformer } from "../transformers/hex.transformer";
import { BaseEntity } from "./base.entity";

@Entity({ name: "userRedistributePoint" })
@Index(["userAddress", "tokenAddress"], { unique: true })
export class UserRedistributePoint extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "bytea", transformer: hexTransformer })
  tokenAddress: string;

  @Column({ type: "varchar", length: 128 })
  balance: string;

  @Column("decimal", { precision: 12, scale: 10 })
  exchangeRate: number;

  @Column("decimal", { precision: 12, scale: 10 })
  pointWeightPercentage: number;

  @ManyToOne(() => User, (user) => user.points, {
    onDelete: "CASCADE",
    cascade: true,
  })
  @JoinColumn({ name: "userAddress" })
  userAddress: User;

  @OneToMany(
    () => WithdrawHistory,
    (withdrawHistory) => withdrawHistory.userPointId,
    { cascade: true },
  )
  withdrawHistory: WithdrawHistory[];
}
