import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildMaterials, MAT } from './materials.js';
import { buildArchitecture, wallHit, PRISMS } from './plan.js';
import { buildRooms } from './rooms.js';
import { MOVERS, clampHinges, computeConflicts } from './casework.js';
import { buildLighting } from './lighting.js';
import { Player } from './controls.js';
import { initUI, toast } from './ui.js';
import { frame } from './util.js';

const $ = (s) => document.querySelector(s);
const setLoad = (p, t) => { $('#loadBar').style.width = Math.round(p * 100) + '%'; if (t) $('#loadStep').textContent = t; };

let dprNow = 1;
async function boot() {
  const canvas = $('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  let quality = 'high';
  try { quality = localStorage.getItem('wg103-quality') || 'high'; } catch (e) { /* no storage */ }
  const DPR = Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : 1);
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping !== undefined ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cfd9e3');
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 400);

  const steps = ['Паркет ёлочкой', 'Обои и ткани', 'Мрамор и камень', 'Плитка', 'Обои шинуазри и фреска', 'Ковры и декор', 'Материалы'];
  let si = 0;
  await buildMaterials(renderer, (label) => { setLoad(0.05 + 0.6 * (si++ / steps.length), label + '…'); });
  setLoad(0.7, 'Стены, проёмы и окна по чертежам…'); await frame();
  const arch = buildArchitecture(scene);
  setLoad(0.82, 'Мебель и декор…'); await frame();
  buildRooms(scene);
  scene.updateMatrixWorld(true);
  const clamped = clampHinges(wallHit); if (clamped.length) console.info('hinges clamped:', clamped.join(' '));
  console.info('interlocked pairs:', computeConflicts());
  setLoad(0.9, 'Свет…'); await frame();
  const lighting = buildLighting(scene, renderer);
  lighting.setMode('day');

  // post-processing: N8AO (ambient occlusion, half-res) → output (tone map) → SMAA
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.HalfFloatType }));
  composer.setPixelRatio(DPR); composer.setSize(innerWidth, innerHeight);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  let ao = null;
  try {
    const { N8AOPass } = await import('n8ao');
    ao = new N8AOPass(scene, camera, innerWidth * DPR, innerHeight * DPR);
    Object.assign(ao.configuration, { aoRadius: 0.55, distanceFalloff: 0.45, intensity: 2.4, aoSamples: 12, denoiseSamples: 6, denoiseRadius: 10, halfRes: true, depthAwareUpsampling: true, gammaCorrection: false, color: new THREE.Color('#1a1410') });
    composer.addPass(ao);
  } catch (e) { console.warn('AO unavailable', e); }
  const applyQ = (q) => { if (ao) { ao.enabled = q === 'high'; renderPass.enabled = q !== 'high'; } };
  applyQ(quality);
  composer.addPass(new OutputPass());
  try { const { SMAAPass } = await import('three/addons/postprocessing/SMAAPass.js'); composer.addPass(new SMAAPass(innerWidth * DPR, innerHeight * DPR)); } catch (e) { console.warn('SMAA unavailable', e); }

  const player = new Player(camera, canvas, arch.doors, (t, isMover) => (isMover ? toggleMover(t) : toggleDoor(t)));
  player.movers = MOVERS;
  function toggleMover(m) {
    const open = m.target < 0.5;
    if (open) for (const c of m.conflicts || []) c.target = 0; // a neighbour that would collide closes first
    m.target = open ? 1 : 0;
  }
  player.teleport('entry');

  function toggleDoor(door) {
    const group = door.group ? arch.doors.filter((d) => d.group === door.group) : [door];
    const open = door.target < 0.5;
    for (const d of group) d.target = open ? 1 : 0;
    toast(open ? 'Открыто' : 'Закрыто');
  }

  // ---- overview cutaway: one horizontal clipping plane on every material (shadows clipped too),
  // with flat dark caps on the cut walls like the poché of a floor plan ----
  renderer.localClippingEnabled = true;
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && !m.clippingPlanes) { m.clippingPlanes = [cutPlane]; m.clipShadows = true; }
  });
  const capMat = new THREE.MeshBasicMaterial({ color: '#1b2c21', toneMapped: false });
  const caps = new THREE.Group(); caps.name = 'cut-caps'; caps.visible = false; scene.add(caps);
  for (const pr of PRISMS) {
    if (pr.kind === 'podium') continue;
    const sh = new THREE.Shape(pr.poly.map(([x, y]) => new THREE.Vector2(x / 1000, -y / 1000)));
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, capMat); mesh.userData.z = [pr.z0 / 1000, pr.z1 / 1000]; mesh.matrixAutoUpdate = true;
    caps.add(mesh);
  }
  let cutH = 1.4, inOrbit = false;
  const FULL = 3.1;
  function applyCut() {
    const on = inOrbit && cutH < FULL - 0.01;
    cutPlane.constant = on ? cutH : 1e5;
    caps.visible = on;
    if (on) for (const c of caps.children) { const [z0, z1] = c.userData.z; c.visible = z0 < cutH && z1 > cutH; c.position.y = cutH + 0.0008; }
    renderer.shadowMap.needsUpdate = true;
  }

  const ui = initUI({
    player, lighting, camera,
    onModeChange: (m) => {
      inOrbit = m === 'orbit';
      arch.ceilGroup.visible = !inOrbit;
      scene.traverse((o) => { if (o.name === 'furn:outside') o.visible = !inOrbit; });
      scene.background.set(inOrbit ? '#d9d4cc' : '#cfd9e3');
      applyCut();
    },
    onCut: (h) => { cutH = h; applyCut(); },
    cutH, FULL,
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  });

  window.__setQuality = (q) => { quality = q; try { localStorage.setItem('wg103-quality', q); } catch (e) { /* */ } applyQ(q); const d = Math.min(devicePixelRatio || 1, q === 'high' ? 2 : 1); dprNow = d; renderer.setPixelRatio(d); composer.setPixelRatio(d); composer.setSize(innerWidth, innerHeight); lighting.sun.shadow.mapSize.set(q === 'high' ? 4096 : 2048, q === 'high' ? 4096 : 2048); if (lighting.sun.shadow.map) { lighting.sun.shadow.map.dispose(); lighting.sun.shadow.map = null; } renderer.shadowMap.needsUpdate = true; };
  setLoad(1, 'Готово'); await frame();
  // warm-up compile
  // mirrors: static cube reflections baked from a point in front of each mirror (re-baked on light / finish changes)
  const probes = [['mirror_bed', 5.1, 1.5, 3.0], ['mirror_hall', 3.6, 1.5, 7.07], ['mirror_bath', 4.89, 1.55, 5.4]].map(([k, x, y, z]) => {
    const rt = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: false });
    const cam = new THREE.CubeCamera(0.05, 40, rt); cam.position.set(x, y, z); scene.add(cam);
    MAT[k].envMap = rt.texture; MAT[k].envMapIntensity = 1; MAT[k].needsUpdate = true;
    return { k, cam };
  });
  let bakeIn = 0;
  const bakeMirrors = () => {
    const c = cutPlane.constant, cv = caps.visible; cutPlane.constant = 1e5; caps.visible = false; // mirrors always reflect the whole room
    for (const p of probes) { MAT[p.k].visible = false; p.cam.update(renderer, scene); MAT[p.k].visible = true; }
    cutPlane.constant = c; caps.visible = cv;
  };
  window.__bakeMirrors = () => { bakeIn = 3; };
  const setModeRaw = lighting.setMode; lighting.setMode = (m) => { setModeRaw(m); bakeIn = 3; };
  bakeIn = 3;
  renderer.compile(scene, camera);
  $('#load').classList.add('hidden');
  ui.showStart();

  const clock = new THREE.Clock();
  void 0;
  let slowFrames = 0, wasMoving = false, hoverTick = 0; dprNow = DPR;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    let moving = false;
    for (const d of arch.doors) {
      if (Math.abs(d.open - d.target) > 0.001) { moving = true; d.open += (d.target - d.open) * (1 - Math.exp(-dt * 5)); d.pivot.rotation.y = d.base + d.sign * d.open * d.max; }
    }
    for (const m of MOVERS) {
      if (Math.abs(m.open - m.target) <= 0.001) continue;
      moving = true; m.open += (m.target - m.open) * (1 - Math.exp(-dt * 6)); if (Math.abs(m.open - m.target) <= 0.001) m.open = m.target;
      if (m.kind === 'hinge') m.inner.rotation.y = m.sign * m.open * m.max; else m.inner.position.z = m.open * m.max;
      for (const me of m.inside) me.visible = m.open > 0.004;
    }
    if (moving || wasMoving) renderer.shadowMap.needsUpdate = true;
    if (bakeIn > 0 && --bakeIn === 0) bakeMirrors();
    if (++hoverTick % 6 === 0) player.updateHover();
    wasMoving = moving;
    player.update(dt);
    ui.update();
    composer.render();
    // adaptive resolution if the GPU struggles
    if (dt > 0.034) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 120 && dprNow > 0.75) { dprNow -= 0.15; renderer.setPixelRatio(dprNow); composer.setPixelRatio(dprNow); composer.setSize(innerWidth, innerHeight); slowFrames = 0; }
  });
  window.__app = { scene, camera, player, arch, lighting, renderer, composer, ao };
}

boot().catch((e) => { console.error(e); $('#loadStep').textContent = 'Ошибка: ' + e.message; });
