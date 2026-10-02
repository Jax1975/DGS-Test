

const UNIVERSAL=[
"Operator’s manual, inspection records and required examination/certification available and in date",
"General condition; no visible structural damage, cracked welds, distortion, missing parts or loose fixings",
"Access steps, ladders, handrails, platforms and anti-slip surfaces secure and clean",
"Guards, covers, interlocks and safety devices fitted, secure and functional",
"Cab, ROPS/FOPS or operator station undamaged; doors, windows and mirrors serviceable",
"Seat and seat belt/restraint secure and operational",
"Visibility aids, cameras, wipers, washers and demisters operational",
"Horn, beacon, lights, indicators, reversing alarm and other warnings operational",
"Emergency stops, isolation devices, keys and security controls functional and identified",
"Tyres/wheels or tracks/rollers/sprockets in acceptable condition and correctly secured/tensioned",
"Steering, service brake, parking brake and travel controls function correctly",
"Engine, battery, exhaust and cooling system secure; no abnormal noise, smoke or overheating",
"Fuel, oil, coolant, hydraulic fluid and other levels acceptable",
"No fuel, oil, coolant, air, vacuum, slurry or hydraulic leaks",
"Hoses, pipes, cables, couplings, connectors and retaining devices undamaged and secure",
"Rated capacity, operating limits, decals and safety signs present and legible",
"Fire extinguisher, spill kit and first-response equipment present where required and serviceable",
"Safe start-up and function test completed; gauges and fault indicators normal"
];
const SPEC={
"Excavator":"Boom/dipper/bucket, slew area, slew lock, track condition, quick hitch and auxiliary lines",
"Dozer":"Blade, push arms, ripper, tracks, access/egress and reversing visibility",
"Piling rig":"Mast/leader, ropes/chains, winches, crowd system, stability/levelling, guards and emergency stops",
"Articulated dump truck (ADT)":"Articulation joint/lock, body and tailgate, hoist, tyres, brakes, steering and body-down indicator",
"Powder silo trailer":"Tank/body, legs, pressure relief, gauges, hoses/couplings, earthing, dust control and discharge valves",
"Generator":"Electrical enclosure, outlets, leads, earthing arrangements, emergency stop, ventilation and fuel system",
"Pump":"Suction/discharge hoses, couplings, guards, priming, strainers, leaks and safe discharge route",
"Fuel tank / bowser":"Tank integrity, bunding, cap/vents, hose/nozzle, valves, labels, earthing and spill equipment",
"Vacuum tank":"Tank condition, vacuum/pressure controls, relief devices, hoses, closures, valves and contents identification",
"Tractor":"Three-point linkage, PTO guard, drawbar, hydraulics, tyres, brakes and road/field lighting",
"Roller":"Drum/tyres, scraper bars, vibration system, water spray, articulation and edge visibility",
"Telehandler":"Boom/forks, carriage and locking, load chart, rated capacity indicator/limiter, stabilisers and attachment recognition",
"ATV":"Tyres, steering, brakes, throttle return, guards, racks, lights and operator protection specified by manufacturer",
"Loading shovel":"Loader arms, bucket, linkage, articulation joint/lock, tyres and reversing aids",
"Crusher":"Feed hopper, guards, conveyors, pull wires/interlocks, emergency stops, blockages and dust suppression",
"Screener":"Decks, guards, conveyors, belts/rollers, emergency stops, access platforms and dust controls",
"Wirtgen / milling machine":"Milling drum and guards, conveyors, water spray, levelling sensors, emergency stops and edge protection",
"Tractor and spreader":"PTO/drive guards, hopper/body, spreader mechanism, calibration/controls, hydraulics and exclusion area",
"Tractor and Stehr dust free stabiliser":"PTO and drive guards, three-point linkage, hydraulic connections, stabiliser rotor and housing, dust-control system, hoses, spray nozzles, hopper, controls and exclusion area"
};
const DEFAULT_RECIPIENTS=[
['Plant Manager','craig@dgs.co.uk'],['Plant dept','plant@dgs.co.uk'],['HSE','mick@dgs.co.uk'],['HSE Admin','simona@dgs.co.uk'],
['Site manager','Brandon.Hayes@dgs.co.uk'],['Site manager','Craig.Ackerman@dgs.co.uk'],['Site manager','George@dgs.co.uk'],['Site manager','Ian@dgs.co.uk'],['Site manager','Jim@dgs.co.uk'],['Site manager','Phillip@dgs.co.uk'],['Site manager','Shaun.Elliot@dgs.co.uk'],['Site manager','Shaun@dgs.co.uk']];
const KEY='dgs-puwer-v3';
function uid(){return (window.crypto&&window.crypto.randomUUID)?window.crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(36).slice(2)}
let state=JSON.parse(localStorage.getItem(KEY)||'null');
if(!state){const old=localStorage.getItem('dgs-puwer-v2')||localStorage.getItem('dgs-puwer-v1'); state=old?JSON.parse(old):{plants:[],inspections:[],recipients:DEFAULT_RECIPIENTS};}
state.plants??=[];state.inspections??=[];state.recipients??=DEFAULT_RECIPIENTS;
let db=null, centralEnabled=false;
try{ if(window.DGS_SUPABASE_URL && window.DGS_SUPABASE_KEY && window.supabase){ db=window.supabase.createClient(window.DGS_SUPABASE_URL,window.DGS_SUPABASE_KEY); centralEnabled=true; } }catch(e){ console.warn('Central database disabled',e); }
function saveLocal(){localStorage.setItem(KEY,JSON.stringify(state))}
function save(){saveLocal(); if(centralEnabled) syncStateToCloud().catch(e=>console.warn('Cloud sync failed',e));}
async function loadFromCloud(){
  if(!centralEnabled) return;
  const [{data:ps,error:pe},{data:is,error:ie}]=await Promise.all([
    db.from('plants').select('*').order('created_at'),
    db.from('inspections').select('*').order('inspection_date')
  ]);
  if(pe||ie) throw (pe||ie);
  state.plants=(ps||[]).map(p=>({id:p.id,list:p.plant_list,name:p.fleet_name,type:p.plant_type,site:p.site,make:p.make_model}));
  state.inspections=(is||[]).map(i=>{const d=i.data||{};d.id=i.id;d.plantId=i.plant_id;d.date=i.inspection_date;d.time=i.inspection_time;return d});
  saveLocal();
}
async function syncStateToCloud(){
  if(!centralEnabled) return;
  const plantRows=state.plants.map(p=>({id:p.id,plant_list:p.list||'DGS Plant',site:p.site||'',plant_type:p.type||'',make_model:p.make||'',fleet_name:p.name||'',updated_at:new Date().toISOString()}));
  if(plantRows.length){const {error}=await db.from('plants').upsert(plantRows,{onConflict:'id'});if(error)throw error;}
  const inspRows=state.inspections.map(d=>({id:d.id,plant_id:d.plantId,inspection_date:d.date,inspection_time:d.time||'',data:d,updated_at:new Date().toISOString()}));
  if(inspRows.length){const {error}=await db.from('inspections').upsert(inspRows,{onConflict:'id'});if(error)throw error;}

  // Mirror the inspection's individual checks and defects into normalized tables.
  for(const d of state.inspections){
    const checkRows=[];
    UNIVERSAL.forEach((q,i)=>checkRows.push({inspection_id:d.id,check_key:'u'+i,check_number:String(i+1),check_item:q,result:d.checks?.[i]||'',comment:d.comments?.['u'+i]||'',photos:d.checkPhotos?.['u'+i]||[]}));
    const plant=state.plants.find(p=>p.id===d.plantId);
    checkRows.push({inspection_id:d.id,check_key:'spec',check_number:'P',check_item:SPEC[plant?.type]||'Plant-specific check',result:d.spec||'',comment:d.comments?.spec||'',photos:d.checkPhotos?.spec||[]});
    const {error:ce}=await db.from('inspection_checks').upsert(checkRows,{onConflict:'inspection_id,check_key'});if(ce)throw ce;

    // Replace the normalized defects for this inspection so removed defects do not remain in the central database.
    const {error:de}=await db.from('defects').delete().eq('inspection_id',d.id);if(de)throw de;
    const defects=(d.defects||[]).map(x=>({inspection_id:d.id,ref:String(x.ref??''),auto_key:x.autoKey||null,defect:x.defect||'',immediate_action:x.action||'',reported_to:x.reported||'',target_completion:x.target||'',closed_by:x.closed||''}));
    if(defects.length){
      const {data:inserted,error:die}=await db.from('defects').insert(defects).select('id,ref');if(die)throw die;
      for(let n=0;n<inserted.length;n++){
        const photos=d.defects[n]?.photos||[];
        if(photos.length){const photoRows=photos.map(photo_data=>({defect_id:inserted[n].id,photo_data}));const {error:pe}=await db.from('defect_photos').insert(photoRows);if(pe)throw pe;}
      }
    }
  }
}

async function refreshCloud(opts={}){
  if(!centralEnabled){ if(opts.showToast) toast('Central database is not configured'); return false; }
  try{
    await loadFromCloud();
    if(opts.showToast) toast('Shared data updated');
    return true;
  }catch(e){
    console.warn('Cloud refresh failed',e);
    if(opts.showToast) toast('Central database unavailable — using this device data');
    return false;
  }
}
async function refreshOnOpen(){
  // Always render immediately from the local cache, then refresh from Supabase.
  home();
  if(centralEnabled){
    const ok=await refreshCloud({showToast:false});
    if(ok) home();
  }
}
let refreshBusy=false;
async function autoRefreshSharedData(){
  if(!centralEnabled||refreshBusy||current)return;
  if(!document.getElementById('todayList'))return;
  refreshBusy=true;
  try{
    const ok=await refreshCloud({showToast:false});
    if(ok && document.getElementById('todayList')) appHome();
  }finally{refreshBusy=false;}
}


function esc(s=''){s=String(s??'');return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function toast(t){const x=document.getElementById('toast');x.textContent=t;x.style.display='block';setTimeout(()=>x.style.display='none',2600)}
function dateNow(){return new Date().toISOString().slice(0,10)} function timeNow(){return new Date().toTimeString().slice(0,5)}
let current=null;
function appHome(){document.getElementById('app').innerHTML=`<div class="nav"><button class="primary" onclick="home()">Dashboard</button><button onclick="newPlant()">+ Add plant</button><button onclick="recipients()">Email recipients</button><button onclick="refreshCloud({showToast:true}).then(ok=>{if(ok)home()})">↻ Refresh shared data</button></div><div class="card"><h2>Filter plant</h2><div class="grid"><label>Site name<select id="dashSiteFilter" onchange="renderDashboard()"><option value="">All sites</option></select></label><label>Fleet number / name<select id="dashFleetFilter" onchange="renderDashboard()"><option value="">All plant</option></select></label></div><div class="actions" style="margin-top:10px"><button onclick="clearDashboardFilters()">Clear filters</button></div></div><div class="card"><h2>Today's inspections</h2><div id="todayList"></div></div><div class="card"><h2>Active plant</h2><div id="plantList"></div></div><div class="card"><h2>Reports</h2><p class="muted">Create reports using plant type, site and defect filters.</p><button class="primary" onclick="weeklyReport()">Create report</button></div>`;populateDashboardFilters();renderDashboard()}
function home(){current=null;appHome()}
function populateDashboardFilters(){const siteEl=document.getElementById('dashSiteFilter'),fleetEl=document.getElementById('dashFleetFilter');if(!siteEl||!fleetEl)return;const currentSite=siteEl.value,currentFleet=fleetEl.value;const sites=[...new Set(state.plants.map(p=>p.site).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));const fleets=[...new Set(state.plants.map(p=>p.name).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));siteEl.innerHTML='<option value="">All sites</option>'+sites.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');fleetEl.innerHTML='<option value="">All plant</option>'+fleets.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(sites.includes(currentSite))siteEl.value=currentSite;if(fleets.includes(currentFleet))fleetEl.value=currentFleet}
function clearDashboardFilters(){const s=document.getElementById('dashSiteFilter'),f=document.getElementById('dashFleetFilter');if(s)s.value='';if(f)f.value='';renderDashboard()}
function statusClass(status){if(status==='Fit for use')return 'status-fit';if(status==='Fit for use with recorded minor defect(s)')return 'status-minor';if(status==='Do not use — isolated / quarantined' || status==='Do not use')return 'status-do-not-use';return 'due'}
function repairStatusClass(status){return status==='Repair Complete'?'repair-complete':status==='Repair outstanding'?'repair-outstanding':'repair-due'}
function repairBadgeHTML(status){if(status==='Repair Complete')return '<span class="pill repair-complete">Repair Complete</span>';if(status==='Repair outstanding')return '<span class="pill repair-outstanding">Repair outstanding</span>';return ''}
function renderDashboard(){const site=(document.getElementById('dashSiteFilter')?.value||'').trim();const fleet=(document.getElementById('dashFleetFilter')?.value||'').trim();const matches=p=>(!site||String(p.site||'')===site)&&(!fleet||String(p.name||'')===fleet);const t=dateNow();const tl=document.getElementById('todayList');const completed=state.inspections.filter(x=>x.date===t);const today=(list)=>state.plants.filter(p=>(p.list||'DGS Plant')===list&&matches(p)).map(p=>{const i=completed.find(x=>x.plantId===p.id);return `<div class="dayrow"><div><strong>${esc(p.name||p.make+' '+p.model)}</strong><div class="mini">${esc(p.type)}</div><div class="mini">${esc(p.site||'')}</div></div><div>${i?`<span class="pill ${statusClass(i.status)}">${esc(i.status)}</span>${repairBadgeHTML(i.repair?.status)}<button onclick="editInspection('${i.id}')">View</button>`:`<span class="pill due">Due</span><button class="primary" onclick="newInspection('${p.id}')">Complete</button>`}</div></div>`}).join('')||'<p class="muted">No plant matches the selected filters.</p>';tl.innerHTML=`<h3>DGS Plant</h3>${today('DGS Plant')}<h3 style="margin-top:18px">Hired Plant</h3>${today('Hired Plant')}`;const pl=document.getElementById('plantList');const section=(list)=>{const ps=state.plants.filter(p=>(p.list||'DGS Plant')===list&&matches(p));return `<h3>${list}</h3>`+(ps.length?ps.map(p=>{const ins=state.inspections.filter(i=>i.plantId===p.id).sort((a,b)=>b.date.localeCompare(a.date));return `<div class="plantrow"><div><strong>${esc(p.name||[p.make,p.model].filter(Boolean).join(' '))}</strong><div class="mini">${esc(p.type)}</div><div class="mini">${esc(p.site||'')} • ${ins.length} inspection(s) stored</div></div><div class="actions"><button onclick="plantHistory('${p.id}')">History</button><button class="primary" onclick="newInspection('${p.id}')">Today's check</button></div></div>`}).join(''):'<p class="muted">No plant matches the selected filters.</p>')};pl.innerHTML=section('DGS Plant')+section('Hired Plant')}
function newPlant(){document.getElementById('app').innerHTML=`<div class="nav"><button onclick="home()">← Dashboard</button></div><div class="card"><h2>Add plant</h2><div class="grid"><label>Plant list<select id="plist"><option value="DGS Plant">DGS Plant</option><option value="Hired Plant">Hired Plant</option></select></label><label>Project / Site<input id="psite"></label><label>Plant type<select id="ptype"><option value="">Select...</option>${Object.keys(SPEC).map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label>Make / Model<input id="pmodel"></label><label>Fleet number / name<input id="pname" placeholder="e.g. DGS-024 PC210"></label></div><div class="actions" style="margin-top:12px"><button class="primary" onclick="savePlant()">Save plant</button></div></div>`}
function savePlant(){const p={id:uid(),list:val('plist')||'DGS Plant',name:val('pname'),type:val('ptype'),site:val('psite'),make:val('pmodel')};if(!p.type||!p.name){toast('Enter plant name and type');return}state.plants.push(p);save();toast('Plant saved');home()}
function val(id){return document.getElementById(id)?.value.trim()||''}
function newInspection(pid){try{const p=state.plants.find(x=>String(x.id)===String(pid));if(!p){toast('Plant not found — please return to the dashboard and try again');return}const existing=state.inspections.find(x=>String(x.plantId)===String(pid)&&x.date===dateNow());if(existing){editInspection(existing.id);return}renderForm({id:uid(),plantId:p.id,date:dateNow(),time:timeNow(),details:{site:p.site||'',plantType:p.type||'',make:p.make||'',fleet:p.name||'',operator:'',supervisor:''},checks:UNIVERSAL.map(()=>''),spec:'',comments:{},defects:[],status:'',operatorSig:'',supervisorSig:'',repair:{}})}catch(e){console.error(e);toast("Could not open today's check: "+e.message)}}
function renderForm(d){
 current=d;
 d.checkPhotos??={};
 const p=state.plants.find(x=>x.id===d.plantId);
 document.getElementById('app').innerHTML=`<div class="nav"><button onclick="home()">← Dashboard</button></div><div class="card"><h2>PUWER Daily Inspection</h2><div class="statusbox"><strong>${esc(p.name)}</strong><br><span class="muted">${esc(d.date)} ${esc(d.time)} • ${esc(p.type)}</span></div><div class="grid"><label>Project / Site<input id="site" value="${esc(d.details.site)}"></label><label>Date<input id="date" type="date" value="${esc(d.date)}"></label><label>Time<input id="time" type="time" value="${esc(d.time)}"></label><label>Plant type<input value="${esc(d.details.plantType)}" disabled></label><label>Make / Model<input id="make" value="${esc(d.details.make)}"></label><label>Engine hours / Odometer<input id="hours" value="${esc(d.details.hours||'')}"></label></div></div><div class="card"><h2>Universal Pre-use Inspection</h2><p class="muted">Mark each item OK, Defect or N/A. If Defect is selected, add a comment and attach photos if required.</p>${UNIVERSAL.map((q,i)=>checkHTML(i,q,d.checks[i],d.comments['u'+i]||'',true)).join('')}</div><div class="card"><h2>Plant-specific check</h2><p><strong>${esc(p.type)}</strong><br>${esc(SPEC[p.type]||'No plant-specific prompt configured.')}</p>${checkHTML(100,SPEC[p.type]||'Plant-specific check',d.spec,d.comments.spec||'',false)}</div><div class="card"><h2>Defects, Isolation & Corrective Action</h2><p class="muted">Defects selected during the inspection are automatically added below. You can add or edit additional details.</p><div id="defects">${(d.defects?.length?d.defects:[]).map((x,i)=>defectHTML(x,i)).join('')}</div><button onclick="addDefect()">+ Add defect</button></div><div class="card"><h2>Inspection Outcome & Sign-off</h2><label>Plant status<select id="status"><option value="">Select...</option><option ${d.status==='Fit for use'?'selected':''}>Fit for use</option><option ${d.status==='Fit for use with recorded minor defect(s)'?'selected':''}>Fit for use with recorded minor defect(s)</option><option ${d.status==='Do not use'?'selected':''}>Do not use — isolated / quarantined</option></select></label><h3>Operator declaration</h3><p class="muted">I have completed the applicable checks and reported all defects.</p><input id="opname" placeholder="Operator name" value="${esc(d.details.operator||'')}"><canvas id="opsig" class="sig"></canvas><button onclick="clearSig('opsig')">Clear signature</button><h3>Supervisor / authorised person</h3><input id="supname" placeholder="Name" value="${esc(d.details.supervisor||'')}"><canvas id="supsig" class="sig"></canvas><button onclick="clearSig('supsig')">Clear signature</button><h3>Repair close-out</h3><div class="grid"><label>Released by<select id="released">${recipientOptions(d.repair?.released||'')}</select></label><label>Date/time<input id="releasedtime" type="datetime-local" value="${esc(d.repair?.time||'')}"></label><label>Repair status<select id="repairstatus" class="${repairStatusClass(d.repair?.status||'')}" onchange="this.className=repairStatusClass(this.value)"><option value="">Select...</option><option value="Repair outstanding" ${d.repair?.status==='Repair outstanding'?'selected':''}>Repair outstanding</option><option value="Repair Complete" ${d.repair?.status==='Repair Complete'?'selected':''}>Repair Complete</option></select></label></div></div><div class="card"><div class="actions"><button class="primary" onclick="saveInspection()">Save daily inspection</button><button onclick="saveAndNew()">Save & return</button></div></div>`;
 setupSig('opsig',d.operatorSig);setupSig('supsig',d.supervisorSig);
}
function checkHTML(i,q,v,comment,univ){const key=univ?'u'+i:'spec';const photos=current?.checkPhotos?.[key]||[];return `<div class="check"><div class="checkhead"><div class="num">${univ?i+1:'P'}</div><div>${esc(q)}</div></div><div class="choices"><button class="${v==='OK'?'sel-ok':''}" onclick="setCheck('${key}','OK',this)">OK</button><button class="${v==='Defect'?'sel-def':''}" onclick="setCheck('${key}','Defect',this)">Defect</button><button class="${v==='N/A'?'sel-na':''}" onclick="setCheck('${key}','N/A',this)">N/A</button></div><textarea placeholder="Comments / defect reference" data-comment="${key}" ${v==='Defect'?'':'style="display:none"'}>${esc(comment)}</textarea><div id="photos-${key}" class="${v==='Defect'?'':'hidden'}"><div class="photo-actions"><button type="button" onclick="document.getElementById('file-${key}').click()">📁 Add photo from file</button><button type="button" onclick="document.getElementById('camera-${key}').click()">📷 Take photo</button><input id="file-${key}" type="file" accept="image/*" multiple style="display:none" onchange="addCheckPhotos('${key}',this.files)"><input id="camera-${key}" type="file" accept="image/*" capture="environment" style="display:none" onchange="addCheckPhotos('${key}',this.files)"></div><div class="photo-preview">${photos.map((src,n)=>`<img class="photo-thumb" src="${src}" alt="Defect photo ${n+1}">`).join('')}</div></div></div>`}
function setCheck(key,v,btn){if(key==='spec')current.spec=v;else current.checks[Number(key.slice(1))]=v;current.checkPhotos??={};current.comments??={};const c=btn.parentElement.parentElement.querySelector('textarea');c.style.display=v==='Defect'?'block':'none';const photoBox=btn.parentElement.parentElement.querySelector('#photos-'+key);if(photoBox)photoBox.classList.toggle('hidden',v!=='Defect');if(v!=='Defect'){c.value='';delete current.checkPhotos[key]}current.comments[key]=c.value;btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('sel-ok','sel-def','sel-na'));btn.classList.add(v==='OK'?'sel-ok':v==='Defect'?'sel-def':'sel-na');syncDefectsFromChecks();refreshDefects()}
function addCheckPhotos(key,files){if(!files?.length)return;current.checkPhotos??={};current.checkPhotos[key]??=[];let remaining=files.length;[...files].forEach(file=>{if(!file.type.startsWith('image/')){remaining--;return}const r=new FileReader();r.onload=e=>{compressPhoto(e.target.result,src=>{current.checkPhotos[key].push(src);remaining--;if(remaining<=0)renderForm(current);})};r.readAsDataURL(file)});}
function compressPhoto(data,done){const img=new Image();img.onload=()=>{const max=1280;const scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);done(c.toDataURL('image/jpeg',0.72))};img.onerror=()=>done(data);img.src=data}
function syncDefectsFromChecks(){current.defects??=[];const keys=[...UNIVERSAL.map((q,i)=>({key:'u'+i,text:q})),{key:'spec',text:SPEC[state.plants.find(x=>x.id===current.plantId)?.type]||'Plant-specific check'}];const active=new Set();keys.forEach((x,idx)=>{const result=x.key==='spec'?current.spec:current.checks[Number(x.key.slice(1))];if(result==='Defect'){active.add(x.key);const comment=current.comments?.[x.key]||'';let item=current.defects.find(z=>z.autoKey===x.key);if(!item){item={ref:current.defects.length+1,defect:'',action:'',reported:'',target:'',closed:'',autoKey:x.key,photos:[]};current.defects.push(item)}item.defect=comment;item.photos=current.checkPhotos?.[x.key]||[]}});current.defects=current.defects.filter(x=>!x.autoKey||active.has(x.autoKey))}
function refreshDefects(){const el=document.getElementById('defects');if(!el)return;el.innerHTML=(current.defects||[]).map((x,i)=>defectHTML(x,i)).join('')}
function recipientOptions(selected){const vals=[...DEFAULT_RECIPIENTS];if(selected && !vals.some(r=>r[1]===selected)) vals.push(['Custom',selected]);return `<option value="">Select...</option>`+vals.map(([name,email])=>`<option value="${esc(email)}" ${email===selected?'selected':''}>${esc(name)} — ${esc(email)}</option>`).join('')}
function defectHTML(x,i){const photos=x.photos||[];return `<div class="check"><div class="grid"><label>Ref<input data-d="ref" value="${esc(x.ref||i+1)}"></label><label>Defect / observation<input data-d="defect" value="${esc(x.defect||'')}"></label><label>Immediate action / isolation<input data-d="action" value="${esc(x.action||'')}"></label><label>Reported to<select data-d="reported">${recipientOptions(x.reported||'')}</select></label><label>Target / completion<input data-d="target" value="${esc(x.target||'')}"></label><label>Closed by<select data-d="closed">${recipientOptions(x.closed||'')}</select></label></div>${photos.length?`<div class="photo-preview">${photos.map((src,n)=>`<img class="photo-thumb" src="${src}" alt="Defect photo ${n+1}">`).join('')}</div>`:''}</div>`}
function addDefect(){current.defects??=[];current.defects.push({ref:current.defects.length+1,defect:'',action:'',reported:'',target:'',closed:'',photos:[]});refreshDefects()}
function setupSig(id,data){
  const c=document.getElementById(id),ctx=c.getContext('2d');
  // Keep a real drawing buffer rather than relying only on CSS dimensions.
  const cssW=Math.max(300,Math.floor(c.getBoundingClientRect().width||900)), cssH=150, dpr=Math.max(1,window.devicePixelRatio||1);
  c.width=cssW*dpr; c.height=cssH*dpr; c.style.height=cssH+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.lineWidth=2; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#111';
  let drawing=false,last;
  function pos(e){const r=c.getBoundingClientRect();const t=e.touches?.[0]||e;return{x:(t.clientX-r.left),y:(t.clientY-r.top)}}
  if(data){const img=new Image();img.onload=()=>{ctx.clearRect(0,0,cssW,cssH);ctx.drawImage(img,0,0,cssW,cssH)};img.src=data}
  const start=e=>{drawing=true;last=pos(e);e.preventDefault()};
  const move=e=>{if(!drawing)return;const p=pos(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;e.preventDefault()};
  const end=()=>{drawing=false};
  c.onmousedown=start;c.onmousemove=move;c.onmouseup=end;c.onmouseleave=end;c.ontouchstart=start;c.ontouchmove=move;c.ontouchend=end;
}
function captureSignature(id){
  const c=document.getElementById(id); if(!c)return '';
  try{
    const ctx=c.getContext('2d'); const px=ctx.getImageData(0,0,c.width,c.height).data; let ink=false;
    for(let i=0;i<px.length;i+=16){ if(px[i]<245||px[i+1]<245||px[i+2]<245){ink=true;break} }
    return ink?c.toDataURL('image/png'):'';
  }catch(e){return '';}
}
function clearSig(id){const c=document.getElementById(id);c.getContext('2d').clearRect(0,0,c.width,c.height);if(id==='opsig')current.operatorSig='';else current.supervisorSig=''}
async function saveInspection(){const d=current;const statusEl=document.getElementById('status');const selectedStatus=val('status');if(!selectedStatus){toast('Please select the plant status before saving the inspection');statusEl?.focus();return}d.date=val('date')||dateNow();d.time=val('time')||timeNow();d.details={site:val('site'),plantType:state.plants.find(x=>x.id===d.plantId).type,make:val('make'),fleet:state.plants.find(x=>x.id===d.plantId).name,operator:val('opname'),supervisor:val('supname'),hours:document.getElementById('hours')?.value||''};d.checkPhotos??={};d.comments??={};document.querySelectorAll('[data-comment]').forEach(t=>d.comments[t.dataset.comment]=t.value);syncDefectsFromChecks();d.defects=[...document.querySelectorAll('#defects .check')].map((el,i)=>{const old=current.defects[i]||{};const o={...old};el.querySelectorAll('[data-d]').forEach(x=>o[x.dataset.d]=x.value);o.photos=old.photos||[];return o});d.status=selectedStatus;d.operatorSig=document.getElementById('opsig')?.toDataURL('image/png')||d.operatorSig||'';d.supervisorSig=document.getElementById('supsig')?.toDataURL('image/png')||d.supervisorSig||'';d.repair={released:val('released'),time:val('releasedtime'),status:val('repairstatus')};const idx=state.inspections.findIndex(x=>x.id===d.id);if(idx>=0)state.inspections[idx]=d;else state.inspections.push(d);saveLocal();if(centralEnabled){try{await syncStateToCloud()}catch(e){console.warn('Cloud sync failed',e)}}toast('Inspection saved');setTimeout(home,500)}
function saveAndNew(){saveInspection()}
function editInspection(id){const d=state.inspections.find(x=>x.id===id);renderForm(JSON.parse(JSON.stringify(d)))}
function plantHistory(pid){const p=state.plants.find(x=>x.id===pid);const ins=state.inspections.filter(x=>x.plantId===pid).sort((a,b)=>b.date.localeCompare(a.date));document.getElementById('app').innerHTML=`<div class="nav"><button onclick="home()">← Dashboard</button></div><div class="card"><h2>${esc(p.name)} — History</h2><div class="actions"><button class="primary" onclick="newInspection('${pid}')">Today's check</button><button onclick="weeklyReport('${pid}')">Report</button></div>${ins.length?ins.map(i=>`<div class="dayrow"><div><strong>${esc(i.date)}</strong><div class="mini">${esc(i.details.operator||'')} • ${esc(i.details.site||'')}</div></div><div><span class="pill ${statusClass(i.status)}">${esc(i.status||'Incomplete')}</span>${repairBadgeHTML(i.repair?.status)} <button onclick="editInspection('${i.id}')">View</button></div></div>`).join(''):'<p class="muted">No completed inspections.</p>'}</div>`}
function recipients(){document.getElementById('app').innerHTML=`<div class="nav"><button onclick="home()">← Dashboard</button></div><div class="card"><h2>Email recipients</h2><p class="muted">Select one or more recipients when sending a report. You can also add a new address.</p><div id="recips" class="email-grid">${state.recipients.map((r,i)=>`<div class="recipient"><label><input type="checkbox" data-r="${i}"> ${esc(r[0])}</label><div class="mini">${esc(r[1])}</div></div>`).join('')}</div><hr><h3>Add new email</h3><div class="grid"><label>Name<input id="rname"></label><label>Email<input id="remail" type="email"></label></div><button style="margin-top:10px" onclick="addRecipient()">Add recipient</button></div>`}
function addRecipient(){const n=val('rname'),e=val('remail');if(!n||!e||!e.includes('@')){toast('Enter a name and valid email');return}state.recipients.push([n,e]);save();toast('Recipient added');recipients()}
function weeklyReport(pid){const plants=pid?[state.plants.find(x=>x.id===pid)]:state.plants;const sites=[...new Set(plants.filter(Boolean).map(p=>p.site).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));document.getElementById('app').innerHTML=`<div class="nav no-print"><button onclick="home()">← Dashboard</button></div><div class="card no-print"><h2>Create report</h2><div class="grid"><label>Plant list<select id="wrlist"><option value="">All plant</option><option value="DGS Plant">DGS Plant</option><option value="Hired Plant">Hired Plant</option></select></label><label>Site<select id="wrsite"><option value="">All sites</option>${sites.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label><label>Defects reported<select id="wrdefects"><option value="">All inspections</option><option value="yes">Defects reported</option><option value="no">No defects reported</option><option value="repair-outstanding">Repair Outstanding</option><option value="repair-complete">Repair Complete</option></select></label><label>Plant<select id="wrplant"><option value="">All plants</option>${plants.filter(Boolean).map(p=>`<option value="${p.id}">${esc(p.list||'DGS Plant')} — ${esc(p.name)}</option>`).join('')}</select></label><label>From<input id="wrfrom" type="date" value="${new Date(Date.now()-6*864e5).toISOString().slice(0,10)}"></label><label>To<input id="wrto" type="date" value="${dateNow()}"></label></div><div class="actions" style="margin-top:10px"><button class="primary" onclick="buildReport()">Generate report</button></div></div><div class="card no-print"><h3>Email recipients</h3><div id="reportRecipients" class="email-grid">${state.recipients.map((r,i)=>`<div class="recipient"><label><input type="checkbox" data-report-r="${i}"> ${esc(r[0])}</label><div class="mini">${esc(r[1])}</div></div>`).join('')}</div><button style="margin-top:10px" onclick="selectAllReportRecipients(true)">Select all</button> <button style="margin-top:10px" onclick="selectAllReportRecipients(false)">Clear all</button></div><div id="reportOut"></div>`;if(pid){const p=state.plants.find(x=>x.id===pid);if(p){document.getElementById('wrlist').value=p.list||'DGS Plant';document.getElementById('wrsite').value=p.site||'';document.getElementById('wrplant').value=p.id;}}}
function buildReport(){const pid=val('wrplant'),list=val('wrlist'),site=val('wrsite'),defFilter=val('wrdefects'),from=val('wrfrom'),to=val('wrto');const rows=state.inspections.filter(i=>{const p=state.plants.find(x=>x.id===i.plantId);if(!p)return false;const hasDef=Array.isArray(i.defects)&&i.defects.length>0;const repairStatus=i.repair?.status||'';const defectMatch=!defFilter||(defFilter==='yes'?hasDef:defFilter==='no'?!hasDef:defFilter==='repair-outstanding'?repairStatus==='Repair outstanding':defFilter==='repair-complete'?repairStatus==='Repair Complete':true);return (!pid||i.plantId===pid)&&(!list||(p.list||'DGS Plant')===list)&&(!site||String(p.site||'')===site)&&defectMatch&&i.date>=from&&i.date<=to}).sort((a,b)=>a.date.localeCompare(b.date));const groups={};rows.forEach(i=>(groups[i.plantId]??=[]).push(i));let html='<div class="report"><h1>DGS PUWER Plant Inspection Report</h1><p><strong>Period:</strong> '+esc(from)+' to '+esc(to)+'</p><p><strong>Filters:</strong> '+esc(list||'All plant')+' • '+esc(site||'All sites')+' • '+esc(defFilter==='yes'?'Defects reported':defFilter==='no'?'No defects reported':'All inspections')+'</p>';if(!rows.length)html+='<p>No completed inspections found for the selected filters and period.</p>';for(const [pId,arr] of Object.entries(groups)){const p=state.plants.find(x=>x.id===pId);html+=`<div class="pagebreak"><h2>${esc(p.name)}</h2><p>${esc(p.type)} • ${esc(p.list||'DGS Plant')} • ${esc(p.site||'')}</p>`;arr.forEach((d,idx)=>{html+=`<h3>${esc(d.date)} — ${esc(d.status||'Incomplete')}</h3><table><tr><th style="width:7%">No.</th><th>Check item</th><th style="width:10%">Result</th><th>Comments / defect</th></tr>`;UNIVERSAL.forEach((q,i)=>html+=`<tr><td>${i+1}</td><td>${esc(q)}</td><td>${esc(d.checks[i]||'')}</td><td>${esc(d.comments['u'+i]||'')}</td></tr>`);html+=`<tr><td>P</td><td>${esc(SPEC[p.type]||'Plant-specific check')}</td><td>${esc(d.spec||'')}</td><td>${esc(d.comments.spec||'')}</td></tr></table>`;if(d.defects?.length){html+='<h4>Defects / corrective action</h4><table><tr><th>Ref</th><th>Defect</th><th>Immediate action</th><th>Reported to</th><th>Target</th><th>Closed by</th></tr>';d.defects.forEach(x=>html+=`<tr><td>${esc(x.ref)}</td><td>${esc(x.defect)}</td><td>${esc(x.action)}</td><td>${esc(x.reported)}</td><td>${esc(x.target)}</td><td>${esc(x.closed)}</td></tr>`);html+='</table>';const photoItems=d.defects.flatMap(x=>x.photos||[]);if(photoItems.length){html+='<h4>Defect photographs</h4><div class="photo-preview">'+photoItems.map(src=>`<img class="photo-thumb" src="${src}" alt="Defect photograph">`).join('')+'</div>'}}html+=`<div class="declarations"><h4>Operator declaration</h4><p><strong>Name:</strong> ${esc(d.details.operator||'')}</p><p><strong>Signature:</strong><br>${d.operatorSig&&d.operatorSig.startsWith('data:image')?`<img class="report-signature" src="${d.operatorSig}" alt="Operator signature">`:'<span class="signature-line">No signature captured</span>'}</p><h4>Supervisor / authorised person</h4><p><strong>Name:</strong> ${esc(d.details.supervisor||'')}</p><p><strong>Signature:</strong><br>${d.supervisorSig&&d.supervisorSig.startsWith('data:image')?`<img class="report-signature" src="${d.supervisorSig}" alt="Supervisor signature">`:'<span class="signature-line">No signature captured</span>'}</p></div>`;});html+='</div>'}html+='<div class="no-print" style="margin-top:20px"><button class="primary" onclick="printReport()">Print / Save as PDF</button> <button onclick="emailReport()">Email selected recipients</button></div></div>';document.getElementById('reportOut').innerHTML=html;window.reportRows=rows}

function printReport(){
  const imgs=[...document.querySelectorAll('.report img')];
  const pending=imgs.filter(img=>!img.complete);
  if(!pending.length){window.print();return;}
  let left=pending.length;
  const done=()=>{left--;if(left<=0)window.print()};
  pending.forEach(img=>{img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});});
  setTimeout(()=>window.print(),1000);
}
function selectAllReportRecipients(on){document.querySelectorAll('[data-report-r]').forEach(x=>x.checked=on)}
async function waitForReportImages(root, timeout=5000){
  const imgs=[...root.querySelectorAll('img')];
  if(!imgs.length)return;
  await Promise.all(imgs.map(img=>new Promise(resolve=>{
    if(img.complete){resolve();return}
    const done=()=>{img.removeEventListener('load',done);img.removeEventListener('error',done);resolve()};
    img.addEventListener('load',done);img.addEventListener('error',done);
    setTimeout(done,timeout);
  })));
  for(const img of imgs){try{if(img.decode)await img.decode()}catch(e){}}
}
function pdfEscape(s){return String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
function base64ToBytes(dataUrl){const b64=dataUrl.split(',')[1]||'';const bin=atob(b64);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function makePdfFromJpegs(jpegs){
  const objects=[]; const add=o=>{objects.push(o);return objects.length};
  const catalog=add(''); const pages=add(''); const pageRefs=[];
  const imgRefs=[];
  jpegs.forEach((j,idx)=>{
    const img=base64ToBytes(j.data);
    const imgObj=`<< /Type /XObject /Subtype /Image /Width ${j.w} /Height ${j.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`;
    imgRefs.push(add({header:imgObj,stream:img}));
  });
  jpegs.forEach((j,idx)=>{
    const imgRef=imgRefs[idx];
    const content=`q\n${595/j.w} 0 0 ${842/j.h} 0 0 cm\n/Im${idx+1} Do\nQ\n`;
    const contentRef=add(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
    pageRefs.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im${idx+1} ${imgRef} 0 R >> >> /Contents ${contentRef} 0 R >>`));
  });
  objects[catalog-1]=`<< /Type /Catalog /Pages ${pages} 0 R >>`;
  objects[pages-1]=`<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map(x=>x+' 0 R').join(' ')}] >>`;
  let out='%PDF-1.4\n%\\xFF\\xFF\\xFF\\xFF\n'; const offsets=[0];
  for(let i=0;i<objects.length;i++){
    offsets[i+1]=out.length; out+=`${i+1} 0 obj\n`;
    const o=objects[i]; if(typeof o==='string')out+=o+'\nendobj\n'; else {out+=o.header; for(let k=0;k<o.stream.length;k++)out+=String.fromCharCode(o.stream[k]); out+='\nendstream\nendobj\n';}
  }
  const xref=out.length; out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`; for(let i=1;i<offsets.length;i++)out+=String(offsets[i]).padStart(10,'0')+' 00000 n \n'; out+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes=new Uint8Array(out.length); for(let i=0;i<out.length;i++)bytes[i]=out.charCodeAt(i)&255; return new Blob([bytes],{type:'application/pdf'});
}
async function reportToPdfBlob(report){
  const clone=report.cloneNode(true); clone.querySelectorAll('.no-print').forEach(el=>el.remove());
  const holder=document.createElement('div'); holder.style.position='absolute'; holder.style.left='0'; holder.style.top='0'; holder.style.width='794px'; holder.style.background='#fff'; holder.style.zIndex='-1';
  clone.style.width='794px'; clone.style.maxWidth='794px'; clone.style.margin='0'; clone.style.padding='28px';
  const style=document.createElement('style');
  style.textContent=[...document.styleSheets].map(ss=>{try{return [...ss.cssRules].map(r=>r.cssText).join('')}catch(e){return ''}}).join('');
  clone.prepend(style); holder.appendChild(clone); document.body.appendChild(holder);
  await waitForReportImages(clone,8000); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const fullH=Math.ceil(clone.scrollHeight||clone.getBoundingClientRect().height); const pageH=1123; const jpegs=[];
  for(let y=0;y<fullH;y+=pageH){
    const h=Math.min(pageH,fullH-y); const html=clone.outerHTML.replace('<style>','<style>body{margin:0;background:#fff}');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="794" height="${h}"><foreignObject width="794" height="${fullH}" transform="translate(0,${-y})"><div xmlns="http://www.w3.org/1999/xhtml">${html}</div></foreignObject></svg>`;
    const img=new Image(); img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;});
    const c=document.createElement('canvas'); c.width=794*1.5; c.height=h*1.5; const ctx=c.getContext('2d'); ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
    jpegs.push({data:c.toDataURL('image/jpeg',.92),w:c.width,h:c.height});
  }
  holder.remove(); return makePdfFromJpegs(jpegs);
}
async function emailReport(){
  const checks=[...document.querySelectorAll('[data-report-r]:checked')]; const ids=checks.map(x=>state.recipients[Number(x.dataset.reportR)]?.[1]).filter(Boolean);
  if(!ids.length){toast('Select at least one recipient');return}
  if(!document.querySelector('#reportOut .report')) buildReport();
  const report=document.querySelector('#reportOut .report'); if(!report){toast('Could not build the report');return}
  const from=val('wrfrom'),to=val('wrto'); const subject='DGS PUWER Plant Inspection Report'; const safeDate=(from===to?from:`${from} to ${to}`).replace(/[^0-9A-Za-z-]+/g,'_'); const filename=`DGS-PUWER-Inspection-Report-${safeDate}.pdf`;
  try{
    toast('Creating PDF with signatures…'); const blob=await reportToPdfBlob(report); const file=new File([blob],filename,{type:'application/pdf'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:subject,text:`${ids.join(', ')}\n\nPlease find the completed DGS PUWER plant inspection report for ${from} to ${to}.`}); toast('PDF attached — choose your email app to send it');
    }else{
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
      window.location.href=`mailto:${ids.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent('Please find the completed DGS PUWER plant inspection report attached.')}`; toast('PDF created. It has been downloaded and email opened as a fallback.');
    }
  }catch(e){console.error('emailReport failed',e);toast('Could not create the PDF: '+(e?.message||'browser does not support PDF sharing'))}
}
// Explicitly expose app actions for GitHub Pages / Android webviews.
// Some embedded browsers do not resolve inline onclick handlers to lexical globals reliably.
Object.assign(window,{home,appHome,newPlant,savePlant,newInspection,renderForm,setCheck,addCheckPhotos,compressPhoto,addDefect,clearSig,captureSignature,saveInspection,saveAndNew,editInspection,plantHistory,recipients,addRecipient,weeklyReport,buildReport,selectAllReportRecipients,emailReport,printReport,populateDashboardFilters,clearDashboardFilters,renderDashboard,repairStatusClass});

document.addEventListener('click',function(e){
  const b=e.target.closest('button');
  if(!b) return;
  // Give dynamically-created inspection buttons a direct fallback.
  const m=b.getAttribute('onclick')||'';
  if(m.includes('newInspection(')){
    const match=m.match(/newInspection\('([^']+)'\)/);
    if(match){ e.preventDefault(); window.newInspection(match[1]); }
  }
});
// service worker
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
// Automatically refresh shared data when the app opens and when the user returns to it.
window.addEventListener('pageshow',()=>autoRefreshSharedData());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')autoRefreshSharedData()});
refreshOnOpen();
