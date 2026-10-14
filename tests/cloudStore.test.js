import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CloudWriter,readCache,cacheKey,validateWorkspace} from '../src/cloudStore.js';
const data=(n=0)=>({subjects:[],sessions:[],exams:[],schedule:[],value:n});
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}}
const turn=()=>new Promise(r=>setTimeout(r,0));
test('cloud writes are serialized, retain latest edits, and use the newly confirmed revision',async()=>{
 const store=storage(),calls=[],resolvers=[],statuses=[];
 const writer=new CloudWriter({userId:'one',data:data(),revision:2,storage:store,write:(id,value,revision)=>{calls.push({id,value,revision});return new Promise(r=>resolvers.push(r))},onStatus:s=>statuses.push(s.kind)});
 assert.equal(writer.save(data(1)),true);writer.save(data(2));writer.save(data(3));assert.equal(calls.length,1);
 assert.equal(readCache(store,'one').pending,true);assert.equal(readCache(store,'two'),null);
 resolvers.shift()({revision:3});await turn();assert.equal(calls.length,2);assert.equal(calls[1].value.value,3);assert.equal(calls[1].revision,3);
 resolvers.shift()({revision:4});await turn();assert.equal(readCache(store,'one').data.value,3);assert.equal(readCache(store,'one').pending,false);assert.equal(readCache(store,'one').revision,4);assert.equal(statuses.at(-1),'saved');
});
test('offline edits remain pending and retry uses the same data without claiming success',async()=>{
 const store=storage(),statuses=[];let fail=true;
 const writer=new CloudWriter({userId:'one',data:data(),revision:1,storage:store,onStatus:s=>statuses.push(s.kind),write:async()=>{if(fail)throw Error('offline');return {revision:2}}});
 writer.save(data(9));await turn();assert.equal(statuses.at(-1),'error');assert.equal(readCache(store,'one').pending,true);
 fail=false;writer.retry();await turn();assert.equal(statuses.at(-1),'saved');assert.equal(readCache(store,'one').pending,false);
});
test('conflicts never retry blindly or overwrite the newer cloud state',async()=>{
 let calls=0;const store=storage(),statuses=[];
 const writer=new CloudWriter({userId:'one',data:data(),revision:1,storage:store,onStatus:s=>statuses.push(s.kind),write:async()=>{calls++;throw Object.assign(Error('stale'),{code:'40001'})}});
 writer.save(data(1));await turn();writer.save(data(2));writer.retry();await turn();assert.equal(calls,1);assert.equal(statuses.at(-1),'conflict');assert.equal(readCache(store,'one').data.value,2);
});
test('local storage failure rejects a change; disposal prevents future requests',async()=>{
 let calls=0;const writer=new CloudWriter({userId:'one',data:data(),revision:0,storage:{setItem(){throw Error('quota')}},write:async()=>{calls++;return {revision:1}}});
 assert.equal(writer.save(data(1)),false);assert.equal(calls,0);
 const good=new CloudWriter({userId:'two',data:data(),revision:0,storage:storage(),write:async()=>{calls++;return {revision:1}}});good.dispose();good.save(data(2));await turn();assert.equal(calls,0);
});
test('invalid caches and broken backups are rejected without trusting another user cache',()=>{
 assert.throws(()=>validateWorkspace({subjects:[]}));assert.throws(()=>validateWorkspace({...data(),sessions:[{questions:10,correct:20}]}));
 const store=storage();store.setItem(cacheKey('one'),'not JSON');assert.equal(readCache(store,'one'),null);
});
test('opening an unchanged cloud workspace causes no writes, but pending cache still resumes',async()=>{
 let calls=0;const store=storage();
 const setup=dirty=>new CloudWriter({userId:'one',data:data(1),revision:4,storage:store,dirty,write:async()=>{calls++;return {revision:5}}});
 const clean=setup(false);assert.equal(clean.save(data(1)),true);await turn();assert.equal(calls,0);assert.equal(readCache(store,'one').pending,false);
 const pending=setup(true);pending.save(data(1));await turn();assert.equal(calls,1);assert.equal(readCache(store,'one').revision,5);
});
