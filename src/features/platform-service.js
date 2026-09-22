import { accessFor, selectEnvironment } from '../platform-domain.js';

export function createPlatformService(L,W) {
  const state={ready:false,documents:[],customers:[],members:[],access:accessFor(null),environment:'commercial',error:null};
  const scope=()=>W.state.active?.id || L.userId;
  const key=()=>`tarkit.environment.${L.userId}.${scope()}`;
  const draftKey=()=>`tarkit.strategy-drafts.${L.userId}.${scope()}`;
  function readDrafts(){try{return JSON.parse(localStorage.getItem(draftKey())||'[]');}catch{return [];}}
  async function initialize(){
    state.ready=false;state.error=null;state.documents=[];state.customers=[];state.members=W.state.members;
    state.access=accessFor(W.state.active,W.state.memberships.find(m=>m.workspace_id===W.state.active?.id));
    let saved;try{saved=localStorage.getItem(key());}catch{}
    state.environment=selectEnvironment(saved||'commercial',state.access.environments);
    if(!W.state.active){state.documents=readDrafts();return;}
    const responses=await Promise.all([
      L.rawDb.from('tarkit_documents').select('*').eq('workspace_id',scope()).order('updated_at',{ascending:false}),
      L.rawDb.from('tarkit_customer_success').select('*').eq('workspace_id',scope()),
      L.rawDb.rpc('tarkit_member_access',{p_workspace_id:scope()}),
    ]);
    const missing=responses.some(r=>['PGRST205','42P01','PGRST202','42883'].includes(r.error?.code));
    const failure=responses.find(r=>r.error&&!['PGRST205','42P01','PGRST202','42883'].includes(r.error.code));
    if(failure){state.error=failure.error.message;throw failure.error;}
    if(missing){state.documents=readDrafts();return;}
    state.ready=true;state.documents=responses[0].data||[];state.customers=responses[1].data||[];state.members=responses[2].data||[];
    const own=state.members.find(m=>m.user_id===L.userId);
    state.access=accessFor(W.state.active,own);
    state.environment=selectEnvironment(saved||'commercial',state.access.environments);
  }
  function switchEnvironment(value){if(!state.access.environments.includes(value))throw new Error('Your administrator has not enabled this environment.');state.environment=value;localStorage.setItem(key(),value);}
  async function saveDocument(document){
    if(!state.access.writeStrategy && document.kind!=='roi')throw new Error('Your role can view this resource. Ask an administrator or commercial lead to edit it.');
    if(document.kind==='roi'&&!state.access.writeCRM)throw new Error('Your role can view saved cases.');
    if(!state.ready){
      const drafts=readDrafts(), row={...document,id:document.id||crypto.randomUUID(),updated_at:new Date().toISOString(),local_draft:true};
      const index=drafts.findIndex(d=>d.id===row.id);if(index<0)drafts.unshift(row);else drafts[index]=row;
      localStorage.setItem(draftKey(),JSON.stringify(drafts));state.documents=drafts;return row;
    }
    const payload={kind:document.kind,title:document.title,content:document.content,updated_at:new Date().toISOString()};
    const query=document.id ? L.rawDb.from('tarkit_documents').update(payload).eq('id',document.id).eq('workspace_id',scope()) : L.rawDb.from('tarkit_documents').insert({...payload,workspace_id:scope(),created_by:L.userId});
    const {data,error}=await query.select('*').single();if(error)throw error;
    await initialize();return data;
  }
  async function saveCustomer(values){
    if(!state.access.writeCRM)throw new Error('Your role has read-only access to customer success.');
    if(!state.ready)throw new Error('Shared customer-success tracking requires the database upgrade.');
    const {error}=await L.rawDb.rpc('tarkit_save_customer_success',{p_workspace_id:scope(),p_deal_id:values.deal_id,p_stage:values.stage,p_sub_stage:values.sub_stage,p_health:values.health||'Not assessed',p_renewal_date:values.renewal_date||null,p_notes:values.notes||'',p_expected_updated_at:values.expected_updated_at||null});
    if(error)throw error;await initialize();
  }
  async function saveAccess(userId,role,appRole,environments){
    if(!state.ready||!state.access.admin)throw new Error('Administrator access and the database upgrade are required.');
    const {error}=await L.rawDb.rpc('tarkit_set_member_access',{p_workspace_id:scope(),p_user_id:userId,p_role:role,p_app_role:appRole,p_environments:environments});
    if(error)throw error;await initialize();
  }
  return {state,initialize,switchEnvironment,saveDocument,saveCustomer,saveAccess};
}
