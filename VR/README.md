# OrbiQuest VR

Versiune imersivă (WebXR) a jocului, gândită pentru Meta Quest 3. E un folder
complet separat de restul proiectului — nu modifică jocul 2D original.

## Ce este

Nu e o portare 1:1 a paginilor 2D, ci un **hub 3D continuu**: intri o singură
dată în sesiunea VR și rămâi în ea tot jocul (navigarea între pagini HTML
separate ar întrerupe sesiunea WebXR de fiecare dată, deci arhitectura veche
cu 5 fișiere .html nu se potrivea în VR). Stai în centrul unei "punți de
comandă" circulare, cu 5 panouri plutitoare în jurul tău:

- **Jurnal de bord** — povestea (aceeași ca pe site-ul 2D)
- **Modul 01 · Gravitație** — orbită circulară, cu o simulare 3D REALĂ a
  sondei orbitând planeta (aceeași fizică v=√(GM/r) ca versiunea 2D)
- **Modul 02 · Spectru** — efect Doppler / deplasare spre roșu
- **Modul 03 · Paralaxă** — distanța până la o stea
- **Terminal** — introducerea codului final de 3 cifre

Te uiți la un panou și apeși pe el cu laser-ul controllerului (sau click de
mouse, în previzualizare pe desktop) ca să deschizi consola interactivă a
acelui modul — hub-ul dispare complet cât timp ești acolo (nu se mai
suprapune nimic din meniu), și te întorci cu butonul „◀ HUB". Majoritatea
controalelor fine din 2D au fost înlocuite cu **butoane mari** (+/−,
tastatură numerică 3D), mai fiabile cu laser pointer-ul; viteza de la
Modul 01 e un slider draggabil (apucă mânerul cu trigger-ul și trage).

## Tehnologie

- [A-Frame 1.6.0](https://aframe.io) (`aframe.min.js`, descărcat local — rulează offline, fără CDN)
- Tot UI-ul (etichete, butoane, tastatură) e desenat manual pe canvas 2D și
  aplicat ca textură pe panouri 3D — NU folosește componenta de text nativă
  A-Frame, pentru că fontul ei implicit nu are diacritice românești (ar fi
  apărut la fel ca pătratele negre din PDF-ul de documentație).
- Fizica Modulului 01 e portată direct din `shared.js`/`modul01.html`
  (aceiași pași, aceleași praguri de excentricitate), doar aplicată unor
  obiecte 3D reale în loc de desen pe canvas 2D.
- Deplasare cu thumbstick-ul (componentă custom, mică, în `vr-app.js`) —
  A-Frame de bază nu include locomoție, doar am adăugat-o eu.

## Cum testezi pe Quest 3

WebXR (modul imersiv real) cere un **context securizat**: HTTPS, sau
`localhost`. Deschiderea directă a fișierului (`file://`) sau accesarea prin
IP simplu (`http://`) pe rețeaua locală **s-ar putea să nu arate butonul
"Enter VR"** în browserul din Quest — depinde de politica exactă a
browserului Meta. Trei variante, de la cea mai simplă:

**1. Previzualizare rapidă pe desktop (fără cască)**
Deschide `index.html` direct într-un browser de pe calculator — se vede
scena 3D, te poți uita în jur cu mouse-ul și poți da click pe panouri.
Bun pentru verificat rapid logica/aspectul, nu e "VR" propriu-zis.

**2. Server local + HTTP pe rețeaua locală (pentru testat pe cască)**
```
cd VR
python -m http.server 8000
```
Apoi, pe Quest 3 (Meta Quest Browser), pe **aceeași rețea WiFi**, accesează
`http://<IP-ul-calculatorului-tău>:8000`. Dacă nu apare butonul "Enter VR",
înseamnă că browserul blochează WebXR pe http — treci la varianta 3.

**3. HTTPS garantat**
Cel mai simplu: publică folderul `VR` pe un hosting static gratuit cu HTTPS
automat (GitHub Pages, Netlify, Vercel etc.) și deschide acel link din
browserul Quest-ului. Spune-mi dacă vrei, te ajut să faci asta quando ești
mulțumit de conținut — nu am publicat nimic public din partea mea.

## Controale

- **Quest 3 (controllere Touch)**: laser + trigger pentru a apăsa panouri/
  butoane; thumbstick stânga pentru deplasare.
- **Desktop (previzualizare)**: WASD + mouse pentru privit, click pentru
  interacțiune (cursor de tip "mouse ray").

## Ce e simplificat față de versiunea 2D (deliberat, pentru o primă variantă)

- Modulele 2 și 3 folosesc reprezentări 3D simplificate (nu identice pixel
  cu pixel cu varianta canvas 2D), dar aceeași logică/formule de verificare.
- Nu există încă traiectorie/trail vizibil pentru sondă la Modul 01 (doar
  poziția ei curentă + inelul-țintă) — de adăugat ulterior dacă vrei.
- Nu am putut testa efectiv pe o cască Quest 3 din acest mediu (nu am acces
  la un headset aici) — am verificat sintaxa JS și logica cu atenție, dar
  ergonomia exactă (înălțimi, distanțe, mărimi de buton) s-ar putea să aibă
  nevoie de ajustări fine odată ce încerci live pe cască.
