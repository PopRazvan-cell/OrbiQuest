/* ============================================================
   OrbiQuest VR — hub imersiv + cele 3 module + terminal, totul
   într-o singură scenă A-Frame continuă (fără schimbare de pagină,
   pentru că navigarea între pagini întrerupe sesiunea WebXR).
   ============================================================ */
/* mișcare pe thumbstick (translație orizontală, relativă la direcția privirii) */
AFRAME.registerComponent('simple-locomotion',{
  init(){
    this.vec={x:0,y:0};
    const onMove=e=>{ this.vec.x=e.detail.x||0; this.vec.y=e.detail.y||0; };
    const onEnd=()=>{ this.vec.x=0; this.vec.y=0; };
    ['handL','handR'].forEach(id=>{
      const el=document.getElementById(id);
      el.addEventListener('thumbstickmoved', onMove);
      el.addEventListener('axismove', onMove);
      el.addEventListener('thumbstickup', onEnd);
    });
  },
  tick(t,dt){
    const {x,y}=this.vec;
    if(Math.abs(x)<0.15 && Math.abs(y)<0.15) return;
    const THREE=AFRAME.THREE;
    const cam=document.getElementById('camera').object3D;
    const dir=new THREE.Vector3(); cam.getWorldDirection(dir); dir.y=0; dir.normalize();
    const right=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,1,0)).negate();
    const speed=1.6*(dt/1000);
    this.el.object3D.position.addScaledVector(dir,-y*speed);
    this.el.object3D.position.addScaledVector(right,x*speed);
  }
});

(function(){
  const THREE=AFRAME.THREE;
  const scene=document.querySelector('a-scene');
  const seed=(Date.now()^Math.floor(Math.random()*1e9))>>>0;
  const P=buildParams(seed);
  const codes={c1:null,c2:null,c3:null};
  let timeLeft=10*60, oxTimerId=null, gameEnded=false;

  /* scena e simplă (fără modele/texturi externe) și se poate încărca aproape
     instant — dacă 'loaded' se declanșează înainte ca acest script (ultimul
     din pagină) să apuce să asculte, evenimentul se pierde și init() nu mai
     rulează niciodată. De asta rămânea blocat pe ecranul de încărcare. */
  if(scene.hasLoaded) init();
  else scene.addEventListener('loaded', init);

  function init(){
    try{
      document.getElementById('loadingMsg').style.display='none';
      SFX.ensure();
      document.getElementById('rig').setAttribute('simple-locomotion','');
      buildSky();
      buildHub();
      buildHud();
      startOxygen();
      SFX.playFile('journal-whoosh.mp3', 0.7);
      setTimeout(()=>SFX.playFile('landing-ambient.mp3', 0.35, true), 1600);
    }catch(err){
      const m=document.getElementById('loadingMsg');
      m.style.display='flex'; m.style.color='#FF3366';
      m.textContent='Eroare la încărcare: '+err.message;
      console.error(err);
    }
  }

  /* ---------- cer înstelat: puncte 3D mici (nu textură pe sferă — arăta ca
     niște pete mari, neclare), fundal întunecat separat ---------- */
  function buildSky(){
    const bgGeo=new THREE.SphereGeometry(58,16,16);
    const bgMat=new THREE.MeshBasicMaterial({color:0x060a16, side:THREE.BackSide});
    document.getElementById('sky').setObject3D('bg', new THREE.Mesh(bgGeo,bgMat));

    const N=2500;
    const positions=new Float32Array(N*3);
    const colorsArr=new Float32Array(N*3);
    const cyan=new THREE.Color(0x7cf7ff), white=new THREE.Color(0xdfe9ff);
    for(let i=0;i<N;i++){
      const u=Math.random(), v=Math.random();
      const theta=2*Math.PI*u, phi=Math.acos(2*v-1);
      const R=50;
      positions[i*3]=R*Math.sin(phi)*Math.cos(theta);
      positions[i*3+1]=R*Math.sin(phi)*Math.sin(theta);
      positions[i*3+2]=R*Math.cos(phi);
      const base=Math.random()<0.15?cyan:white;
      const b=0.45+Math.random()*0.55;
      colorsArr[i*3]=base.r*b; colorsArr[i*3+1]=base.g*b; colorsArr[i*3+2]=base.b*b;
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geo.setAttribute('color', new THREE.BufferAttribute(colorsArr,3));
    const mat=new THREE.PointsMaterial({size:1.6, sizeAttenuation:false, vertexColors:true,
                                         transparent:true, opacity:0.9, depthWrite:false});
    document.getElementById('sky').setObject3D('mesh', new THREE.Points(geo,mat));
  }

  /* ---------- HUD fix (oxigen + cod), lângă centrul camerei, NU prins de rotația capului ---------- */
  let hudEl;
  function buildHud(){
    hudEl=VRUI.panel({width:1.1,height:0.3,pxW:760,parent:document.getElementById('hud'),
                       position:'0 2.35 -0.9', rotation:'-18 0 0'});
    renderHud();
  }
  function renderHud(){
    hudEl.redraw((ctx,w,h)=>{
      VRUI.drawPanelBg(ctx,w,h,'#00F0FF',0.78);
      ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='#7cf7ff';
      ctx.font='700 '+Math.round(h*0.24)+'px '+VRUI.FONT;
      ctx.fillText('OXIGEN  '+fmtTime(timeLeft), w*0.05, h*0.36);
      const d=[codes.c1,codes.c2,codes.c3].map(x=>x||'_').join('  ·  ');
      ctx.fillStyle= (codes.c1&&codes.c2&&codes.c3) ? '#2fffa8' : '#eaf6ff';
      ctx.fillText('COD  '+d, w*0.05, h*0.74);
    });
  }
  function startOxygen(){
    oxTimerId=setInterval(()=>{
      if(gameEnded) return;
      timeLeft--; renderHud();
      if(timeLeft<=0){ clearInterval(oxTimerId); onGameOver(); }
    },1000);
  }

  /* ---------- hub: 5 panouri într-un cerc în jurul jucătorului ---------- */
  const HUB_R=2.1;
  function ringPos(angleDeg,radius,y){
    const rad=angleDeg*Math.PI/180;
    return {x:radius*Math.sin(rad), y, z:-radius*Math.cos(rad)};
  }
  const hubDefs=[
    {id:'journal', angle:0,   title:'JURNAL DE BORD', accent:'#00F0FF'},
    {id:'m1',      angle:72,  title:'MODUL 01 · GRAVITAȚIE', accent:'#00F0FF'},
    {id:'m2',      angle:144, title:'MODUL 02 · SPECTRU', accent:'#7000FF'},
    {id:'m3',      angle:216, title:'MODUL 03 · PARALAXĂ', accent:'#FF3366'},
    {id:'core',    angle:288, title:'TERMINAL · REPORNIRE', accent:'#2fffa8'},
  ];
  const hubPanels={};
  function buildHub(){
    hubDefs.forEach(def=>{
      const pos=ringPos(def.angle,HUB_R,1.55);
      const p=VRUI.panel({width:0.85,height:0.55,pxW:520,parent:document.getElementById('hub'),
                           position:pos.x+' '+pos.y+' '+pos.z, rotation:'0 '+(-def.angle)+' 0',
                           clickable:true});
      hubPanels[def.id]=p;
      renderHubPanel(def);
      p.el.addEventListener('mouseenter',()=>{ p.el.setAttribute('animation__hov','property:scale; to:1.06 1.06 1.06; dur:120'); });
      p.el.addEventListener('mouseleave',()=>{ p.el.setAttribute('animation__hov','property:scale; to:1 1 1; dur:120'); });
      p.el.addEventListener('click',()=>{
        SFX.click();
        openConsole(def.id);
      });
    });
  }
  function statusOf(id){
    if(id==='m1') return codes.c1?'done':'active';
    if(id==='m2') return codes.c1? (codes.c2?'done':'active') : 'locked';
    if(id==='m3') return codes.c2? (codes.c3?'done':'active') : 'locked';
    if(id==='core') return (codes.c1&&codes.c2&&codes.c3) ? 'active' : 'locked';
    return 'active';
  }
  function renderHubPanel(def){
    const p=hubPanels[def.id];
    const st=statusOf(def.id);
    p.redraw((ctx,w,h)=>{
      VRUI.drawPanelBg(ctx,w,h, st==='done'?'#2fffa8':(st==='locked'?'#3a4560':def.accent), st==='locked'?0.55:0.85);
      ctx.textAlign='center';
      ctx.fillStyle='#eaf6ff'; ctx.font='700 '+Math.round(h*0.13)+'px '+VRUI.FONT;
      VRUI.wrapText(ctx, def.title, w/2, h*0.32, w*0.82, h*0.16);
      ctx.font='400 '+Math.round(h*0.09)+'px '+VRUI.FONT;
      ctx.fillStyle = st==='done'?'#2fffa8':(st==='locked'?'#8a95b0':'#7cf7ff');
      const msg = def.id==='journal' ? 'Apasă pentru a citi' : (st==='done'?'✓ Rezolvat':(st==='locked'?'Blocat':'Apasă pentru a intra'));
      ctx.fillText(msg, w/2, h*0.78);
    });
  }
  function refreshHub(){ hubDefs.forEach(renderHubPanel); }

  /* ---------- gestionare consolă activă: fiecare modul e o "cameră" izolată —
     hub-ul (și tot ce ține de meniu) se ascunde complet cât timp ești în ea,
     ca să nu se mai suprapună nimic ---------- */
  const consolesRoot=document.getElementById('consoles');
  const hubEl=document.getElementById('hub');
  let activeConsole=null, activeId=null;
  const AMBIENT_FILE={m2:'modul02-ambient.mp3', m3:'modul03-ambient.mp3'};
  /* setăm și "visible" (randare) și "scale" la 0 (nu doar vizual — geometria
     de dimensiune ~0 nu mai poate fi lovită de raycaster, deci panourile din
     hub chiar nu mai sunt "apăsabile" cât timp ești într-o consolă) */
  function setHubVisible(v){
    hubEl.setAttribute('visible', v);
    hubEl.setAttribute('scale', v? '1 1 1' : '0.001 0.001 0.001');
  }
  function clearConsole(){
    if(activeConsole){ activeConsole.remove(); activeConsole=null; }
    while(consolesRoot.firstChild) consolesRoot.removeChild(consolesRoot.firstChild);
    if(mod1.stopSim) mod1.stopSim();
  }
  function openConsole(id){
    clearConsole();
    activeId=id;
    setHubVisible(false);
    SFX.playFile('door-sound.mp3', 0.5);
    if(id!=='journal'){
      SFX.stopAllAmbient();
      if(id==='m1') SFX.startAmbient('m1');
      else if(id==='core') SFX.startAmbient('core');
      else if(AMBIENT_FILE[id]) SFX.playFile(AMBIENT_FILE[id], 0.5, true);
    }
    activeConsole=document.createElement('a-entity');
    activeConsole.setAttribute('position','0 1.35 -1.15');
    consolesRoot.appendChild(activeConsole);
    VRUI.button({parent:activeConsole,width:0.4,height:0.12,label:'◀ HUB',accent:'#8a95b0',
                 position:'0 0.95 0', onClick:closeConsole});
    if(id==='journal') journal.open(activeConsole);
    else if(id==='m1') mod1.open(activeConsole);
    else if(id==='m2') mod2.open(activeConsole);
    else if(id==='m3') mod3.open(activeConsole);
    else if(id==='core') core.open(activeConsole);
  }
  function closeConsole(){
    clearConsole();
    setHubVisible(true);
    if(activeId && activeId!=='journal'){
      SFX.stopAllAmbient();
      SFX.playFile('landing-ambient.mp3', 0.35, true);
    }
    activeId=null;
  }

  function digitEarned(which,val){
    codes[which]=val; renderHud(); refreshHub(); SFX.chime(true);
  }

  /* ============================================================
     JURNAL DE BORD — povestea (aceeași ca pe landing page-ul 2D)
     ============================================================ */
  const journal=(function(){
    const TEXT=[
      '214 zile de la lansare. Naveta de cercetare ARV Kepler-9 traversa marginea sistemului solar, la 41 de unități astronomice de Soare, când senzorii au înregistrat o anomalie gravitațională neînregistrată în nicio hartă stelară. O fracțiune de secundă mai târziu, un impuls a lovit nava — sistemele s-au blocat, culoarele s-au întunecat, iar inteligența artificială de bord a intrat în avarie.',
      'Ai fost singurul membru al echipajului readus la conștiență de sistemul de urgență. Rezervă de oxigen: 10 minute. Suficient cât să repari, pe rând, cele trei module vitale ale navei — Laboratorul de Astrofizică, Observatorul spectral și Reactorul cuantic — și să introduci codul de repornire înainte ca aerul să se termine.',
      'Fiecare modul e blocat cu o cifră derivată dintr-o lege reală a fizicii. Rezolvă ecuațiile, recalibrează instrumentele, recuperează fragmentele codului. Nava — și tu — nu aveți a doua șansă.'
    ];
    function open(parent){
      const p=VRUI.panel({width:1.3,height:1.0,pxW:900,pxH:700,parent,position:'0 0.3 0'});
      p.redraw((ctx,w,h)=>{
        VRUI.drawPanelBg(ctx,w,h,'#00F0FF',0.9);
        ctx.textAlign='left'; ctx.fillStyle='#7cf7ff';
        ctx.font='700 '+Math.round(h*0.045)+'px '+VRUI.FONT;
        ctx.fillText('JURNAL DE BORD — ULTIMA TRANSMISIE', w*0.06, h*0.09);
        ctx.fillStyle='#eaf6ff'; ctx.font='400 '+Math.round(h*0.032)+'px '+VRUI.FONT;
        let y=h*0.19; const lh=h*0.044;
        TEXT.forEach(par=>{ y=VRUI.wrapText(ctx,par,w*0.06,y,w*0.88,lh)+lh*0.6; });
      });
    }
    return {open};
  })();

  /* ============================================================
     MODUL 1 — orbită circulară (v = √(GM/r)), simulare 3D reală
     ============================================================ */
  const mod1=(function(){
    const PXPERMM=0.62, SIM_G_LOCAL=4200;
    let r=125, v=1.50, physId=null, sim=null, tableRoot=null, statusText=null, velSlider=null;
    let planetMesh=null, probeMesh=null, targetRing=null;

    function open(parent){
      r=125; v=1.50; sim=null;
      tableRoot=document.createElement('a-entity');
      tableRoot.setAttribute('position','0 0 0');
      parent.appendChild(tableRoot);

      const holo=document.createElement('a-entity');
      holo.setAttribute('position','0 0.15 -0.55');
      holo.setAttribute('rotation','-55 0 0');
      tableRoot.appendChild(holo);

      const planetGeo=new THREE.SphereGeometry(0.045,20,20);
      const planetMat=new THREE.MeshBasicMaterial({color:0xd98a3a});
      planetMesh=new THREE.Mesh(planetGeo,planetMat);
      holo.setObject3D('planet',planetMesh);

      const probeGeo=new THREE.SphereGeometry(0.02,14,14);
      const probeMat=new THREE.MeshBasicMaterial({color:0x00F0FF});
      probeMesh=new THREE.Mesh(probeGeo,probeMat);
      probeMesh.visible=false;
      holo.setObject3D('probe',probeMesh);

      updateTargetRing(holo);

      statusText=VRUI.panel({width:0.6,height:0.16,pxW:460,parent:tableRoot,position:'0 0.72 0'});
      const rLabel=VRUI.panel({width:0.34,height:0.1,pxW:320,parent:tableRoot,position:'0 0.55 0'});
      const targetLabel=VRUI.panel({width:0.5,height:0.09,pxW:420,parent:tableRoot,position:'0 -0.62 0'});

      function renderLabels(){
        rLabel.redraw((ctx,w,h)=>{ VRUI.drawPanelBg(ctx,w,h,'#00F0FF',0.75);
          ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#eaf6ff';
          ctx.font='700 '+Math.round(h*0.4)+'px '+VRUI.FONT; ctx.fillText('Raza: '+r+' Mm',w/2,h/2); });
        targetLabel.redraw((ctx,w,h)=>{ VRUI.drawPanelBg(ctx,w,h,'#7cf7ff',0.55);
          ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#7cf7ff';
          ctx.font='400 '+Math.round(h*0.42)+'px '+VRUI.FONT;
          ctx.fillText('Rază țintă (date navă): '+P.r1+' Mm', w/2, h/2); });
      }
      function setStatus(msg,color){
        statusText.redraw((ctx,w,h)=>{
          VRUI.drawPanelBg(ctx,w,h,color||'#00F0FF',0.82);
          ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#eaf6ff';
          ctx.font='700 '+Math.round(h*0.24)+'px '+VRUI.FONT;
          VRUI.wrapText(ctx,msg,w/2,h*0.32,w*0.9,h*0.32);
        });
      }
      renderLabels();
      setStatus('Reglează raza și viteza, apoi lansează sonda.','#00F0FF');

      function stepRadius(delta){
        return ()=>{
          r=Math.min(255,Math.max(125,Math.round((r+delta)/5)*5));
          renderLabels(); setStatus('Reglează raza și viteza, apoi lansează sonda.','#00F0FF');
          checkBtn.setDisabled(true);
        };
      }
      VRUI.button({parent:tableRoot,width:0.16,height:0.1,label:'−5',accent:'#0090a8',position:'-0.42 0.55 0',onClick:stepRadius(-5)});
      VRUI.button({parent:tableRoot,width:0.16,height:0.1,label:'+5',accent:'#0090a8',position:'0.42 0.55 0',onClick:stepRadius(5)});

      velSlider=VRUI.slider({parent:tableRoot,width:0.85,height:0.15,position:'0 0.32 0',
        min:1.5,max:6,step:0.05,value:v,accent:'#0090a8',label:'Viteză injecție',
        format:x=>x.toFixed(2)+' km/s',
        onChange:val=>{
          v=val; setStatus('Reglează raza și viteza, apoi lansează sonda.','#00F0FF');
          checkBtn.setDisabled(true);
        }});

      const checkBtn=VRUI.button({parent:tableRoot,width:0.55,height:0.13,label:'BLOCHEAZĂ ORBITA',accent:'#2fffa8',
                                   position:'0.3 -0.78 0', disabled:true,
                                   onClick:()=>{
                                     digitEarned('c1',P.dig1);
                                     setStatus('Cod extras: '+P.dig1+'. Poți reveni la hub.','#2fffa8');
                                     checkBtn.setDisabled(true);
                                   }});
      VRUI.button({parent:tableRoot,width:0.32,height:0.13,label:'↻ LANSEAZĂ',accent:'#0090a8',
                   position:'-0.35 -0.78 0', onClick:launch});

      function launch(){
        stopSim();
        const r_px=r*PXPERMM, v_px=v/P.KMS_PER_SIMV;
        sim={x:r_px,y:0,vx:0,vy:-v_px,alive:true,frames:0};
        probeMesh.visible=true; probeMesh.material.color.set(0x00F0FF);
        let minR=1e9,maxR=0; const DT=0.7;
        setStatus('Sondă lansată — se calculează traiectoria…','#7cf7ff');
        physId=setInterval(()=>{
          for(let k=0;k<16;k++){
            const dx=sim.x,dy=sim.y,d=Math.hypot(dx,dy);
            if(d<24){ sim.alive=false; break; }
            const a=SIM_G_LOCAL/(d*d);
            sim.vx-=a*dx/d*DT; sim.vy-=a*dy/d*DT;
            sim.x+=sim.vx*DT; sim.y+=sim.vy*DT;
            minR=Math.min(minR,d); maxR=Math.max(maxR,d);
          }
          probeMesh.position.set(sim.x/100, sim.y/100, 0);
          sim.frames++;
          const dNow=Math.hypot(sim.x,sim.y);
          if(dNow>320) sim.alive=false;
          if(!sim.alive){
            clearInterval(physId);
            probeMesh.material.color.set(0xFF3366);
            setStatus(dNow>320?'Sonda a scăpat — viteză prea mare.':'Sonda s-a prăbușit — viteză prea mică.','#FF3366');
            return;
          }
          if(sim.frames>75){
            clearInterval(physId);
            const ecc=(maxR-minR)/(maxR+minR||1);
            const stable=ecc<0.055, onTarget=(r===P.r1);
            if(stable&&onTarget){
              probeMesh.material.color.set(0x2fffa8);
              setStatus('Orbită stabilă, pe raza-țintă! Blochează pentru cod.','#2fffa8');
              checkBtn.setDisabled(false);
            }else if(stable&&!onTarget){
              probeMesh.material.color.set(0xFFD34D);
              setStatus('Orbită stabilă, dar la altă rază decât cea din date ('+P.r1+' Mm).','#FFD34D');
            }else{
              probeMesh.material.color.set(0xFF3366);
              setStatus('Orbită eliptică (ecc='+ecc.toFixed(3)+'). Recalculează v=√(GM/r).','#FF3366');
            }
          }
        },30);
      }
      function updateTargetRing(holo){
        const rt=(P.r1*PXPERMM)/100;
        const geo=new THREE.RingGeometry(rt-0.006,rt+0.006,64);
        const mat=new THREE.MeshBasicMaterial({color:0x5bc0ff,transparent:true,opacity:0.35,side:THREE.DoubleSide});
        targetRing=new THREE.Mesh(geo,mat);
        holo.setObject3D('targetRing',targetRing);
      }
    }
    function stopSim(){
      if(physId){ clearInterval(physId); physId=null; }
      if(velSlider){ velSlider.destroy(); velSlider=null; }
    }
    return {open, stopSim};
  })();

  /* ============================================================
     MODUL 02 — efect Doppler (deplasare spre roșu)
     ============================================================ */
  const mod2=(function(){
    function wlColor(wl){
      let r,g,b;
      if(wl<440){r=(440-wl)/40;g=0;b=1;}
      else if(wl<490){r=0;g=(wl-440)/50;b=1;}
      else if(wl<510){r=0;g=1;b=(510-wl)/20;}
      else if(wl<580){r=(wl-510)/70;g=1;b=0;}
      else if(wl<645){r=1;g=(645-wl)/65;b=0;}
      else{r=1;g=0;b=0;}
      return 'rgb('+Math.round(r*255)+','+Math.round(g*255)+','+Math.round(b*255)+')';
    }
    function open(parent){
      let cursor=656.3;
      const specW=1024, specWmin=640, specWmax=Math.max(720, Math.ceil(P.lamObs+20));
      const spec=VRUI.panel({width:1.0,height:0.28,pxW:specW,pxH:180,parent,position:'0 0.55 0'});
      const status=VRUI.panel({width:0.9,height:0.16,pxW:640,parent,position:'0 0.2 0'});
      function wl2x(wl,w){ return (wl-specWmin)/(specWmax-specWmin)*w; }
      function drawSpec(){
        spec.redraw((ctx,w,h)=>{
          ctx.clearRect(0,0,w,h);
          for(let px=0;px<w;px++){ const wl=specWmin+(px/w)*(specWmax-specWmin); ctx.fillStyle=wlColor(wl); ctx.fillRect(px,20,1,h-60); }
          ctx.strokeStyle='#0a0f18'; ctx.lineWidth=3; ctx.strokeRect(0,20,w,h-60);
          ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(wl2x(656.3,w),8); ctx.lineTo(wl2x(656.3,w),h-30); ctx.stroke();
          ctx.fillStyle='#dfe9ff'; ctx.font='700 15px '+VRUI.FONT; ctx.textAlign='center';
          ctx.fillText('laborator 656.3',wl2x(656.3,w),h-8);
          ctx.fillStyle='#ff6b6b';
          ctx.fillText('linie observată',wl2x(P.lamObs,w),h-8);
          ctx.strokeStyle='#b98cff'; ctx.lineWidth=4;
          ctx.beginPath(); ctx.moveTo(wl2x(cursor,w),0); ctx.lineTo(wl2x(cursor,w),h-38); ctx.stroke();
        });
      }
      function setStatus(msg,color){
        status.redraw((ctx,w,h)=>{
          VRUI.drawPanelBg(ctx,w,h,color||'#7000FF',0.82);
          ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#eaf6ff';
          ctx.font='700 '+Math.round(h*0.22)+'px '+VRUI.FONT;
          VRUI.wrapText(ctx,msg,w/2,h*0.3,w*0.92,h*0.3);
        });
      }
      drawSpec();
      setStatus('Aliniază cursorul pe linia observată, apoi introdu viteza (km/s).','#7000FF');

      function moveCursor(d){ return ()=>{ cursor=Math.min(specWmax,Math.max(specWmin,cursor+d)); drawSpec(); }; }
      VRUI.button({parent,width:0.15,height:0.1,label:'≪5',accent:'#4a00a8',position:'-0.6 -0.02 0',onClick:moveCursor(-5)});
      VRUI.button({parent,width:0.15,height:0.1,label:'≪1',accent:'#4a00a8',position:'-0.4 -0.02 0',onClick:moveCursor(-1)});
      VRUI.button({parent,width:0.15,height:0.1,label:'1≫',accent:'#4a00a8',position:'0.4 -0.02 0',onClick:moveCursor(1)});
      VRUI.button({parent,width:0.15,height:0.1,label:'5≫',accent:'#4a00a8',position:'0.6 -0.02 0',onClick:moveCursor(5)});

      VRUI.keypad({parent,position:'0 -0.62 0',maxLen:6,placeholder:'viteză',suffix:' km/s',confirmLabel:'CONFIRMĂ VITEZA',
        onConfirm:(val)=>{
          const cursorOK=Math.abs(cursor-P.lamObs)<=0.6;
          const v=parseInt(val,10);
          if(!cursorOK){ setStatus('Cursorul nu e pe linia observată. Ajustează-l întâi.','#FF3366'); return; }
          if(isNaN(v)){ setStatus('Introdu viteza calculată (număr întreg).','#FF3366'); return; }
          const tol=Math.max(P.v2correct*0.03,120);
          if(Math.abs(v-P.v2correct)<=tol){
            digitEarned('c2',P.dig2);
            setStatus('Viteză confirmată (~'+Math.round(P.v2correct)+' km/s). Cod: '+P.dig2,'#2fffa8');
          }else{
            setStatus('Greșit. z=(λ_obs−656.3)/656.3, v=z·c. (toleranță ±3%)','#FF3366');
          }
        }});
    }
    return {open};
  })();

  /* ============================================================
     MODUL 03 — paralaxă trigonometrică
     ============================================================ */
  const mod3=(function(){
    function open(parent){
      let jan=true;
      const scene3=VRUI.panel({width:0.9,height:0.5,pxW:640,pxH:360,parent,position:'0 0.55 0'});
      const status=VRUI.panel({width:0.9,height:0.14,pxW:640,parent,position:'0 0.2 0'});
      function draw(){
        scene3.redraw((ctx,w,h)=>{
          ctx.clearRect(0,0,w,h);
          ctx.fillStyle='#070b11'; ctx.fillRect(0,0,w,h);
          ctx.strokeStyle='rgba(150,170,200,.35)'; ctx.setLineDash([3,4]);
          ctx.beginPath(); ctx.ellipse(w*0.5,h*0.72,w*0.32,h*0.09,0,0,7); ctx.stroke(); ctx.setLineDash([]);
          const sunGrad=ctx.createRadialGradient(w*0.5,h*0.74,2,w*0.5,h*0.74,16);
          sunGrad.addColorStop(0,'#fff4d6'); sunGrad.addColorStop(1,'#d98a3a');
          ctx.fillStyle=sunGrad; ctx.beginPath(); ctx.arc(w*0.5,h*0.74,14,0,7); ctx.fill();
          const ex= jan? w*0.22 : w*0.78;
          ctx.fillStyle='#3a7bd5'; ctx.beginPath(); ctx.arc(ex,h*0.63,9,0,7); ctx.fill();
          ctx.fillStyle='#9fb3d0'; ctx.font='700 14px '+VRUI.FONT; ctx.textAlign='center';
          ctx.fillText(jan?'Ianuarie':'Iulie', ex, h*0.63-16);
          const starX= jan? w*0.58 : w*0.42, starY=h*0.18;
          ctx.strokeStyle='rgba(255,125,156,.5)'; ctx.lineWidth=1.4; ctx.setLineDash([2,4]);
          ctx.beginPath(); ctx.moveTo(ex,h*0.63); ctx.lineTo(starX,starY); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle='#ff7d9c'; ctx.beginPath(); ctx.arc(starX,starY,7,0,7); ctx.fill();
          ctx.fillStyle='#c9d6e2'; ctx.font='700 15px '+VRUI.FONT; ctx.fillText('Vega-B', starX, starY-14);
          ctx.globalAlpha=.35; ctx.fillStyle='#ff7d9c';
          ctx.beginPath(); ctx.arc(jan? w*0.42:w*0.58, starY,6,0,7); ctx.fill(); ctx.globalAlpha=1;
          ctx.fillStyle='#7f8bab'; ctx.font='700 15px '+VRUI.FONT; ctx.textAlign='left';
          ctx.fillText('Deplasare totală (2p): '+P.shift3.toFixed(3)+'″', 14, h-16);
        });
      }
      function setStatus(msg,color){
        status.redraw((ctx,w,h)=>{
          VRUI.drawPanelBg(ctx,w,h,color||'#FF3366',0.82);
          ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#eaf6ff';
          ctx.font='700 '+Math.round(h*0.26)+'px '+VRUI.FONT;
          VRUI.wrapText(ctx,msg,w/2,h*0.34,w*0.92,h*0.32);
        });
      }
      draw();
      setStatus('Comută poziția, calculează distanța (p=deplasare/2, d=1/p).','#FF3366');
      VRUI.button({parent,width:0.4,height:0.1,label:'⇄ Comută lună',accent:'#a8102f',position:'0 -0.02 0',
                   onClick:()=>{ jan=!jan; draw(); }});
      VRUI.keypad({parent,position:'0 -0.62 0',maxLen:6,allowDot:true,placeholder:'parseci',suffix:' pc',confirmLabel:'CONFIRMĂ DISTANȚA',
        onConfirm:(val)=>{
          const d=parseFloat(val);
          if(isNaN(d)){ setStatus('Introdu distanța în parseci.','#FF3366'); return; }
          const tol=Math.max(P.d3correct*0.02,0.6);
          if(Math.abs(d-P.d3correct)<=tol){
            digitEarned('c3',P.dig3);
            setStatus('Distanță confirmată ('+P.d3correct.toFixed(1)+' pc). Cod: '+P.dig3,'#2fffa8');
          }else{
            setStatus('Greșit. p=deplasare/2; d=1/p (parseci).','#FF3366');
          }
        }});
    }
    return {open};
  })();

  /* ============================================================
     TERMINAL — codul final de 3 cifre
     ============================================================ */
  const core=(function(){
    function open(parent){
      const status=VRUI.panel({width:0.9,height:0.2,pxW:640,parent,position:'0 0.55 0'});
      function setStatus(msg,color){
        status.redraw((ctx,w,h)=>{
          VRUI.drawPanelBg(ctx,w,h,color||'#00F0FF',0.85);
          ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#eaf6ff';
          ctx.font='700 '+Math.round(h*0.2)+'px '+VRUI.FONT;
          VRUI.wrapText(ctx,msg,w/2,h*0.3,w*0.92,h*0.28);
        });
      }
      setStatus('Introdu codul de 3 cifre colectat din module.','#00F0FF');
      VRUI.keypad({parent,position:'0 -0.1 0',maxLen:3,placeholder:'cod',confirmLabel:'ACCES TERMINAL',
        onConfirm:(val)=>{
          if(!(codes.c1&&codes.c2&&codes.c3)){ setStatus('Lipsesc cifre — rezolvă mai întâi toate modulele.','#FF3366'); return; }
          const real=''+codes.c1+codes.c2+codes.c3;
          if(val===real){ onWin(); }
          else{ setStatus('ACCES REFUZAT · cod incorect.','#FF3366'); SFX.chime(false); }
        }});
    }
    return {open};
  })();

  /* ---------- final: victorie / eșec ---------- */
  function onWin(){
    if(gameEnded) return; gameEnded=true;
    clearInterval(oxTimerId);
    SFX.chime(true); SFX.stopAllLoops();
    clearConsole();
    const dep=SFX.playFile('door-sound.mp3',0.8);
    dep.addEventListener('ended', ()=>SFX.playFile('launch-sound.mp3',0.8));
    spawnBurst();
    const win=VRUI.panel({width:1.2,height:0.6,pxW:820,parent:document.getElementById('fx'),position:'0 1.5 -1.3'});
    win.redraw((ctx,w,h)=>{
      VRUI.drawPanelBg(ctx,w,h,'#2fffa8',0.92);
      ctx.textAlign='center'; ctx.fillStyle='#2fffa8'; ctx.font='800 '+Math.round(h*0.16)+'px '+VRUI.FONT;
      ctx.fillText('NAVA ONLINE', w/2, h*0.32);
      ctx.fillStyle='#eaf6ff'; ctx.font='400 '+Math.round(h*0.09)+'px '+VRUI.FONT;
      ctx.fillText('Ai scăpat cu '+fmtTime(Math.max(0,timeLeft))+' rezervă de oxigen.', w/2, h*0.56);
      ctx.font='700 '+Math.round(h*0.09)+'px '+VRUI.FONT; ctx.fillStyle='#7cf7ff';
      ctx.fillText('Reîncarcă pagina pentru o partidă nouă.', w/2, h*0.78);
    });
  }
  function onGameOver(){
    if(gameEnded) return; gameEnded=true;
    SFX.chime(false); SFX.stopAllLoops();
    clearConsole();
    const go=VRUI.panel({width:1.2,height:0.5,pxW:820,parent:document.getElementById('fx'),position:'0 1.5 -1.3'});
    go.redraw((ctx,w,h)=>{
      VRUI.drawPanelBg(ctx,w,h,'#FF3366',0.92);
      ctx.textAlign='center'; ctx.fillStyle='#FF3366'; ctx.font='800 '+Math.round(h*0.18)+'px '+VRUI.FONT;
      ctx.fillText('SEMNAL TĂCUT', w/2, h*0.38);
      ctx.fillStyle='#eaf6ff'; ctx.font='400 '+Math.round(h*0.1)+'px '+VRUI.FONT;
      ctx.fillText('Oxigenul s-a epuizat. Reîncarcă pagina pentru a reîncerca.', w/2, h*0.68);
    });
  }
  function spawnBurst(){
    const fx=document.getElementById('fx');
    for(let i=0;i<40;i++){
      const geo=new THREE.SphereGeometry(0.02,6,6);
      const mat=new THREE.MeshBasicMaterial({color: Math.random()<0.5?0x2fffa8:0x00F0FF, transparent:true, opacity:1});
      const mesh=new THREE.Mesh(geo,mat);
      const el=document.createElement('a-entity');
      el.setAttribute('position','0 1.5 -1.3');
      fx.appendChild(el);
      el.setObject3D('mesh',mesh);
      const ang=Math.random()*Math.PI*2, dist=0.6+Math.random()*1.4;
      const dx=Math.cos(ang)*dist, dy=(Math.random()-0.2)*1.4, dz=Math.sin(ang)*dist;
      el.setAttribute('animation__mv','property:position; to:'+dx+' '+(1.5+dy)+' '+(-1.3+dz)+'; dur:1400; easing:easeOutQuad');
      /* opacitatea materialului nu e o proprietate de componentă A-Frame (mesh-ul e adăugat brut
         prin setObject3D), deci fade-ul se face manual, nu prin componenta declarativă animation */
      const t0=performance.now();
      (function fade(){
        const t=(performance.now()-t0)/1400;
        mat.opacity=Math.max(0,1-t);
        if(t<1) requestAnimationFrame(fade); else el.remove();
      })();
    }
  }
})();
