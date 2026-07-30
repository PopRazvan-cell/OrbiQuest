/* ============================================================
   OrbiQuest VR — motor audio (identic ca principiu cu shared.js
   din versiunea 2D): tastare/click sintetizat prin Web Audio API
   + redare de fișiere .mp3 locale. Totul offline.
   ============================================================ */
const SFX = (function(){
  let ctx=null, master=null, ambient=null, filePlayers=[];
  let muted=false;

  function ensure(){
    if(ctx) return ctx;
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    master=ctx.createGain(); master.gain.value=muted?0:1; master.connect(ctx.destination);
    return ctx;
  }
  function unlock(){ ensure(); if(ctx.state==='suspended') ctx.resume(); }
  ['pointerdown','keydown'].forEach(ev=>addEventListener(ev,unlock,{once:true}));

  function setMuted(m){
    muted=m;
    if(master) master.gain.setTargetAtTime(m?0:1, ctx.currentTime, 0.05);
    filePlayers.forEach(a=>{ a.muted=m; });
  }
  function isMuted(){ return muted; }

  function click(){
    if(!ctx) return;
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type='square'; o.frequency.value=520;
    g.gain.value=0.05;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.06);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime+0.07);
  }

  function chime(ok){
    if(!ctx) return;
    const notes = ok ? [523.25,659.25,783.99,1046.5] : [392,349.23,311.13];
    notes.forEach((f,i)=>{
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='triangle'; o.frequency.value=f;
      const start=ctx.currentTime+i*0.12;
      g.gain.setValueAtTime(0.0001,start);
      g.gain.exponentialRampToValueAtTime(0.18,start+0.02);
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

  function stopAllLoops(){
    filePlayers.filter(a=>a.loop).forEach(a=>{ a.pause(); });
    filePlayers=filePlayers.filter(a=>!a.loop);
  }

  /* teme ambientale sintetizate (pentru module fără fișier .mp3 dedicat) */
  const THEMES={
    m1:{freqs:[49,98,146.8],type:'sawtooth',lfo:0.08,filter:400},
    core:{freqs:[73.4,110,146.8],type:'triangle',lfo:1.6,filter:600}
  };
  function startAmbient(name){
    ensure(); stopAmbient();
    const t=THEMES[name]; if(!t) return;
    const nodes=[];
    const filt=ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=t.filter;
    const bus=ctx.createGain(); bus.gain.value=0.0001;
    filt.connect(bus); bus.connect(master);
    bus.gain.setTargetAtTime(0.1, ctx.currentTime, 1.2);
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
  function stopAllAmbient(){ stopAllLoops(); stopAmbient(); }

  return {ensure,unlock,setMuted,isMuted,click,chime,playFile,stopAllLoops,
          startAmbient,stopAmbient,stopAllAmbient};
})();
