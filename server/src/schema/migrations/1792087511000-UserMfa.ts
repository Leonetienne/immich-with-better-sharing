import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE "user" ADD "mfaSecret" character varying;`.execute(db);
  await sql`ALTER TABLE "user" ADD "mfaEnabled" boolean NOT NULL DEFAULT false;`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE "user" DROP COLUMN "mfaEnabled";`.execute(db);
  await sql`ALTER TABLE "user" DROP COLUMN "mfaSecret";`.execute(db);
}
