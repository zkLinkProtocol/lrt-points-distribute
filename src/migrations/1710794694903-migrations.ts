import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1710794694903 implements MigrationInterface {
    name = 'Migrations1710794694903'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "lrt_points_history" ("id" SERIAL NOT NULL, "address" bytea NOT NULL, "token" bytea NOT NULL, "points" character varying(256) DEFAULT 0, "updatedAt" TIMESTAMP NOT NULL, CONSTRAINT "PK_ce23c85d7e1ca782d3b2bbd9cee" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3f44f57a881cbd24abc60de599" ON "lrt_points_history" ("address") `);
        await queryRunner.query(`CREATE INDEX "IDX_addcaa2ee8fa6b556b9ff926bf" ON "lrt_points_history" ("token") `);
        await queryRunner.query(`CREATE TABLE "lrt_points" ("id" SERIAL NOT NULL, "address" bytea NOT NULL, "token" bytea NOT NULL, "points" character varying(256) DEFAULT 0, "updatedAt" TIMESTAMP NOT NULL, CONSTRAINT "PK_b0105ab639d465035f41ce1d34f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5e37cb177d581a3d6f2730efaa" ON "lrt_points" ("updatedAt") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_78ff97912ffd64607643df587a" ON "lrt_points" ("address", "token") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_78ff97912ffd64607643df587a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e37cb177d581a3d6f2730efaa"`);
        await queryRunner.query(`DROP TABLE "lrt_points"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_addcaa2ee8fa6b556b9ff926bf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3f44f57a881cbd24abc60de599"`);
        await queryRunner.query(`DROP TABLE "lrt_points_history"`);
    }

}
