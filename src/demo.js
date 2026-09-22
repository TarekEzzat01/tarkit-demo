/* Explicit sample mode only. This adapter never calls Supabase or an AI provider. */
if (window.TARKIT_PUBLIC_DEMO || new URLSearchParams(location.search).get('demo') === '1') {
  const uid = '10000000-0000-4000-8000-000000000001';
  const wid = '20000000-0000-4000-8000-000000000001';
  const companyId = '30000000-0000-4000-8000-000000000001';
  const dealId = '40000000-0000-4000-8000-000000000001';
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const profile = { id: uid, email:'sara@example.test', email_confirmed_at:new Date().toISOString(),user_metadata:{full_name:'Sara Ahmed'} };
  const dateAfter = days => { const d = new Date(); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const id = (group,index) => `${group}0000000-0000-4000-8000-${String(index).padStart(12,'0')}`;
  const teamNames=['Sara Ahmed','Faisal Ali','Mariam Nasser','Khalid Saleh'];
  const accounts=[
    ['Fennec Projects','Riyadh','Saudi Arabia','Construction'],
    ['Cedar Systems','Dubai','United Arab Emirates','Technology'],
    ['Dune Works','Riyadh','Saudi Arabia','Construction'],
    ['Nakhla Logistics','Jeddah','Saudi Arabia','Logistics'],
    ['Madar Engineering','Dammam','Saudi Arabia','Engineering'],
    ['Harbor Services','Doha','Qatar','Services'],
    ['Palmline Distribution','Kuwait City','Kuwait','Distribution'],
    ['Pearlpath Consulting','Manama','Bahrain','Consulting'],
    ['Wadi Operations','Muscat','Oman','Services'],
    ['Sandstone Manufacturing','Abu Dhabi','United Arab Emirates','Manufacturing'],
    ['Sahab Digital','Khobar','Saudi Arabia','Technology'],
    ['Oasis Facilities','Madinah','Saudi Arabia','Facilities Management'],
  ];
  const initial={
    tarkit_workspaces:[{id:wid,name:'TARKIT Demo · GCC Sales',country:'Saudi Arabia',created_by:uid}],
    tarkit_memberships:teamNames.map((display_name,i)=>({workspace_id:wid,user_id:id(1,i+1),display_name,role:i===0?'owner':'member',app_role:i===1?'cco':'sales_rep',environments:i===0?['executive','commercial','sales']:i===1?['commercial','sales']:['sales']})),
    companies:accounts.map(([name,city,country,industry],i)=>({id:id(3,i+1),owner_id:uid,workspace_id:wid,name,city,country,industry,website:i%5===0?'':`https://account-${i+1}.example.test`,type:'Private',size:i%3===0?'Large':'Medium',status:i<4?'Warm':'Hot',erp_current:i%3===0?'SAP':i%3===1?'Oracle':'Unknown',notes:'Fictional company for product demonstrations.',created_at:new Date().toISOString()})),
    contacts:[],deals:[],activities:[],icp_profiles:[],
    annual_targets:[{id:id(7,1),owner_id:uid,workspace_id:wid,year:date.getFullYear(),target_sar:5000000}],
    activity_targets:['Call','Meeting','Demo','Email'].map((activity_type,i)=>({id:id(8,i+1),owner_id:uid,workspace_id:wid,period_type:'weekly',activity_type,target_count:[20,8,5,30][i]})),
    tarkit_events:[],lk_product_lines:[],lk_sub_product_lines:[],lk_stages:[],lk_sub_stages:[],tarkit_documents:[],tarkit_customer_success:[]
  };
  const sampleRole=new URLSearchParams(location.search).get('demoRole');
  if(['c_suite','cco','sales_rep'].includes(sampleRole))Object.assign(initial.tarkit_memberships[0],{role:'member',app_role:sampleRole,environments:sampleRole==='c_suite'?['executive']:sampleRole==='cco'?['commercial','sales']:['sales']});
  const contactNames=[['Omar','Hassan'],['Lina','Mansour'],['Noura','Salem'],['Yousef','Karim'],['Hessa','Ali'],['Rashid','Nasser'],['Reem','Khalil'],['Abdullah','Faris'],['Dana','Saleh'],['Ahmed','Samir'],['Maha','Hamdan'],['Saeed','Adel']];
  accounts.forEach((_,i)=>{
    ['Chief Operating Officer','Sales Operations Manager'].forEach((title,j)=>{const n=i*2+j+1,[first_name,last_name]=contactNames[(i+j)%contactNames.length];initial.contacts.push({id:id(5,n),owner_id:uid,workspace_id:wid,company_id:id(3,i+1),first_name,last_name,title,seniority:j?'Manager':'C-Level',department:j?'Sales':'Executive',email:n%7===0?'':`contact-${n}@example.test`,notes:'Fictional contact; example.test is reserved for testing.'});});
  });
  const openStages=[['Qualification','Initial Contact',10],['Demo','Demo Scheduled',25],['Proposal','Proposal Submitted',50],['Negotiation','Commercial Discussion',75],['Awarding','PO Pending',90]];
  const projects=['Reporting rollout','Customer portal','Operations platform','Commercial analytics','Service transformation','Team workspace expansion','Workflow automation','Delivery visibility','Account intelligence','Success program','Partner workspace','Regional expansion'];
  for(let i=0;i<24;i++){
    const company=i%accounts.length,closed=i>=16,[stage,sub_stage,probability]=i<16?openStages[i%5]:i<22?['Won','Won',100]:['Lost','Lost',0];
    const close=closed?dateAfter(-5-(i-16)*9):dateAfter(i===15?-7:10+i*10);
    initial.deals.push({id:id(4,i+1),owner_id:uid,workspace_id:wid,company_id:id(3,company+1),primary_contact_id:id(5,company*2+1),assigned_to:id(1,(i%4)+1),name:`${projects[company]}${i>=12?' · Phase 2':''}`,value_sar:[85000,240000,360000,175000,120000,95000,280000,150000,210000,420000,160000,195000][company],stage,sub_stage,probability,expected_close:close,actual_close:closed?close:null,lost_reason:stage==='Lost'?'Sample: project postponed':null,notes:'Fictional opportunity for demonstration.',created_at:new Date().toISOString()});
  }
  const activityTypes=['Call','Meeting','Demo','Email'];
  const summaries=['Discussed requirements and buying process','Reviewed decision criteria and stakeholders','Demonstrated the proposed workflow','Shared a tailored proposal and next steps'];
  const actions=['Confirm the discovery attendees','Schedule the stakeholder review','Send the agreed demo recap','Follow up on the commercial proposal'];
  for(let i=0;i<48;i++){
    const d=initial.deals[i%24],type=(i+Math.floor(i/12))%4,completed=i%3===0;
    initial.activities.push({id:id(6,i+1),owner_id:uid,workspace_id:wid,company_id:d.company_id,deal_id:d.id,contact_id:d.primary_contact_id,type:activityTypes[type],activity_date:dateAfter(-(i%28)),summary:summaries[type],next_action:`${actions[type]} · ${d.name}`,next_action_due:dateAfter(((i*5+Math.floor(i/12))%15)-5),next_action_completed_at:completed?new Date().toISOString():null,duration_min:[15,45,60,0][type],created_at:new Date().toISOString()});
  }
  const lifecycle=[['Onboarding','Kickoff scheduled','Not assessed'],['Adoption','Training','Healthy'],['Value realization','Outcomes documented','Healthy'],['Renewal','Renewal planning','Watch'],['At risk','Recovery plan','At risk'],['Onboarding','Implementation in progress','Healthy']];
  initial.deals.filter(d=>d.stage==='Won').forEach((d,i)=>{const [stage,sub_stage,health]=lifecycle[i];initial.tarkit_customer_success.push({deal_id:d.id,workspace_id:wid,stage,sub_stage,health,renewal_date:dateAfter([180,120,90,30,21,240][i]),notes:['Sample: kickoff agenda agreed; confirm implementation owner.','Sample: training underway; review first-value milestone.','Sample: outcomes documented for the next business review.','Sample: renewal sponsor meeting due this month.','Sample: adoption slowed; agree recovery actions with sponsor.','Sample: implementation plan approved.'][i],updated_at:new Date().toISOString()});});
  const artifact=(kind,title,content)=>({id:crypto.randomUUID(),workspace_id:wid,created_by:uid,kind,title,content,updated_at:new Date().toISOString()});
  initial.tarkit_documents=[
    artifact('gtm','Demo GTM Strategy',{
      'Market Segmentation':'Demo plan: small B2B service, technology and industrial teams across Saudi Arabia and the GCC. Start with teams managing repeatable, multi-stakeholder deals.',
      'ICP (Ideal Customer Profile)':'Demo hypothesis: a 5–25 person commercial team with a shared pipeline, recurring handoff friction and a named sales-operations owner. Validate in discovery.',
      'Buying Center Mapping':'Demo buying center: CCO as sponsor, sales operations as champion, sales reps as daily users, and IT/security as reviewers.',
      'Value Proposition':'Demo positioning: connect account context, opportunity progress and the next action in one shared workspace.',
      'Brand Positioning':'Demo direction: clear commercial decisions for ambitious GCC teams, expressed through the TARKIT brand.',
      'Messaging & Channels':'Demo experiment: founder-led discovery, practical pipeline workshops, partner introductions and short product walkthroughs.',
      'Proof System':'Demo plan: validate time to first value, capture permissioned pilot feedback and document measured outcomes. These are planned evidence, not customer claims.',
      'Packaging':'Demo proposal: begin with a useful team workspace, then validate collaboration and intelligence needs before defining paid packaging.',
      'Pricing':'No approved price. Demo research: test willingness to pay with buyers and compare seat-based and workspace-based preferences.'
    }),
    artifact('motions','Demo GTM Motions Mix',{mix:[40,20,15,25],notes:['Demo: targeted discovery with qualified accounts.','Demo: practical account and pipeline content.','Demo: pilot joint workshops with implementation partners.','Demo: measure first account → opportunity → next action; prompt useful invitations after activation.']}),
    artifact('vision','Demo Vision & Targets',{body:'Demonstration vision: give every commercial team a clear next action and shared revenue context. Review pipeline weekly, customer health monthly and GTM assumptions quarterly. The SAR 5M target is fictional planning data.'}),
    artifact('battlecard','Demo: Shared CRM vs spreadsheets',{position:'Demo hypothesis: connected records and next actions reduce coordination work.',strengths:'Spreadsheets are familiar and flexible for simple lists.',gaps:'Compare manual updates, ownership clarity and handoff effort using the buyer’s actual workflow.',questions:'How do you track the next action? Who updates the forecast? Where do customer handoffs get lost?',proof:'Illustrative comparison only. Validate against the buyer’s tools and a measured pilot.',context:'Use in a discovery workshop; avoid unsupported savings claims.'}),
    artifact('battlecard','Demo: Team workspace vs disconnected tools',{position:'Demo hypothesis: a shared account view gives conversations and opportunities consistent context.',strengths:'Specialist tools may have deeper capabilities in their individual area.',gaps:'Evaluate integrations, duplicate entry, access management and total effort.',questions:'Which tools are essential? What must integrate? Which information is repeatedly entered?',proof:'No vendor-specific claims. Complete a buyer-led requirements comparison.',context:'Use after mapping the existing workflow and must-have integrations.'}),
    artifact('roi','Demo case: Sales administration',{people:12,hours:2,hourly:150,benefit:0,setup:25000,annual:36000}),
    artifact('roi','Demo case: Customer handoffs',{people:8,hours:1.5,hourly:175,benefit:0,setup:18000,annual:24000})
  ];
  const key='tarkit.sample.v4.1.'+(sampleRole||'admin'); let data;
  try { data=JSON.parse(sessionStorage.getItem(key)) || initial; } catch { data=initial; }
  const persist=()=>sessionStorage.setItem(key,JSON.stringify(data));
  const stamp=row=>({id:crypto.randomUUID(),created_at:new Date().toISOString(),...row});
  const result=value=>Promise.resolve({data:value,error:null});
  function from(table) {
    let operation='select',payload,filters=[],single=false,sort=null;
    const builder={
      select(){return this;},eq(key,value){filters.push(row=>row[key]===value);return this;},is(key,value){filters.push(row=>(row[key]??null)===value);return this;},
      order(key,options){sort={key,ascending:options?.ascending!==false};return this;},limit(){return this;},single(){single=true;return this;},maybeSingle(){single=true;return this;},
      insert(rows){operation='insert';payload=Array.isArray(rows)?rows:[rows];return this;},update(row){operation='update';payload=row;return this;},
      upsert(rows){operation='upsert';payload=Array.isArray(rows)?rows:[rows];return this;},delete(){operation='delete';return this;},
      then(resolve,reject){
        return Promise.resolve().then(()=>{
          if(!data[table]) return {data:null,error:{code:'PGRST205',message:'Table unavailable'}};
          let rows=data[table].filter(row=>filters.every(test=>test(row)));
          if(operation==='insert'){rows=payload.map(stamp);data[table].push(...rows);}
          if(operation==='update') rows.forEach(row=>Object.assign(row,payload));
          if(operation==='delete') data[table]=data[table].filter(row=>!rows.includes(row));
          if(operation==='upsert') { rows=payload.map(row=>{const old=data[table].find(x=>row.id ? x.id===row.id : x.workspace_id===row.workspace_id&&x.year===row.year&&x.activity_type===row.activity_type);if(old){Object.assign(old,row);return old;}const n=stamp(row);data[table].push(n);return n;}); }
          if(table==='tarkit_memberships') rows=rows.map(row=>({...row,tarkit_workspaces:data.tarkit_workspaces.find(w=>w.id===row.workspace_id)}));
          if(sort) rows=[...rows].sort((a,b)=>String(a[sort.key]||'').localeCompare(String(b[sort.key]||''))*(sort.ascending?1:-1));
          if(operation!=='select') persist();
          return {data:structuredClone(single ? rows[0]||null : rows),error:null};
        }).then(resolve,reject);
      }
    };return builder;
  }
  async function rpc(name,args){
    let value=null;
    if(name==='tarkit_team_members'||name==='tarkit_member_access') value=data.tarkit_memberships.filter(row=>row.workspace_id===args.p_workspace_id).map(row=>({...row,display_name:row.display_name||teamNames[Number(row.user_id.slice(-12))-1]||'Demo teammate',environments:['owner','admin'].includes(row.role)?['executive','commercial','sales']:row.environments}));
    else if(name==='tarkit_set_member_access'){
      const own=data.tarkit_memberships.find(m=>m.workspace_id===args.p_workspace_id&&m.user_id===uid);
      const member=data.tarkit_memberships.find(m=>m.workspace_id===args.p_workspace_id&&m.user_id===args.p_user_id);
      if(!own||!['owner','admin'].includes(own.role)||!member||member.role==='owner'||member.user_id===uid||!args.p_environments?.length)return {data:null,error:{message:'This access update is not allowed.'}};
      Object.assign(member,{role:args.p_role,app_role:args.p_app_role,environments:args.p_environments});
    }else if(name==='tarkit_save_customer_success'){
      const old=data.tarkit_customer_success.find(c=>c.deal_id===args.p_deal_id);
      if((old?.updated_at||null)!==args.p_expected_updated_at)return {data:null,error:{message:'Customer tracking changed. Refresh before saving.'}};
      const row={deal_id:args.p_deal_id,workspace_id:args.p_workspace_id,stage:args.p_stage,sub_stage:args.p_sub_stage,health:args.p_health,renewal_date:args.p_renewal_date,notes:args.p_notes,updated_at:new Date().toISOString()};
      if(old)Object.assign(old,row);else data.tarkit_customer_success.push(row);
    }else if(name==='tarkit_create_workspace'){
      value=crypto.randomUUID();data.tarkit_workspaces.push({id:value,name:args.p_name,country:args.p_country});data.tarkit_memberships.push({workspace_id:value,user_id:uid,role:'owner'});
    }else if(name==='tarkit_invite_member') value=crypto.randomUUID();
    else if(name==='tarkit_create_opportunity'){
      value=crypto.randomUUID();data.deals.push(stamp({id:value,owner_id:uid,workspace_id:args.p_workspace_id,company_id:args.p_company_id,name:args.p_name,value_sar:args.p_value_sar,stage:args.p_stage,sub_stage:args.p_sub_stage,probability:args.p_probability,expected_close:args.p_expected_close,assigned_to:args.p_assigned_to}));
      data.activities.push(stamp({owner_id:uid,workspace_id:args.p_workspace_id,company_id:args.p_company_id,deal_id:value,type:'Call',activity_date:today,summary:'Next action scheduled for opportunity',next_action:args.p_next_action,next_action_due:args.p_due}));
    }else if(name==='tarkit_complete_followup'){
      const row=data.activities.find(row=>row.id===args.p_activity_id);if(row)row.next_action_completed_at=new Date().toISOString();
    }else if(name==='tarkit_record_event'){} // Sample interactions are excluded from product analytics.
    else return {data:null,error:{message:'This action is unavailable in the sample workspace.'}};
    persist();return {data:value,error:null};
  }
  window.TARKIT_DEMO_CLIENT={from,rpc,functions:{invoke:async()=>({data:null,error:{message:'Sample mode does not call AI providers.'}})},auth:{getSession:()=>result({session:{user:profile}}),getUser:()=>result({user:profile}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>{},signInWithPassword:()=>result({session:{user:profile},user:profile})}};
}
