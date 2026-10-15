-- Reverts the immich-tweaked schema so the upstream immich image of the same version starts on this database.
-- Stop immich-server first, then run:
--   docker compose exec -T database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < migrate-back-to-immich.sql
-- Data without an upstream equivalent is copied to the schema immich_tweaked_backup before it is dropped.

\set ON_ERROR_STOP on

BEGIN;

CREATE SCHEMA IF NOT EXISTS immich_tweaked_backup;

-- partner favorites (asset_user_favorite)
CREATE TABLE IF NOT EXISTS immich_tweaked_backup.asset_user_favorite (
  "userId" uuid NOT NULL,
  "assetId" uuid NOT NULL,
  "createdAt" timestamp with time zone NOT NULL,
  PRIMARY KEY ("userId", "assetId")
);
DO $$
BEGIN
  IF to_regclass('public.asset_user_favorite') IS NOT NULL THEN
    INSERT INTO immich_tweaked_backup.asset_user_favorite
      SELECT "userId", "assetId", "createdAt" FROM public.asset_user_favorite
      ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- partner edit permissions (partner.allowEdits)
CREATE TABLE IF NOT EXISTS immich_tweaked_backup.partner_allow_edits (
  "sharedById" uuid NOT NULL,
  "sharedWithId" uuid NOT NULL,
  PRIMARY KEY ("sharedById", "sharedWithId")
);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'partner' AND column_name = 'allowEdits') THEN
    INSERT INTO immich_tweaked_backup.partner_allow_edits
      SELECT "sharedById", "sharedWithId" FROM public.partner WHERE "allowEdits"
      ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- locked albums (album.isLocked); their own assets keep visibility 'locked' and land in the owner's locked folder
CREATE TABLE IF NOT EXISTS immich_tweaked_backup.locked_album (
  "albumId" uuid PRIMARY KEY
);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'album' AND column_name = 'isLocked') THEN
    INSERT INTO immich_tweaked_backup.locked_album
      SELECT id FROM public.album WHERE "isLocked"
      ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- totp mfa (user.mfaSecret, user.mfaEnabled)
CREATE TABLE IF NOT EXISTS immich_tweaked_backup.user_mfa (
  "userId" uuid PRIMARY KEY,
  "mfaSecret" character varying,
  "mfaEnabled" boolean NOT NULL
);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'mfaEnabled') THEN
    INSERT INTO immich_tweaked_backup.user_mfa
      SELECT id, "mfaSecret", "mfaEnabled" FROM public."user" WHERE "mfaEnabled" OR "mfaSecret" IS NOT NULL
      ON CONFLICT ("userId") DO UPDATE SET "mfaSecret" = excluded."mfaSecret", "mfaEnabled" = excluded."mfaEnabled";
  END IF;
END $$;

-- upstream expects every stack member to belong to the stack owner, so members of other owners leave the stack
CREATE TABLE IF NOT EXISTS immich_tweaked_backup.stack_member (
  "stackId" uuid NOT NULL,
  "assetId" uuid PRIMARY KEY,
  "isPrimary" boolean NOT NULL
);
INSERT INTO immich_tweaked_backup.stack_member
  SELECT a."stackId", a.id, s."primaryAssetId" = a.id
  FROM public.asset a
  JOIN public.stack s ON s.id = a."stackId"
  WHERE s.id IN (SELECT a2."stackId" FROM public.asset a2 JOIN public.stack s2 ON s2.id = a2."stackId"
                 WHERE a2."ownerId" <> s2."ownerId")
  ON CONFLICT DO NOTHING;

UPDATE public.asset a SET "stackId" = NULL
  FROM public.stack s
  WHERE s.id = a."stackId" AND a."ownerId" <> s."ownerId";

UPDATE public.stack s SET "primaryAssetId" = (
    SELECT a.id FROM public.asset a WHERE a."stackId" = s.id ORDER BY a."fileCreatedAt", a.id LIMIT 1
  )
  WHERE NOT EXISTS (SELECT 1 FROM public.asset a WHERE a.id = s."primaryAssetId" AND a."stackId" = s.id)
    AND EXISTS (SELECT 1 FROM public.asset a WHERE a."stackId" = s.id);

DELETE FROM public.stack s
  WHERE (SELECT count(*) FROM public.asset a WHERE a."stackId" = s.id) < 2;

-- schema changes, newest first (mirrors the down() of each migration)
ALTER TABLE public."user" DROP COLUMN IF EXISTS "mfaEnabled";
ALTER TABLE public."user" DROP COLUMN IF EXISTS "mfaSecret";
ALTER TABLE public.album DROP COLUMN IF EXISTS "isLocked";
ALTER TABLE public.partner DROP COLUMN IF EXISTS "allowEdits";
DROP TABLE IF EXISTS public.asset_user_favorite;

DELETE FROM public.kysely_migrations WHERE name IN (
  '1792087511000-UserMfa',
  '1792085463673-AlbumIsLocked',
  '1792082133563-PartnerAllowEdits',
  '1792080525791-AssetUserFavorite'
);

\echo 'Backed up to schema immich_tweaked_backup:'
SELECT 'partner favorites' AS item, count(*) FROM immich_tweaked_backup.asset_user_favorite
UNION ALL SELECT 'partner edit permissions', count(*) FROM immich_tweaked_backup.partner_allow_edits
UNION ALL SELECT 'locked albums', count(*) FROM immich_tweaked_backup.locked_album
UNION ALL SELECT 'mfa users', count(*) FROM immich_tweaked_backup.user_mfa
UNION ALL SELECT 'cross-owner stack members', count(*) FROM immich_tweaked_backup.stack_member;

COMMIT;
