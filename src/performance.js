import {localNow,addDays} from './scheduler.js';
export function performanceData(data,{subject='all',days=0,today=localNow().date}={}) {
 const start=Number(days)?addDays(today,1-Number(days)):null;
 const matches=r=>(subject==='all'||String(r.subject)===String(subject))&&r.date<=today&&(!start||r.date>=start);
 const sessions=data.sessions.filter(matches),exams=data.exams.filter(matches);
 const records=[...sessions.map(r=>({...r,kind:'study'})),...exams.map(r=>({...r,kind:'exam'}))].sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
 const questions=records.reduce((n,r)=>n+Number(r.questions),0),correct=records.reduce((n,r)=>n+Number(r.correct),0);
 const seconds=sessions.reduce((n,r)=>n+(r.durationSeconds!==undefined?Number(r.durationSeconds):Number(r.minutes)*60),0);
 const groups=new Map();for(const r of records){if(!Number(r.questions))continue;const day=groups.get(r.date)||{date:r.date,questions:0,correct:0};day.questions+=Number(r.questions);day.correct+=Number(r.correct);groups.set(r.date,day)}
 return {sessions,exams,records,questions,correct,errors:questions-correct,rate:questions?correct/questions*100:null,seconds,trend:[...groups.values()].map(d=>({...d,rate:d.correct/d.questions*100}))};
}
export function evaluation(stats,goal=80){if(!stats.questions)return {label:'Sem questões',tone:'neutral',text:'Registre questões e acertos para avaliar esta matéria.'};if(stats.questions<20)return {label:'Amostra inicial',tone:'neutral',text:'Você ainda tem menos de 20 questões neste recorte. Amplie a prática antes de tirar conclusões.'};if(stats.rate>=goal)return {label:'Meta atingida',tone:'good',text:'Seu percentual está na meta de estudo. Mantenha as revisões e pratique conteúdos variados.'};return {label:'Precisa de atenção',tone:'attention',text:'Seu percentual está abaixo da meta de estudo. Revise os erros e pratique os pontos de maior dificuldade.'}}
