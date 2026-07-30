/* ============================================================
   OrbiQuest VR — parametrii puzzle-urilor (identici matematic cu
   shared.js din versiunea 2D), generați o singură dată per sesiune
   VR, ținuți în memorie (nu mai există navigare între pagini).
   ============================================================ */
function makeRNG(seed){
  let a=seed>>>0;
  return function(){
    a|=0; a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

/* constante pentru simularea 3D vizuală a orbitei (Modul 1) — aceeași
   metodă de calibrare ca versiunea 2D (canvas): distanțele nu sunt
   reale (ar da orbite de zile întregi), ci o scenă compactă auto-consistentă,
   calibrată ca la v=180Mm viteza corectă reală (din vNeeded) să corespundă
   exact vitezei de simulare — deci fizica "arată" corect la orice rază.
   1 unitate px-originală devine 1 cm în scena VR (/100 -> metri). */
const SIM_G=4200, PXPERMM=0.62;
const simVCirc=r=>Math.sqrt(SIM_G/(r*PXPERMM));

function buildParams(seed){
  const rnd=makeRNG(seed);
  const randi=(a,b)=>a+Math.floor(rnd()*(b-a+1));
  const digitFrom=x=>String(Math.abs(Math.round(x))%10);

  const GM=1.843e15;
  const vNeeded=r=>Math.sqrt(GM/(r*1e6))/1000; // r în Mm -> km/s
  const KMS_PER_SIMV=vNeeded(180)/simVCirc(180);

  const P={GM,vNeeded,KMS_PER_SIMV};

  const raze=[]; for(let r=125;r<=255;r+=5) raze.push(r);
  P.r1=raze[randi(0,raze.length-1)];
  P.v1correct=vNeeded(P.r1);
  P.dig1=digitFrom(P.v1correct*100);

  const dLambda=randi(12,45);
  P.lamObs=656.3+dLambda;
  P.z2=dLambda/656.3;
  P.v2correct=P.z2*300000;
  P.dig2=digitFrom(P.v2correct/100);

  const pMas=randi(15,60);
  P.p3=pMas/1000;
  P.shift3=P.p3*2;
  P.d3correct=1/P.p3;
  P.dig3=digitFrom(P.d3correct);

  return P;
}

function fmtTime(s){ const m=Math.floor(s/60), x=s%60; return m+':'+String(x).padStart(2,'0'); }
