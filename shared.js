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
   Rulează un canvas full-screen ~1.9s apoi navighează.
   kind: 'airlock' | 'corridor' | 'dome' | 'depart'
   ============================================================ */
function playTransition(kind, label, sub, destURL){
  let ov=document.getElementById('transition');
  if(!ov){
    ov=document.createElement('div'); ov.id='transition';
    ov.innerHTML=`<canvas></canvas><div class="tlabel"><div class="big"></div><div class="small"></div></div>`;
    document.body.appendChild(ov);
  }
  ov.querySelector('.big').textContent=label||'';
  ov.querySelector('.small').textContent=sub||'';
  const cv=ov.querySelector('canvas');
  const ctx=cv.getContext('2d');
  function size(){cv.width=innerWidth;cv.height=innerHeight;}
  size(); addEventListener('resize',size);

  ov.classList.add('run');
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  let t0=performance.now(), raf;
  function frame(now){
    const t=(now-t0)/1900;            // 0..1
    drawTransition(ctx,cv.width,cv.height,kind,t);
    if(t<1 && !reduce){ raf=requestAnimationFrame(frame); }
  }
  if(!reduce) raf=requestAnimationFrame(frame);
  // navighează la mijlocul animației (când ecranul e opac)
  setTimeout(()=>{ location.href=destURL; }, reduce?150:950);
}

function drawTransition(ctx,W,H,kind,t){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#05080d'; ctx.fillRect(0,0,W,H);
  const cx=W/2, cy=H/2;

  if(kind==='depart'){
    // câmp de stele care se accelerează (warp) — nava pleacă
    ctx.save(); ctx.translate(cx,cy);
    const N=180;
    for(let i=0;i<N;i++){
      const ang=(i*137.5)%360*Math.PI/180;
      const seedR=((i*53)%100)/100;
      const len=20+ t*t*420*seedR;
      const r0=30+seedR*40;
      const r1=r0+len;
      const x0=Math.cos(ang)*r0, y0=Math.sin(ang)*r0;
      const x1=Math.cos(ang)*r1, y1=Math.sin(ang)*r1;
      ctx.strokeStyle=`rgba(180,210,255,${0.15+0.5*t})`;
      ctx.lineWidth=1+ t*1.5;
      ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
    }
    // flash final
    if(t>0.7){ ctx.fillStyle=`rgba(255,255,255,${(t-0.7)/0.3*0.8})`; ctx.fillRect(-W,-H,W*2,H*2); }
    ctx.restore();
    return;
  }

  // uși de sas care se deschid (airlock/corridor/dome) — două panouri glisante
  // faza 0..0.5 se închid peste ecranul vechi, 0.5..1 se deschid spre cel nou
  const tint = kind==='dome' ? '#2a3b52' : (kind==='corridor'?'#1d2c3c':'#22303f');
  const open = t<0.5 ? (0.5-t)*2 : (t-0.5)*2;   // 1 -> 0 -> 1 (deschis-închis-deschis)
  const gap = open*W*0.5;
  // panou stânga
  const grd=ctx.createLinearGradient(0,0,cx,0);
  grd.addColorStop(0,'#0a1017'); grd.addColorStop(1,tint);
  ctx.fillStyle=grd; ctx.fillRect(0,0,cx-gap,H);
  // panou dreapta
  const grd2=ctx.createLinearGradient(cx,0,W,0);
  grd2.addColorStop(0,tint); grd2.addColorStop(1,'#0a1017');
  ctx.fillStyle=grd2; ctx.fillRect(cx+gap,0,W-(cx+gap),H);
  // dungi tehnice pe uși
  ctx.strokeStyle='rgba(255,182,72,.18)'; ctx.lineWidth=2;
  for(let y=40;y<H;y+=60){
    ctx.beginPath();ctx.moveTo(20,y);ctx.lineTo(cx-gap-20,y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx+gap+20,y);ctx.lineTo(W-20,y);ctx.stroke();
  }
  // linia de mijloc luminoasă
  ctx.fillStyle=`rgba(79,214,232,${0.6*(1-open)})`;
  ctx.fillRect(cx-gap-1, 0, 2, H);
  ctx.fillRect(cx+gap-1, 0, 2, H);
}

/* utilitar mic */
function $(s){return document.querySelector(s);}
