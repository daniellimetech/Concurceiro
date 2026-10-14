import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newClock,startClock,pauseClock,elapsedMs,formatClock,saveMeasuredStudy,loadClock,clockKey} from '../src/studyClock.js';
const subject={id:'port',name:'Português'};
const base=()=>({subjects:[subject],sessions:[],exams:[],schedule:[]});
const at=new Date('2026-10-19T17:30:00-03:00');
test('stopwatch excludes paused intervals, resumes correctly, and formats seconds',()=>{
 let c=startClock(newClock('port'),1000);assert.equal(elapsedMs(c,41000),40000);
 c=pauseClock(c,41000);assert.equal(elapsedMs(c,91000),40000);
 c=startClock(c,91000);assert.equal(elapsedMs(c,111000),60000);assert.equal(formatClock(3661000),'01:01:01');
});
test('deadline-based countdown caps elapsed time after tab inactivity and cannot add study hours',()=>{
 const c=startClock({...newClock('port','timer',60)},1000);assert.equal(elapsedMs(c,301000),60000);
 assert.throws(()=>saveMeasuredStudy(base(),c,{questions:0,correct:0},at),/apenas um alerta/);
});
test('reload restores running anchors with account-scoped keys',()=>{
 const c=startClock(newClock('port'),1000);const loaded=loadClock({getItem:()=>JSON.stringify(c)},'key');assert.equal(elapsedMs(loaded,61000),60000);assert.notEqual(clockKey('a'),clockKey('b'));
});
test('saving measured time preserves actual seconds and is idempotent',()=>{
 const c={...newClock('port'),accumulatedMs:91500};const data=saveMeasuredStudy(base(),c,{questions:10,correct:8},at);
 assert.equal(data.sessions[0].durationSeconds,91);assert.equal(data.sessions[0].minutes,91/60);assert.equal(data.schedule.length,0);
 assert.equal(saveMeasuredStudy(data,c,{questions:10,correct:8},at),data);
 assert.throws(()=>saveMeasuredStudy(base(),newClock('port'),{questions:0,correct:0},at));
});
test('linked stopwatch concludes only on save, creates one successor, and preserves fractional duration',()=>{
 const data={...base(),schedule:[{id:'lesson',subject:'port',stage:'study',title:'Interpretação',date:'2026-10-19',time:'16:30',minutes:60}]};
 const c={...newClock('port'),sourceScheduleId:'lesson',accumulatedMs:61000};
 assert.equal(data.schedule.length,1);const result=saveMeasuredStudy(data,c,{questions:10,correct:7},at);
 assert.equal(result.schedule.length,2);assert.equal(result.schedule[1].stage,'review24');assert.equal(result.schedule[0].done,true);assert.equal(result.sessions[0].durationSeconds,61);assert.equal(result.sessions[0].minutes,61/60);
 assert.equal(saveMeasuredStudy(result,c,{questions:10,correct:7},at),result);
});
