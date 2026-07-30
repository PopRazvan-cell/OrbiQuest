/* ============================================================
   OrbiQuest VR — set de widget-uri 3D desenate pe canvas (texturi),
   nu text A-Frame nativ: fontul implicit A-Frame nu are diacritice
   românești, deci tot textul e desenat cu Canvas2D (Arial), la fel
   ca soluția folosită și pentru PDF-ul de documentație.
   ============================================================ */
const VRUI = (function(){
  const THREE = AFRAME.THREE;
  const FONT = "'Segoe UI', Arial, sans-serif";

  function makeCanvas(pxW, pxH){
    const c=document.createElement('canvas');
    c.width=pxW; c.height=pxH;
    return c;
  }

  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function panel(opts){
    const width=opts.width, height=opts.height;
    const pxW=opts.pxW||512, pxH=opts.pxH||Math.round(pxW*(height/width));
    const canvas=makeCanvas(pxW,pxH);
    const ctx=canvas.getContext('2d');
    const geo=new THREE.PlaneGeometry(width,height);
    const tex=new THREE.CanvasTexture(canvas);
    tex.minFilter=THREE.LinearFilter;
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:!opts.transparent});
    const mesh=new THREE.Mesh(geo,mat);
    const el=document.createElement('a-entity');
    if(opts.position) el.setAttribute('position',opts.position);
    if(opts.rotation) el.setAttribute('rotation',opts.rotation);
    (opts.parent||document.querySelector('a-scene')).appendChild(el);
    el.setObject3D('mesh',mesh);
    if(opts.clickable){ el.classList.add('clickable'); }
    function redraw(fn){ fn(ctx,pxW,pxH); tex.needsUpdate=true; }
    return {el,canvas,ctx,tex,redraw,pxW,pxH,width,height};
  }

  function drawPanelBg(ctx,w,h,accent,alpha){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='rgba(8,14,26,'+(alpha!==undefined?alpha:0.86)+')';
    roundRect(ctx,0,0,w,h,Math.min(w,h)*0.04); ctx.fill();
    ctx.strokeStyle=accent||'#00F0FF'; ctx.lineWidth=Math.max(2,w*0.006);
    roundRect(ctx,ctx.lineWidth,ctx.lineWidth,w-ctx.lineWidth*2,h-ctx.lineWidth*2,Math.min(w,h)*0.035);
    ctx.stroke();
  }

  function wrapText(ctx,text,x,y,maxWidth,lineHeight){
    const words=text.split(' ');
    let line='', ly=y;
    for(let i=0;i<words.length;i++){
      const test=line+words[i]+' ';
      if(ctx.measureText(test).width>maxWidth && line!==''){
        ctx.fillText(line,x,ly); line=words[i]+' '; ly+=lineHeight;
      }else line=test;
    }
    ctx.fillText(line,x,ly);
    return ly+lineHeight;
  }

  /* buton simplu, click prin laser-controls / mouse (VRUI.button) */
  function button(opts){
    const p=panel({width:opts.width||0.5,height:opts.height||0.16,pxW:opts.pxW||420,
                    parent:opts.parent,position:opts.position,rotation:opts.rotation,clickable:true});
    let hover=false, disabled=!!opts.disabled;
    function render(){
      p.redraw((ctx,w,h)=>{
        drawPanelBg(ctx,w,h, disabled?'#3a4560':(hover?'#7cf7ff':(opts.accent||'#00F0FF')), disabled?0.55:(hover?0.95:0.82));
        ctx.fillStyle= disabled? '#6a7590' : '#eaf6ff';
        ctx.font='700 '+Math.round(h*0.34)+'px '+FONT;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(opts.label||'', w/2, h/2);
      });
    }
    render();
    p.el.addEventListener('mouseenter',()=>{ if(!disabled){hover=true;render();} });
    p.el.addEventListener('mouseleave',()=>{ hover=false; render(); });
    p.el.addEventListener('click',()=>{
      if(disabled) return;
      SFX.click();
      p.el.setAttribute('animation__press','property: scale; from: 1 1 1; to: 0.9 0.9 0.9; dir: alternate; dur: 90; loop: 2');
      if(opts.onClick) opts.onClick();
    });
    return {
      el:p.el,
      setLabel(t){ opts.label=t; render(); },
      setDisabled(d){ disabled=d; render(); }
    };
  }

  /* slider draggabil cu laser-ul: apucă mânerul (mousedown/trigger) și trage
     stânga-dreapta; poziția se citește din UV-ul intersecției raycaster-ului,
     interogat direct (nu prin evenimente, care sunt limitate la ~10/s) */
  function slider(opts){
    const insetL=0.09, insetR=0.91;
    const p=panel({width:opts.width||0.62,height:opts.height||0.15,pxW:opts.pxW||520,
                    parent:opts.parent,position:opts.position,rotation:opts.rotation,clickable:true});
    let value=opts.value!==undefined?opts.value:opts.min;
    let dragging=false;
    const min=opts.min, max=opts.max, step=opts.step||0.01;
    function clampStep(v){
      v=Math.round(v/step)*step;
      v=Math.min(max,Math.max(min,v));
      return Math.round(v*1000)/1000;
    }
    function render(){
      p.redraw((ctx,w,h)=>{
        drawPanelBg(ctx,w,h,opts.accent||'#00F0FF',0.82);
        const ty=h*0.66, x0=w*insetL, x1=w*insetR;
        ctx.strokeStyle='rgba(255,255,255,.3)'; ctx.lineWidth=h*0.07; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(x0,ty); ctx.lineTo(x1,ty); ctx.stroke();
        const f=(value-min)/(max-min);
        const hx=x0+f*(x1-x0);
        ctx.strokeStyle=opts.accent||'#00F0FF'; ctx.lineWidth=h*0.07;
        ctx.beginPath(); ctx.moveTo(x0,ty); ctx.lineTo(hx,ty); ctx.stroke();
        ctx.fillStyle='#eaf6ff'; ctx.beginPath(); ctx.arc(hx,ty,h*0.19,0,7); ctx.fill();
        ctx.strokeStyle=opts.accent||'#00F0FF'; ctx.lineWidth=h*0.035;
        ctx.beginPath(); ctx.arc(hx,ty,h*0.19,0,7); ctx.stroke();
        ctx.fillStyle='#eaf6ff'; ctx.textAlign='center'; ctx.font='700 '+Math.round(h*0.26)+'px '+FONT;
        ctx.fillText((opts.label||'')+' '+(opts.format?opts.format(value):value), w/2, h*0.24);
      });
    }
    render();

    function applyUV(uv){
      if(!uv) return;
      const f=Math.min(1,Math.max(0,(uv.x-insetL)/(insetR-insetL)));
      const v=clampStep(min+f*(max-min));
      if(v!==value){ value=v; render(); if(opts.onChange) opts.onChange(value); }
    }
    p.el.addEventListener('mousedown', e=>{
      dragging=true; SFX.click();
      const inter=e.detail&&e.detail.intersection;
      if(inter&&inter.uv) applyUV(inter.uv);
    });
    ['mouseup','mouseleave'].forEach(ev=>p.el.addEventListener(ev,()=>{ dragging=false; }));
    addEventListener('mouseup',()=>{ dragging=false; });

    const pollId=setInterval(()=>{
      if(!dragging) return;
      const mesh=p.el.getObject3D('mesh');
      ['handL','handR'].forEach(id=>{
        const hand=document.getElementById(id);
        const rc=hand&&hand.components&&hand.components.raycaster;
        if(!rc||!rc.intersections) return;
        const hit=rc.intersections.find(i=>i.object===mesh);
        if(hit&&hit.uv) applyUV(hit.uv);
      });
    },20);

    return {
      el:p.el,
      get value(){ return value; },
      set(v){ value=clampStep(v); render(); },
      destroy(){ clearInterval(pollId); }
    };
  }

  /* tastatură numerică 3D (0-9, ștergere, confirmare) — folosită
     pentru toate răspunsurile numerice (viteze, distanțe, cod final) */
  function keypad(opts){
    const parent=document.createElement('a-entity');
    parent.setAttribute('position',opts.position||'0 0 0');
    if(opts.rotation) parent.setAttribute('rotation',opts.rotation);
    (opts.parent||document.querySelector('a-scene')).appendChild(parent);

    let value='';
    const maxLen=opts.maxLen||6;
    const allowDot=!!opts.allowDot;
    const disp=panel({width:0.66,height:0.16,pxW:520,parent,position:'0 0.62 0',clickable:false});
    function renderDisp(){
      disp.redraw((ctx,w,h)=>{
        drawPanelBg(ctx,w,h,'#0090a8',0.9);
        ctx.fillStyle='#7cf7ff'; ctx.font='700 '+Math.round(h*0.42)+'px '+FONT;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText((value||opts.placeholder||'—')+(opts.suffix||''), w/2, h/2);
      });
    }
    renderDisp();

    const keys=['7','8','9','4','5','6','1','2','3', allowDot?'.':'', '0','⌫'];
    const cols=3, bw=0.2, bh=0.16, gap=0.03;
    keys.forEach((k,i)=>{
      if(k==='') return;
      const col=i%cols, row=Math.floor(i/cols);
      const x=(col-1)*(bw+gap);
      const y=0.4 - row*(bh+gap);
      button({
        parent, width:bw, height:bh, label:k, accent:'#0090a8',
        position:x+' '+y+' 0',
        onClick:()=>{
          if(k==='⌫'){ value=value.slice(0,-1); }
          else if(value.length<maxLen){ if(!(k==='.'&&value.includes('.'))) value+=k; }
          renderDisp();
          if(opts.onChange) opts.onChange(value);
        }
      });
    });
    button({
      parent, width:0.66, height:0.16, label:opts.confirmLabel||'CONFIRMĂ', accent:'#2fffa8',
      position:'0 -0.42 0',
      onClick:()=>{ if(opts.onConfirm) opts.onConfirm(value); }
    });

    return {
      el:parent,
      getValue:()=>value,
      clear(){ value=''; renderDisp(); },
      set(v){ value=String(v); renderDisp(); }
    };
  }

  return {panel, button, slider, keypad, drawPanelBg, wrapText, roundRect, FONT};
})();
