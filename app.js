"use strict";

/**
 * NovaDesk ITSM - prototipo académico de NovaTech Perú.
 * No usa backend: los datos se almacenan en localStorage y son demostrativos.
 */
const STORAGE_KEY = "novadesk-state-v2";
const SLA_TARGETS = {
  P1: { response: 5, restore: 60, label: "Crítica" },
  P2: { response: 10, restore: 120, label: "Alta" },
  P3: { response: 30, restore: 480, label: "Media" },
  P4: { response: 240, restore: 1440, label: "Baja" }
};

const seedState = {
  incidents: [
    {id:"INC-1042",title:"Intermitencia del enlace principal",p:"P1",status:"En diagnóstico",assignee:"Lucía P.",slaSeconds:2238,mine:true,createdAt:"2026-11-17T18:32:00-05:00"},
    {id:"INC-1041",title:"VPN lenta en oficina secundaria",p:"P2",status:"Asignado",assignee:"Marco R.",slaSeconds:4680,mine:false,createdAt:"2026-11-17T17:45:00-05:00"},
    {id:"INC-1039",title:"Resolución DNS intermitente",p:"P2",status:"En espera",assignee:"Rodrigo S.",slaSeconds:6360,mine:true,createdAt:"2026-11-17T16:20:00-05:00"},
    {id:"INC-1038",title:"Pérdida de conectividad Wi-Fi",p:"P3",status:"En diagnóstico",assignee:"Ana V.",slaSeconds:18720,mine:false,createdAt:"2026-11-17T14:12:00-05:00"},
    {id:"INC-1037",title:"Acceso lento al ERP en nube",p:"P3",status:"Asignado",assignee:"Rodrigo S.",slaSeconds:24000,mine:true,createdAt:"2026-11-17T12:08:00-05:00"},
    {id:"INC-1035",title:"Solicitud de revisión de ancho de banda",p:"P4",status:"En análisis",assignee:"Rodrigo S.",slaSeconds:66120,mine:true,createdAt:"2026-11-16T15:30:00-05:00"},
    {id:"INC-1033",title:"Cortes de audio en telefonía IP",p:"P3",status:"En espera",assignee:"Lucía P.",slaSeconds:25500,mine:false,createdAt:"2026-11-16T10:10:00-05:00"}
  ],
  failoverTests: [
    {date:"02/11/2026 10:00",owner:"Lucía Paredes",switchTime:"18 s",returnTime:"24 s",result:"Aprobado"},
    {date:"05/10/2026 10:00",owner:"Marco Ruiz",switchTime:"21 s",returnTime:"29 s",result:"Aprobado"}
  ]
};

const articles = [
  {tag:"Internet",title:"Pérdida de paquetes en enlace WAN",text:"Guía de diagnóstico con ping, MTR, revisión de interfaz, rutas y escalamiento al ISP.",views:128,version:"v2.3"},
  {tag:"VPN",title:"VPN con latencia elevada",text:"Validación de túnel, MTU, cifrado, ancho de banda y rutas hacia la sede secundaria.",views:76,version:"v1.8"},
  {tag:"DNS",title:"Resolución DNS intermitente",text:"Pruebas con nslookup, caché, reenviadores y comparación contra resolutores externos.",views:93,version:"v2.0"},
  {tag:"Firewall",title:"Conmutación manual dual-WAN",text:"Procedimiento controlado para activar el enlace secundario y conservar evidencia.",views:64,version:"v1.5"},
  {tag:"Wi-Fi",title:"Degradación por saturación de canal",text:"Inspección de espectro, utilización, potencia y reasignación de canales.",views:51,version:"v1.2"},
  {tag:"Internet",title:"Validación posterior a restauración",text:"Lista de verificación para confirmar navegación, VPN, VoIP, ERP y CRM.",views:112,version:"v2.1"}
];

const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const clone = value => JSON.parse(JSON.stringify(value));

function loadState(){
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && Array.isArray(saved.incidents) ? saved : clone(seedState);
  } catch { return clone(seedState); }
}
let state = loadState();
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function escapeHTML(value=""){
  return String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}
function formatDuration(seconds){
  const n=Math.max(0,Number(seconds)||0), h=String(Math.floor(n/3600)).padStart(2,"0"), m=String(Math.floor((n%3600)/60)).padStart(2,"0"), s=String(n%60).padStart(2,"0");
  return `${h}:${m}:${s}`;
}
function announce(message){ const region=$("#liveRegion"); if(region){region.textContent=""; requestAnimationFrame(()=>region.textContent=message);} }
function go(view, updateHash=true){
  const target=document.getElementById(view); if(!target) return;
  $$(".view").forEach(v=>v.classList.toggle("active",v===target));
  $$(".nav-item").forEach(n=>{const active=n.dataset.view===view;n.classList.toggle("active",active);n.setAttribute("aria-current",active?"page":"false");});
  if(updateHash) history.replaceState(null,"",`#${view}`);
  window.scrollTo({top:0,behavior:"smooth"});
  if(innerWidth<821) $("#sidebar")?.classList.remove("open");
  target.querySelector("h1")?.focus?.({preventScroll:true});
  announce(`Vista ${target.querySelector("h1")?.textContent||view}`);
}

function priorityClass(p){ const safe=SLA_TARGETS[p]?p:"P4"; return `<span class="priority ${safe.toLowerCase()}">${safe}</span>`; }
function stateClass(status){
  const text=String(status); const c=/diagnóstico|nuevo/i.test(text)?"progress":/espera/i.test(text)?"standby":/resuelto|cerrado|asignado|análisis/i.test(text)?"ok":"warn";
  return `<span class="state ${c}">${escapeHTML(text)}</span>`;
}
function syncBadges(){
  const open=state.incidents.filter(x=>!/cerrado|resuelto/i.test(x.status)).length;
  $$(".nav-item .badge").forEach(b=>b.textContent=open);
  const card=$(".kpi-card strong"); if(card) card.textContent=open;
}
function bindTicketLinks(){ $$(".ticket-link").forEach(b=>b.addEventListener("click",()=>go("ticket-detail"))); }
function renderRecent(){
  const body=$("#recentIncidents"); if(!body) return;
  body.innerHTML=state.incidents.slice(0,4).map(x=>`<tr><td><button class="text-button ticket-link">${escapeHTML(x.id)}</button></td><td>${escapeHTML(x.title)}</td><td>${priorityClass(x.p)}</td><td>${stateClass(x.status)}</td><td>${formatDuration(x.slaSeconds).slice(0,5)}</td></tr>`).join("");
  bindTicketLinks(); syncBadges();
}
function renderQueue(filter="all",term=""){
  const body=$("#queueBody"); if(!body) return;
  const q=term.trim().toLocaleLowerCase("es");
  const list=state.incidents.filter(x=>(filter==="all"||x.p===filter||(filter==="mine"&&x.mine))&&`${x.id} ${x.title} ${x.assignee} ${x.status}`.toLocaleLowerCase("es").includes(q));
  body.innerHTML=list.length?list.map(x=>`<tr><td><input type="checkbox" aria-label="Seleccionar ${escapeHTML(x.id)}"></td><td><button class="text-button ticket-link">${escapeHTML(x.id)}</button></td><td><strong>${escapeHTML(x.title)}</strong></td><td>${priorityClass(x.p)}</td><td>${stateClass(x.status)}</td><td>${escapeHTML(x.assignee)}</td><td><b>${formatDuration(x.slaSeconds).slice(0,5)}</b></td><td><button class="icon-button row-menu" aria-label="Acciones de ${escapeHTML(x.id)}">⋮</button></td></tr>`).join(""):`<tr><td colspan="8" class="empty-state">No hay incidencias que coincidan con el filtro.</td></tr>`;
  bindTicketLinks();
}
function renderArticles(term="",tag="Todos"){
  const grid=$("#articleGrid"); if(!grid) return;
  const q=term.trim().toLocaleLowerCase("es");
  const list=articles.filter(a=>(tag==="Todos"||a.tag===tag)&&`${a.title} ${a.text} ${a.tag}`.toLocaleLowerCase("es").includes(q));
  grid.innerHTML=list.length?list.map(a=>`<article class="article-card" tabindex="0"><span class="tag">${escapeHTML(a.tag)}</span><h3>${escapeHTML(a.title)}</h3><p>${escapeHTML(a.text)}</p><div class="article-meta"><span>◉ ${a.views} consultas</span><span>${escapeHTML(a.version)}</span></div></article>`).join(""):`<p class="empty-state">No se encontraron artículos.</p>`;
}
function renderChart(){
  const chart=$("#weeklyChart"); if(!chart) return;
  const data=[[8,7],[6,6],[10,9],[7,7],[9,8],[4,5],[3,4]], days=["L","M","X","J","V","S","D"];
  chart.innerHTML=data.map((v,i)=>`<div class="bar-group"><div class="bar open" style="height:${v[0]*11}px" title="Registradas: ${v[0]}"></div><div class="bar closed" style="height:${v[1]*11}px" title="Resueltas: ${v[1]}"></div><label>${days[i]}</label></div>`).join("");
}
function renderFailoverHistory(){
  const body=$("#failoverHistory"); if(!body) return;
  body.innerHTML=state.failoverTests.map(x=>`<tr><td>${escapeHTML(x.date)}</td><td>${escapeHTML(x.owner)}</td><td>${escapeHTML(x.switchTime)}</td><td>${escapeHTML(x.returnTime)}</td><td><span class="state ok">${escapeHTML(x.result)}</span></td></tr>`).join("");
}
function calcPriority(){
  const impact=Number($("#impact")?.value||1), urgency=Number($("#urgency")?.value||1), total=impact+urgency;
  const p=total>=5?"P1":total===4?"P2":total===3?"P3":"P4", target=SLA_TARGETS[p];
  const result=$("#priorityResult"), text=$("#priorityTarget"); if(!result||!text) return p;
  result.className=`priority ${p.toLowerCase()}`; result.textContent=`${p} · ${target.label}`;
  text.textContent=`Respuesta: ${target.response} min · Restauración: ${target.restore>=60?`${target.restore/60} h`:`${target.restore} min`}`;
  return p;
}

let modalConfirm=null;
function modal(title,message,icon="✓",onConfirm=null){
  $("#modalTitle").textContent=title; $("#modalMessage").textContent=message; $("#modalIcon").textContent=icon;
  modalConfirm=onConfirm; $("#modalBackdrop").hidden=false; $("#modalAction").focus();
}
function closeModal(){ $("#modalBackdrop").hidden=true; modalConfirm=null; }
function toast(message){ const t=$("#toast"); if(!t)return;t.textContent=message;t.classList.add("show");announce(message);clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2600); }
function nextIncidentId(){ return `INC-${Math.max(...state.incidents.map(x=>Number(x.id.split("-")[1])||0))+1}`; }
function createIncident(event){
  event.preventDefault(); const form=event.currentTarget; if(!form.reportValidity()) return;
  const p=calcPriority(), id=nextIncidentId(), target=SLA_TARGETS[p];
  state.incidents.unshift({id,title:$("#incidentTitle").value.trim(),p,status:"Nuevo",assignee:"Sin asignar",slaSeconds:target.restore*60,mine:false,createdAt:new Date().toISOString()});
  saveState(); renderRecent(); renderQueue(); modal("Incidencia creada",`Se generó ${id} con prioridad ${p}, objetivo de restauración de ${target.restore} minutos y trazabilidad inicial.`);
}
function runFailover(){
  const btn=$("#runFailover"); if(!btn||btn.disabled)return; btn.disabled=true; btn.textContent="Ejecutando prueba...";
  setTimeout(()=>{
    const switchSeconds=18+Math.floor(Math.random()*5), returnSeconds=24+Math.floor(Math.random()*7);
    state.failoverTests.unshift({date:new Date().toLocaleString("es-PE"),owner:"Rodrigo S.",switchTime:`${switchSeconds} s`,returnTime:`${returnSeconds} s`,result:"Aprobado"});
    saveState(); renderFailoverHistory(); btn.disabled=false; btn.textContent="▶ Ejecutar prueba de failover";
    modal("Prueba completada",`La conmutación tardó ${switchSeconds} segundos y el retorno ${returnSeconds} segundos. La evidencia quedó registrada.`);
  },1200);
}
function exportReport(){
  const rows=[["KPI","Resultado","Meta"],["Disponibilidad","99.72%","99.5%"],["MTTD","3.8 min","5 min"],["MTTA","7.2 min","10 min"],["MTTR P1","46 min","60 min"],["SLA","93.4%","90%"]];
  const csv="\ufeff"+rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})), a=document.createElement("a");
  a.href=url;a.download="novadesk_kpi_octubre_2026.csv";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);toast("Reporte CSV exportado");
}

function bindEvents(){
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  $("#menuButton")?.addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $("#impact")?.addEventListener("change",calcPriority); $("#urgency")?.addEventListener("change",calcPriority);
  $("#incidentForm")?.addEventListener("submit",createIncident);
  $$(".filter").forEach(b=>b.addEventListener("click",()=>{$$(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderQueue(b.dataset.filter,$("#queueSearch").value);}));
  $("#queueSearch")?.addEventListener("input",e=>renderQueue($(".filter.active")?.dataset.filter||"all",e.target.value));
  $("#knowledgeSearch")?.addEventListener("input",e=>renderArticles(e.target.value,$(".category-chips .active")?.textContent||"Todos"));
  $$(".category-chips button").forEach(b=>b.addEventListener("click",()=>{$$(".category-chips button").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderArticles($("#knowledgeSearch").value,b.textContent);}));
  $("#newArticle")?.addEventListener("click",()=>modal("Nuevo artículo","Editor previsto: síntoma, causa, solución, riesgo, propietario, versión y fecha de revisión.","＋"));
  $("#sendEscalation")?.addEventListener("click",()=>{const id=`ISP-PE-${crypto.getRandomValues(new Uint32Array(1))[0]%900000+100000}`;$("#providerCase").value=id;modal("Escalamiento enviado",`El proveedor recibió el caso ${id} con prioridad P1 y tres evidencias.`);});
  $("#addNote")?.addEventListener("click",()=>{const el=document.createElement("div");el.className="timeline-item current";el.innerHTML='<i></i><time>Ahora</time><div><strong>Nota de trabajo añadida</strong><p>Se registró una actualización manual en la cronología.</p><small>Rodrigo S. · Gestor</small></div>';$("#timeline").prepend(el);toast("Nota añadida a INC-1042");});
  $("#activateFailover")?.addEventListener("click",()=>modal("Confirmar failover","La simulación activará el enlace secundario y conservará evidencia del cambio.","⇄",runFailover));
  $("#resolveTicket")?.addEventListener("click",()=>modal("Validación requerida","Confirma restauración técnica, validación del usuario, solución y código de cierre.","!"));
  $("#runFailover")?.addEventListener("click",runFailover);
  $("#refreshDashboard")?.addEventListener("click",()=>toast(`Tablero actualizado a las ${new Date().toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}`));
  $("#exportReport")?.addEventListener("click",exportReport);
  $("#globalSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){go("queue");$("#queueSearch").value=e.target.value;renderQueue("all",e.target.value);}});
  $("#modalClose")?.addEventListener("click",closeModal);
  $("#modalAction")?.addEventListener("click",()=>{const fn=modalConfirm;closeModal();if(fn)fn();});
  $("#modalBackdrop")?.addEventListener("click",e=>{if(e.target===$("#modalBackdrop"))closeModal();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(!$("#modalBackdrop").hidden)closeModal();else $("#sidebar")?.classList.remove("open");}});
  window.addEventListener("hashchange",()=>go(location.hash.slice(1)||"dashboard",false));
}

function startClock(){
  setInterval(()=>{const incident=state.incidents.find(x=>x.id==="INC-1042");if(!incident)return;if(incident.slaSeconds>0){incident.slaSeconds--; if(incident.slaSeconds%30===0)saveState();} const clock=$("#slaClock");if(clock)clock.textContent=formatDuration(incident.slaSeconds);},1000);
}
function init(){
  bindEvents();renderRecent();renderQueue();renderArticles();renderChart();renderFailoverHistory();calcPriority();syncBadges();startClock();go(location.hash.slice(1)||"dashboard",false);
}

document.addEventListener("DOMContentLoaded",init);
