export const originColumns = ['job_id','stream_id','ordinal','page_total','job_operation_key',
  'parent_destination','parent_namespace','parent_mapping_version','parent_principal_id',
  'parent_fingerprint','parent_operation_key','parent_total','parent_layout_hash'];

export async function readStreamOrigins(database, streamId) {
  return (await database.prepare(`SELECT ${originColumns.join(',')} FROM ik_d1_stream_origins WHERE stream_id=? ORDER BY ordinal,job_id`).bind(streamId).all()).results;
}

// Derive expectations independently from real parent/page/job membership. Never
// classify an ordinary job by its ID, operation-key format or policy binding.
export async function expectedStreamOrigins(database, streamId) {
  return (await database.prepare(`SELECT p.job_id,p.stream_id,p.ordinal,p.total AS page_total,j.operation_key AS job_operation_key,
    s.destination AS parent_destination,s.namespace AS parent_namespace,s.mapping_version AS parent_mapping_version,
    s.principal_id AS parent_principal_id,s.fingerprint AS parent_fingerprint,s.operation_key AS parent_operation_key,
    s.total AS parent_total,s.layout_hash AS parent_layout_hash
    FROM ik_d1_stream_pages p JOIN ik_d1_streams s ON s.id=p.stream_id JOIN ik_jobs j ON j.id=p.job_id
    WHERE p.stream_id=? ORDER BY p.ordinal,p.job_id`).bind(streamId).all()).results;
}
