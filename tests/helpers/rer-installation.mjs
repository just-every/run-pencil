import { execFileSync, spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export async function installation() {
 const directory = await mkdtemp(join(tmpdir(), 'pencil-rer-journey-'));
 const root = join(directory, 'seed'); await mkdir(root);
 for (const path of execFileSync('git', ['ls-files', '-z'], { cwd: source }).toString().split('\0').filter(Boolean)) {
  await mkdir(dirname(join(root, path)), { recursive: true }); await copyFile(join(source, path), join(root, path));
 }
 await symlink(join(source, 'node_modules'), join(root, 'node_modules'), 'dir');
 const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
 const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
 const origin = `http://127.0.0.1:${port}`;
 const children = new Set();
 // This installation has its own root and lock. A public rer verify caller's
 // ownership applies to that caller's checkout, never to this separate copy.
 // The caller's queue or runner admitted this journey; as in Base's local
 // journeys, its own servers are not refused again by the machine-load guard.
 const fixtureEnv = { ...process.env, CI: 'true', RER_SERVER_JOURNEY: '1', WRANGLER_SEND_METRICS: 'false', RER_SERVERS_DIR: join(directory, 'server-registry'), RER_SERVERS_LOAD_THRESHOLD: '100000' };
 delete fixtureEnv.RER_LOCAL_OPERATION;
 delete fixtureEnv.RER_ONBOARDING_PROCESS_OWNER;
 // The queue's policy and membership belong to the verify caller's own checkout; this copy is its own caller and CI=true is its policy.
 delete fixtureEnv.RER_JOB_POLICY;
 delete fixtureEnv.RER_JOB_MEMBERSHIP;
 const start = args => {
  const child = spawn(process.execPath, ['node_modules/@runeditrun/rer/bin/rer.mjs', ...args, '--non-interactive', '--no-queue'], { cwd: root, env: fixtureEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child); let output = '';
  child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { output += bytes; });
  const done = new Promise(resolve => child.once('close', code => { children.delete(child); resolve({ code, output }); }));
  return { child, done, output: () => output };
 };
 const run = async args => {
  // Read-only and reset verbs intentionally have no --no-queue flag.
  if (['reset', 'check', 'describe', 'doctor'].includes(args[0])) {
   const child = spawn(process.execPath, ['node_modules/@runeditrun/rer/bin/rer.mjs', ...args, '--non-interactive'], { cwd: root, env: fixtureEnv, stdio: ['ignore', 'pipe', 'pipe'] });
   children.add(child); let output = ''; child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { output += bytes; });
   return await new Promise(resolve => child.once('close', code => { children.delete(child); resolve({ code, output }); }));
  }
  return await start(args).done;
 };
 const wait = async runtime => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
   if (runtime.child.exitCode !== null) {
    // Report only the CLI's fixed resource refusal, never captured app output,
    // private settings, cookies or sign-in links from this installation.
    const reason = runtime.output().split('\n').find(line =>
     line === 'Server startup requires 15 GiB free on checkout and temporary volumes. Recover owned space before retrying.');
    throw Error(`The rer runtime exited before readiness (exit ${runtime.child.exitCode})${reason ? ': ' + reason : '.'}`);
   }
   if (runtime.output().includes(`RER_READY ${origin}`)) return;
   await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('The rer runtime did not report health-gated readiness.');
 };
 const stop = async runtime => { if (runtime.child.exitCode === null) runtime.child.kill('SIGTERM'); return await runtime.done; };
 return { root, origin, port, start, run, wait, stop, async close() {
  for (const child of [...children]) child.kill('SIGTERM');
  await Promise.all([...children].map(child => new Promise(resolve => child.once('close', resolve))));
  await rm(directory, { recursive: true, force: true });
 } };
}
