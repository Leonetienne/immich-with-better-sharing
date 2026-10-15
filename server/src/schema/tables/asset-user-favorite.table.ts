import { CreateDateColumn, ForeignKeyColumn, type Generated, Table, Timestamp } from '@immich/sql-tools';
import { AssetTable } from 'src/schema/tables/asset.table.js';
import { UserTable } from 'src/schema/tables/user.table.js';

// Favorites on assets owned by someone else. The owner's own favorite lives in asset.isFavorite.
@Table('asset_user_favorite')
export class AssetUserFavoriteTable {
  @ForeignKeyColumn(() => UserTable, { onUpdate: 'CASCADE', onDelete: 'CASCADE', primary: true })
  userId!: string;

  @ForeignKeyColumn(() => AssetTable, { onUpdate: 'CASCADE', onDelete: 'CASCADE', primary: true, index: true })
  assetId!: string;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;
}
