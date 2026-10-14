import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('../supabase/migrations/202610140001_study_workspaces.sql',import.meta.url),'utf8');
const one='11111111-1111-4111-8111-111111111111',two='22222222-2222-4222-8222-222222222222';
const payload={subjects:[],sessions:[],exams:[],schedule:[]};
test('PostgreSQL migration: private rows, authenticated-only RPC, atomic writes and stale-version protection',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; insert into auth.users values ('${one}'),('${two}');`);
  await db.exec(migration);await db.exec(migration); // installation is repeatable
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${one}',false)`);
  const create=await db.query('select * from public.save_study_workspace($1,$2::jsonb,0)',[one,JSON.stringify(payload)]);assert.equal(Number(create.rows[0].revision),1);
  await assert.rejects(()=>db.query('select * from public.save_study_workspace($1,$2::jsonb,0)',[one,JSON.stringify(payload)]),{code:'40001'});
  const update=await db.query('select * from public.save_study_workspace($1,$2::jsonb,1)',[one,JSON.stringify({...payload,planVersion:1})]);assert.equal(Number(update.rows[0].revision),2);
  await assert.rejects(()=>db.query('select * from public.save_study_workspace($1,$2::jsonb,1)',[one,JSON.stringify(payload)]),{code:'40001'});
  await assert.rejects(()=>db.query('update public.study_workspaces set revision=9'),{code:'42501'});
  await assert.rejects(()=>db.query('select * from public.save_study_workspace($1,$2::jsonb,0)',[two,JSON.stringify(payload)]),{code:'42501'});
  await db.exec(`select set_config('request.jwt.claim.sub','${two}',false)`);
  assert.equal((await db.query('select * from public.study_workspaces')).rows.length,0,'user two cannot see user one');
  await db.query('select * from public.save_study_workspace($1,$2::jsonb,0)',[two,JSON.stringify(payload)]);
  const own=await db.query('select * from public.study_workspaces');assert.equal(own.rows.length,1);assert.equal(own.rows[0].user_id,two);
  await assert.rejects(()=>db.query('select * from public.save_study_workspace($1,$2::jsonb,1)',[two,JSON.stringify({subjects:[]})]),{code:'23514'});
  assert.equal(Number((await db.query('select revision from public.study_workspaces')).rows[0].revision),1,'failed write preserves the revision');
  await db.exec(`reset role; set role anon; select set_config('request.jwt.claim.sub','',false)`);
  await assert.rejects(()=>db.query('select * from public.study_workspaces'),{code:'42501'});
  await assert.rejects(()=>db.query('select * from public.save_study_workspace($1,$2::jsonb,0)',[one,JSON.stringify(payload)]),{code:'42501'});
 }finally{await db.close()}
});
