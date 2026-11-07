import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildMaterials } from './materials.js';
import { buildArchitecture } from './plan.js';
import { buildRooms } from './rooms.js';
import { MOVERS } from './casework.js';
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
  const DPR = Math.min(devicePixelRatio || 1, quality === 'high' ? 1.25 : 1);
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping !== undefined ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

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
  function toggleMover(m) { m.target = m.target < 0.5 ? 1 : 0; }
  player.teleport('entry');

  function toggleDoor(door) {
    const group = door.group ? arch.doors.filter((d) => d.group === door.group) : [door];
    const open = door.target < 0.5;
    for (const d of group) d.target = open ? 1 : 0;
    toast(open ? 'Открыто' : 'Закрыто');
  }

  const ui = initUI({
    player, lighting,
    onModeChange: (m) => {
      arch.ceilGroup.visible = m !== 'orbit';
      scene.traverse((o) => { if (o.name === 'furn:outside') o.visible = m !== 'orbit'; });
      scene.background.set(m === 'orbit' ? '#d9d4cc' : '#cfd9e3');
      camera.fov = m === 'orbit' ? 45 : 68; camera.updateProjectionMatrix();
    },
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  });

  window.__setQuality = (q) => { quality = q; try { localStorage.setItem('wg103-quality', q); } catch (e) { /* */ } applyQ(q); const d = Math.min(devicePixelRatio || 1, q === 'high' ? 1.25 : 1); dprNow = d; renderer.setPixelRatio(d); composer.setPixelRatio(d); composer.setSize(innerWidth, innerHeight); lighting.sun.shadow.mapSize.set(q === 'high' ? 4096 : 2048, q === 'high' ? 4096 : 2048); if (lighting.sun.shadow.map) { lighting.sun.shadow.map.dispose(); lighting.sun.shadow.map = null; } renderer.shadowMap.needsUpdate = true; };
  setLoad(1, 'Готово'); await frame();
  // warm-up compile
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
