import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localNow,addDays,reviewWindow,findReviewSlot,nextReview,completeEntry,generatePlan,isOverdue,toMinutes,DEFAULT_ROUTINE} from '../src/scheduler.js';
const subjects=JSON.parse(readFileSync(new URL('../src/contest.json',import.meta.url),'utf8'));
const base=()=>({subjects,sessions:[],exams:[],schedule:[],routine:DEFAULT_ROUTINE});
const lesson={id:'lesson',subject:subjects[0].id,title:'Português — aula 1',date:'2026-10-19',time:'16:30',minutes:60,stage:'study',done:false};
const actual=(date='2026-10-19',time='17:30')=>`${date}T${time}:00-03:00`;
const outcome=(at)=>({completedAt:at,minutes:60,questions:10,correct:8,topic:'Interpretação — aula 1'});
const now=new Date('2027-03-01T20:00:00-03:00');
test('Brazil dates, month boundaries, and windows are independent of host timezone',()=>{
 assert.deepEqual(localNow(new Date('2026-10-20T01:30:00Z')),{date:'2026-10-19',time:'22:30'});
 assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(reviewWindow('2026-10-19')[0],1110);assert.equal(reviewWindow('2026-10-20')[0],1050);assert.equal(reviewWindow('2026-10-24'),null);
});
test('creation of new lessons creates no review; seven hourly subjects per week, all within routine',()=>{
 const result=generatePlan(base(),'2026-10-19',4,subjects);assert.equal(result.added,28);
 assert.equal(result.data.schedule.filter(s=>s.stage!=='study').length,0);
 const days=Map.groupBy(result.data.schedule,s=>s.date);
 for(const [date,items] of days){const day=new Date(date+'T12:00Z').getUTCDay();assert.equal(items.length,[1,3].includes(day)?2:1);assert.ok(items.every(s=>s.minutes===60&&['16:30','17:30'].includes(s.time)));assert.equal(new Set(items.map(s=>s.subject)).size,items.length)}
 const counts=Object.fromEntries(subjects.map(s=>[s.name,result.data.schedule.filter(e=>e.subject===s.id).length]));
 assert.ok(Object.values(counts).every(n=>n>0),'every subject gets time in four weeks');assert.ok(counts['Língua Portuguesa']>counts['Língua Inglesa (Leitura Técnica)']);
 assert.equal(generatePlan(result.data,'2026-10-19',4,subjects).added,0);
});
test('completion creates just one next review and one performance entry, repeats are idempotent',()=>{
 const data={...base(),schedule:[lesson]};const done=completeEntry(data,'lesson',outcome(actual()),now);
 assert.equal(done.schedule.length,2);assert.equal(done.sessions.length,1);assert.equal(done.sessions[0].correct,8);
 const next=done.schedule[1];assert.equal(next.stage,'review24');assert.equal(next.date,'2026-10-20');assert.equal(next.time,'17:30');assert.equal(next.minutes,15);assert.equal(next.topic,'Interpretação — aula 1');
 assert.equal(completeEntry(done,'lesson',outcome(actual()),now),done);
});
test('late 24h completion anchors seven days to actual day, then 30 days anchors to next actual completion',()=>{
 let data=completeEntry({...base(),schedule:[lesson]},'lesson',outcome(actual()),now);
 const r24=data.schedule[1];
 // Due Oct 20, actually done four days later, Oct 24 (Saturday).
 data=completeEntry(data,r24.id,outcome(actual('2026-10-24','18:00')),now);
 const r7=data.schedule[2];assert.equal(r7.stage,'review7');assert.equal(r7.dueDate,'2026-10-31');assert.equal(r7.date,'2026-11-02');assert.equal(r7.minutes,25);
 data=completeEntry(data,r7.id,outcome(actual('2026-11-04','19:00')),now);
 const r30=data.schedule[3];assert.equal(r30.stage,'review30');assert.equal(r30.dueDate,'2026-12-04');
 data=completeEntry(data,r30.id,outcome(actual('2026-12-04','18:00')),now);assert.equal(data.schedule.length,4);assert.equal(data.sessions.length,4);
});
test('weekend target transfers to Monday and retains target; optional weekend stays',()=>{
 const friday={...lesson,date:'2026-10-23'};const review=nextReview(friday,new Date(actual('2026-10-23')),[]);
 assert.equal(review.dueDate,'2026-10-24');assert.equal(review.date,'2026-10-26');assert.equal(review.time,'18:30');assert.equal(review.shifted,true);
 const kept=nextReview(friday,new Date(actual('2026-10-23')),[],{...DEFAULT_ROUTINE,weekends:true});assert.equal(kept.date,'2026-10-24');assert.equal(kept.time,'17:30');
});
test('review capacity: gaps used, no overlap, no spill past the daily hour',()=>{
 const entries=[{date:'2026-10-20',time:'17:30',minutes:25},{date:'2026-10-20',time:'18:10',minutes:20}];
 assert.equal(findReviewSlot('2026-10-20',15,entries).time,'17:55');
 const shifted=findReviewSlot('2026-10-20',25,entries);assert.equal(shifted.date,'2026-10-21');assert.equal(shifted.time,'18:30');
 const result=generatePlan(base(),'2026-10-19',1,subjects);let data=result.data;
 for(const l of result.data.schedule)data=completeEntry(data,l.id,outcome(actual('2026-10-19','19:30')),now);
 const reviews=data.schedule.filter(s=>s.stage==='review24');
 for(const r of reviews){const w=reviewWindow(r.date);assert.ok(toMinutes(r.time)>=w[0]&&toMinutes(r.time)+r.minutes<=w[1]);assert.equal(reviews.filter(x=>x.date===r.date&&toMinutes(x.time)<toMinutes(r.time)+r.minutes&&toMinutes(x.time)+x.minutes>toMinutes(r.time)).length,1)}
});
test('overdue uses the end of scheduled session; completed tasks are never late',()=>{
 assert.equal(isOverdue(lesson,new Date(actual('2026-10-19','17:00'))),false);
 assert.equal(isOverdue(lesson,new Date(actual('2026-10-19','17:31'))),true);
 assert.equal(isOverdue({...lesson,done:true},now),false);
});
test('invalid performance, future completions, and invalid chain ordering cannot change data',()=>{
 const data={...base(),schedule:[lesson]};assert.throws(()=>completeEntry(data,'lesson',{...outcome(actual()),correct:11},now));
 assert.throws(()=>completeEntry(data,'lesson',outcome(actual('2028-01-01')),now));assert.equal(data.schedule.length,1);
 const done=completeEntry(data,'lesson',outcome(actual()),now),review=done.schedule[1];
 assert.throws(()=>completeEntry(done,review.id,outcome(actual('2026-10-18')),now));
 assert.throws(()=>completeEntry(done,review.id,{...outcome(actual('2026-10-20')),questions:9},now));
});
test('manual events reserve space; unrelated subjects and historical data remain intact',()=>{
 const data={...base(),schedule:[{...lesson,id:'manual',stage:'manual',minutes:60}],sessions:[{id:'old'}]};
 const generated=generatePlan(data,'2026-10-19',1,subjects);assert.equal(generated.added,6);assert.equal(generated.conflicts,1);assert.deepEqual(generated.data.sessions,[{id:'old'}]);assert.equal(generated.data.schedule[0].id,'manual');
 const done=completeEntry(data,'manual',outcome(actual()),now);assert.equal(done.schedule.length,1);
});
test('adding a missing slot keeps the two daily subjects distinct',()=>{
 const first=generatePlan(base(),'2026-10-19',1,subjects).data;
 const monday=first.schedule.filter(s=>s.date==='2026-10-19');
 const partial={...first,schedule:first.schedule.filter(s=>s.id!==monday[1].id)};
 const filled=generatePlan(partial,'2026-10-19',1,subjects).data.schedule.filter(s=>s.date==='2026-10-19');
 assert.equal(filled.length,2);assert.equal(new Set(filled.map(s=>s.subject)).size,2);
});
