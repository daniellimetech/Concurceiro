export const cacheKey = userId => `concurceiro-cloud-v1:${userId}`;
export function validateWorkspace(data) {
 if(!data||typeof data!=='object')throw Error('Dados de estudo inválidos.');
 for(const key of ['subjects','sessions','exams','schedule'])if(!Array.isArray(data[key]))throw Error('Backup de estudos inválido.');
 if(!data.subjects.every(s=>s&&typeof s.name==='string'&&(typeof s.id==='string'||typeof s.id==='number')))throw Error('Matérias inválidas.');
 if(![...data.sessions,...data.exams].every(s=>s&&Number.isFinite(Number(s.minutes??0))&&Number(s.minutes??0)>=0&&Number.isInteger(Number(s.questions))&&Number(s.questions)>=0&&Number.isInteger(Number(s.correct))&&Number(s.correct)>=0&&Number(s.correct)<=Number(s.questions)))throw Error('Resultados inválidos.');
 if(!data.schedule.every(s=>s&&typeof s.title==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s.date)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)&&Number(s.minutes)>0&&Number(s.minutes)<=1440))throw Error('Cronograma inválido.');
 return data;
}
export function readCache(storage,userId) {
 try{const cache=JSON.parse(storage.getItem(cacheKey(userId)));if(cache&&Number.isInteger(cache.revision)&&cache.revision>=0){validateWorkspace(cache.data);return cache}}catch{}
 return null;
}
export function downloadBackup(data,name='meus-estudos.json') {
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
// Local durability first; serialize cloud writes and use compare-and-swap revisions.
export class CloudWriter {
 constructor({userId,data,revision,storage,write,onStatus=()=>{},dirty=false}) {
  this.userId=userId;this.latest=data;this.revision=revision;this.storage=storage;this.write=write;this.onStatus=onStatus;
  this.pending=null;this.running=false;this.blocked=false;this.disposed=false;this.dirty=dirty;
 }
 persist(data,pending) {this.storage.setItem(cacheKey(this.userId),JSON.stringify({data,revision:this.revision,pending}))}
 save(data) {
  if(this.disposed)return false;
  if(!this.dirty&&this.revision>0&&JSON.stringify(data)===JSON.stringify(this.latest)){try{this.persist(data,false);return true}catch(error){this.onStatus({kind:'local-error',message:'Não foi possível guardar a cópia deste dispositivo.',error});return false}}
  try{validateWorkspace(data);this.persist(data,true)}catch(error){this.onStatus({kind:'local-error',message:'Não foi possível guardar as alterações neste dispositivo. Exporte um backup.',error});return false}
  this.latest=data;this.pending=data;this.dirty=true;
  if(!this.blocked&&!this.disposed)void this.flush();
  return true;
 }
 async flush() {
  if(this.running||this.blocked||this.disposed)return;
  this.running=true;
  try {
   while(this.pending&&!this.disposed) {
    const snapshot=this.pending;this.pending=null;this.onStatus({kind:'saving'});
    try {
     const result=await this.write(this.userId,snapshot,this.revision);
     if(!Number.isInteger(result.revision)||result.revision<=this.revision)throw Error('Resposta de sincronização inválida.');
     this.revision=result.revision;
     this.dirty=Boolean(this.pending);
     // A later local edit may have arrived while this request was in flight.
     this.persist(this.latest,this.dirty);
     if(!this.dirty)this.onStatus({kind:'saved',updatedAt:result.updated_at});
    } catch(error) {
     this.pending=this.pending||snapshot;this.dirty=true;
     this.blocked=error.code==='40001';
     this.onStatus({kind:this.blocked?'conflict':'error',message:this.blocked?'Há mudanças no banco feitas por outra aba ou dispositivo. Sua cópia local foi preservada.':'Não foi possível salvar no banco. As alterações estão guardadas neste dispositivo.',error});
     break;
    }
   }
  } finally {this.running=false}
 }
 retry(){if(!this.blocked&&!this.disposed)void this.flush()}
 dispose(){this.disposed=true}
}
