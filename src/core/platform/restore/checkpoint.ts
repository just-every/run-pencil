import type { D1Sql } from '../../../base/import-kit/src/d1/index'

/** Advances the restore checkpoint inside an erasure batch, so a later archive's
 * `rer import --journal` refuses every archive made before this erasure. */
export const restoreCheckpoint: D1Sql = {
  sql: 'INSERT INTO restore_erasure_checkpoint(singleton,epoch) VALUES(1,1) ON CONFLICT(singleton) DO UPDATE SET epoch=epoch+1',
}
