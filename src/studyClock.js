import {completeEntry,localNow,uid} from './scheduler.js';
export const MAX_CLOCK_MS=86400000;
export const clockKey=userId=>`concurceiro-clock-v1:${userId||'local'}`;
export function newClock(subject='',mode='stopwatch',durationSeconds=2100){return {id:uid(),mode,durationSeconds,accumulatedMs:0,runningSince:null,subject,topic:'',sourceScheduleId:null}}
export function elapsedMs(clock,now=Date.now()) {const limit=clock.mode==='timer'?clock.durationSeconds*1000:MAX_CLOCK_MS;return Math.min(limit,Math.max(0,clock.accumulatedMs+(clock.runningSince===null?0:Math.max(0,now-clock.runningSince))))}
export function pauseClock(clock,now=Date.now()){return {...clock,accumulatedMs:elapsedMs(clock,now),runningSince:null}}
export function startClock(clock,now=Date.now()){if(clock.runningSince!==null)return clock;return {...clock,runningSince:now}}
export function formatClock(ms){const seconds=Math.floor(ms/1000);return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':')}
export function loadClock(storage,key,subject='') {try{const c=JSON.parse(storage.getItem(key));if(c&&typeof c.id==='string'&&['timer','stopwatch'].includes(c.mode)&&Number.isFinite(c.accumulatedMs)&&c.accumulatedMs>=0&&(c.runningSince===null||Number.isFinite(c.runningSince))&&Number.isFinite(c.durationSeconds)&&c.durationSeconds>=60&&c.durationSeconds<=10800)return c}catch{}return newClock(subject)}
export function saveMeasuredStudy(data,clock,result,now=new Date()) {
 if(clock.mode!=='stopwatch')throw Error('O timer é apenas um alerta. Use o cronômetro para registrar tempo estudado.');
 if(data.sessions.some(s=>s.timerId===clock.id))return data;
 const seconds=Math.floor(elapsedMs(clock,now.getTime())/1000);
 if(seconds<1)throw Error('Estude por pelo menos um segundo antes de salvar.');
 const questions=Number(result.questions),correct=Number(result.correct);
 if(!Number.isInteger(questions)||questions<0||!Number.isInteger(correct)||correct<0||correct>questions)throw Error('Confira o total de questões e os acertos.');
 if(!data.subjects.some(s=>String(s.id)===String(clock.subject)))throw Error('Selecione uma matéria válida.');
 const topic=result.topic?.trim()||clock.topic||'Sessão cronometrada';
 if(clock.sourceScheduleId){
  const entry=data.schedule.find(s=>s.id===clock.sourceScheduleId);
  if(!entry||entry.done)throw Error('Esse agendamento já foi concluído ou excluído. Desvincule-o para salvar como estudo avulso.');
  const updated=completeEntry(data,entry.id,{minutes:Math.ceil(seconds/60),questions,correct,topic,completedAt:now.toISOString()},now);
  return {...updated,sessions:updated.sessions.map(s=>s.sourceScheduleId===entry.id?{...s,minutes:seconds/60,durationSeconds:seconds,timerId:clock.id}:s)};
 }
 return {...data,sessions:[...data.sessions,{id:uid(),timerId:clock.id,subject:clock.subject,date:localNow(now).date,minutes:seconds/60,durationSeconds:seconds,questions,correct,notes:topic}]};
}
