import { Entity, Column, PrimaryGeneratedColumn, Unique } from "typeorm";
import { BaseEntity } from "./base.entity";

@Entity({ name: "protocolDau" })
@Unique(["date", "name"])
export class ProtocolDau extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "int" })
  public readonly id: number;

  @Column({ type: "varchar" })
  public readonly name: string;

  @Column({ type: "int" })
  public readonly amount: number;

  @Column({ type: "date" })
  public readonly date: String;
}
