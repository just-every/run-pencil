import { failure } from './deployment-data-errors.mjs';
// `rer import --journal LATER`: LATER is a later archive of the same installation. Every erasure advances
// restore_erasure_checkpoint and import-kit's append-only journal in its own batch, so an input archive whose
// epoch is older than LATER's was made before an erasure and is refused whole: nothing erased comes back.
function rows(store, name) {
  const index = store.payload.tables.findIndex(table => table.name === name);
  if (index < 0) throw failure('LATER_JOURNAL', 'The archive has no erasure checkpoint.');
  const { columns } = store.payload.tables[index];
  return [...store.rows(index)].map(row => Object.fromEntries(columns.map((column, i) => [column, row[i]?.value ?? null])));
}
function erasureState(store) {
  const [checkpoint] = rows(store, 'restore_erasure_checkpoint'), [owner] = rows(store, 'oa_bootstrap');
  return { epoch: Number(checkpoint?.epoch ?? 0), owner: owner?.claim_id ?? null, journal: new Set(rows(store, 'ik_d1_erasure_journal').map(row => row.id)) };
}
export function erasureFence(store, later) {
  const older = erasureState(store), newer = erasureState(later);
  const sameInstallation = !older.owner || older.owner === newer.owner;
  if (!sameInstallation || newer.epoch < older.epoch || [...older.journal].some(id => !newer.journal.has(id))) throw failure('LATER_JOURNAL', 'The journal archive is not a later archive of this installation.');
  if (newer.epoch > older.epoch) throw failure('ERASURE_EPOCH', 'The archive was made before a later erasure; restoring it would bring erased data back.');
  return { erasureEpoch: newer.epoch };
}
