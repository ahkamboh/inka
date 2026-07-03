// mascot3d.js — "Inka", the 3D artist girl (Three.js) + the 3D slide-props layer.
// A stylized chibi female character: skin, hair, beret, dress, pencil in hand — with
// studio lighting, blink/talk/pose animations. Plus a full-stage 3D layer where the
// agent can place spinning 3D props inside slides ({"op":"model"}). window.M3D / window.P3D.
import * as THREE from '/vendor/three/three.module.js';

const wrap = document.getElementById('stagewrap');

/* ============================ THE CHARACTER ============================ */
const cnv = document.createElement('canvas');
cnv.id = 'mascot3d';
Object.assign(cnv.style, { position: 'absolute', left: '1%', bottom: '0', width: '26%', height: '62%',
  zIndex: 3, pointerEvents: 'none' });
wrap.appendChild(cnv);

const renderer = new THREE.WebGLRenderer({ canvas: cnv, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 0.7, 0.1, 30);
camera.position.set(0.25, 1.35, 5.0);
camera.lookAt(0, 1.0, 0);

scene.add(new THREE.HemisphereLight(0xfff8ee, 0x8a8178, 0.9));
const key = new THREE.DirectionalLight(0xfff0dc, 1.5); key.position.set(2.6, 3.6, 3.2); scene.add(key);
const rim = new THREE.DirectionalLight(0xdfe8ff, 0.9); rim.position.set(-3, 2.4, -2.6); scene.add(rim);
const fill = new THREE.PointLight(0xffe6c8, 0.45, 12); fill.position.set(-1.6, 0.8, 2.6); scene.add(fill);

// materials
const skin  = new THREE.MeshStandardMaterial({ color: 0xf6cfae, roughness: 0.65 });
const hairM = new THREE.MeshStandardMaterial({ color: 0x3a2a1f, roughness: 0.55 });
const dress = new THREE.MeshStandardMaterial({ color: 0xe8730c, roughness: 0.6 });
const cream = new THREE.MeshStandardMaterial({ color: 0xfff6ea, roughness: 0.6 });
const orange = new THREE.MeshStandardMaterial({ color: 0xe8730c, roughness: 0.55 });
const orangeLit = new THREE.MeshStandardMaterial({ color: 0xf28a2e, roughness: 0.5 });
const dark  = new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.6 });
const wood  = new THREE.MeshStandardMaterial({ color: 0xf0cfa0, roughness: 0.8 });
const pink  = new THREE.MeshStandardMaterial({ color: 0xd97a7a, roughness: 0.7 });
const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
const iris  = new THREE.MeshStandardMaterial({ color: 0x38261a, roughness: 0.3 });
const mouthM = new THREE.MeshStandardMaterial({ color: 0xa04c3c, roughness: 0.5 });

const rig = new THREE.Group(); scene.add(rig);
const bodyG = new THREE.Group(); rig.add(bodyG);

// ---- dress (A-line lathe) + collar + buttons ----
const dressPts = [[0.001,0],[0.32,0.02],[0.35,0.30],[0.24,0.66],[0.155,0.84],[0.001,0.86]]
  .map(([x, y]) => new THREE.Vector2(x, y));
const dressMesh = new THREE.Mesh(new THREE.LatheGeometry(dressPts, 40), dress);
dressMesh.position.y = 0.26; bodyG.add(dressMesh);
const collar = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.028, 12, 24), cream);
collar.rotation.x = Math.PI / 2; collar.position.y = 1.10; bodyG.add(collar);
for (const by of [0.92, 0.78]) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), cream);
  b.position.set(0, by, 0.30 - (0.92 - by) * 0.16); bodyG.add(b);
}
// neck
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.14, 14), skin);
neck.position.y = 1.13; bodyG.add(neck);

// ---- head ----
const head = new THREE.Group(); head.position.y = 1.52; bodyG.add(head);
head.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 40, 32), skin));
// hair: back cap + bangs + side locks + low ponytail
const cap = new THREE.Mesh(new THREE.SphereGeometry(0.445, 36, 26, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM);
cap.position.set(0, 0.05, -0.045); cap.rotation.x = -0.28; head.add(cap);
const bangs = [[-0.20, 0.30, 0.30, 0.16], [0.02, 0.34, 0.30, 0.18], [0.23, 0.29, 0.29, 0.15]];
for (const [bx, by, bz, br] of bangs) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(br, 18, 14), hairM);
  m.position.set(bx, by, bz); m.scale.set(1.15, 0.75, 0.65); head.add(m);
}
const lockL = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.34, 6, 12), hairM);
lockL.position.set(-0.40, -0.05, 0.02); lockL.rotation.z = 0.12; head.add(lockL);
const lockR = lockL.clone(); lockR.position.x = 0.40; lockR.rotation.z = -0.12; head.add(lockR);
const pony = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 6, 12), hairM);
pony.position.set(0.30, -0.18, -0.28); pony.rotation.z = -0.45; pony.rotation.x = 0.3; head.add(pony);
const ponyTie = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 8, 16), orange);
ponyTie.position.set(0.235, 0.02, -0.24); ponyTie.rotation.y = 0.8; head.add(ponyTie);
// beret (brand!)
const beret = new THREE.Group();
const bcap = new THREE.Mesh(new THREE.SphereGeometry(0.30, 30, 18), orange); bcap.scale.set(1.15, 0.36, 1.15);
const btop = new THREE.Mesh(new THREE.SphereGeometry(0.19, 22, 14), orangeLit); btop.scale.set(1, 0.42, 1); btop.position.y = 0.05;
const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.08, 10), dark); stem.position.y = 0.1;
beret.add(bcap, btop, stem);
beret.position.set(-0.13, 0.40, 0.0); beret.rotation.z = 0.30; beret.rotation.x = -0.05;
head.add(beret);
// eyes (white + iris + glint), blink via scale
const eyes = new THREE.Group(); head.add(eyes);
for (const sx of [-1, 1]) {
  const e = new THREE.Group();
  const w = new THREE.Mesh(new THREE.SphereGeometry(0.095, 22, 18), white); w.scale.set(1, 1.15, 0.55);
  const i = new THREE.Mesh(new THREE.SphereGeometry(0.052, 18, 14), iris); i.position.z = 0.045; i.scale.set(1, 1.2, 0.6);
  const g = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), white); g.position.set(0.02, 0.03, 0.085);
  e.add(w, i, g); e.position.set(sx * 0.16, 0.02, 0.375);
  eyes.add(e);
}
// brows
for (const sx of [-1, 1]) {
  const br = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.09, 4, 8), hairM);
  br.position.set(sx * 0.16, 0.17, 0.385); br.rotation.z = Math.PI / 2 + sx * -0.15;
  head.add(br);
}
// smile + blush
const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 10, 24, Math.PI), mouthM);
mouth.position.set(0, -0.16, 0.40); mouth.rotation.z = Math.PI; mouth.rotation.x = -0.35; mouth.scale.set(1, 0.8, 0.5);
head.add(mouth);
for (const sx of [-1, 1]) {
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 12), new THREE.MeshStandardMaterial({ color: 0xff9d8a, roughness: 1 }));
  bl.position.set(sx * 0.26, -0.10, 0.30); bl.scale.set(1, 0.7, 0.4);
  head.add(bl);
}

// ---- arms (groups pivot AT the shoulder; capsule lies along +X so rotation reads naturally) ----
function makeArm(side) { // side: -1 left, +1 right
  const g = new THREE.Group(); g.position.set(side * 0.21, 1.02, 0.02);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.26, 6, 12), skin);
  arm.rotation.z = Math.PI / 2; arm.position.x = side * 0.16;
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), skin);
  hand.position.x = side * 0.33;
  g.add(arm, hand);
  return g;
}
const armL = makeArm(-1); armL.rotation.z = 0.95; bodyG.add(armL);      // hangs by the dress
const armR = makeArm(1); bodyG.add(armR);
// pencil in the right hand
const pencil = new THREE.Group();
const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.46, 6), orange);
const tip = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.115, 12), wood); tip.position.y = 0.29;
const lead = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 10), dark); lead.position.y = 0.335;
const band = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 12),
  new THREE.MeshStandardMaterial({ color: 0xb9b2a6, metalness: 0.6, roughness: 0.35 })); band.position.y = -0.24;
const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.06, 12), pink); eraser.position.y = -0.285;
pencil.add(shaft, tip, lead, band, eraser);
pencil.position.set(0.33, 0.02, 0.05); pencil.rotation.z = -0.45; pencil.rotation.x = 0.1;
armR.add(pencil);

// ---- legs + shoes ----
for (const sx of [-1, 1]) {
  const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.16, 6, 10), skin);
  leg.position.set(sx * 0.11, 0.17, 0); rig.add(leg);
  const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), orange);
  shoe.scale.set(1.15, 0.55, 1.75); shoe.position.set(sx * 0.11, 0.035, 0.05); rig.add(shoe);
}

// contact shadow
const shCnv = document.createElement('canvas'); shCnv.width = shCnv.height = 128;
const sg = shCnv.getContext('2d');
const grad = sg.createRadialGradient(64, 64, 6, 64, 64, 62);
grad.addColorStop(0, 'rgba(20,16,10,0.4)'); grad.addColorStop(1, 'rgba(20,16,10,0)');
sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shCnv), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.set(0.02, -0.02, 0.05);
scene.add(shadow);

/* ---- pose state machine (targets; everything lerps — no compounding rotations) ---- */
const T = { idle:  { bodyZ: 0.00, headZ: 0.00, armRZ: 0.25, armRY: 0.00, rigY: 0.05, scrib: 0 },
            think: { bodyZ: -0.06, headZ: 0.14, armRZ: 0.85, armRY: -0.45, rigY: 0.02, scrib: 0 },
            point: { bodyZ: 0.06, headZ: -0.08, armRZ: 0.10, armRY: -0.45, rigY: 0.30, scrib: 0 },
            draw:  { bodyZ: 0.09, headZ: -0.10, armRZ: -0.15, armRY: -0.55, rigY: 0.34, scrib: 1 },
            wave:  { bodyZ: -0.04, headZ: 0.10, armRZ: 1.2, armRY: -0.3, rigY: 0.02, scrib: 0 },
            happy: { bodyZ: 0.00, headZ: 0.06, armRZ: 0.7, armRY: -0.25, rigY: 0.05, scrib: 0 } };
let cur = 'idle', talking = false, scribbleUntil = 0, hopStart = -10;
const clock = new THREE.Clock();
let blinkAt = 2.5, blinkT = 0;

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const tgt = T[cur] || T.idle;
  const scribbling = performance.now() < scribbleUntil || tgt.scrib;

  // breathe + bob
  bodyG.scale.y = 1 + Math.sin(t * 2.1) * 0.014;
  rig.position.y = Math.sin(t * 2.1) * 0.012;

  // pose targets (computed fresh each frame — cannot drift)
  const sway = (cur === 'think') ? Math.sin(t * 3.4) * 0.04 : Math.sin(t * 1.1) * 0.012;
  const zT = tgt.bodyZ + sway + (scribbling ? 0.03 : 0);
  bodyG.rotation.z += (zT - bodyG.rotation.z) * 0.09;
  head.rotation.z += (tgt.headZ - head.rotation.z) * 0.08;
  head.rotation.y += ((cur === 'draw' || cur === 'point' ? 0.35 : 0) - head.rotation.y) * 0.08;

  let aZ = tgt.armRZ, aY = tgt.armRY;
  if (cur === 'wave') aZ += Math.sin(t * 8.5) * 0.4;
  if (scribbling && cur !== 'wave') { aZ += Math.sin(t * 15) * 0.12; }
  armR.rotation.z += (aZ - armR.rotation.z) * 0.13;
  armR.rotation.y += (aY - armR.rotation.y) * 0.13;
  armL.rotation.z += ((0.95 + (cur === 'happy' ? -1.6 : 0)) - armL.rotation.z) * 0.1;  // both arms up when happy

  const hs = t - hopStart;
  if (hs < 1.1 && hs > 0) rig.position.y += Math.abs(Math.sin(hs * Math.PI * 2)) * 0.15 * (1 - hs * 0.6);

  if (t > blinkAt) { blinkT = t; blinkAt = t + 2.6 + Math.random() * 2.6; }
  const b = t - blinkT;
  eyes.scale.y = (b < 0.12) ? Math.max(0.1, Math.abs(Math.cos(b / 0.12 * Math.PI))) : 1;

  mouth.scale.y = talking ? 0.5 + Math.abs(Math.sin(t * 12.5)) * 0.85 : 0.8;
  mouth.scale.x = talking ? 0.9 + Math.abs(Math.cos(t * 10.5)) * 0.15 : 1;

  rig.rotation.y += (tgt.rigY - rig.rotation.y) * 0.07;

  const w = cnv.clientWidth, h = cnv.clientHeight;
  if (w && h && (cnv.width !== Math.floor(w * renderer.getPixelRatio()))) {
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
}
animate();

window.M3D = {
  pose(p) { cur = T[p] ? p : 'idle'; if (p === 'happy') hopStart = clock.getElapsedTime(); },
  talking(on) { talking = !!on; },
  scribble() { scribbleUntil = performance.now() + 900; },
};

/* ============================ 3D SLIDE PROPS ============================ */
// A full-stage transparent 3D layer; the agent places spinning props INSIDE slides via
// {"op":"model","name":"cube","x":800,"y":400,"scale":1.5}. Props belong to a slide index,
// fade with slide navigation, and follow the slide's auto-centering offset.
const pCnv = document.createElement('canvas');
pCnv.id = 'props3d';
Object.assign(pCnv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%',
  zIndex: 2, pointerEvents: 'none' });
wrap.insertBefore(pCnv, cnv);

const pRen = new THREE.WebGLRenderer({ canvas: pCnv, alpha: true, antialias: true });
pRen.setPixelRatio(Math.min(devicePixelRatio, 2));
pRen.outputColorSpace = THREE.SRGBColorSpace;
pRen.toneMapping = THREE.ACESFilmicToneMapping;

const pScene = new THREE.Scene();
// perspective camera framing the 1600x900 slide plane exactly (origin at canvas centre)
const P_FOV = 30;
const pCam = new THREE.PerspectiveCamera(P_FOV, 16 / 9, 10, 6000);
const pDist = 450 / Math.tan((P_FOV / 2) * Math.PI / 180);
pCam.position.set(0, 0, pDist);
pScene.add(new THREE.HemisphereLight(0xfff8ee, 0x9a9188, 1.0));
const pKey = new THREE.DirectionalLight(0xfff0dc, 1.4); pKey.position.set(600, 800, 900); pScene.add(pKey);
const pRim = new THREE.DirectionalLight(0xdfe8ff, 0.7); pRim.position.set(-700, 400, -600); pScene.add(pRim);

const inkM = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.5 });
const orM  = new THREE.MeshStandardMaterial({ color: 0xe8730c, roughness: 0.55 });
const crM  = new THREE.MeshStandardMaterial({ color: 0xfff2df, roughness: 0.6 });
const glowM = new THREE.MeshStandardMaterial({ color: 0xffd27a, roughness: 0.4, emissive: 0xff9a1f, emissiveIntensity: 0.55 });

function buildProp(name) {
  const g = new THREE.Group(); const S = 70; // base half-size in slide px
  const add = (mesh) => g.add(mesh);
  switch (name) {
    case 'cube': add(new THREE.Mesh(new THREE.BoxGeometry(S * 1.6, S * 1.6, S * 1.6), orM)); break;
    case 'sphere': add(new THREE.Mesh(new THREE.SphereGeometry(S, 36, 28), orM)); break;
    case 'pyramid': add(new THREE.Mesh(new THREE.ConeGeometry(S * 1.1, S * 1.8, 4), orM)); break;
    case 'ring': { const m = new THREE.Mesh(new THREE.TorusGeometry(S, S * 0.32, 18, 40), orM); add(m); break; }
    case 'rocket': {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(S * 0.42, S * 1.1, 8, 20), crM);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(S * 0.42, S * 0.7, 20), orM); nose.position.y = S * 1.1;
      const win = new THREE.Mesh(new THREE.SphereGeometry(S * 0.18, 16, 12), inkM); win.position.set(0, S * 0.3, S * 0.36);
      const f1 = new THREE.Mesh(new THREE.BoxGeometry(S * 0.16, S * 0.6, S * 0.5), orM); f1.position.set(S * 0.45, -S * 0.55, 0);
      const f2 = f1.clone(); f2.position.x = -S * 0.45;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(S * 0.25, S * 0.6, 12), glowM); flame.position.y = -S * 0.95; flame.rotation.x = Math.PI;
      g.add(body, nose, win, f1, f2, flame); break; }
    case 'bulb': {
      const glass = new THREE.Mesh(new THREE.SphereGeometry(S * 0.75, 28, 22), glowM);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.3, S * 0.34, S * 0.5, 16), inkM); base.position.y = -S * 0.85;
      g.add(glass, base); break; }
    case 'gear': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(S * 0.8, S * 0.3, 14, 30), inkM); add(ring);
      for (let i = 0; i < 8; i++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(S * 0.3, S * 0.34, S * 0.3), inkM);
        const a = i / 8 * Math.PI * 2;
        tooth.position.set(Math.cos(a) * S * 1.12, Math.sin(a) * S * 1.12, 0); tooth.rotation.z = a;
        add(tooth);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.28, S * 0.28, S * 0.5, 18), orM);
      hub.rotation.x = Math.PI / 2; add(hub); break; }
    case 'coin': {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(S, S, S * 0.18, 36), orM); c.rotation.x = Math.PI / 2;
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.78, S * 0.78, S * 0.2, 36), orangeLit); inner.rotation.x = Math.PI / 2;
      g.add(c, inner); break; }
    default: add(new THREE.Mesh(new THREE.SphereGeometry(S, 30, 24), orM));
  }
  return g;
}

const props = [];   // {g, slide, base:{x,y}, scale, born}
let curSlide = 0;
const offsets = new Map(); // slideIdx -> {dx,dy}

function pAnimate() {
  requestAnimationFrame(pAnimate);
  const t = clock.getElapsedTime();
  for (const p of props) {
    const off = offsets.get(p.slide) || { dx: 0, dy: 0 };
    const tx = (p.base.x + off.dx) - 800, ty = 450 - (p.base.y + off.dy);
    p.g.position.x += (tx - p.g.position.x) * 0.1;
    p.g.position.y += (ty - p.g.position.y) * 0.1;
    p.g.rotation.y = t * 0.7; p.g.rotation.x = Math.sin(t * 0.9) * 0.18;
    const vis = p.slide === curSlide;
    const grow = Math.min(1, (performance.now() - p.born) / 600);
    const target = vis ? p.scale * (0.6 + 0.4 * grow) : 0.0001;
    const s = p.g.scale.x + (target - p.g.scale.x) * 0.12;
    p.g.scale.set(s, s, s);
  }
  const w = pCnv.clientWidth, h = pCnv.clientHeight;
  if (w && h && (pCnv.width !== Math.floor(w * pRen.getPixelRatio()))) {
    pRen.setSize(w, h, false); pCam.aspect = w / h; pCam.updateProjectionMatrix();
  }
  pRen.render(pScene, pCam);
}
pAnimate();

window.P3D = {
  add(name, x, y, scale, slideIdx) {
    const g = buildProp(String(name || 'cube').toLowerCase());
    g.position.set(x - 800, 450 - y, 0); g.scale.set(0.0001, 0.0001, 0.0001);
    pScene.add(g);
    props.push({ g, slide: slideIdx, base: { x, y }, scale: Math.max(0.3, Math.min(3, scale || 1)), born: performance.now() });
  },
  setSlide(i) { curSlide = i; },
  offset(slideIdx, dx, dy) { offsets.set(slideIdx, { dx, dy }); },
  reset() { for (const p of props) pScene.remove(p.g); props.length = 0; offsets.clear(); curSlide = 0; },
};
