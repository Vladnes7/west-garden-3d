import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { WINDOWS } from './plan-data.js';
import { MAT } from './materials.js';
import { LIGHTS } from './pieces.js';
import { HEAD } from './plan.js';

export function buildLighting(scene, renderer) {
  RectAreaLightUniformsLib.init();
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = env;
  for (const k in MAT) { const m = MAT[k]; if (m.isMeshStandardMaterial) m.envMapIntensity = k === 'glass' ? 0.12 : /mirror|chrome|brass|gilt|bronze|steel|glass|crystal/.test(k) ? 0.9 : 0.35; }

  const hemi = new THREE.HemisphereLight('#e7eef5', '#8c7a66', 0.5);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff1dc', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7; sc.near = 1; sc.far = 60;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;
  sun.target.position.set(3.1, 0, 3.8);
  scene.add(sun, sun.target);

  // window sky light: one RectAreaLight per window (north facade)
  const rects = [];
  for (const w of WINDOWS) {
    const a = w.a / 1000, b = w.b / 1000, len = b - a, h = (HEAD - w.sill) / 1000, cy = (w.sill + HEAD) / 2000;
    const L = new THREE.RectAreaLight('#dfe9f3', 6, len, h);
    L.position.set((a + b) / 2, cy, -0.05); L.lookAt((a + b) / 2, cy, 2);
    L.userData.k = 1.0;
    scene.add(L); rects.push(L);
  }

  // interior point lights (merged per room/kind to keep shader cost sane)
  const groups = new Map();
  for (const l of LIGHTS) {
    if (l.kind === 'led' && l.room !== 'living' && l.room !== 'bath') continue;
    const k2 = l.kind === 'sconce' || l.kind === 'spot' || l.kind === 'led' ? 'aux' : l.kind;
    const key = k2 === 'chandelier' || k2 === 'lamp' ? k2 + ':' + l.x.toFixed(1) + ':' + l.z.toFixed(1) : k2 + ':' + l.room;
    if (!groups.has(key)) groups.set(key, { ...l, n: 0, sx: 0, sy: 0, sz: 0, p: 0 });
    const g = groups.get(key); g.n++; g.sx += l.x; g.sy += l.y; g.sz += l.z; g.p += l.power;
  }
  const points = [];
  for (const g of groups.values()) {
    const color = g.kind === 'led' ? '#ffd6a0' : g.kind === 'spot' ? '#fff0db' : '#ffd29c';
    const base = { chandelier: 9, lamp: 4, sconce: 3, led: 2, spot: 5 }[g.kind] || 4;
    const pl = new THREE.PointLight(color, base * Math.min(Math.max(g.p, 0.5), 1.2), g.kind === 'chandelier' ? 8 : 5, 2);
    pl.position.set(g.sx / g.n, g.sy / g.n, g.sz / g.n);
    pl.userData.base = pl.intensity; pl.userData.kind = g.kind;
    pl.visible = false;
    scene.add(pl); points.push(pl);
  }

  const outside = MAT.outside;
  const emissives = [['lampshade', 0.6], ['bulb', 2.2], ['globe', 1.4], ['ceramic_lamp', 1.0]];

  function setMode(mode) {
    const day = mode === 'day', eve = mode === 'evening', night = mode === 'night';
    // sun direction: day = high afternoon from W-NW, evening = low golden from W
    if (day) { sun.position.set(3.1 - 7, 14, 3.8 - 15); sun.color.set('#fff3e2'); sun.intensity = 3.2; }
    if (eve) { sun.position.set(3.1 - 18, 5.5, 3.8 - 10); sun.color.set('#ffb070'); sun.intensity = 1.5; }
    sun.visible = !night;
    hemi.intensity = day ? 0.55 : eve ? 0.14 : 0.04;
    hemi.color.set(day ? '#e7eef5' : eve ? '#f3d6bd' : '#55627a');
    for (const r of rects) { r.intensity = (day ? 7 : eve ? 1.4 : 0.15) * r.userData.k; r.color.set(day ? '#dfe9f3' : eve ? '#ffcf9f' : '#4a5b7a'); }
    for (const p of points) { p.visible = !day; p.intensity = p.userData.base * (night ? 1.15 : 1.0); }
    for (const [k, v] of emissives) { const m = MAT[k]; if (m && m.emissiveIntensity !== undefined) m.emissiveIntensity = day ? 0 : v * (night ? 1.2 : 1); }
    MAT.led.color.set(day ? '#f2e6d6' : '#ffd9a8');
    MAT.spot.color.set(day ? '#f4f1ea' : '#fff6e8');
    outside.color.set(day ? '#ffffff' : eve ? '#f0b48a' : '#1c2436');
    renderer.toneMappingExposure = day ? 1.0 : eve ? 1.0 : 1.05;
    renderer.shadowMap.needsUpdate = true;
  }
  return { sun, hemi, rects, points, setMode };
}
