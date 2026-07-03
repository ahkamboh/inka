// mascot3d.js — the inkling mascot as a real 3D character (Three.js).
// A smooth lathe-built bean with studio lighting, orange beret, shoes and a pencil in
// hand, soft contact shadow, breathing/blink/talk/pose animations. Renders in a small
// transparent WebGL canvas overlaid on the stage's bottom-left; exposes window.M3D.
import * as THREE from '/vendor/three/three.module.js';

const wrap = document.getElementById('stagewrap');
const cnv = document.createElement('canvas');
cnv.id = 'mascot3d';
Object.assign(cnv.style, { position: 'absolute', left: '1.5%', bottom: '0', width: '27%', height: '58%',
  zIndex: 3, pointerEvents: 'none' });
wrap.appendChild(cnv);

const renderer = new THREE.WebGLRenderer({ canvas: cnv, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 0.75, 0.1, 30);
camera.position.set(0.35, 1.55, 4.6);
camera.lookAt(0, 0.92, 0);

// ---- studio lighting ----
scene.add(new THREE.HemisphereLight(0xfff8ee, 0x8a8178, 0.85));
const key = new THREE.DirectionalLight(0xfff0dc, 1.6); key.position.set(2.6, 3.6, 3.2); scene.add(key);
const rim = new THREE.DirectionalLight(0xdfe8ff, 1.1); rim.position.set(-3, 2.4, -2.6); scene.add(rim);
const fill = new THREE.PointLight(0xffe6c8, 0.5, 12); fill.position.set(-1.6, 0.8, 2.6); scene.add(fill);

// ---- materials ----
const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x26231f, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: 0x4a443c });
const orange = new THREE.MeshStandardMaterial({ color: 0xe8730c, roughness: 0.55 });
const orangeLit = new THREE.MeshStandardMaterial({ color: 0xf28a2e, roughness: 0.5 });
const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
const wood = new THREE.MeshStandardMaterial({ color: 0xf0cfa0, roughness: 0.8 });
const dark = new THREE.MeshStandardMaterial({ color: 0x171512, roughness: 0.6 });
const pink = new THREE.MeshStandardMaterial({ color: 0xd97a7a, roughness: 0.7 });

// ---- character rig ----
const rig = new THREE.Group(); scene.add(rig);
const body = new THREE.Group(); rig.add(body);

// bean body (lathe of the inkling silhouette — narrow head, full belly)
const pts = [[0.001,0],[0.34,0.02],[0.47,0.20],[0.50,0.55],[0.46,0.95],[0.37,1.35],[0.25,1.65],[0.12,1.84],[0.001,1.90]]
  .map(([x,y]) => new THREE.Vector2(x, y));
const bean = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), bodyMat);
body.add(bean);

// eyes (blink by scaling)
const eyeGeo = new THREE.SphereGeometry(0.075, 24, 24);
const eyeL = new THREE.Mesh(eyeGeo, white); eyeL.position.set(-0.135, 1.18, 0.375);
const eyeR = new THREE.Mesh(eyeGeo, white); eyeR.position.set(0.135, 1.18, 0.375);
const eyes = new THREE.Group(); eyes.add(eyeL, eyeR); body.add(eyes);

// blush
const blushGeo = new THREE.SphereGeometry(0.062, 16, 16);
const bl1 = new THREE.Mesh(blushGeo, new THREE.MeshStandardMaterial({ color: 0xff9a4d, roughness: 1 }));
bl1.position.set(-0.245, 1.02, 0.33); bl1.scale.set(1, 0.8, 0.45);
const bl2 = bl1.clone(); bl2.position.x = 0.245;
body.add(bl1, bl2);

// smile (half-torus)
const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.02, 12, 32, Math.PI), white);
mouth.position.set(0, 1.04, 0.46); mouth.rotation.z = Math.PI; mouth.rotation.x = -0.42; mouth.scale.set(1,0.85,0.5);
body.add(mouth);

// beret (squashed sphere + stem), tilted like an artist
const beret = new THREE.Group();
const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 20), orange); cap.scale.set(1, 0.36, 1);
const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), orangeLit); capTop.scale.set(1, 0.4, 1); capTop.position.y = 0.055;
const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.09, 10), dark); stem.position.y = 0.12;
beret.add(cap, capTop, stem);
beret.position.set(-0.06, 1.83, 0.02); beret.rotation.z = 0.28; beret.rotation.x = -0.06;
body.add(beret);

// legs + shoes
const legGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.22, 12);
const legL = new THREE.Mesh(legGeo, dark); legL.position.set(-0.155, 0.05, 0);
const legR = new THREE.Mesh(legGeo, dark); legR.position.set(0.155, 0.05, 0);
const shoeGeo = new THREE.SphereGeometry(0.085, 18, 14);
const shoeL = new THREE.Mesh(shoeGeo, orange); shoeL.scale.set(1.25, 0.55, 1.9); shoeL.position.set(-0.155, -0.03, 0.05);
const shoeR = shoeL.clone(); shoeR.position.x = 0.155;
rig.add(legL, legR, shoeL, shoeR);

// left arm (rests along the body)
const armGeo = new THREE.CapsuleGeometry(0.036, 0.34, 6, 12);
const armL = new THREE.Mesh(armGeo, bodyMat);
armL.position.set(-0.44, 0.95, 0.06); armL.rotation.z = 0.5;
body.add(armL);

// right arm — a group at the shoulder, holds the pencil (poses rotate this)
const armRGroup = new THREE.Group(); armRGroup.position.set(0.40, 1.02, 0.10); body.add(armRGroup);
const armR = new THREE.Mesh(armGeo, bodyMat); armR.position.set(0.16, -0.02, 0.06); armR.rotation.z = -1.25;
armRGroup.add(armR);
const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 14), bodyMat); hand.position.set(0.34, 0.02, 0.10);
armRGroup.add(hand);
// the pencil ✏️
const pencil = new THREE.Group();
const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.52, 6), orange); // hex pencil!
const tip = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.13, 12), wood); tip.position.y = 0.325;
const lead = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.045, 10), dark); lead.position.y = 0.375;
const band = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.045, 12), new THREE.MeshStandardMaterial({ color: 0xb9b2a6, metalness: 0.6, roughness: 0.35 }));
band.position.y = -0.27;
const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.07, 12), pink); eraser.position.y = -0.325;
pencil.add(shaft, tip, lead, band, eraser);
pencil.scale.set(0.85,0.85,0.85); pencil.position.set(0.34, 0.05, 0.12); pencil.rotation.z = -0.5; pencil.rotation.x = 0.12;
armRGroup.add(pencil);

// soft contact shadow (radial-gradient sprite on the floor)
const shCnv = document.createElement('canvas'); shCnv.width = shCnv.height = 128;
const g = shCnv.getContext('2d');
const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
grad.addColorStop(0, 'rgba(20,16,10,0.42)'); grad.addColorStop(1, 'rgba(20,16,10,0)');
g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shCnv), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.085; shadow.position.z = 0.05;
scene.add(shadow);

// ---- animation state machine ----
const T = { idle:  { bodyZ: 0.00, bodyX: 0.00, armZ: 0.0, armY: 0.0 },
            think: { bodyZ: -0.10, bodyX: -0.05, armZ: 0.25, armY: 0.0 },
            point: { bodyZ: 0.10, bodyX: 0.02, armZ: -0.95, armY: -0.35 },
            draw:  { bodyZ: 0.16, bodyX: 0.05, armZ: -0.55, armY: -0.55 },
            wave:  { bodyZ: -0.06, bodyX: 0.00, armZ: 0.95, armY: 0.25 },
            happy: { bodyZ: 0.00, bodyX: 0.00, armZ: 0.55, armY: 0.0 } };
let cur = 'idle', talking = false, scribbleUntil = 0, hopStart = -10;
const clock = new THREE.Clock();
let blinkAt = 2.5, blinkT = 0;

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const tgt = T[cur] || T.idle;

  // breathe + idle bob/sway
  const breathe = 1 + Math.sin(t * 2.2) * 0.016;
  body.scale.set(1, breathe, 1);
  rig.position.y = Math.sin(t * 2.2) * 0.012;
  const sway = (cur === 'think') ? Math.sin(t * 3.6) * 0.05 : Math.sin(t * 1.1) * 0.015;

  // pose lerp
  body.rotation.z += ((tgt.bodyZ + sway) - body.rotation.z) * 0.10;
  body.rotation.x += (tgt.bodyX - body.rotation.x) * 0.10;
  let armZ = tgt.armZ, armY = tgt.armY;
  if (cur === 'wave') armZ += Math.sin(t * 9) * 0.35;                       // waving
  if (performance.now() < scribbleUntil) { armZ += Math.sin(t * 16) * 0.16; armY -= 0.45; body.rotation.z += 0.06; } // scribbling
  armRGroup.rotation.z += (armZ - armRGroup.rotation.z) * 0.14;
  armRGroup.rotation.y += (armY - armRGroup.rotation.y) * 0.14;

  // happy hop
  const hs = t - hopStart;
  if (hs < 1.1) rig.position.y += Math.abs(Math.sin(hs * Math.PI * 2)) * 0.16 * (1 - hs * 0.6);

  // blink
  if (t > blinkAt) { blinkT = t; blinkAt = t + 2.6 + Math.random() * 2.4; }
  const b = t - blinkT;
  eyes.scale.y = (b < 0.12) ? Math.max(0.08, Math.abs(Math.cos(b / 0.12 * Math.PI))) : 1;

  // talk (mouth pulses)
  mouth.scale.y = talking ? 0.55 + Math.abs(Math.sin(t * 13)) * 0.9 : 1;
  mouth.scale.x = talking ? 0.85 + Math.abs(Math.cos(t * 11)) * 0.2 : 1;

  // gentle turn toward the canvas when drawing/pointing
  const yTgt = (cur === 'draw' || cur === 'point') ? 0.35 : 0.06;
  rig.rotation.y += (yTgt - rig.rotation.y) * 0.08;

  const w = cnv.clientWidth, h = cnv.clientHeight;
  if (w && h && (cnv.width !== w * renderer.getPixelRatio() || cnv.height !== h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
}
animate();

// ---- public API (index.html drives this) ----
window.M3D = {
  pose(p) { cur = T[p] ? p : 'idle'; if (p === 'happy') hopStart = clock.getElapsedTime(); },
  talking(on) { talking = !!on; },
  scribble() { scribbleUntil = performance.now() + 900; },
};
