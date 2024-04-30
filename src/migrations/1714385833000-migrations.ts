import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1714385833000 implements MigrationInterface {
  name = "Migrations1714385833000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
        `CREATE INDEX "IDX_at2ee8fa6b556b9ff926bd" ON "blockAddressPointOfLp" ("createdAt", "updatedAt", "address") `,
      );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_at2ee8fa6b556b9ff926bd"`,
    );
  }
}
