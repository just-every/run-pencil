import { DatabaseSync } from 'node:sqlite';
import { constants, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { objectBytes } from './deployment-data-objects.mjs';
import { captureStore, storeDigest, storeSummary, validateStore } from './deployment-data-stream.mjs';
import { failure } from './deployment-data-errors.mjs';

// Standalone restoration has no deployment bucket. Keep an actual private
// object directory next to the new SQLite file, and re-read both for proof.
export function restoreObjectTest(store, output) {
  const directory = output + '.objects';
  mkdirSync(directory,{mode:0o700});
  let database, reexport, published = false;
  try {
    for (const object of store.objects()) {
      const path = join(directory,object.key);
      mkdirSync(dirname(path),{recursive:true,mode:0o700});
      const {data: _data,...metadata} = object;
      writeFileSync(path,objectBytes(object),{flag:'wx',mode:0o600});
      writeFileSync(path + '.json',JSON.stringify(metadata),{flag:'wx',mode:0o600});
    }
    database = new DatabaseSync(store.validated,{readOnly:true});
    reexport = captureStore(database,dirname(output));
    reexport.payload.objects = [];
    for (const original of store.objects()) {
      const path = join(directory,original.key), metadata = JSON.parse(readFileSync(path + '.json','utf8'));
      reexport.addObject({...metadata,data:readFileSync(path).toString('base64')});
    }
    reexport.sha256 = storeDigest(reexport); validateStore(reexport);
    if (reexport.sha256 !== store.sha256) throw failure('CONTENT_MISMATCH','Restored database and attachments did not re-export with the original checksum.');
    copyFileSync(store.validated,output,constants.COPYFILE_EXCL); published = true;
    return {...storeSummary(store),reexportSha256:reexport.sha256,attachmentDirectory:directory};
  } finally {
    reexport?.close(); database?.close();
    if (!published) rmSync(directory,{recursive:true});
  }
}
