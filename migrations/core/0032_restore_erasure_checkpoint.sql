-- Pencil's restore checkpoint. Every erasure batch (a response, imported or not, and an Audience contact) advances
-- the epoch, and import-kit's retirement carries the same statement as its checkpoint. `rer import --journal LATER`
-- refuses, whole, an archive whose epoch is older than LATER's, so nothing erased after it was made comes back.
-- The row is created by the first erasure; an installation that never erased anything has epoch 0. Additive only.
CREATE TABLE restore_erasure_checkpoint (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  epoch INTEGER NOT NULL CHECK(epoch>0)
);
