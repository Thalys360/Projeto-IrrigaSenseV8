const CULTURES=[
{name:"Alface",min:70,max:85},{name:"Tomate",min:60,max:80},{name:"Cebola",min:70,max:85},{name:"Cebolinha",min:70,max:85},{name:"Coentro",min:65,max:80},{name:"Cenoura",min:65,max:85},{name:"Batata",min:65,max:80},{name:"Batata-doce",min:40,max:70},{name:"Pimentão",min:70,max:85},{name:"Pimenta",min:55,max:75},{name:"Abóbora",min:60,max:80},{name:"Abobrinha",min:50,max:75},{name:"Couve",min:55,max:80},{name:"Beterraba",min:50,max:75},{name:"Alho",min:70,max:85},{name:"Feijão",min:55,max:80},{name:"Milho",min:45,max:75},{name:"Trigo",min:45,max:75},{name:"Mandioca",min:45,max:70},{name:"Arroz",min:75,max:90},{name:"Soja",min:50,max:75},{name:"Outra / Personalizada",min:null,max:null,custom:true}
];
const DEFAULT_STATE={
zones:[
{name:"Tomate",culture:"Tomate",min:60,max:80,humidity:67,pump:false,night:{enabled:true,start:"20:00",end:"05:30",critical:48,maxSeconds:15,intervalMinutes:120}},
{name:"Feijão",culture:"Feijão",min:55,max:80,humidity:54,pump:true,night:{enabled:true,start:"20:00",end:"05:30",critical:43,maxSeconds:15,intervalMinutes:120}}
],
history:[
{time:"14:32",date:"13/08/2026",zone:"Zona 2 — Feijão",text:"Irrigação automática iniciada",tag:"Automático"},
{time:"14:20",date:"13/08/2026",zone:"Zona 1 — Tomate",text:"Umidade atualizada para 67%",tag:"Leitura"},
{time:"14:05",date:"13/08/2026",zone:"Sistema",text:"ESP-01 conectado ao Wi-Fi",tag:"Conectividade"}
],
profiles:[{id:1,name:"Horta Escolar",zones:[{name:"Alface",culture:"Alface",min:70,max:85},{name:"Coentro",culture:"Coentro",min:65,max:80}]}],
calibration:{sensor1:{dry:"",wet:""},sensor2:{dry:"",wet:""}},
security:{},
flowRates:{pump1:0.60,pump2:0.60},
waterUsage:{zone1Seconds:75,zone2Seconds:110},
teamPhotos:{thalys:"",mary:"",eduarda:"",eriberto:"",rayanna:"",pedro:""},
gallery:[]
};
const timers={1:null,2:null};
let remaining={1:0,2:0};
let manualUnlocked=false;
let manualLockTimer=null;
let adminUnlocked=false;
let firebaseReady=false;
let firebaseOnline=false;
let currentAdminUser=null;
const commandUnsubscribers={1:null,2:null};
function clone(x){return JSON.parse(JSON.stringify(x))}
function loadState(){try{const raw=localStorage.getItem("irrigasense2_site_state");if(!raw)return clone(DEFAULT_STATE);const s=JSON.parse(raw);return {...clone(DEFAULT_STATE),...s,zones:s.zones||clone(DEFAULT_STATE.zones),history:s.history||clone(DEFAULT_STATE.history),profiles:s.profiles||clone(DEFAULT_STATE.profiles),calibration:s.calibration||clone(DEFAULT_STATE.calibration),security:{},flowRates:{...clone(DEFAULT_STATE.flowRates),...(s.flowRates||{})},waterUsage:{...clone(DEFAULT_STATE.waterUsage),...(s.waterUsage||{})},teamPhotos:{...clone(DEFAULT_STATE.teamPhotos),...(s.teamPhotos||{})},gallery:s.gallery||[]}}catch(e){return clone(DEFAULT_STATE)}}
let state=loadState();function saveState(){localStorage.setItem("irrigasense2_site_state",JSON.stringify(state))}
function toast(msg){const e=document.getElementById("toast");e.textContent=msg;e.classList.add("show");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("show"),2500)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
const sidebar=document.getElementById("sidebar"),overlay=document.getElementById("overlay");
function openMenu(){sidebar.classList.add("open");overlay.classList.add("open");document.body.style.overflow="hidden"}
function closeMenu(){sidebar.classList.remove("open");overlay.classList.remove("open");document.body.style.overflow=""}
document.getElementById("openMenu").addEventListener("click",openMenu);document.getElementById("closeMenu").addEventListener("click",closeMenu);overlay.addEventListener("click",closeMenu);
function navigate(view){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));const t=document.getElementById("view-"+view);if(t)t.classList.add("active");document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));const a=document.querySelector(`.nav-item[data-view="${view}"] em`);document.getElementById("pageTitle").textContent=a?a.textContent:"IrrigaSense";closeMenu();window.scrollTo({top:0,behavior:"smooth"});if(view==="historico")renderHistory();if(view==="graficos")setTimeout(drawChart,80);if(view==="perfis")renderProfiles();if(view==="galeria")renderGallery();if(view==="admin")renderAdminGallery()}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));document.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.jump)));
document.getElementById("themeToggle").addEventListener("click",()=>{document.body.classList.toggle("dark");localStorage.setItem("irrigasense2_theme",document.body.classList.contains("dark")?"dark":"light");drawChart()});if(localStorage.getItem("irrigasense2_theme")==="dark")document.body.classList.add("dark");


function firebaseApi(){return window.IrrigaFirebase||null}

function zoneConfigPayload(z){
  const zone=state.zones[z-1];
  return {
    nome:zone.name,
    cultura:zone.culture,
    minimo:Number(zone.min),
    maximo:Number(zone.max),
    ativa:true,
    protecaoNoturna:{
      ativa:!!zone.night.enabled,
      inicio:zone.night.start,
      fim:zone.night.end,
      limiteCritico:Number(zone.night.critical),
      maxSegundos:Number(zone.night.maxSeconds),
      intervaloMinutos:Number(zone.night.intervalMinutes)
    }
  };
}

function setFirebaseUi(online){
  firebaseOnline=online;
  const dot=document.getElementById("firebaseStatusDot");
  const text=document.getElementById("firebaseStatusText");
  if(dot)dot.className=`status-dot ${online?"online":"warning"}`;
  if(text)text.textContent=online?"Conectado":"Offline";
  const side=document.getElementById("sidebarSystemMode");
  if(side)side.textContent=online?"Firebase conectado":"Firebase offline";
  const connectText=document.getElementById("connectFirebaseText");
  if(connectText)connectText.textContent=online?"Conectado":"Offline";
}

function applyRemoteZone(z,data){
  if(!data)return;
  const zone=state.zones[z-1];
  const cfg=data.config||{};
  const tel=data.telemetry||{};
  zone.name=cfg.nome??zone.name;
  zone.culture=cfg.cultura??zone.culture;
  zone.min=Number(cfg.minimo??zone.min);
  zone.max=Number(cfg.maximo??zone.max);
  if(cfg.protecaoNoturna){
    zone.night={
      enabled:cfg.protecaoNoturna.ativa??zone.night.enabled,
      start:cfg.protecaoNoturna.inicio??zone.night.start,
      end:cfg.protecaoNoturna.fim??zone.night.end,
      critical:Number(cfg.protecaoNoturna.limiteCritico??zone.night.critical),
      maxSeconds:Number(cfg.protecaoNoturna.maxSegundos??zone.night.maxSeconds),
      intervalMinutes:Number(cfg.protecaoNoturna.intervaloMinutos??zone.night.intervalMinutes)
    };
  }
  if(tel.umidade!==undefined)zone.humidity=Number(tel.umidade);
  if(tel.bomba!==undefined)zone.pump=!!tel.bomba;
  saveState();
  renderDashboard();
  if(document.activeElement?.closest?.(".zone-form")==null)syncForms();
  drawChart();
}

function applySystemRemote(data){
  if(!data)return;
  const tel=data.telemetry||{};
  const esp=!!tel.espOnline;
  const arduino=!!tel.arduinoOnline;
  const wifi=!!tel.wifiOnline;
  const last=tel.ultimaComunicacao||tel.lastSeen||null;

  const espEl=document.getElementById("espStatusSummary");
  if(espEl)espEl.textContent=esp?"Online":"Offline";

  const wifiText=document.getElementById("wifiStatusText");
  const wifiDot=document.getElementById("wifiStatusDot");
  if(wifiText)wifiText.textContent=wifi?"Conectado":"Offline";
  if(wifiDot)wifiDot.className=`status-dot ${wifi?"online":"warning"}`;

  const ardText=document.getElementById("arduinoStatusText");
  const ardDot=document.getElementById("arduinoStatusDot");
  if(ardText)ardText.textContent=arduino?"Operando":"Offline";
  if(ardDot)ardDot.className=`status-dot ${arduino?"online":"warning"}`;

  const pill=document.getElementById("topSystemPill");
  if(pill){
    const ok=esp&&arduino;
    pill.className=`pill ${ok?"online":"warning"}`;
    pill.innerHTML=`<i></i>${ok?"Sistema online":"Aguardando dispositivo"}`;
  }

  const lastEl=document.getElementById("lastCommunication");
  if(lastEl&&last){
    const d=new Date(Number(last));
    if(!Number.isNaN(d.getTime()))lastEl.textContent=d.toLocaleString("pt-BR");
  }
}

function applyRemoteHistory(obj){
  const entries=Object.values(obj||{}).sort((a,b)=>(b.timestampCliente||0)-(a.timestampCliente||0));
  if(!entries.length)return;
  state.history=entries.slice(0,100).map(x=>({
    time:x.hora||"",
    date:x.data||"",
    zone:x.zona||"Sistema",
    text:x.mensagem||"",
    tag:x.tipo||"Evento"
  }));
  saveState();
  renderHistory();
}

function applyRemoteTeamPhotos(obj){
  const next={thalys:"",mary:"",eduarda:"",eriberto:"",rayanna:"",pedro:""};
  if(obj&&typeof obj==="object"){
    Object.keys(next).forEach(id=>{
      const value=obj[id];
      if(typeof value==="string")next[id]=value;
      else if(value&&typeof value.dataUrl==="string")next[id]=value.dataUrl;
    });
  }
  state.teamPhotos=next;
  saveState();
  applyTeamPhotos();
  if(currentAdminUser)renderTeamPhotoManager();
}

function normalizeRemoteGallery(value){
  const raw=Array.isArray(value)
    ? value.filter(Boolean)
    : (value&&typeof value==="object" ? Object.values(value) : []);
  return raw
    .filter(item=>item&&item.src)
    .map((item,index)=>({
      id:Number(item.id)||Date.now()+index,
      src:String(item.src||""),
      title:String(item.title||"Foto do IrrigaSense"),
      caption:String(item.caption||""),
      date:String(item.date||""),
      featured:!!item.featured,
      order:Number.isFinite(Number(item.order))?Number(item.order):index
    }))
    .sort((a,b)=>a.order-b.order);
}

function applyRemoteGallery(value){
  state.gallery=normalizeRemoteGallery(value);
  saveState();
  renderGallery();
  if(currentAdminUser)renderAdminGallery();
}

async function initializeFirebaseSite(){
  const fb=firebaseApi();if(!fb)return;
  firebaseReady=true;
  fb.listenConnection(setFirebaseUi);
  fb.listenZone(1,data=>applyRemoteZone(1,data));
  fb.listenZone(2,data=>applyRemoteZone(2,data));
  fb.listenSystem(applySystemRemote);
  fb.listenHistory(applyRemoteHistory);
  fb.listenTeamPhotos(applyRemoteTeamPhotos);
  fb.listenGallery(applyRemoteGallery);
  fb.listenAuth(async user=>{
    currentAdminUser=(user&&fb.isAdminUser(user))?user:null;
    adminUnlocked=!!currentAdminUser;
    updateAdminUiFromAuth();
    if(currentAdminUser){
      try{
        await fb.ensureAdminSetup({
          zones:[zoneConfigPayload(1),zoneConfigPayload(2)],
          calibration:state.calibration,
          flowRates:state.flowRates
        });
      }catch(e){console.error("Setup Firebase:",e)}
    }
  });
}

window.addEventListener("irrigasense-firebase-ready",initializeFirebaseSite);
if(window.IrrigaFirebase)initializeFirebaseSite();

function updateAdminUiFromAuth(){
  const lock=document.getElementById("adminLockPanel");
  const panel=document.getElementById("adminPanel");
  const pill=document.getElementById("adminLockPill");
  if(!lock||!panel||!pill)return;
  if(currentAdminUser){
    lock.classList.add("hidden");
    panel.classList.remove("hidden");
    pill.textContent="🔓 Administrador Firebase";
    pill.className="pill success";
    const info=document.getElementById("adminAccountInfo");
    if(info)info.textContent=`Conta autenticada: ${currentAdminUser.email||"administrador"}`;
    renderAdminGallery();renderTeamPhotoManager();syncFlowRates();
  }else{
    lock.classList.remove("hidden");
    panel.classList.add("hidden");
    pill.textContent="🔒 Bloqueado";
    pill.className="pill warning";
  }
}

async function saveHistoryFirebase(zone,text,tag){
  const fb=firebaseApi();
  if(!fb||!currentAdminUser)return;
  try{
    const d=new Date();
    await fb.addHistory({
      data:d.toLocaleDateString("pt-BR"),
      hora:d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),
      zona:zone,mensagem:text,tipo:tag
    });
  }catch(e){console.error("Histórico Firebase:",e)}
}


function fillCultureOptions(){[1,2].forEach(z=>{const s=document.getElementById("culture"+z);s.innerHTML="";CULTURES.forEach(c=>{const o=document.createElement("option");o.value=c.name;o.textContent=c.custom?`${c.name} — definir manualmente`:`${c.name} — ${c.min}% a ${c.max}%`;s.appendChild(o)});s.addEventListener("change",()=>applyCulture(z))})}
function applyCulture(z){const c=CULTURES.find(x=>x.name===document.getElementById("culture"+z).value);document.getElementById("customWrap"+z).classList.toggle("hidden",!c.custom);if(!c.custom){document.getElementById("zoneName"+z).value=c.name;document.getElementById("min"+z).value=c.min;document.getElementById("max"+z).value=c.max;document.getElementById("rangePreview"+z).textContent=`Preset: ${c.min}% a ${c.max}%`}else{document.getElementById("min"+z).value="";document.getElementById("max"+z).value="";document.getElementById("rangePreview"+z).textContent="Defina manualmente os limites."}}
function syncForms(){[1,2].forEach(z=>{const zone=state.zones[z-1];document.getElementById("zoneName"+z).value=zone.name;document.getElementById("culture"+z).value=zone.culture;document.getElementById("min"+z).value=zone.min;document.getElementById("max"+z).value=zone.max;document.getElementById("rangePreview"+z).textContent=`Faixa atual: ${zone.min}% a ${zone.max}%`;const custom=zone.culture==="Outra / Personalizada";document.getElementById("customWrap"+z).classList.toggle("hidden",!custom);document.getElementById("customCrop"+z).value=custom?zone.name:"";document.getElementById("nightEnabled"+z).checked=zone.night.enabled;document.getElementById("nightStart"+z).value=zone.night.start;document.getElementById("nightEnd"+z).value=zone.night.end;document.getElementById("critical"+z).value=zone.night.critical;document.getElementById("nightMax"+z).value=zone.night.maxSeconds;document.getElementById("nightInterval"+z).value=zone.night.intervalMinutes})}
document.querySelectorAll(".zone-form").forEach(form=>form.addEventListener("submit",e=>{e.preventDefault();const z=Number(form.dataset.zone),i=z-1,culture=document.getElementById("culture"+z).value;let name=document.getElementById("zoneName"+z).value.trim();if(culture==="Outra / Personalizada"){const c=document.getElementById("customCrop"+z).value.trim();if(c)name=c}const min=Number(document.getElementById("min"+z).value),max=Number(document.getElementById("max"+z).value);if(!name)return toast("Digite o nome da zona.");if(!Number.isFinite(min)||!Number.isFinite(max)||min<0||max>100||min>=max)return toast("Configuração inválida: mínimo deve ser menor que máximo.");const critical=Number(document.getElementById("critical"+z).value),maxSeconds=Number(document.getElementById("nightMax"+z).value),intervalMinutes=Number(document.getElementById("nightInterval"+z).value);if(critical<0||critical>100||maxSeconds<5||maxSeconds>120||intervalMinutes<10)return toast("Revise a proteção noturna.");state.zones[i]={...state.zones[i],name,culture,min,max,night:{enabled:document.getElementById("nightEnabled"+z).checked,start:document.getElementById("nightStart"+z).value||"20:00",end:document.getElementById("nightEnd"+z).value||"05:30",critical,maxSeconds,intervalMinutes}};addHistory(`Zona ${z} — ${name}`,"Configuração atualizada","Configuração");
saveState();syncForms();renderDashboard();
const fb=firebaseApi();
if(!fb||!currentAdminUser)return toast("Entre no Painel do Administrador para salvar no Firebase.");
fb.saveZoneConfig(z,zoneConfigPayload(z))
  .then(()=>toast(`Zona ${z} salva no Firebase.`))
  .catch(err=>{console.error(err);toast("Falha ao salvar a zona no Firebase.");});
}));

function soilStatus(z){if(z.humidity<z.min)return"Abaixo do ideal";if(z.humidity>z.max)return"Acima do ideal";return"Adequado"}
function renderDashboard(){state.zones.forEach((zone,i)=>{const z=i+1,p=Math.max(0,Math.min(100,Number(zone.humidity)||0));document.getElementById("dashName"+z).textContent=zone.name;document.getElementById("dashCrop"+z).textContent=zone.culture;document.getElementById("dashHum"+z).textContent=p+"%";document.getElementById("dashRange"+z).textContent=`${zone.min}%–${zone.max}%`;document.getElementById("soilStatus"+z).textContent=soilStatus(zone);document.getElementById("meter"+z).style.width=p+"%";document.getElementById("ring"+z).style.background=`conic-gradient(var(--green) 0 ${p}%,var(--surface2) ${p}% 100%)`;const b=document.getElementById("pumpBadge"+z);b.textContent=zone.pump?"Bomba ligada":"Bomba desligada";b.className=`pump-badge ${zone.pump?"on":"off"}`;document.getElementById("manualName"+z).textContent=zone.name;document.getElementById("manualHum"+z).textContent=p+"%";const mb=document.getElementById("manualPumpBadge"+z);mb.textContent=zone.pump?"Ligada":"Desligada";mb.className=`pump-badge ${zone.pump?"on":"off"}`;document.getElementById("heroZone"+z).textContent=zone.name;document.getElementById("heroHum"+z).textContent=p+"% de umidade";document.getElementById("legendName"+z).textContent=zone.name});document.getElementById("avgHumidity").textContent=Math.round((state.zones[0].humidity+state.zones[1].humidity)/2)+"%";document.getElementById("activePumps").textContent=state.zones.filter(z=>z.pump).length+"/2";if(document.getElementById("chartTitle1")){document.getElementById("chartTitle1").textContent=state.zones[0].name;document.getElementById("chartTitle2").textContent=state.zones[1].name}}

async function unlockManual(){
  const input=document.getElementById("manualPassword"),err=document.getElementById("manualError");
  const fb=firebaseApi();
  if(!fb||!currentAdminUser){
    err.textContent="Entre primeiro no Painel do Administrador.";
    return;
  }
  try{
    const expected=await fb.getManualPinHash();
    const received=await fb.sha256(input.value);
    if(received!==expected){err.textContent="PIN/senha do modo manual incorreto.";return}
    err.textContent="";
    manualUnlocked=true;
    document.getElementById("manualLockPanel").classList.add("hidden");
    document.getElementById("manualGrid").classList.remove("locked");
    document.getElementById("lockManual").classList.remove("hidden");
    document.getElementById("manualLockPill").textContent="🔓 Desbloqueado";
    document.getElementById("manualLockPill").className="pill success";
    resetManualLockTimer();
    toast("Modo manual desbloqueado por 5 minutos.");
  }catch(e){
    console.error(e);err.textContent="Não foi possível validar o PIN no Firebase.";
  }
}
function lockManual(){manualUnlocked=false;clearTimeout(manualLockTimer);document.getElementById("manualLockPanel").classList.remove("hidden");document.getElementById("manualGrid").classList.add("locked");document.getElementById("lockManual").classList.add("hidden");document.getElementById("manualLockPill").textContent="🔒 Bloqueado";document.getElementById("manualLockPill").className="pill warning";document.getElementById("manualPassword").value=""}
function resetManualLockTimer(){clearTimeout(manualLockTimer);manualLockTimer=setTimeout(lockManual,5*60*1000)}
document.getElementById("unlockManual").addEventListener("click",unlockManual);document.getElementById("manualPassword").addEventListener("keydown",e=>{if(e.key==="Enter")unlockManual()});document.getElementById("lockManual").addEventListener("click",()=>{lockManual();toast("Modo manual bloqueado.")});
async function startIrrigation(z){
  if(!manualUnlocked)return;
  const fb=firebaseApi();
  if(!fb||!currentAdminUser)return toast("Administrador não autenticado.");
  if(!firebaseOnline)return toast("Firebase offline. Comando não enviado.");
  resetManualLockTimer();
  const d=Number(document.getElementById("manualDuration"+z).value);
  try{
    const id=await fb.sendCommand(z,"IRRIGAR",d);
    addHistory(`Zona ${z} — ${state.zones[z-1].name}`,`Comando de irrigação enviado por ${d} segundos`,"Manual");
    document.getElementById("countdown"+z).textContent="☁️ Comando enviado — aguardando ESP-01";
    if(commandUnsubscribers[z])commandUnsubscribers[z]();
    commandUnsubscribers[z]=fb.listenCommand(id,cmd=>{
      if(!cmd)return;
      const el=document.getElementById("countdown"+z);
      if(cmd.status==="pendente")el.textContent="☁️ Comando pendente — aguardando ESP-01";
      else if(cmd.status==="recebido")el.textContent="📡 ESP-01 recebeu o comando";
      else if(cmd.status==="executando")el.textContent=`💧 Irrigação em execução${cmd.restanteSegundos!==undefined?` — ${cmd.restanteSegundos}s`:""}`;
      else if(cmd.status==="concluido"){
        el.textContent="✅ Irrigação concluída e confirmada";
        if(Number(cmd.duracaoExecutadaSegundos)>0){
          state.waterUsage["zone"+z+"Seconds"]=(state.waterUsage["zone"+z+"Seconds"]||0)+Number(cmd.duracaoExecutadaSegundos);
          saveState();updateWaterMetrics();
        }
        if(commandUnsubscribers[z]){commandUnsubscribers[z]();commandUnsubscribers[z]=null}
      }else if(cmd.status==="erro"){
        el.textContent=`⚠️ Erro: ${cmd.erro||"falha no dispositivo"}`;
      }else if(cmd.status==="cancelado"){
        el.textContent="⛔ Comando cancelado";
      }
    });
  }catch(e){
    console.error(e);toast("Falha ao enviar comando ao Firebase.");
  }
}
function stopIrrigation(z,log=true){
  const wasRunning=!!timers[z];
  let elapsed=0;
  if(wasRunning){
    const selected=Number(document.getElementById("manualDuration"+z).value);
    elapsed=Math.max(0,selected-(remaining[z]||0));
    clearInterval(timers[z]);timers[z]=null;
  }
  if(state.zones[z-1].pump){
    state.zones[z-1].pump=false;
    if(log&&elapsed>0)state.waterUsage["zone"+z+"Seconds"]=(state.waterUsage["zone"+z+"Seconds"]||0)+elapsed;
    if(log)addHistory(`Zona ${z} — ${state.zones[z-1].name}`,"Irrigação manual interrompida","Manual");
  }
  remaining[z]=0;saveState();renderDashboard();updateWaterMetrics();
  const e=document.getElementById("countdown"+z);if(e)e.textContent=log?"Irrigação interrompida":"Pronta para irrigação manual";
}
function updateCountdown(z){document.getElementById("countdown"+z).textContent=`💧 Bomba ligada — ${remaining[z]}s restantes`}
document.querySelectorAll(".start-irrigation").forEach(b=>b.addEventListener("click",()=>startIrrigation(Number(b.dataset.zone))));
document.querySelectorAll(".stop-irrigation").forEach(b=>b.addEventListener("click",async()=>{
  if(!manualUnlocked)return;
  const z=Number(b.dataset.zone),fb=firebaseApi();
  resetManualLockTimer();
  if(!fb||!currentAdminUser)return toast("Administrador não autenticado.");
  try{
    await fb.sendCommand(z,"PARAR",0);
    addHistory(`Zona ${z} — ${state.zones[z-1].name}`,"Comando de parada imediata enviado","Manual");
    document.getElementById("countdown"+z).textContent="⛔ Parada enviada — aguardando confirmação";
  }catch(e){console.error(e);toast("Falha ao enviar parada.");}
}));

function addHistory(zone,text,tag){
  const d=new Date();
  state.history.unshift({time:d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),date:d.toLocaleDateString("pt-BR"),zone,text,tag});
  state.history=state.history.slice(0,100);
  saveHistoryFirebase(zone,text,tag);
}
function renderHistory(){const l=document.getElementById("historyList");if(!state.history.length){l.innerHTML='<div class="notice info">Nenhum registro.</div>';return}l.innerHTML=state.history.map(i=>`<article class="history-item"><div class="history-time"><strong>${escapeHtml(i.time)}</strong><small>${escapeHtml(i.date)}</small></div><div class="history-main"><strong>${escapeHtml(i.zone)}</strong><small>${escapeHtml(i.text)}</small></div><span class="history-tag">${escapeHtml(i.tag)}</span></article>`).join("")}
document.getElementById("clearHistory").addEventListener("click",async()=>{
  if(!currentAdminUser)return toast("Entre como administrador para limpar o histórico.");
  if(!confirm("Apagar todo o histórico salvo no Firebase?"))return;
  try{
    await firebaseApi().clearHistory();
    state.history=[];saveState();renderHistory();toast("Histórico apagado do Firebase.");
  }catch(e){console.error(e);toast("Falha ao apagar histórico.");}
});

function getChartSeries(zoneIndex){
  const current=Number(state.zones[zoneIndex].humidity)||0;
  const base=zoneIndex===0?[6,4,2,0,-3,-1,2]:[9,7,5,0,3,8,11];
  return base.map(v=>Math.max(0,Math.min(100,current+v)));
}
function drawHumidityChart(canvasId,zoneIndex){
  const c=document.getElementById(canvasId);if(!c)return;
  const ctx=c.getContext("2d"),W=c.width,H=c.height,dark=document.body.classList.contains("dark");
  const grid=dark?"#294037":"#dbe8df",txt=dark?"#9cb0a6":"#6a7d74",line=zoneIndex===0?"#15915e":"#d0a126";
  ctx.clearRect(0,0,W,H);
  const pad={l:52,r:22,t:24,b:44},cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
  ctx.font="12px system-ui";ctx.fillStyle=txt;ctx.strokeStyle=grid;ctx.lineWidth=1;
  for(let v=0;v<=100;v+=20){const y=pad.t+ch-(v/100)*ch;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.fillText(v+"%",8,y+4)}
  const labels=["08h","10h","12h","14h","16h","18h","20h"];labels.forEach((l,i)=>{const x=pad.l+(i/(labels.length-1))*cw;ctx.fillText(l,x-11,H-14)});
  const data=getChartSeries(zoneIndex);
  const points=data.map((v,i)=>({x:pad.l+(i/(data.length-1))*cw,y:pad.t+ch-(v/100)*ch,v}));
  const grad=ctx.createLinearGradient(0,pad.t,0,H-pad.b);grad.addColorStop(0,zoneIndex===0?"rgba(21,145,94,.28)":"rgba(208,161,38,.28)");grad.addColorStop(1,"rgba(255,255,255,0)");
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineTo(points[points.length-1].x,H-pad.b);ctx.lineTo(points[0].x,H-pad.b);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=line;ctx.lineWidth=4;ctx.lineJoin="round";ctx.lineCap="round";ctx.stroke();
  points.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fillStyle=dark?"#14221c":"#fff";ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=line;ctx.stroke()});
  const z=state.zones[zoneIndex];
  const minY=pad.t+ch-(z.min/100)*ch,maxY=pad.t+ch-(z.max/100)*ch;
  ctx.save();ctx.setLineDash([7,6]);ctx.lineWidth=1.5;ctx.strokeStyle=zoneIndex===0?"rgba(21,145,94,.65)":"rgba(208,161,38,.65)";
  [minY,maxY].forEach(y=>{ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke()});ctx.restore();
}
function litersFor(zoneNum){
  const seconds=Number(state.waterUsage["zone"+zoneNum+"Seconds"]||0);
  const rate=Number(state.flowRates["pump"+zoneNum]||0);
  return seconds/60*rate;
}
function formatLiters(v){return v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+" L"}
function updateWaterMetrics(){
  const l1=litersFor(1),l2=litersFor(2),total=l1+l2,totalSeconds=Number(state.waterUsage.zone1Seconds||0)+Number(state.waterUsage.zone2Seconds||0);
  const ids=[["estimatedWater1",l1],["estimatedWater2",l2],["estimatedTotalWater",total]];
  ids.forEach(([id,val])=>{const e=document.getElementById(id);if(e)e.textContent=formatLiters(val)});
  const t=document.getElementById("estimatedIrrigationTime");if(t)t.textContent=totalSeconds>=60?(totalSeconds/60).toLocaleString("pt-BR",{maximumFractionDigits:1})+" min":totalSeconds+" s";
  const n1=document.getElementById("waterMetricName1"),n2=document.getElementById("waterMetricName2");if(n1)n1.textContent=state.zones[0].name;if(n2)n2.textContent=state.zones[1].name;
}
function drawWaterChart(){
  const c=document.getElementById("waterChart");if(!c)return;
  const ctx=c.getContext("2d"),W=c.width,H=c.height,dark=document.body.classList.contains("dark");
  const grid=dark?"#294037":"#dbe8df",txt=dark?"#9cb0a6":"#6a7d74";
  ctx.clearRect(0,0,W,H);
  const data=[litersFor(1),litersFor(2)],max=Math.max(1,...data)*1.2,pad={l:66,r:38,t:30,b:62},cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
  ctx.font="12px system-ui";ctx.fillStyle=txt;ctx.strokeStyle=grid;
  for(let i=0;i<=4;i++){const val=max*i/4,y=pad.t+ch-(i/4)*ch;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.fillText(val.toLocaleString("pt-BR",{maximumFractionDigits:2})+" L",8,y+4)}
  const barW=Math.min(180,cw/5),centers=[pad.l+cw*.30,pad.l+cw*.70],colors=["#15915e","#d0a126"];
  data.forEach((v,i)=>{const h=(v/max)*ch,x=centers[i]-barW/2,y=pad.t+ch-h;const g=ctx.createLinearGradient(0,y,0,pad.t+ch);g.addColorStop(0,colors[i]);g.addColorStop(1,i===0?"rgba(21,145,94,.45)":"rgba(208,161,38,.45)");ctx.fillStyle=g;ctx.beginPath();const r=14;ctx.roundRect(x,y,barW,h,r);ctx.fill();ctx.fillStyle=txt;ctx.textAlign="center";ctx.fillText(state.zones[i].name,centers[i],H-27);ctx.fillStyle=dark?"#ecf8f1":"#173229";ctx.font="bold 14px system-ui";ctx.fillText(formatLiters(v),centers[i],Math.max(pad.t+18,y-10));ctx.font="12px system-ui";ctx.textAlign="start"});
}
function drawChart(){
  document.getElementById("chartTitle1").textContent=state.zones[0].name;
  document.getElementById("chartTitle2").textContent=state.zones[1].name;
  document.getElementById("chartCurrent1").textContent=state.zones[0].humidity+"%";
  document.getElementById("chartCurrent2").textContent=state.zones[1].humidity+"%";
  updateWaterMetrics();drawHumidityChart("humidityChart1",0);drawHumidityChart("humidityChart2",1);drawWaterChart();
}
document.getElementById("chartPeriod").addEventListener("change",()=>{drawChart();toast("Período alterado na demonstração.")});

function renderProfiles(){const g=document.getElementById("profilesGrid");if(!state.profiles.length){g.innerHTML='<div class="notice info">Nenhum perfil salvo.</div>';return}g.innerHTML=state.profiles.map(p=>`<article class="profile-card"><h3>${escapeHtml(p.name)}</h3><div class="profile-zone"><span>Zona 1</span><b>${escapeHtml(p.zones[0].name)}</b></div><div class="profile-zone"><span>Zona 2</span><b>${escapeHtml(p.zones[1].name)}</b></div><div class="profile-actions"><button class="btn primary" data-load="${p.id}">Carregar</button><button class="btn danger" data-delete="${p.id}">Excluir</button></div></article>`).join("");g.querySelectorAll("[data-load]").forEach(b=>b.addEventListener("click",()=>loadProfile(Number(b.dataset.load))));g.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteProfile(Number(b.dataset.delete))))}
function loadProfile(id){const p=state.profiles.find(x=>x.id===id);if(!p)return;p.zones.forEach((z,i)=>state.zones[i]={...state.zones[i],...z});saveState();syncForms();renderDashboard();toast("Perfil carregado. Salve as zonas para enviar ao Firebase.")}
async function deleteProfile(id){
  if(!currentAdminUser)return toast("Entre como administrador.");
  state.profiles=state.profiles.filter(x=>x.id!==id);saveState();renderProfiles();
  try{await firebaseApi().deleteProfile(id);toast("Perfil excluído.");}
  catch(e){console.error(e);toast("Perfil removido localmente, mas falhou no Firebase.");}
}
document.getElementById("saveProfile").addEventListener("click",async()=>{
  if(!currentAdminUser)return toast("Entre como administrador.");
  const n=prompt("Nome do novo perfil:");if(!n||!n.trim())return;
  const profile={id:Date.now(),name:n.trim(),zones:state.zones.map(z=>({name:z.name,culture:z.culture,min:z.min,max:z.max,night:clone(z.night)}))};
  state.profiles.push(profile);saveState();renderProfiles();
  try{await firebaseApi().saveProfile(profile);toast("Perfil salvo no Firebase.");}
  catch(e){console.error(e);toast("Perfil salvo localmente, mas falhou no Firebase.");}
});

document.querySelectorAll(".calibration-form").forEach(form=>form.addEventListener("submit",e=>{e.preventDefault();const s=form.dataset.sensor,dry=document.getElementById("dry"+s).value,wet=document.getElementById("wet"+s).value;if(dry===""||wet==="")return toast("Preencha as duas referências.");if(Number(dry)===Number(wet))return toast("Os valores não podem ser iguais.");state.calibration["sensor"+s]={dry:Number(dry),wet:Number(wet)};saveState();
if(!currentAdminUser)return toast("Calibração salva localmente. Entre como administrador para enviar ao Firebase.");
firebaseApi().saveCalibration(s,state.calibration["sensor"+s])
.then(()=>{addHistory(`Sensor ${s}`,"Calibração atualizada","Calibração");toast(`Calibração do Sensor ${s} salva no Firebase.`)})
.catch(e=>{console.error(e);toast("Falha ao salvar calibração no Firebase.")})}));
function syncCalibration(){[1,2].forEach(s=>{const c=state.calibration["sensor"+s]||{};document.getElementById("dry"+s).value=c.dry??"";document.getElementById("wet"+s).value=c.wet??""})}

async function unlockAdmin(){
  const email=document.getElementById("adminEmailInput").value.trim();
  const password=document.getElementById("adminPasswordInput").value;
  const error=document.getElementById("adminError");
  const fb=firebaseApi();
  if(!fb){error.textContent="Firebase ainda está carregando.";return}
  if(!email||!password){error.textContent="Digite e-mail e senha.";return}
  error.textContent="";
  try{
    const user=await fb.signInAdmin(email,password);
    currentAdminUser=user;adminUnlocked=true;updateAdminUiFromAuth();
    toast("Administrador autenticado pelo Firebase.");
  }catch(e){
    console.error(e);
    error.textContent=e.message==="UNAUTHORIZED_UID"?"Esta conta não possui permissão administrativa.":"E-mail ou senha inválidos.";
  }
}

async function lockAdmin(){
  manualUnlocked=false;
  lockManual();
  try{if(firebaseApi())await firebaseApi().signOutAdmin()}catch(e){console.error(e)}
  currentAdminUser=null;adminUnlocked=false;updateAdminUiFromAuth();
  const p=document.getElementById("adminPasswordInput");if(p)p.value="";
}

document.getElementById("unlockAdmin").addEventListener("click",unlockAdmin);
document.getElementById("adminPasswordInput").addEventListener("keydown",e=>{if(e.key==="Enter")unlockAdmin()});
document.getElementById("lockAdmin").addEventListener("click",()=>{lockAdmin();toast("Sessão administrativa encerrada.")});

document.getElementById("resetAdminPassword").addEventListener("click",async()=>{
  const email=document.getElementById("adminEmailInput").value.trim();
  if(!email)return toast("Digite seu e-mail primeiro.");
  try{await firebaseApi().resetAdminPassword(email);toast("E-mail de redefinição enviado.");}
  catch(e){console.error(e);toast("Não foi possível enviar a redefinição.");}
});

const resetInside=document.getElementById("sendPasswordReset");
if(resetInside)resetInside.addEventListener("click",async()=>{
  if(!currentAdminUser?.email)return toast("Nenhuma conta autenticada.");
  try{await firebaseApi().resetAdminPassword(currentAdminUser.email);toast("E-mail de redefinição enviado.");}
  catch(e){console.error(e);toast("Não foi possível enviar a redefinição.");}
});

document.getElementById("changeManualPassword").addEventListener("click",async()=>{
  if(!currentAdminUser)return toast("Entre como administrador.");
  const a=document.getElementById("newManualPassword").value,b=document.getElementById("confirmManualPassword").value;
  if(a.length<6)return toast("O PIN/senha manual deve ter pelo menos 6 caracteres.");
  if(a!==b)return toast("As senhas não coincidem.");
  try{
    const hash=await firebaseApi().sha256(a);
    await firebaseApi().setManualPinHash(hash);
    document.getElementById("newManualPassword").value="";
    document.getElementById("confirmManualPassword").value="";
    toast("Senha do modo manual alterada com segurança.");
  }catch(e){console.error(e);toast("Falha ao atualizar senha manual.");}
});

document.getElementById("saveFlowRates").addEventListener("click",async()=>{
  const f1=Number(document.getElementById("flowRate1").value),f2=Number(document.getElementById("flowRate2").value);
  if(!Number.isFinite(f1)||!Number.isFinite(f2)||f1<=0||f2<=0)return toast("Informe vazões válidas.");
  if(!currentAdminUser)return toast("Entre como administrador.");
  state.flowRates={pump1:f1,pump2:f2};saveState();updateWaterMetrics();drawWaterChart();
  try{await firebaseApi().saveFlowRates(state.flowRates);toast("Vazões estimadas salvas no Firebase.");}
  catch(e){console.error(e);toast("Falha ao salvar vazões no Firebase.");}
});
function syncFlowRates(){
  document.getElementById("flowRate1").value=state.flowRates.pump1;
  document.getElementById("flowRate2").value=state.flowRates.pump2;
}

const TEAM_MEMBERS=[
  {id:"thalys",name:"Thalys Eduardo",handle:"@__thalys._",initials:"TE"},
  {id:"mary",name:"Mary Ellen",handle:"@Mary_ellen5615",initials:"ME"},
  {id:"eduarda",name:"Maria Eduarda",handle:"@eduardasales.__",initials:"ME"},
  {id:"eriberto",name:"Prof. Eriberto Vagner",handle:"@freitassvagner",initials:"EV"},
  {id:"rayanna",name:"Profª Rayanna Campos",handle:"@Rayanna.cf",initials:"RC"},
  {id:"pedro",name:"Pedro Kaio",handle:"@pedrokaiogpoficial_",initials:"PK"}
];

function applyTeamPhotos(){
  document.querySelectorAll("[data-member-photo]").forEach(el=>{
    const id=el.dataset.memberPhoto;
    const member=TEAM_MEMBERS.find(m=>m.id===id);
    if(!member)return;
    const src=state.teamPhotos[id]||"";
    el.innerHTML=src
      ? `<img src="${src}" alt="Foto de ${escapeHtml(member.name)}">`
      : `<span>${member.initials}</span>`;
  });
}

function renderTeamPhotoManager(){
  const box=document.getElementById("teamPhotoManager");
  if(!box)return;

  box.innerHTML=TEAM_MEMBERS.map(m=>{
    const src=state.teamPhotos[m.id]||"";
    return `<div class="team-photo-editor">
      <div class="team-photo-preview">${src?`<img src="${src}" alt="Foto de ${escapeHtml(m.name)}">`:m.initials}</div>
      <div>
        <strong>${escapeHtml(m.name)}</strong>
        <small>${escapeHtml(m.handle)}</small>
        <input type="file" accept="image/*" data-team-file="${m.id}">
      </div>
      <div class="team-photo-actions">
        <button class="btn primary" type="button" data-save-team-photo="${m.id}">Salvar foto</button>
        <button class="btn danger" type="button" data-remove-team-photo="${m.id}">Remover</button>
      </div>
    </div>`;
  }).join("");

  box.querySelectorAll("[data-save-team-photo]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!currentAdminUser)return toast("Entre como administrador.");
    const id=btn.dataset.saveTeamPhoto;
    const input=box.querySelector(`[data-team-file="${id}"]`);
    const file=input?.files?.[0];
    if(!file)return toast("Selecione uma foto.");
    if(!file.type.startsWith("image/"))return toast("Selecione um arquivo de imagem.");

    btn.disabled=true;
    const original=btn.textContent;
    btn.textContent="Salvando...";

    try{
      const dataUrl=await resizeImage(file,560,.76,420000);
      await firebaseApi().saveTeamPhoto(id,dataUrl);
      state.teamPhotos[id]=dataUrl;
      saveState();
      applyTeamPhotos();
      renderTeamPhotoManager();
      toast("Foto salva no Firebase e publicada no site.");
    }catch(e){
      console.error("Foto da equipe:",e);
      toast("Não foi possível salvar a foto. Tente uma imagem menor.");
      btn.disabled=false;
      btn.textContent=original;
    }
  }));

  box.querySelectorAll("[data-remove-team-photo]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!currentAdminUser)return toast("Entre como administrador.");
    const id=btn.dataset.removeTeamPhoto;
    btn.disabled=true;
    try{
      await firebaseApi().removeTeamPhoto(id);
      state.teamPhotos[id]="";
      saveState();
      applyTeamPhotos();
      renderTeamPhotoManager();
      toast("Foto removida do site.");
    }catch(e){
      console.error("Remover foto:",e);
      toast("Não foi possível remover a foto.");
      btn.disabled=false;
    }
  }));
}

function resizeImage(file,maxWidth=1200,quality=.78,maxChars=900000){
  return new Promise((resolve,reject)=>{
    const img=new Image(),reader=new FileReader();
    reader.onload=()=>{
      img.onload=()=>{
        const maxDimension=Math.max(img.width,img.height);
        const scale=Math.min(1,maxWidth/maxDimension);
        const w=Math.max(1,Math.round(img.width*scale));
        const h=Math.max(1,Math.round(img.height*scale));
        const c=document.createElement("canvas");
        c.width=w;c.height=h;
        const ctx=c.getContext("2d",{alpha:false});
        if(!ctx)return reject(new Error("CANVAS_UNAVAILABLE"));
        ctx.drawImage(img,0,0,w,h);

        let q=quality;
        let data=c.toDataURL("image/jpeg",q);
        while(data.length>maxChars&&q>.42){
          q-=.08;
          data=c.toDataURL("image/jpeg",q);
        }
        if(data.length>maxChars)return reject(new Error("IMAGE_TOO_LARGE"));
        resolve(data);
      };
      img.onerror=()=>reject(new Error("INVALID_IMAGE"));
      img.src=reader.result;
    };
    reader.onerror=()=>reject(new Error("FILE_READ_ERROR"));
    reader.readAsDataURL(file);
  });
}
document.getElementById("addGalleryPhoto").addEventListener("click",async()=>{
  if(!currentAdminUser)return toast("Entre como administrador.");
  const file=document.getElementById("galleryFile").files[0];
  const title=document.getElementById("galleryTitle").value.trim();
  if(!file)return toast("Selecione uma imagem.");
  if(!file.type.startsWith("image/"))return toast("Selecione um arquivo de imagem.");
  if(!title)return toast("Digite um título.");

  const button=document.getElementById("addGalleryPhoto");
  button.disabled=true;
  button.textContent="Enviando...";

  try{
    const src=await resizeImage(file,1000,.72,850000);
    state.gallery.unshift({
      id:Date.now(),
      src,
      title,
      caption:document.getElementById("galleryCaption").value.trim(),
      date:document.getElementById("galleryDate").value.trim(),
      featured:document.getElementById("galleryFeatured").checked
    });
    await firebaseApi().saveGallery(state.gallery);
    saveState();
    renderGallery();
    renderAdminGallery();
    ["galleryFile","galleryTitle","galleryCaption","galleryDate"].forEach(id=>document.getElementById(id).value="");
    document.getElementById("galleryFeatured").checked=false;
    toast("Foto adicionada e publicada.");
  }catch(e){
    console.error("Galeria:",e);
    toast("Não foi possível salvar a foto. Tente uma imagem menor.");
  }finally{
    button.disabled=false;
    button.textContent="Adicionar à galeria";
  }
});
function renderGallery(){const full=document.getElementById("projectGallery"),home=document.getElementById("homeGallery"),empty=document.getElementById("galleryEmpty");const card=p=>`<article class="gallery-card"><img src="${p.src}" alt="${escapeHtml(p.title)}"><div class="gallery-info"><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.caption||"")}</p><span class="gallery-date">${escapeHtml(p.date||"")}</span></div></article>`;full.innerHTML=state.gallery.map(card).join("");empty.classList.toggle("hidden",state.gallery.length>0);const f=state.gallery.filter(p=>p.featured).slice(0,3),items=f.length?f:state.gallery.slice(0,3);home.innerHTML=items.length?items.map(card).join(""):`<article class="gallery-card"><div class="gallery-placeholder">📷</div><div class="gallery-info"><h3>Protótipo</h3><p>Adicione fotos pelo Painel do Administrador.</p></div></article><article class="gallery-card"><div class="gallery-placeholder">🏆</div><div class="gallery-info"><h3>Feiras</h3><p>Registre apresentações e momentos importantes.</p></div></article><article class="gallery-card"><div class="gallery-placeholder">👥</div><div class="gallery-info"><h3>Equipe</h3><p>Mostre quem desenvolve o IrrigaSense.</p></div></article>`}
async function persistGallery(message){
  saveState();
  renderGallery();
  renderAdminGallery();
  if(!currentAdminUser)return;
  try{
    await firebaseApi().saveGallery(state.gallery);
    if(message)toast(message);
  }catch(e){
    console.error("Salvar galeria:",e);
    toast("A alteração ficou local, mas não foi salva no Firebase.");
  }
}

function moveGalleryPhoto(id,direction){
  const index=state.gallery.findIndex(p=>p.id===id);
  if(index<0)return;
  const target=index+direction;
  if(target<0||target>=state.gallery.length)return;
  const [item]=state.gallery.splice(index,1);
  state.gallery.splice(target,0,item);
  persistGallery(direction<0?"Foto movida para cima.":"Foto movida para baixo.");
}

function moveGalleryPhotoTo(draggedId,targetId){
  if(draggedId===targetId)return;
  const from=state.gallery.findIndex(p=>p.id===draggedId);
  const to=state.gallery.findIndex(p=>p.id===targetId);
  if(from<0||to<0)return;
  const [item]=state.gallery.splice(from,1);
  state.gallery.splice(to,0,item);
  persistGallery("Ordem da galeria atualizada.");
}

function renderAdminGallery(){
  const list=document.getElementById("adminGalleryList");if(!list)return;
  if(!state.gallery.length){
    list.innerHTML='<div class="notice info">Nenhuma foto cadastrada.</div>';
    return;
  }

  list.innerHTML=state.gallery.map((p,index)=>`
    <article class="admin-gallery-item sortable-gallery-item" draggable="true" data-gallery-id="${p.id}">
      <img src="${p.src}" alt="">
      <div class="admin-gallery-main">
        <strong>${escapeHtml(p.title)}</strong><br>
        <small>Posição ${index+1} • ${escapeHtml(p.date||"Sem data")} • ${p.featured?"Destaque":"Galeria"}</small>
        <span class="drag-hint">↕ Arraste para mudar a ordem</span>
      </div>
      <div class="gallery-order-actions">
        <button class="btn ghost mini-btn" data-move-up="${p.id}" type="button" ${index===0?"disabled":""}>⬆ Subir</button>
        <button class="btn ghost mini-btn" data-move-down="${p.id}" type="button" ${index===state.gallery.length-1?"disabled":""}>⬇ Descer</button>
        <button class="btn danger mini-btn" data-delete-photo="${p.id}" type="button">Excluir</button>
      </div>
    </article>`).join("");

  list.querySelectorAll("[data-move-up]").forEach(b=>b.addEventListener("click",()=>moveGalleryPhoto(Number(b.dataset.moveUp),-1)));
  list.querySelectorAll("[data-move-down]").forEach(b=>b.addEventListener("click",()=>moveGalleryPhoto(Number(b.dataset.moveDown),1)));

  list.querySelectorAll("[data-delete-photo]").forEach(b=>b.addEventListener("click",()=>{
    state.gallery=state.gallery.filter(x=>x.id!==Number(b.dataset.deletePhoto));
    persistGallery("Foto removida.");
  }));

  let draggedId=null;
  list.querySelectorAll(".sortable-gallery-item").forEach(item=>{
    item.addEventListener("dragstart",e=>{
      draggedId=Number(item.dataset.galleryId);
      item.classList.add("dragging");
      if(e.dataTransfer){
        e.dataTransfer.effectAllowed="move";
        e.dataTransfer.setData("text/plain",String(draggedId));
      }
    });
    item.addEventListener("dragend",()=>{
      item.classList.remove("dragging");
      list.querySelectorAll(".sortable-gallery-item").forEach(x=>x.classList.remove("drag-over"));
      draggedId=null;
    });
    item.addEventListener("dragover",e=>{
      e.preventDefault();
      if(Number(item.dataset.galleryId)!==draggedId)item.classList.add("drag-over");
    });
    item.addEventListener("dragleave",()=>item.classList.remove("drag-over"));
    item.addEventListener("drop",e=>{
      e.preventDefault();
      item.classList.remove("drag-over");
      const targetId=Number(item.dataset.galleryId);
      const sourceId=draggedId || Number(e.dataTransfer?.getData("text/plain"));
      if(sourceId)moveGalleryPhotoTo(sourceId,targetId);
    });
  });
}

setInterval(()=>{const e=document.getElementById("lastCommunication");if(e)e.textContent="há poucos segundos"},5000);
fillCultureOptions();syncForms();syncCalibration();syncFlowRates();renderDashboard();renderHistory();renderProfiles();renderGallery();renderAdminGallery();applyTeamPhotos();renderTeamPhotoManager();updateWaterMetrics();
