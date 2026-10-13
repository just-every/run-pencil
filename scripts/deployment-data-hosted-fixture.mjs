import assert from 'node:assert/strict';
import { application } from './deployment-data-hosted-test-helpers.mjs';

export async function hostedFixture(directory, db) {
  const app = await application(directory, db);
  const call = async (path, body, status=200, method) => {
    const response=await app.request(path,body,method), text=await response.text();
    assert.equal(response.status,status,`${path}: ${text}`);
    return text?JSON.parse(text):null;
  };
  await call('/auth/bootstrap',{token:app.bindings.SETUP_TOKEN,displayName:'Recovery Owner'},303);
  await call('/setup',{name:'Recovery',timeZone:'UTC'},303);
  const flow=await call('/api/app/flows',{title:'Preserved form',slug:'preserved-form',template:'feedback'},201);
  const draft=await call(`/api/app/flows/${flow.id}/draft`);
  await call(`/api/app/flows/${flow.id}/publish`,{expectedVersion:draft.flow.draftVersion},201);
  const contact=await call('/api/app/distribution/contacts',{name:'Invited person',email:'invitee@example.test',fields:{cohort:'original'}},201);
  const launch=await call(`/api/app/flows/${flow.id}/distribution`,{contactIds:[contact.id],commandKey:'recovery-invitation-command'},201);
  const input={definition:JSON.stringify({id:'recovery-typeform',title:'Historical answers',fields:[{id:'question',ref:'question',title:'Your feedback',type:'long_text'}]}),plannedAt:'2026-10-01T00:00:00.000Z',csv:'Response ID,Submitted At,Your feedback\nfirst,2026-01-01T12:00:00Z,Retained imported answer\nsecond,2026-01-02T12:00:00Z,Erased imported answer'};
  const review=await call('/api/app/imports/review',input);
  assert.equal(review.responseCount,2);
  let job=await call('/api/app/imports/commit',{...input,plannedAt:review.plannedAt,columns:review.columns,fingerprint:review.fingerprint,acknowledged:true});
  for(let i=0;i<15&&job.state!=='completed';i++)job=await call(`/api/app/imports/${job.id}/resume`,{});
  assert.equal(job.state,'completed');
  // A real development sign-in exercises private capture using the same schema.
  // It is a local test runtime only; deployed mail above used the network edge.
  const original={...app.bindings};
  Object.assign(app.bindings,{APP_ORIGIN:'http://127.0.0.1:8787',PENCIL_LOCAL_DEVELOPMENT:'true',MAIL_PROVIDER:'local'});
  await call('/auth/magic-link',{email:'owner@example.test'},202);
  Object.assign(app.bindings,original);
  assert.ok(db.prepare('SELECT count(*) n FROM rer_mail_development_outbox').get().n>0);
  const erased=db.prepare("SELECT r.id FROM responses r JOIN response_answers a ON a.response_id=r.id WHERE a.value_json LIKE '%Erased imported answer%'").get().id;
  return {app,call,flow,launch,job,input,erased};
}
