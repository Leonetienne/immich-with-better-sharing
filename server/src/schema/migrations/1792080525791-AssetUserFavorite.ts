import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE TABLE "asset_user_favorite" (
  "userId" uuid NOT NULL,
  "assetId" uuid NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "asset_user_favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "asset_user_favorite_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "asset_user_favorite_pkey" PRIMARY KEY ("userId", "assetId")
);`.execute(db);
  await sql`CREATE INDEX "asset_user_favorite_userId_idx" ON "asset_user_favorite" ("userId");`.execute(db);
  await sql`CREATE INDEX "asset_user_favorite_assetId_idx" ON "asset_user_favorite" ("assetId");`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE "asset_user_favorite";`.execute(db);
}
