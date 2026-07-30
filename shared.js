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
  return t!==null ? parseInt(t,10) : 10*60;   // default 10 min
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
   COD MEMORAT — afișează cifrele obținute (persistă vizual pe
   toate paginile, ca jucătorul să nu trebuiască să le rețină singur)
   ============================================================ */
function renderCodeDisplay(el, codes){
  if(!el) return;
  const d=[codes.c1, codes.c2, codes.c3];
  el.innerHTML = d.map(x=> x
    ? `<span style="color:var(--ok)">${x}</span>`
    : `<span style="color:var(--ink-dim)">_</span>`
  ).join('<span style="color:var(--ink-dim)"> · </span>');
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
  SFX.doorSound();
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
    SFX.doorSound();
    setTimeout(()=>{ ov.classList.remove("run","opening"); }, 1000);
  }));
}

/* ============================================================
   AUDIO — motor sintetizat prin Web Audio API (tastare, uși, teme
   ambientale per modul, reușită/eșec) + redare de fișiere audio
   locale (playFile), totul offline — fără cereri de rețea.
   ============================================================ */
const SFX=(function(){
  let ctx=null, master=null, ambient=null, filePlayers=[];
  let muted=localStorage.getItem('oq_muted')==='1';

  function ensure(){
    if(ctx) return ctx;
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    master=ctx.createGain(); master.gain.value=muted?0:1; master.connect(ctx.destination);
    return ctx;
  }
  function unlock(){ ensure(); if(ctx.state==='suspended') ctx.resume(); }
  ['pointerdown','keydown'].forEach(ev=>addEventListener(ev,unlock,{once:true}));

  function setMuted(m){
    muted=m; localStorage.setItem('oq_muted', m?'1':'0');
    if(master) master.gain.setTargetAtTime(m?0:1, ctx.currentTime, 0.05);
    filePlayers.forEach(a=>{ a.muted=m; });
  }
  function isMuted(){ return muted; }

  function tick(){
    if(!ctx) return;
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type='square'; o.frequency.value=1400+Math.random()*500;
    g.gain.value=0.025;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.035);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime+0.04);
  }

  function noiseBuffer(dur){
    const buf=ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    return buf;
  }
  function doorSound(){
    if(!ctx) return;
    const src=ctx.createBufferSource(); src.buffer=noiseBuffer(0.9);
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=0.7;
    bp.frequency.setValueAtTime(200,ctx.currentTime);
    bp.frequency.exponentialRampToValueAtTime(1800,ctx.currentTime+0.5);
    bp.frequency.exponentialRampToValueAtTime(120,ctx.currentTime+0.9);
    const g=ctx.createGain(); g.gain.setValueAtTime(0.16,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.9);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(); src.stop(ctx.currentTime+0.9);
    const th=ctx.createOscillator(), tg=ctx.createGain();
    th.type='sine'; th.frequency.value=70;
    tg.gain.setValueAtTime(0.25,ctx.currentTime+0.02);
    tg.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);
    th.connect(tg); tg.connect(master);
    th.start(ctx.currentTime+0.02); th.stop(ctx.currentTime+0.32);
  }

  /* teme ambientale: pad-uri de oscilatoare detunate + LFO pe filtru, unice per modul */
  const THEMES={
    m1:{freqs:[49,98,146.8],type:'sawtooth',lfo:0.08,filter:400},
    m2:{freqs:[110,164.8,220,277.2],type:'sine',lfo:0.18,filter:1600},
    m3:{freqs:[65.4,130.8],type:'square',lfo:0.9,filter:300},
    core:{freqs:[73.4,110,146.8],type:'triangle',lfo:1.6,filter:600}
  };
  function startAmbient(name){
    ensure(); stopAmbient();
    const t=THEMES[name]; if(!t) return;
    const nodes=[];
    const filt=ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=t.filter;
    const bus=ctx.createGain(); bus.gain.value=0.0001;
    filt.connect(bus); bus.connect(master);
    bus.gain.setTargetAtTime(0.09, ctx.currentTime, 1.2);
    t.freqs.forEach(f=>{
      const o=ctx.createOscillator(); o.type=t.type; o.frequency.value=f;
      const og=ctx.createGain(); og.gain.value=1/t.freqs.length;
      o.connect(og); og.connect(filt); o.start();
      nodes.push(o);
    });
    const lfo=ctx.createOscillator(); lfo.frequency.value=t.lfo;
    const lfoGain=ctx.createGain(); lfoGain.gain.value=t.filter*0.5;
    lfo.connect(lfoGain); lfoGain.connect(filt.frequency); lfo.start();
    nodes.push(lfo);
    ambient={nodes,bus};
  }
  function stopAmbient(){
    if(!ambient) return;
    const {nodes,bus}=ambient;
    if(ctx) bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
    setTimeout(()=>{ nodes.forEach(n=>{ try{n.stop();}catch(e){} }); }, 900);
    ambient=null;
  }

  function chime(ok){
    if(!ctx) return;
    const notes = ok ? [523.25,659.25,783.99,1046.5] : [392,349.23,311.13];
    notes.forEach((f,i)=>{
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='triangle'; o.frequency.value=f;
      const start=ctx.currentTime+i*0.12;
      g.gain.setValueAtTime(0.0001,start);
      g.gain.exponentialRampToValueAtTime(0.15,start+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,start+0.5);
      o.connect(g); g.connect(master);
      o.start(start); o.stop(start+0.55);
    });
  }

  function playFile(src,vol,loop){
    const a=new Audio(src);
    a.volume = vol!==undefined ? vol : 0.85;
    a.loop = !!loop;
    a.muted = muted;
    filePlayers.push(a);
    a.addEventListener('ended', ()=>{ filePlayers=filePlayers.filter(x=>x!==a); });
    a.play().catch(()=>{});
    return a;
  }

  return {ensure,unlock,setMuted,isMuted,tick,doorSound,startAmbient,stopAmbient,chime,playFile};
})();

function mountAudioToggle(){
  if(document.getElementById('audioToggle')) return;
  const btn=document.createElement('button');
  btn.id='audioToggle'; btn.className='audio-toggle'; btn.type='button';
  function render(){
    btn.textContent=SFX.isMuted()?'🔇':'🔊';
    btn.setAttribute('aria-label',SFX.isMuted()?'Activează sunetul':'Dezactivează sunetul');
  }
  render();
  btn.onclick=()=>{ SFX.setMuted(!SFX.isMuted()); render(); };
  document.body.appendChild(btn);
}
mountAudioToggle();

/* utilitar mic */
function $(s){return document.querySelector(s);}
