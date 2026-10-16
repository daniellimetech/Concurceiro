// All schedule dates use the student's time zone, independently of the server.
export const TIME_ZONE = 'America/Sao_Paulo';
export const DEFAULT_ROUTINE = {weekends: false, shortReview: 15, longReview: 25};
export const STAGES = ['study', 'review24', 'review7', 'review30'];
export const STAGE_NAMES = {study: 'Estudo novo', review24: 'Revisão de 24h', review7: 'Revisão de 7 dias', review30: 'Revisão de 30 dias'};
export const uid = () => globalThis.crypto.randomUUID();
export function localNow(now = new Date()) {
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: TIME_ZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 return {date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`};
}
export function addDays(date, count) {const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10)}
export function weekday(date) {return new Date(date+'T12:00:00Z').getUTCDay()}
export function toMinutes(time) {const [h,m]=time.split(':').map(Number);return h*60+m}
export function toTime(minutes) {return `${Math.floor(minutes/60)}`.padStart(2,'0')+':'+`${minutes%60}`.padStart(2,'0')}
export function timestamp(date,time) {return new Date(`${date}T${time}:00-03:00`).getTime()}
export function reviewWindow(date, config=DEFAULT_ROUTINE) {
 const day=weekday(date);
 if(day===0||day===6) return config.weekends ? [1050,1110] : null;
 return day===1||day===3 ? [1110,1170] : [1050,1110];
}
export function isOverdue(entry, now = Date.now()) {return !entry.done && timestamp(entry.date,entry.time)+Number(entry.minutes)*60000 < Number(now)}
export function priority(subject, officialSubjects=[]) {
 const official=officialSubjects.find(s=>s.name===subject.name);
 return Number(subject.priority)||Number(official?.questions ?? subject.questions ?? 1)*Number(official?.weight ?? subject.weight ?? 1);
}
// Earliest free gap in the daily review hour; never silently overbook it.
export function findReviewSlot(targetDate, duration, schedule, config=DEFAULT_ROUTINE) {
 if(!Number.isInteger(duration)||duration<1||duration>60)throw Error('A duração de uma revisão deve estar entre 1 e 60 minutos.');
 for(let offset=0;offset<3660;offset++) {
  const date=addDays(targetDate,offset), window=reviewWindow(date,config);
  if(!window)continue;
  const busy=schedule.filter(s=>s.date===date).map(s=>[toMinutes(s.time),toMinutes(s.time)+Number(s.minutes)]).sort((a,b)=>a[0]-b[0]);
  let start=window[0];
  for(const [a,b] of busy) {if(b<=start)continue;if(a>=start+duration)break;start=Math.max(start,b)}
  if(start+duration<=window[1])return {date,time:toTime(start),shifted:date!==targetDate};
 }
 throw Error('Não foi possível encontrar um horário livre para a revisão.');
}
export function nextReview(entry, completedAt, schedule, config=DEFAULT_ROUTINE, makeId=uid) {
 const index=STAGES.indexOf(entry.stage);
 if(index<0||index===3)return null;
 const stage=STAGES[index+1], days=[1,7,30][index];
 const dueDate=addDays(localNow(new Date(completedAt)).date,days);
 const minutes=Number(stage==='review24'?config.shortReview:config.longReview);
 const slot=findReviewSlot(dueDate,minutes,schedule,config);
 return {id:makeId(),subject:entry.subject,title:entry.topic||entry.title,topic:entry.topic||entry.title,stage,minutes,questions:10,parentId:entry.id,chainId:entry.chainId||entry.id,dueDate,...slot,done:false};
}
// One state transition persists completion, performance, and its single successor.
export function completeEntry(data,id,result,now=new Date(),makeId=uid) {
 const entry=data.schedule.find(s=>s.id===id);
 if(!entry)throw Error('Este agendamento não existe mais.');
 if(entry.done)return data;
 const completedAt=new Date(result.completedAt);
 if(!Number.isFinite(completedAt.getTime())||completedAt.getTime()>now.getTime())throw Error('Informe uma conclusão válida, que não esteja no futuro.');
 const parent=data.schedule.find(s=>s.id===entry.parentId);
 if(parent?.completedAt&&completedAt<new Date(parent.completedAt))throw Error('A conclusão não pode ser anterior à etapa precedente.');
 const minutes=Number(result.minutes),questions=Number(result.questions),correct=Number(result.correct);
 if(!Number.isInteger(minutes)||minutes<1||minutes>1440||!Number.isInteger(questions)||questions<0||!Number.isInteger(correct)||correct<0||correct>questions)throw Error('Confira a duração, as questões e os acertos.');
 const done={...entry,done:true,completedAt:completedAt.toISOString(),topic:result.topic?.trim()||entry.topic||entry.title};
 const schedule=data.schedule.map(s=>s.id===id?done:s);
 const next=schedule.some(s=>s.parentId===id)?null:nextReview(done,completedAt,schedule,{...DEFAULT_ROUTINE,...data.routine},makeId);
 if(next)schedule.push(next);
 const sessions=data.sessions.some(s=>s.sourceScheduleId===id)?data.sessions:[...data.sessions,{id:makeId(),sourceScheduleId:id,subject:entry.subject,date:localNow(completedAt).date,minutes,questions,correct,notes:`${STAGE_NAMES[entry.stage]||'Estudo'} · ${done.topic}`}];
 return {...data,schedule,sessions};
}
// Largest deficit against the weighted share, keeping a rotation through all subjects.
// Existing planned lessons count, so adding weeks continues rather than restarts the cycle.
export function generatePlan(data,startDate,weeks,officialSubjects=[],makeId=uid) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!Number.isFinite(new Date(startDate+'T12:00:00Z').getTime())||weeks<1||weeks>12)throw Error('Escolha uma data válida e de 1 a 12 semanas.');
 if(!data.subjects.length)throw Error('Cadastre as matérias antes de gerar o cronograma.');
 const subjects=data.subjects.filter(s=>officialSubjects.some(o=>o.name===s.name));
 if(!subjects.length)throw Error('Adicione as matérias do edital na aba Meu edital antes de gerar o cronograma.');
 const weights=new Map(subjects.map(s=>[String(s.id),priority(s,officialSubjects)]));
 const sum=[...weights.values()].reduce((a,b)=>a+b,0);
 const counts=new Map(subjects.map(s=>[String(s.id),data.schedule.filter(e=>e.stage==='study'&&String(e.subject)===String(s.id)).length]));
 let count=[...counts.values()].reduce((a,b)=>a+b,0), added=0, conflicts=0;
 const schedule=[...data.schedule];
 for(let offset=0;offset<weeks*7;offset++) {
  const date=addDays(startDate,offset),day=weekday(date);
  if(day===0||day===6)continue;
  const chosen=new Set(schedule.filter(s=>s.date===date&&s.stage==='study').map(s=>String(s.subject)));
  for(const time of day===1||day===3?['16:30','17:30']:['16:30']) {
   const minute=toMinutes(time);
   if(schedule.some(s=>s.date===date&&toMinutes(s.time)<minute+60&&toMinutes(s.time)+Number(s.minutes)>minute)){conflicts++;continue}
   const ranked=subjects.filter(s=>!chosen.has(String(s.id))).sort((a,b)=>{
    const score=s=>(count+1)*weights.get(String(s.id))/sum-counts.get(String(s.id));
    return score(b)-score(a)||weights.get(String(b.id))-weights.get(String(a.id))||String(a.id).localeCompare(String(b.id));
   });
   const s=ranked[0]||subjects[0], id=makeId();
   schedule.push({id,chainId:id,title:`Estudo · ${s.name}`,subject:s.id,date,time,minutes:60,stage:'study',generated:true,done:false});
   chosen.add(String(s.id));counts.set(String(s.id),counts.get(String(s.id))+1);count++;added++;
  }
 }
 return {data:{...data,schedule},added,conflicts};
}
