import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfigured=Boolean(url&&key);
export let configurationError='';
export let supabase=null;
if(cloudConfigured) {
 try {
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'&&parsed.hostname!=='localhost'&&parsed.hostname!=='127.0.0.1')throw Error('Use a URL HTTPS do seu projeto Supabase.');
  if(key.startsWith('sb_secret_'))throw Error('Use a chave pública do Supabase, nunca uma chave secreta.');
  if(key.startsWith('ey')) {
   let claims;try{claims=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{}
   if(claims?.role==='service_role')throw Error('A chave service_role não pode ser usada no navegador.');
  }
  supabase=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 }catch(error){configurationError=error.message}
} else if(url||key)configurationError='Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY juntas e faça um novo deploy.';
export async function loadWorkspace(userId) {
 const {data,error}=await supabase.from('study_workspaces').select('data,revision,updated_at').eq('user_id',userId).maybeSingle();
 if(error)throw error;return data;
}
export async function writeWorkspace(userId,data,revision) {
 const {data:result,error}=await supabase.rpc('save_study_workspace',{p_user_id:userId,p_data:data,p_expected_revision:revision});
 if(error)throw error;
 if(!result?.[0])throw Error('O banco não confirmou o salvamento.');
 return result[0];
}
