import React,{useEffect,useRef,useState} from 'react';
import {Cloud,CloudOff,Check,RefreshCw,Download,LogOut,GraduationCap,ShieldCheck,ArrowRight,AlertTriangle} from 'lucide-react';
import {cloudConfigured,configurationError,supabase,loadWorkspace,writeWorkspace} from './supabase.js';
import {CloudWriter,cacheKey,readCache,validateWorkspace,downloadBackup} from './cloudStore.js';

function authMessage(error) {
 const message=error?.message||'';
 if(/invalid login credentials/i.test(message))return 'E-mail ou senha incorretos.';
 if(/email not confirmed/i.test(message))return 'Confirme seu e-mail antes de entrar.';
 if(/already registered/i.test(message))return 'Este e-mail já está cadastrado. Entre ou recupere a senha.';
 if(/rate limit|too many/i.test(message))return 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.';
 if(/fetch|network/i.test(message))return 'Não foi possível conectar. Confira sua conexão e tente novamente.';
 return 'Não foi possível concluir. Confira os dados e tente novamente. Se persistir, verifique a configuração de autenticação do projeto.';
}
function AccountFrame({children}) {return <div className="account-page"><a className="brand" href="#" onClick={e=>e.preventDefault()}><span><GraduationCap size={26}/></span>concurceiro<b>•</b></a><section className="account-card">{children}</section><p className="account-footer"><ShieldCheck size={15}/> Seu espaço de estudos, só seu.</p></div>}
function AuthForm({recovery,onRecovered}) {
 const [mode,setMode]=useState(recovery?'recovery':'login'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(e) {
  e.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');const fields=Object.fromEntries(new FormData(e.target));
  try {
   const redirect=window.location.origin+window.location.pathname;
   let result;
   if(mode==='recovery'){result=await supabase.auth.updateUser({password:fields.password});if(result.error)throw result.error;onRecovered();return}
   if(mode==='reset'){result=await supabase.auth.resetPasswordForEmail(fields.email,{redirectTo:redirect});if(result.error)throw result.error;setMessage('Se houver uma conta para este e-mail, você receberá um link para redefinir a senha.');return}
   if(mode==='register'){result=await supabase.auth.signUp({email:fields.email,password:fields.password,options:{emailRedirectTo:redirect}});if(result.error)throw result.error;if(!result.data.session)setMessage('Cadastro solicitado. Confira seu e-mail e confirme a conta para entrar.');return}
   result=await supabase.auth.signInWithPassword({email:fields.email,password:fields.password});if(result.error)throw result.error;
  }catch(err){setError(authMessage(err))}finally{setBusy(false)}
 }
 function switchMode(next){setMode(next);setError('');setMessage('')}
 return <AccountFrame><span className="eyebrow">SUA JORNADA CONTINUA AQUI</span><h1>{mode==='recovery'?'Escolha uma nova senha':mode==='reset'?'Recuperar acesso':mode==='register'?'Seu próximo passo começa aqui.':'Bom ter você de volta.'}</h1><p>Entre na sua conta para guardar suas matérias, estudos e revisões e continuar em outro dispositivo.</p>{!['recovery','reset'].includes(mode)&&<div className="auth-tabs"><button onClick={()=>switchMode('login')} className={mode==='login'?'selected':''}>Entrar</button><button onClick={()=>switchMode('register')} className={mode==='register'?'selected':''}>Criar conta</button></div>}<form onSubmit={submit}>{mode!=='recovery'&&<label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="voce@exemplo.com"/></label>}{mode!=='reset'&&<label>Senha<input name="password" type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='login'?1:8} maxLength={128} required placeholder={mode==='login'?'Sua senha':'Pelo menos 8 caracteres'}/></label>}{error&&<p className="account-error" role="alert">{error}</p>}{message&&<p className="account-message" role="status">{message}</p>}<button className="primary submit" disabled={busy}>{busy?<><RefreshCw size={16}/>Aguarde…</>:<>{mode==='register'?'Criar minha conta':mode==='reset'?'Enviar link':mode==='recovery'?'Salvar nova senha':'Entrar'}<ArrowRight size={16}/></>}</button></form>{mode==='login'&&<button className="text-btn recovery-link" onClick={()=>switchMode('reset')}>Esqueci minha senha</button>}{mode==='reset'&&<button className="text-btn recovery-link" onClick={()=>switchMode('login')}>Voltar para entrar</button>}<p className="auth-note">Use uma senha exclusiva. A confirmação e a recuperação de acesso são enviadas por e-mail.</p></AccountFrame>
}
export default function AccountRoot({App}) {
 const [user,setUser]=useState(null),[loading,setLoading]=useState(Boolean(supabase)),[authError,setAuthError]=useState(''),[recovery,setRecovery]=useState(false);
 useEffect(()=>{
  if(!supabase)return;let active=true;
  supabase.auth.getSession().then(({data,error})=>{if(!active)return;if(error)setAuthError('Não foi possível recuperar a sessão. Recarregue a página.');setUser(data.session?.user||null);setLoading(false)}).catch(()=>{if(active){setAuthError('Não foi possível recuperar a sessão. Recarregue a página.');setLoading(false)}});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if(!active)return;setUser(session?.user||null);setAuthError('');setLoading(false);if(event==='PASSWORD_RECOVERY')setRecovery(true)});
  return()=>{active=false;subscription.unsubscribe()};
 },[]);
 if(configurationError)return <AccountFrame><h1>Conexão pendente</h1><p>{configurationError}</p><p className="auth-note">Seus registros locais foram preservados. Ajuste a configuração do projeto e publique uma nova versão.</p></AccountFrame>;
 if(!cloudConfigured)return <App/>;
 if(loading)return <AccountFrame><h2>Recuperando sua conta…</h2></AccountFrame>;
 if(authError)return <AccountFrame><p role="alert">{authError}</p><button className="primary" onClick={()=>location.reload()}>Tentar novamente</button></AccountFrame>;
 if(!user||recovery)return <AuthForm key={recovery?'recovery':'auth'} recovery={recovery} onRecovered={()=>setRecovery(false)}/>;
 return <CloudWorkspace key={user.id} user={user} App={App}/>;
}
function CloudWorkspace({user,App}) {
 const [phase,setPhase]=useState('loading'),[error,setError]=useState(''),[snapshot,setSnapshot]=useState(null),[generation,setGeneration]=useState(0),[sync,setSync]=useState({kind:'saved'}),[pendingConflict,setPendingConflict]=useState(null),[logoutError,setLogoutError]=useState('');
 const writer=useRef(null),active=useRef(true),loadId=useRef(0);
 const device=useRef(null);
 if(device.current===null){try{device.current=validateWorkspace(JSON.parse(localStorage.getItem('concurceiro-v1')))}catch{device.current=false}}
 function start(data,revision,pending=false) {
  validateWorkspace(data);writer.current?.dispose();
  const next=new CloudWriter({userId:user.id,data,revision,storage:localStorage,write:writeWorkspace,dirty:pending,onStatus:status=>{if(active.current&&writer.current===next)setSync(status)}});
  writer.current=next;setSnapshot({initialData:data,save:value=>next.save(value)});setGeneration(n=>n+1);setPhase('ready');setSync({kind:'saved'});

 }
 async function load(useRemote=false) {
  const request=++loadId.current;setPhase('loading');setError('');
  try {
   const remote=await loadWorkspace(user.id);if(!active.current||request!==loadId.current)return;
   if(remote)validateWorkspace(remote.data);
   const cached=readCache(localStorage,user.id);
   if(!useRemote&&cached?.pending) {
    if(cached.revision===(remote?.revision||0)){start(cached.data,cached.revision,true);return}
    setPendingConflict(cached);setPhase('conflict');return;
   }
   if(remote){start(remote.data,remote.revision);return}
   setPhase('choice');
  }catch(err){if(active.current&&request===loadId.current){setError('Não foi possível carregar seus estudos do banco. Confira sua conexão. Se for a primeira configuração, verifique se o script SQL foi executado no Supabase.');setPhase('error')}}
 }
 useEffect(()=>{active.current=true;void load();const online=()=>writer.current?.retry();window.addEventListener('online',online);return()=>{active.current=false;loadId.current++;writer.current?.dispose();window.removeEventListener('online',online)}},[]);
 async function logout(){setLogoutError('');const {error}=await supabase.auth.signOut();if(error)setLogoutError('Não foi possível sair. Tente novamente.');}
 function useServer() {
  const cached=readCache(localStorage,user.id);
  if(cached?.pending&&!window.confirm('Há mudanças deste dispositivo que ainda não estão no banco. Exporte a cópia local antes de continuar. Carregar a versão do banco agora?'))return;
  try{if(cached?.pending)localStorage.setItem(cacheKey(user.id)+':conflict-backup',JSON.stringify(cached))}catch{const message='Não foi possível preservar sua cópia local. Exporte o backup antes de recarregar.';setError(message);setSync({kind:'local-error',message});return}
  writer.current?.dispose();void load(true);
 }
 function exportLocal(){const cached=readCache(localStorage,user.id);if(cached)downloadBackup(cached.data,'estudos-pendentes.json')}
 const cloud={...snapshot,user,sync,logout,logoutError,retry:()=>writer.current?.retry(),exportLocal,useServer};
 if(phase==='loading')return <AccountFrame><h2>Carregando seus estudos…</h2><p>Buscando a versão salva na sua conta.</p></AccountFrame>;
 if(phase==='error')return <AccountFrame><h1>Vamos reconectar.</h1><p role="alert">{error}</p><div className="account-actions"><button className="primary" onClick={()=>load()}>Tentar novamente</button><button className="secondary" onClick={exportLocal}><Download size={15}/>Exportar cópia deste dispositivo</button><button className="text-btn" onClick={logout}>Sair</button></div></AccountFrame>;
 if(phase==='conflict')return <AccountFrame><h1>Duas versões dos seus estudos.</h1><p>Existem alterações pendentes neste dispositivo e uma versão diferente no banco. Baixe a cópia local antes de carregar a versão do banco. Depois você poderá importá-la em Configurações, se preferir.</p><div className="account-actions"><button className="primary" onClick={()=>downloadBackup(pendingConflict.data,'estudos-pendentes.json')}><Download size={16}/>Baixar cópia local</button><button className="secondary" onClick={useServer}>Carregar versão do banco</button><button className="text-btn" onClick={logout}>Sair</button></div>{error&&<p className="account-error" role="alert">{error}</p>}</AccountFrame>;
 if(phase==='choice')return <AccountFrame><span className="eyebrow">SUA CONTA ESTÁ PRONTA</span><h1>Como você quer começar?</h1><p>Ainda não há estudos salvos nesta conta.</p>{device.current?<><div className="migration-summary"><strong>Encontramos registros neste navegador</strong><p>{device.current.sessions.length} sessões · {device.current.exams.length} simulados · {device.current.schedule.length} agendamentos.</p><p>Envie somente se esses registros forem seus. A cópia original continuará neste navegador.</p></div><button className="primary submit" onClick={()=>start(device.current,0,true)}><Cloud size={17}/>Transferir meus registros para minha conta</button></>:<p className="auth-note">Seu cronograma inicial será preparado ao continuar.</p>}<button className="secondary submit" onClick={()=>start({subjects:[],sessions:[],exams:[],schedule:[]},0)}>Começar com um novo cronograma</button><button className="text-btn recovery-link" onClick={logout}>Sair</button>{logoutError&&<p role="alert">{logoutError}</p>}</AccountFrame>;
 return <App key={generation} cloud={cloud}/>;
}
export function SyncStatus({cloud}) {
 if(!cloud)return null;
 const {sync}=cloud;
 const bad=['error','conflict','local-error'].includes(sync.kind);
 return <div className={`sync-status ${bad?'sync-error':''}`} role="status">{bad?<AlertTriangle size={17}/>:sync.kind==='saving'?<RefreshCw size={17}/>:<Cloud size={17}/>}<div><strong>{sync.kind==='saved'?'Salvo na sua conta':sync.kind==='saving'?'Salvando na sua conta…':sync.kind==='conflict'?'Conflito entre dispositivos':'Alterações ainda não salvas no banco'}</strong>{bad&&<p>{sync.message}</p>}</div>{sync.kind==='error'&&<button className="secondary" onClick={cloud.retry}>Tentar sincronizar</button>}{bad&&<button className="secondary" onClick={cloud.exportLocal}>Baixar cópia local</button>}{sync.kind==='conflict'&&<button className="secondary" onClick={cloud.useServer}>Carregar banco</button>}</div>;
}
export function DatabaseSettings({cloud}) {
 return <section className="panel database-settings"><div className="panel-heading"><div><h2>{cloud?'Sua conta e seus estudos':'Seus estudos neste dispositivo'}</h2><p>{cloud?'Seus registros são privados e vinculados à sua conta.':'A sincronização ainda não foi ativada nesta versão publicada.'}</p></div>{cloud?<Cloud size={23}/>:<CloudOff size={23}/>}</div><div className="database-settings-body">{cloud?<><p><strong>{cloud.user.email}</strong></p><p>Ao terminar de estudar, confira a confirmação “Salvo na sua conta” antes de trocar de dispositivo. Use uma aba por vez para evitar conflitos.</p><button className="secondary" onClick={cloud.logout}><LogOut size={16}/>Sair da conta</button>{cloud.logoutError&&<p className="account-error" role="alert">{cloud.logoutError}</p>}</>:<p>Seus registros continuam guardados somente neste navegador. Depois de ativar a conexão com o banco, você poderá criar uma conta e escolher transferir esses dados.</p>}</div></section>
}
