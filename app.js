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
security:{manualPassword:"admnistrador231",adminPassword:"IrrigaAdmin2026"},
flowRates:{pump1:0.60,pump2:0.60},
waterUsage:{zone1Seconds:75,zone2Seconds:110},
teamPhotos:{thalys:"",mary:"",eduarda:"",eriberto:"",rayanna:"",pedro:""},
gallery:[]
};
const timers={1:null,2:null};let remaining={1:0,2:0};let manualUnlocked=false;let manualLockTimer=null;let adminUnlocked=false;
function clone(x){return JSON.parse(JSON.stringify(x))}
function loadState(){try{const raw=localStorage.getItem("irrigasense2_site_state");if(!raw)return clone(DEFAULT_STATE);const s=JSON.parse(raw);return {...clone(DEFAULT_STATE),...s,zones:s.zones||clone(DEFAULT_STATE.zones),history:s.history||clone(DEFAULT_STATE.history),profiles:s.profiles||clone(DEFAULT_STATE.profiles),calibration:s.calibration||clone(DEFAULT_STATE.calibration),security:{...clone(DEFAULT_STATE.security),...(s.security||{})},flowRates:{...clone(DEFAULT_STATE.flowRates),...(s.flowRates||{})},waterUsage:{...clone(DEFAULT_STATE.waterUsage),...(s.waterUsage||{})},teamPhotos:{...clone(DEFAULT_STATE.teamPhotos),...(s.teamPhotos||{})},gallery:s.gallery||[]}}catch(e){return clone(DEFAULT_STATE)}}
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

function fillCultureOptions(){[1,2].forEach(z=>{const s=document.getElementById("culture"+z);s.innerHTML="";CULTURES.forEach(c=>{const o=document.createElement("option");o.value=c.name;o.textContent=c.custom?`${c.name} — definir manualmente`:`${c.name} — ${c.min}% a ${c.max}%`;s.appendChild(o)});s.addEventListener("change",()=>applyCulture(z))})}
function applyCulture(z){const c=CULTURES.find(x=>x.name===document.getElementById("culture"+z).value);document.getElementById("customWrap"+z).classList.toggle("hidden",!c.custom);if(!c.custom){document.getElementById("zoneName"+z).value=c.name;document.getElementById("min"+z).value=c.min;document.getElementById("max"+z).value=c.max;document.getElementById("rangePreview"+z).textContent=`Preset: ${c.min}% a ${c.max}%`}else{document.getElementById("min"+z).value="";document.getElementById("max"+z).value="";document.getElementById("rangePreview"+z).textContent="Defina manualmente os limites."}}
function syncForms(){[1,2].forEach(z=>{const zone=state.zones[z-1];document.getElementById("zoneName"+z).value=zone.name;document.getElementById("culture"+z).value=zone.culture;document.getElementById("min"+z).value=zone.min;document.getElementById("max"+z).value=zone.max;document.getElementById("rangePreview"+z).textContent=`Faixa atual: ${zone.min}% a ${zone.max}%`;const custom=zone.culture==="Outra / Personalizada";document.getElementById("customWrap"+z).classList.toggle("hidden",!custom);document.getElementById("customCrop"+z).value=custom?zone.name:"";document.getElementById("nightEnabled"+z).checked=zone.night.enabled;document.getElementById("nightStart"+z).value=zone.night.start;document.getElementById("nightEnd"+z).value=zone.night.end;document.getElementById("critical"+z).value=zone.night.critical;document.getElementById("nightMax"+z).value=zone.night.maxSeconds;document.getElementById("nightInterval"+z).value=zone.night.intervalMinutes})}
document.querySelectorAll(".zone-form").forEach(form=>form.addEventListener("submit",e=>{e.preventDefault();const z=Number(form.dataset.zone),i=z-1,culture=document.getElementById("culture"+z).value;let name=document.getElementById("zoneName"+z).value.trim();if(culture==="Outra / Personalizada"){const c=document.getElementById("customCrop"+z).value.trim();if(c)name=c}const min=Number(document.getElementById("min"+z).value),max=Number(document.getElementById("max"+z).value);if(!name)return toast("Digite o nome da zona.");if(!Number.isFinite(min)||!Number.isFinite(max)||min<0||max>100||min>=max)return toast("Configuração inválida: mínimo deve ser menor que máximo.");const critical=Number(document.getElementById("critical"+z).value),maxSeconds=Number(document.getElementById("nightMax"+z).value),intervalMinutes=Number(document.getElementById("nightInterval"+z).value);if(critical<0||critical>100||maxSeconds<5||maxSeconds>120||intervalMinutes<10)return toast("Revise a proteção noturna.");state.zones[i]={...state.zones[i],name,culture,min,max,night:{enabled:document.getElementById("nightEnabled"+z).checked,start:document.getElementById("nightStart"+z).value||"20:00",end:document.getElementById("nightEnd"+z).value||"05:30",critical,maxSeconds,intervalMinutes}};addHistory(`Zona ${z} — ${name}`,"Configuração atualizada","Configuração");saveState();syncForms();renderDashboard();toast(`Zona ${z} salva.`)}));

function soilStatus(z){if(z.humidity<z.min)return"Abaixo do ideal";if(z.humidity>z.max)return"Acima do ideal";return"Adequado"}
function renderDashboard(){state.zones.forEach((zone,i)=>{const z=i+1,p=Math.max(0,Math.min(100,Number(zone.humidity)||0));document.getElementById("dashName"+z).textContent=zone.name;document.getElementById("dashCrop"+z).textContent=zone.culture;document.getElementById("dashHum"+z).textContent=p+"%";document.getElementById("dashRange"+z).textContent=`${zone.min}%–${zone.max}%`;document.getElementById("soilStatus"+z).textContent=soilStatus(zone);document.getElementById("meter"+z).style.width=p+"%";document.getElementById("ring"+z).style.background=`conic-gradient(var(--green) 0 ${p}%,var(--surface2) ${p}% 100%)`;const b=document.getElementById("pumpBadge"+z);b.textContent=zone.pump?"Bomba ligada":"Bomba desligada";b.className=`pump-badge ${zone.pump?"on":"off"}`;document.getElementById("manualName"+z).textContent=zone.name;document.getElementById("manualHum"+z).textContent=p+"%";const mb=document.getElementById("manualPumpBadge"+z);mb.textContent=zone.pump?"Ligada":"Desligada";mb.className=`pump-badge ${zone.pump?"on":"off"}`;document.getElementById("heroZone"+z).textContent=zone.name;document.getElementById("heroHum"+z).textContent=p+"% de umidade";document.getElementById("legendName"+z).textContent=zone.name});document.getElementById("avgHumidity").textContent=Math.round((state.zones[0].humidity+state.zones[1].humidity)/2)+"%";document.getElementById("activePumps").textContent=state.zones.filter(z=>z.pump).length+"/2";if(document.getElementById("chartTitle1")){document.getElementById("chartTitle1").textContent=state.zones[0].name;document.getElementById("chartTitle2").textContent=state.zones[1].name}}

function unlockManual(){const input=document.getElementById("manualPassword"),err=document.getElementById("manualError");if(input.value!==state.security.manualPassword){err.textContent="Senha incorreta.";return}err.textContent="";manualUnlocked=true;document.getElementById("manualLockPanel").classList.add("hidden");document.getElementById("manualGrid").classList.remove("locked");document.getElementById("lockManual").classList.remove("hidden");document.getElementById("manualLockPill").textContent="🔓 Desbloqueado";document.getElementById("manualLockPill").className="pill success";resetManualLockTimer();toast("Modo manual desbloqueado por 5 minutos.")}
function lockManual(){manualUnlocked=false;clearTimeout(manualLockTimer);[1,2].forEach(z=>stopIrrigation(z,false));document.getElementById("manualLockPanel").classList.remove("hidden");document.getElementById("manualGrid").classList.add("locked");document.getElementById("lockManual").classList.add("hidden");document.getElementById("manualLockPill").textContent="🔒 Bloqueado";document.getElementById("manualLockPill").className="pill warning";document.getElementById("manualPassword").value=""}
function resetManualLockTimer(){clearTimeout(manualLockTimer);manualLockTimer=setTimeout(lockManual,5*60*1000)}
document.getElementById("unlockManual").addEventListener("click",unlockManual);document.getElementById("manualPassword").addEventListener("keydown",e=>{if(e.key==="Enter")unlockManual()});document.getElementById("lockManual").addEventListener("click",()=>{lockManual();toast("Modo manual bloqueado.")});
function startIrrigation(z){if(!manualUnlocked)return;stopIrrigation(z,false);resetManualLockTimer();const d=Number(document.getElementById("manualDuration"+z).value);remaining[z]=d;state.zones[z-1].pump=true;addHistory(`Zona ${z} — ${state.zones[z-1].name}`,`Irrigação manual iniciada por ${d} segundos`,"Manual");saveState();renderDashboard();updateCountdown(z);timers[z]=setInterval(()=>{remaining[z]-=1;updateCountdown(z);if(remaining[z]<=0){clearInterval(timers[z]);timers[z]=null;state.zones[z-1].pump=false;state.waterUsage["zone"+z+"Seconds"]=(state.waterUsage["zone"+z+"Seconds"]||0)+d;addHistory(`Zona ${z} — ${state.zones[z-1].name}`,`Irrigação manual de ${d} segundos finalizada automaticamente`,"Manual");saveState();renderDashboard();updateWaterMetrics();document.getElementById("countdown"+z).textContent="Irrigação concluída"}},1000)}
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
document.querySelectorAll(".start-irrigation").forEach(b=>b.addEventListener("click",()=>startIrrigation(Number(b.dataset.zone))));document.querySelectorAll(".stop-irrigation").forEach(b=>b.addEventListener("click",()=>{if(manualUnlocked){stopIrrigation(Number(b.dataset.zone));resetManualLockTimer()}}));

function addHistory(zone,text,tag){const d=new Date();state.history.unshift({time:d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),date:d.toLocaleDateString("pt-BR"),zone,text,tag});state.history=state.history.slice(0,100)}
function renderHistory(){const l=document.getElementById("historyList");if(!state.history.length){l.innerHTML='<div class="notice info">Nenhum registro.</div>';return}l.innerHTML=state.history.map(i=>`<article class="history-item"><div class="history-time"><strong>${escapeHtml(i.time)}</strong><small>${escapeHtml(i.date)}</small></div><div class="history-main"><strong>${escapeHtml(i.zone)}</strong><small>${escapeHtml(i.text)}</small></div><span class="history-tag">${escapeHtml(i.tag)}</span></article>`).join("")}
document.getElementById("clearHistory").addEventListener("click",()=>{state.history=[];saveState();renderHistory();toast("Histórico limpo.")});

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
function loadProfile(id){const p=state.profiles.find(x=>x.id===id);if(!p)return;p.zones.forEach((z,i)=>state.zones[i]={...state.zones[i],...z});saveState();syncForms();renderDashboard();toast("Perfil carregado.")}
function deleteProfile(id){state.profiles=state.profiles.filter(x=>x.id!==id);saveState();renderProfiles();toast("Perfil excluído.")}
document.getElementById("saveProfile").addEventListener("click",()=>{const n=prompt("Nome do novo perfil:");if(!n||!n.trim())return;state.profiles.push({id:Date.now(),name:n.trim(),zones:state.zones.map(z=>({name:z.name,culture:z.culture,min:z.min,max:z.max,night:clone(z.night)}))});saveState();renderProfiles();toast("Perfil salvo.")});

document.querySelectorAll(".calibration-form").forEach(form=>form.addEventListener("submit",e=>{e.preventDefault();const s=form.dataset.sensor,dry=document.getElementById("dry"+s).value,wet=document.getElementById("wet"+s).value;if(dry===""||wet==="")return toast("Preencha as duas referências.");if(Number(dry)===Number(wet))return toast("Os valores não podem ser iguais.");state.calibration["sensor"+s]={dry:Number(dry),wet:Number(wet)};saveState();toast(`Calibração do Sensor ${s} salva.`)}));
function syncCalibration(){[1,2].forEach(s=>{const c=state.calibration["sensor"+s]||{};document.getElementById("dry"+s).value=c.dry??"";document.getElementById("wet"+s).value=c.wet??""})}

function unlockAdmin(){const i=document.getElementById("adminPasswordInput"),e=document.getElementById("adminError");if(i.value!==state.security.adminPassword){e.textContent="Senha administrativa incorreta.";return}e.textContent="";adminUnlocked=true;document.getElementById("adminLockPanel").classList.add("hidden");document.getElementById("adminPanel").classList.remove("hidden");document.getElementById("adminLockPill").textContent="🔓 Administrador";document.getElementById("adminLockPill").className="pill success";renderAdminGallery();renderTeamPhotoManager();syncFlowRates();toast("Painel administrativo desbloqueado.")}
function lockAdmin(){adminUnlocked=false;document.getElementById("adminLockPanel").classList.remove("hidden");document.getElementById("adminPanel").classList.add("hidden");document.getElementById("adminLockPill").textContent="🔒 Bloqueado";document.getElementById("adminLockPill").className="pill warning";document.getElementById("adminPasswordInput").value=""}
document.getElementById("unlockAdmin").addEventListener("click",unlockAdmin);document.getElementById("adminPasswordInput").addEventListener("keydown",e=>{if(e.key==="Enter")unlockAdmin()});document.getElementById("lockAdmin").addEventListener("click",()=>{lockAdmin();toast("Painel bloqueado.")});
document.getElementById("changeManualPassword").addEventListener("click",()=>{const a=document.getElementById("newManualPassword").value,b=document.getElementById("confirmManualPassword").value;if(a.length<6)return toast("A senha deve ter pelo menos 6 caracteres.");if(a!==b)return toast("As senhas não coincidem.");state.security.manualPassword=a;saveState();document.getElementById("newManualPassword").value="";document.getElementById("confirmManualPassword").value="";toast("Senha do modo manual alterada.")});
document.getElementById("saveFlowRates").addEventListener("click",()=>{
  const f1=Number(document.getElementById("flowRate1").value),f2=Number(document.getElementById("flowRate2").value);
  if(!Number.isFinite(f1)||!Number.isFinite(f2)||f1<=0||f2<=0)return toast("Informe vazões válidas.");
  state.flowRates={pump1:f1,pump2:f2};saveState();updateWaterMetrics();drawWaterChart();toast("Vazões estimadas atualizadas.");
});
function syncFlowRates(){
  document.getElementById("flowRate1").value=state.flowRates.pump1;
  document.getElementById("flowRate2").value=state.flowRates.pump2;
}

document.getElementById("changeAdminPassword").addEventListener("click",()=>{const a=document.getElementById("newAdminPassword").value,b=document.getElementById("confirmAdminPassword").value;if(a.length<8)return toast("A senha administrativa deve ter pelo menos 8 caracteres.");if(a!==b)return toast("As senhas não coincidem.");state.security.adminPassword=a;saveState();document.getElementById("newAdminPassword").value="";document.getElementById("confirmAdminPassword").value="";toast("Senha administrativa alterada.")});

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
    const id=el.dataset.memberPhoto,member=TEAM_MEMBERS.find(m=>m.id===id),src=state.teamPhotos[id]||"";
    el.innerHTML=src?`<img src="${src}" alt="Foto de ${escapeHtml(member.name)}">`:`<span>${member.initials}</span>`;
  });
}
function renderTeamPhotoManager(){
  const box=document.getElementById("teamPhotoManager");if(!box)return;
  box.innerHTML=TEAM_MEMBERS.map(m=>{
    const src=state.teamPhotos[m.id]||"";
    return `<div class="team-photo-editor">
      <div class="team-photo-preview">${src?`<img src="${src}" alt="">`:m.initials}</div>
      <div><strong>${escapeHtml(m.name)}</strong><small>${escapeHtml(m.handle)}</small><input type="file" accept="image/*" data-team-file="${m.id}"></div>
      <div class="team-photo-actions"><button class="btn primary" type="button" data-save-team-photo="${m.id}">Salvar foto</button><button class="btn danger" type="button" data-remove-team-photo="${m.id}">Remover</button></div>
    </div>`;
  }).join("");
  box.querySelectorAll("[data-save-team-photo]").forEach(btn=>btn.addEventListener("click",async()=>{
    const id=btn.dataset.saveTeamPhoto,input=box.querySelector(`[data-team-file="${id}"]`),file=input.files[0];
    if(!file)return toast("Selecione uma foto.");
    try{state.teamPhotos[id]=await resizeImage(file,700,.82);saveState();applyTeamPhotos();renderTeamPhotoManager();toast("Foto de perfil atualizada.");}catch(e){toast("Não foi possível processar a foto.");}
  }));
  box.querySelectorAll("[data-remove-team-photo]").forEach(btn=>btn.addEventListener("click",()=>{
    state.teamPhotos[btn.dataset.removeTeamPhoto]="";saveState();applyTeamPhotos();renderTeamPhotoManager();toast("Foto removida.");
  }));
}

function resizeImage(file,maxWidth=1200,quality=.78){return new Promise((resolve,reject)=>{const img=new Image(),reader=new FileReader();reader.onload=()=>{img.onload=()=>{const scale=Math.min(1,maxWidth/img.width),w=Math.round(img.width*scale),h=Math.round(img.height*scale),c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);resolve(c.toDataURL("image/jpeg",quality))};img.onerror=reject;img.src=reader.result};reader.onerror=reject;reader.readAsDataURL(file)})}
document.getElementById("addGalleryPhoto").addEventListener("click",async()=>{if(!adminUnlocked)return;const file=document.getElementById("galleryFile").files[0],title=document.getElementById("galleryTitle").value.trim();if(!file)return toast("Selecione uma imagem.");if(!title)return toast("Digite um título.");try{const src=await resizeImage(file);state.gallery.unshift({id:Date.now(),src,title,caption:document.getElementById("galleryCaption").value.trim(),date:document.getElementById("galleryDate").value.trim(),featured:document.getElementById("galleryFeatured").checked});saveState();renderGallery();renderAdminGallery();["galleryFile","galleryTitle","galleryCaption","galleryDate"].forEach(id=>document.getElementById(id).value="");document.getElementById("galleryFeatured").checked=false;toast("Foto adicionada.")}catch(e){toast("Não foi possível processar a imagem.")}});
function renderGallery(){const full=document.getElementById("projectGallery"),home=document.getElementById("homeGallery"),empty=document.getElementById("galleryEmpty");const card=p=>`<article class="gallery-card"><img src="${p.src}" alt="${escapeHtml(p.title)}"><div class="gallery-info"><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.caption||"")}</p><span class="gallery-date">${escapeHtml(p.date||"")}</span></div></article>`;full.innerHTML=state.gallery.map(card).join("");empty.classList.toggle("hidden",state.gallery.length>0);const f=state.gallery.filter(p=>p.featured).slice(0,3),items=f.length?f:state.gallery.slice(0,3);home.innerHTML=items.length?items.map(card).join(""):`<article class="gallery-card"><div class="gallery-placeholder">📷</div><div class="gallery-info"><h3>Protótipo</h3><p>Adicione fotos pelo Painel do Administrador.</p></div></article><article class="gallery-card"><div class="gallery-placeholder">🏆</div><div class="gallery-info"><h3>Feiras</h3><p>Registre apresentações e momentos importantes.</p></div></article><article class="gallery-card"><div class="gallery-placeholder">👥</div><div class="gallery-info"><h3>Equipe</h3><p>Mostre quem desenvolve o IrrigaSense.</p></div></article>`}
function moveGalleryPhoto(id,direction){
  const index=state.gallery.findIndex(p=>p.id===id);
  if(index<0)return;
  const target=index+direction;
  if(target<0||target>=state.gallery.length)return;
  const [item]=state.gallery.splice(index,1);
  state.gallery.splice(target,0,item);
  saveState();renderGallery();renderAdminGallery();
  toast(direction<0?"Foto movida para cima.":"Foto movida para baixo.");
}

function moveGalleryPhotoTo(draggedId,targetId){
  if(draggedId===targetId)return;
  const from=state.gallery.findIndex(p=>p.id===draggedId);
  const to=state.gallery.findIndex(p=>p.id===targetId);
  if(from<0||to<0)return;
  const [item]=state.gallery.splice(from,1);
  state.gallery.splice(to,0,item);
  saveState();renderGallery();renderAdminGallery();
  toast("Ordem da galeria atualizada.");
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
    saveState();renderGallery();renderAdminGallery();toast("Foto removida.");
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
