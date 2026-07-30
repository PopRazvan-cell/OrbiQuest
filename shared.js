/* ============================================================
   ARV KEPLER-9 — logică partajată între cele 5 pagini
   Totul rulează OFFLINE. Starea circulă prin parametrii din URL:
     ?seed=NNNNN   -> determină toți parametrii randomizați (RNG determinist)
     &c1=&c2=&c3=  -> cifrele codului obținute până acum
     &t=SS         -> secundele rămase din oxigen (cronometru continuu)
   Astfel fiecare joc are alt cod, dar parametrii sunt reconstruiți
   identic pe fiecare pagină din același seed.
   ============================================================ */

/* ---- RNG determinist (mulberry32) ---- */
function makeRNG(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- helpers URL ---- */
function qs(){ return new URLSearchParams(location.search); }
function getSeed(){
  const s = qs().get('seed');
  return s ? parseInt(s,10) : null;
}
function getCodes(){
  const q = qs();
  return { c1:q.get('c1'), c2:q.get('c2'), c3:q.get('c3') };
}
function getTimeLeft(){
  const t = qs().get('t');
  return t!==null ? parseInt(t,10) : 14*60;   // default 14 min
}

/* construiește URL-ul următoarei pagini păstrând starea */
function nextURL(page, extra){
  const q = qs();
  if(extra){ for(const k in extra) q.set(k, extra[k]); }
  q.set('t', String(window.__timeLeft!==undefined ? window.__timeLeft : getTimeLeft()));
  return page + '?' + q.toString();
}

/* ============================================================
   PARAMETRII PUZZLE-URILOR — derivați DETERMINIST din seed.
   Aceleași formule ca versiunea single-file, dar reproductibile.
   ============================================================ */
function buildParams(seed){
  const rnd = makeRNG(seed);
  const randi=(a,b)=>a+Math.floor(rnd()*(b-a+1));
  const digitFrom=x=>String(Math.abs(Math.round(x))%10);

  // constante de calibrare identice cu simularea
  const GMpx=4200, PXPERMM=0.62;
  const vCircPx=r=>Math.sqrt(GMpx/(r*PXPERMM));
  const KMS_PER_PXV=3.20/vCircPx(180);
  const vNeeded=r=>vCircPx(r)*KMS_PER_PXV;

  const P={GMpx,PXPERMM,vNeeded};

  // Camera 1 — rază din setul discret (mult. de 5), evită extreme
  const raze=[]; for(let r=125;r<=255;r+=5) raze.push(r);
  P.r1 = raze[randi(0,raze.length-1)];
  P.v1correct = vNeeded(P.r1);
  P.dig1 = digitFrom(P.v1correct*100);

  // Camera 2 — deplasare spre roșu -> λ_obs, v=z*c
  const dLambda = randi(12,45);
  P.lamObs = 656.3 + dLambda;
  P.z2 = dLambda/656.3;
  P.v2correct = P.z2*300000;
  P.dig2 = digitFrom(P.v2correct/100);

  // Camera 3 — paralaxă -> distanță d=1/p
  const pMas = randi(15,60);
  P.p3 = pMas/1000;
  P.shift3 = P.p3*2;
  P.d3correct = 1/P.p3;
  P.dig3 = digitFrom(P.d3correct);

  return P;
}

/* ============================================================
   TIMER OXIGEN — continuă de la ?t=; se salvează în window.__timeLeft
   ============================================================ */
function fmtTime(s){const m=Math.floor(s/60),x=s%60;return m+':'+String(x).padStart(2,'0');}
function startOxygen(displayEl, onZero){
  window.__timeLeft = getTimeLeft();
  if(displayEl) displayEl.textContent = fmtTime(window.__timeLeft);
  const id=setInterval(()=>{
    window.__timeLeft--;
    if(displayEl){
      displayEl.textContent=fmtTime(Math.max(0,window.__timeLeft));
      if(window.__timeLeft<=120) displayEl.classList.add('crit');
    }
    if(window.__timeLeft<=0){ clearInterval(id); if(onZero) onZero(); }
  },1000);
  return id;
}

/* ============================================================
   RAIL DE PROGRES — marchează camerele rezolvate
   step: indexul camerei curente (0..3). c: obiectul codurilor.
   ============================================================ */
function renderRail(el, step){
  if(!el) return;
  const codes=getCodes();
  const done=[!!codes.c1, !!codes.c2, !!codes.c3, false];
  const names=[['MODUL 01','Gravitație'],['MODUL 02','Spectru'],['MODUL 03','Paralaxă'],['CORE','Repornire']];
  el.innerHTML = names.map((n,i)=>{
    let cls='node';
    if(done[i]) cls+=' done';
    if(i===step) cls+=' active';
    else if(i>step && !done[i]) cls+=' locked';
    return `<div class="${cls}"><div class="idx">${n[0]}</div><div class="nm">${n[1]}</div></div>`;
  }).join('');
}

/* ============================================================
   TRANZIȚIE ANIMATĂ ÎNTRE ÎNCĂPERI
/* ============================================================
   TRANZIȚIE — UȘI DE AIRLOCK metalice (HTML/CSS)
   Se închid spre centru peste ecranul curent, navighează, apoi
   pagina nouă le deschide glisând spre exterior (openAirlockIn).
   ============================================================ */
function ensureAirlock(){
  let ov=document.getElementById("airlock");
  if(!ov){
    ov=document.createElement("div"); ov.id="airlock";
    ov.innerHTML=`<div class="door left"><div class="stripe"></div></div>`+
                 `<div class="door right"><div class="stripe"></div></div>`+
                 `<div class="airlock-label"><div class="big"></div><div class="small"></div></div>`;
    document.body.appendChild(ov);
  }
  return ov;
}
function playTransition(kind,label,sub,destURL){
  const ov=ensureAirlock();
  ov.querySelector(".airlock-label .big").textContent=label||"";
  ov.querySelector(".airlock-label .small").textContent=sub||"";
  ov.classList.add("run","closing");
  const reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
  const closeMs=reduce?120:950;
  setTimeout(()=>{ ov.classList.add("closed"); }, closeMs-260);
  setTimeout(()=>{ location.href=destURL; }, closeMs+180);
}
/* apelat la încărcarea fiecărei pagini de joc: ușile pornesc închise și se deschid */
function openAirlockIn(){
  const nav=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0];
  const ov=ensureAirlock();
  ov.classList.add("run","closed");
  // afișează ușile închise instantaneu, apoi deschide-le
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    ov.classList.remove("closed","closing");
    ov.classList.add("opening");
    setTimeout(()=>{ ov.classList.remove("run","opening"); }, 1000);
  }));
}

/* utilitar mic */
function $(s){return document.querySelector(s);}
