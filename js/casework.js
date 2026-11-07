// Openable casework: hinged doors and drawers on their own pivots (click / E / tap to open),
// hollow carcasses, and procedural contents (clothes, food, dishes, toiletries).
// Frame convention as in pieces.js: origin bottom-centre of the front plane, front toward +z, depth into -z.
import * as THREE from 'three';
import { Batch, Frame } from './geom.js';
import { shakerDoor, archPanelDoor, collide } from './pieces.js';

export const MOVERS = [];   // { kind: 'hinge'|'drawer', inner, meshes, inside, open, target, max, sign }
let ROOT = null;
export function setRoot(g) { ROOT = g; }

const HP = Math.PI / 2;
const rnd = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const pick = (arr, s) => arr[Math.floor(rnd(s) * arr.length) % arr.length];

function attach(F, offX) {
  const outer = new THREE.Group(); outer.name = 'mover';
  F.M.clone().multiply(new THREE.Matrix4().makeTranslation(offX, 0, 0)).decompose(outer.position, outer.quaternion, outer.scale);
  const inner = new THREE.Group(); outer.add(inner); ROOT.add(outer);
  return inner;
}
function register(m) { for (const me of m.meshes) me.userData.mover = m; for (const me of m.inside) { me.visible = false; me.castShadow = false; } MOVERS.push(m); return m; }

// Hinged leaf. hinge: 'L' | 'R' = local side of the hinge. draw(L) draws the leaf like shakerDoor (origin bottom-centre).
// back(L) optionally draws things fixed to the inside of the leaf (fridge door bins), z < 0.
export function hinged(F, w, hinge, draw, { angle = 1.65, back } = {}) {
  const hx = hinge === 'L' ? -w / 2 : w / 2;
  const inner = attach(F, hx);
  const B = new Batch(); const L = new Frame(B, new THREE.Matrix4().makeTranslation(-hx, 0, 0));
  draw(L); if (back) back(L);
  const meshes = B.build(inner, { name: 'leaf' });
  return register({ kind: 'hinge', inner, meshes, inside: [], open: 0, target: 0, max: angle, sign: hinge === 'L' ? -1 : 1 });
}

// Drawer: front drawn by draw(L) (origin bottom-centre of front plane); box + fill(LI, iw, ih, id) move with it.
export function drawer(F, w, h, depth, draw, fill, { travel, boxH } = {}) {
  const inner = attach(F, 0);
  const B = new Batch(); draw(new Frame(B));
  const meshes = B.build(inner, { name: 'drawer' });
  const BI = new Batch(); const LI = new Frame(BI);
  const bw = w - 0.07, bh = boxH || Math.max(0.05, Math.min(h - 0.06, 0.26)), d = depth;
  LI.box(0.012, bh, d, -bw / 2 + 0.006, 0.03, -d / 2, 'drawer_box'); LI.box(0.012, bh, d, bw / 2 - 0.006, 0.03, -d / 2, 'drawer_box');
  LI.box(bw - 0.024, bh, 0.012, 0, 0.03, -d + 0.006, 'drawer_box'); LI.box(bw - 0.024, 0.01, d - 0.012, 0, 0.025, -d / 2 - 0.006, 'drawer_box');
  if (fill) fill(LI.sub(0, 0.035, -d / 2), bw - 0.03, bh - 0.01, d - 0.03);
  const inside = BI.build(inner, { name: 'drawer-in', cast: false });
  return register({ kind: 'drawer', inner, meshes, inside, open: 0, target: 0, max: travel || Math.min(0.42, d * 0.8), sign: 1 });
}

// Hollow carcass behind the front plane (z = 0). shelves: [y] or [y, x0, x1]; parts: x of vertical partitions.
export function carcass(F, w, h, d, mat, { t = 0.018, shelves = [], parts = [], top = true, bottom = true, back = true, shelfMat } = {}) {
  F.box(t, h, d, -w / 2 + t / 2, 0, -d / 2, mat); F.box(t, h, d, w / 2 - t / 2, 0, -d / 2, mat);
  if (top) F.box(w - 2 * t, t, d, 0, h - t, -d / 2, mat);
  if (bottom) F.box(w - 2 * t, t, d, 0, 0, -d / 2, mat);
  if (back) F.box(w - 2 * t, h - (top ? t : 0) - (bottom ? t : 0), 0.008, 0, bottom ? t : 0, -d + 0.004, mat);
  for (const x of parts) F.box(t, h - 2 * t, d - 0.012, x, t, -d / 2 - 0.006, mat);
  for (const s of shelves) {
    const [y, x0 = -w / 2 + t, x1 = w / 2 - t] = Array.isArray(s) ? s : [s];
    F.box(x1 - x0, t, d - 0.03, (x0 + x1) / 2, y, -d / 2 - 0.012, shelfMat || mat);
  }
}

// Wardrobe with hinged doors, hollow carcass and contents. origin bottom-centre of front plane.
export function wardrobe(F, w, h, d, n, mat, style = 'shaker', handle = 'brass', opts = {}) {
  const up = opts.upper || 0, dh = h - up, dw = w / n;
  const parts = []; for (let i = 2; i < n; i += 2) parts.push(-w / 2 + dw * i);
  carcass(F.sub(0, 0, -0.012), w, h, d - 0.02, mat, { parts, shelves: up ? [dh - 0.009] : [] });
  for (let i = 0; i < n; i++) {
    const hs = i % 2 === 0 ? 'R' : 'L', hinge = hs === 'R' ? 'L' : 'R';
    const s = F.sub(-w / 2 + dw * (i + 0.5), 0, 0);
    hinged(s, dw, hinge, (L) => {
      if (style === 'arch') archPanelDoor(L, dw, dh, mat, handle, hs);
      else if (style === 'flat') { L.box(dw - 0.004, dh - 0.004, 0.019, 0, 0.002, 0.0095, mat); if (handle) L.box(0.014, Math.min(1.2, dh * 0.5), 0.022, (hs === 'R' ? 1 : -1) * (dw / 2 - 0.045), dh * 0.33, 0.03, handle); }
      else shakerDoor(L, dw, dh, mat, { handle, handleSide: hs, handleType: opts.handleType || 'long', frame: 0.08 });
    });
    if (up) hinged(F.sub(-w / 2 + dw * (i + 0.5), dh, 0), dw, hinge, (L) => (style === 'flat' ? L.box(dw - 0.004, up - 0.004, 0.019, 0, 0.002, 0.0095, mat) : shakerDoor(L, dw, up, mat, { handle: null, frame: 0.07 })));
  }
  // contents per section (pairs of doors)
  const z = -(d - 0.02) / 2 - 0.012, pal = opts.palette || ['clothes1', 'clothes2', 'clothes3', 'clothes4'];
  for (let i = 0, k = 0; i < n; i += 2, k++) {
    const x0 = -w / 2 + dw * i + 0.02, x1 = Math.min(w / 2, -w / 2 + dw * (i + 2)) - 0.02;
    const kind = (opts.sections || ['hang', 'shelves', 'hang'])[k % (opts.sections || [0, 0, 0]).length];
    fillSection(F, x0, x1, 0.018, Math.min(dh, h - 0.02), z, d - 0.06, kind, pal, k + (opts.seed || 0));
  }
  if (up) for (let i = 0; i < n; i++) { const x = -w / 2 + dw * (i + 0.5); storeBox(F, x - dw * 0.18, dh + 0.01, z, dw * 0.32, Math.min(0.3, up - 0.08), 0.36, 'box_linen'); }
  collide(F, w, d, 0, -d / 2);
}

// Fill a vertical wardrobe section between x0..x1, floor y0..y1.
export function fillSection(F, x0, x1, y0, y1, z, depth, kind, pal, seed = 0) {
  const H = y1 - y0;
  if (kind === 'hang' || kind === 'coats') {
    const rod = y0 + Math.min(H - 0.42, 1.95);
    F.box(x1 - x0, 0.018, depth, (x0 + x1) / 2, rod + 0.1, z, 'drawer_box'); // hat shelf
    for (let i = 0; i < 3; i++) storeBox(F, x0 + 0.06 + i * ((x1 - x0) / 3), rod + 0.12, z, Math.min(0.3, (x1 - x0) / 3 - 0.04), 0.22, Math.min(0.4, depth - 0.05), pick(['box_linen', 'pack1', 'box_linen'], seed + i));
    hanging(F, x0, x1, rod, z, pal, seed, kind === 'coats' ? { long: 1.1, v: 0.2 } : { long: 1.05, v: 0.5 });
    // shoes on the floor
    for (let x = x0 + 0.12, i = 0; x < x1 - 0.1; x += 0.25, i++) shoes(F, x, y0, z + 0.05, pick(['leather', 'black', 'shoe_light'], seed * 5 + i));
  } else if (kind === 'shelves') {
    const n = Math.max(3, Math.floor(H / 0.36));
    for (let j = 1; j < n; j++) F.box(x1 - x0, 0.018, depth, (x0 + x1) / 2, y0 + (H / n) * j, z, 'drawer_box');
    for (let j = 0; j < n; j++) {
      const y = y0 + (H / n) * j + (j ? 0.018 : 0);
      if (j === 0) { for (let x = x0 + 0.12, i = 0; x < x1 - 0.1; x += 0.24, i++) shoes(F, x, y, z + 0.04, pick(['leather', 'black', 'shoe_light'], seed + i)); continue; }
      if (j === n - 1) { storeBox(F, x0 + 0.04, y, z, Math.min(0.36, (x1 - x0) / 2 - 0.05), 0.24, depth - 0.06, 'box_linen'); storeBox(F, (x0 + x1) / 2 + 0.02, y, z, Math.min(0.36, (x1 - x0) / 2 - 0.05), 0.24, depth - 0.06, 'box_linen'); continue; }
      for (let x = x0 + 0.03, i = 0; x < x1 - 0.32; x += 0.34, i++) folded(F, x + 0.15, y, z + 0.02, 3 + Math.floor(rnd(seed * 11 + j * 3 + i) * 4), pal, seed * 13 + j * 7 + i);
    }
  }
}

// ------------------------------------------------------------ contents
export function hanging(F, x0, x1, y, z, mats, seed = 1, { long = 1.0, v = 0.4 } = {}) {
  F.cylX(0.011, x1 - x0, (x0 + x1) / 2, y, z, 'chrome', 12);
  let x = x0 + 0.06, k = 0;
  while (x < x1 - 0.05) {
    const r = rnd(seed * 7.3 + k), len = long - r * v, m = pick(mats, seed * 3.1 + k * 1.7);
    const s = F.sub(x, 0, z, (rnd(k + seed * 2.2) - 0.5) * 0.14);
    s.torus(0.016, 0.003, 0, y + 0.004, 0, 'chrome', 0, Math.PI * 1.3, HP);
    s.box(0.012, 0.014, 0.4, 0, y - 0.07, 0, 'oak_light');
    s.rbox(0.032, 0.07, 0.42, 0.028, 0, y - 0.13, 0, m, 0, 2);
    s.rbox(0.026, len, 0.38, 0.012, 0, y - 0.1 - len, 0, m, 0, 2);
    x += 0.05 + rnd(k * 3.7 + seed) * 0.035; k++;
  }
}
export function folded(F, x, y, z, n, mats, seed = 0, w = 0.3, d = 0.28) {
  for (let i = 0; i < n; i++) F.rbox(w - rnd(seed + i) * 0.03, 0.045, d, 0.016, x + (rnd(seed * 3 + i) - 0.5) * 0.02, y + i * 0.047, z, pick(mats, seed * 1.3 + i), 0, 2);
}
export function shoes(F, x, y, z, mat, ry = 0) {
  const s = F.sub(x, y, z, ry);
  for (const dx of [-0.05, 0.05]) { s.rbox(0.085, 0.06, 0.26, 0.028, dx, 0, 0, mat, 0, 2); s.rbox(0.075, 0.05, 0.1, 0.02, dx, 0.04, -0.07, mat, 0, 2); }
}
export function storeBox(F, x, y, z, w, h, d, mat = 'box_linen') { F.rbox(w, h, d, 0.008, x + w / 2, y, z, mat, 0, 2); F.box(w * 0.25, 0.03, 0.006, x + w / 2, y + h * 0.55, z + d / 2 + 0.002, 'oak_light'); }

// kitchen
export function plates(F, x, y, z, n = 6, r = 0.12) { for (let i = 0; i < n; i++) F.cyl(r, r * 0.78, 0.011, x, y + i * 0.013, z, 'ceramic', 28); }
export function bowls(F, x, y, z, n = 4, r = 0.075) { for (let i = 0; i < n; i++) F.lathe([[0, 0], [r * 0.55, 0], [r * 0.9, 0.04], [r, 0.062], [r * 0.94, 0.062], [r * 0.85, 0.042], [r * 0.5, 0.006], [0, 0.006]], x, y + i * 0.02, z, 'ceramic', 20); }
export function glassCup(F, x, y, z, h = 0.12) { F.lathe([[0, 0], [0.032, 0], [0.036, h], [0.033, h], [0.029, 0.005], [0, 0.005]], x, y, z, 'glass_cup', 16); }
export function mug(F, x, y, z, mat = 'ceramic') { F.lathe([[0, 0], [0.04, 0], [0.041, 0.095], [0.037, 0.095], [0.036, 0.008], [0, 0.008]], x, y, z, mat, 18); F.torus(0.024, 0.006, x + 0.045, y + 0.05, z, mat, 0, Math.PI * 2, 0); }
export function jar(F, x, y, z, r, h, fill) { F.cyl(r * 0.88, r * 0.88, h * 0.72, x, y + 0.004, z, fill, 16); F.cyl(r, r, h, x, y, z, 'jar_glass', 20, true); F.cyl(r * 1.04, r * 1.04, 0.024, x, y + h, z, 'oak_light', 20); }
export function pack(F, x, y, z, w, h, d, mat) { F.box(w, h, d, x, y, z, mat); F.box(w + 0.002, h * 0.28, d + 0.002, x, y + h * 0.52, z, 'carton'); }
export function bottle(F, x, y, z, mat, s = 1) { F.lathe([[0, 0], [0.033 * s, 0], [0.034 * s, 0.2 * s], [0.014 * s, 0.26 * s], [0.012 * s, 0.31 * s], [0.015 * s, 0.315 * s], [0, 0.315 * s]], x, y, z, mat, 16); }
export function can(F, x, y, z, mat) { F.cyl(0.034, 0.034, 0.11, x, y, z, mat, 16); F.cyl(0.032, 0.032, 0.004, x, y + 0.11, z, 'steel', 16); }
export function carton(F, x, y, z, mat = 'carton', h = 0.2) { F.box(0.07, h, 0.07, x, y, z, mat); F.sub(x, y + h, z).add(new THREE.CylinderGeometry(0.0, 0.05, 0.035, 4, 1), mat, new THREE.Matrix4().compose(new THREE.Vector3(0, 0.017, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0)), new THREE.Vector3(1, 1, 1))); }
export function pot(F, x, y, z, r = 0.1, h = 0.13, lid = true) {
  F.lathe([[0, 0], [r, 0], [r, h], [r - 0.004, h], [r - 0.004, 0.006], [0, 0.006]], x, y, z, 'steel', 32);
  for (const s of [-1, 1]) F.box(0.04, 0.012, 0.025, x + s * (r + 0.018), y + h - 0.03, z, 'steel');
  if (lid) { F.lathe([[0, 0.02], [r * 0.5, 0.017], [r + 0.004, 0], [r + 0.004, -0.004], [0, -0.002]], x, y + h + 0.004, z, 'glass_cup', 32); F.sphere(0.014, x, y + h + 0.03, z, 'black', 10, 0.7); F.torus(r + 0.004, 0.003, x, y + h + 0.002, z, 'steel'); }
}
export function pan(F, x, y, z, r = 0.12, ry = 0) {
  F.lathe([[0, 0], [r - 0.015, 0], [r, 0.045], [r - 0.004, 0.045], [r - 0.018, 0.006], [0, 0.006]], x, y, z, 'appliance', 32);
  const s = F.sub(x, y, z, ry); s.box(0.025, 0.016, 0.2, 0, 0.032, r + 0.1, 'black'); s.box(0.03, 0.02, 0.03, 0, 0.028, r + 0.012, 'steel');
}
export function kettle(F, x, y, z) {
  F.lathe([[0, 0], [0.085, 0], [0.09, 0.03], [0.088, 0.13], [0.06, 0.18], [0.03, 0.19], [0.02, 0.2], [0, 0.2]], x, y, z, 'steel', 28);
  F.sphere(0.014, x, y + 0.205, z, 'black', 10);
  F.tube([[x - 0.06, y + 0.17, z], [x - 0.02, y + 0.26, z], [x + 0.04, y + 0.26, z], [x + 0.07, y + 0.16, z]], 0.008, 'black', 16, false, 6);
  F.tube([[x - 0.08, y + 0.06, z], [x - 0.12, y + 0.13, z], [x - 0.135, y + 0.16, z]], 0.012, 'steel', 8, false, 8);
}
export function fruit(F, x, y, z, r, mat) { F.sphere(r, x, y + r * 0.92, z, mat, 14); }

// Fill a kitchen shelf x0..x1 at height y with a themed row.
export function kitchenRow(F, x0, x1, y, z, kind, seed = 0) {
  let x = x0 + 0.02, k = 0;
  const fits = (wd) => x + wd <= x1 - 0.015;
  while (true) {
    const s = seed * 17 + k++;
    if (kind === 'plates') { if (!fits(0.26)) break; plates(F, x + 0.13, y, z, 5 + Math.floor(rnd(s) * 4)); x += 0.27; if (fits(0.17)) { bowls(F, x + 0.085, y, z, 3 + Math.floor(rnd(s + 1) * 3)); x += 0.18; } continue; }
    if (kind === 'glasses') { if (!fits(0.08)) break; glassCup(F, x + 0.04, y, z - 0.06, 0.1 + rnd(s) * 0.05); glassCup(F, x + 0.04, y, z + 0.06, 0.1 + rnd(s + 2) * 0.05); x += 0.085; continue; }
    if (kind === 'mugs') { if (!fits(0.11)) break; mug(F, x + 0.045, y, z - 0.05, pick(['ceramic', 'mug_blue', 'ceramic', 'mug_sand'], s)); mug(F, x + 0.045, y, z + 0.07, pick(['mug_sand', 'ceramic', 'mug_blue'], s + 3)); x += 0.115; continue; }
    if (kind === 'jars') { const r = 0.045 + rnd(s) * 0.02; if (!fits(r * 2 + 0.02)) break; jar(F, x + r, y, z, r, 0.14 + rnd(s + 1) * 0.1, pick(['food_rice', 'food_brown', 'food_yellow', 'food_orange', 'food_green', 'food_rice'], s + 2)); x += r * 2 + 0.02; continue; }
    if (kind === 'packs') {
      const t = rnd(s);
      if (t < 0.45) { const w = 0.16 + rnd(s + 1) * 0.06; if (!fits(w)) break; pack(F, x + w / 2, y, z, w, 0.22 + rnd(s + 2) * 0.08, 0.07, pick(['pack1', 'pack2', 'pack3', 'pack4'], s + 3)); x += w + 0.015; }
      else if (t < 0.75) { if (!fits(0.075)) break; can(F, x + 0.037, y, z + 0.05, pick(['pack2', 'pack3', 'steel'], s)); can(F, x + 0.037, y + 0.114, z + 0.05, pick(['pack2', 'pack4', 'steel'], s + 4)); can(F, x + 0.037, y, z - 0.05, 'pack4'); x += 0.08; }
      else { if (!fits(0.075)) break; bottle(F, x + 0.037, y, z, pick(['bottle_green', 'bottle_amber', 'bottle_oil'], s), 0.9 + rnd(s) * 0.2); x += 0.08; }
      continue;
    }
    break;
  }
}

// Drawer fills: F origin at drawer floor centre; w x d interior
export function drawerFill(F, w, h, d, kind, seed = 0) {
  if (kind === 'cutlery') {
    F.box(w, 0.045, d * 0.8, 0, 0, 0, 'oak_light');
    const n = Math.max(3, Math.floor(w / 0.1)); const cw = w / n;
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + cw * (i + 0.5);
      if (i) F.box(0.008, 0.05, d * 0.8, -w / 2 + cw * i, 0, 0, 'oak_light');
      for (let j = 0; j < 4; j++) { F.box(0.016, 0.006, 0.19, cx - 0.024 + j * 0.016, 0.046 + j * 0.003, -0.02, 'chrome'); F.box(0.03, 0.004, 0.05, cx - 0.024 + j * 0.016, 0.047 + j * 0.003, 0.09, 'chrome'); }
    }
  } else if (kind === 'pots') {
    const n = Math.max(1, Math.floor(w / 0.26));
    for (let i = 0; i < n; i++) { const x = -w / 2 + (w / n) * (i + 0.5); pot(F, x, 0, -d * 0.22, Math.min(0.11, w / n / 2 - 0.02), Math.min(h - 0.03, 0.14), true); pan(F, x, 0, d * 0.25, Math.min(0.1, w / n / 2 - 0.02), 0); }
  } else if (kind === 'utensils') {
    F.box(w, 0.04, d * 0.8, 0, 0, 0, 'oak_light');
    for (let i = 0; i < 6; i++) { const x = -w / 2 + 0.05 + i * (w - 0.1) / 5; F.box(0.03, 0.012, 0.3, x, 0.045, -0.02, pick(['oak_dark', 'black', 'steel'], seed + i)); F.box(0.06, 0.008, 0.07, x, 0.045, 0.16, pick(['oak_dark', 'black', 'steel'], seed + i)); }
  } else if (kind === 'containers') {
    for (let x = -w / 2 + 0.08, i = 0; x < w / 2 - 0.07; x += 0.15, i++) for (const z of [-d * 0.25, d * 0.2]) { F.rbox(0.13, Math.min(h - 0.02, 0.1), 0.18, 0.01, x, 0, z, 'jar_glass', 0, 2); F.box(0.11, Math.min(h - 0.04, 0.07), 0.16, x, 0.002, z, pick(['food_rice', 'food_brown', 'food_orange'], i + z * 10)); F.box(0.135, 0.012, 0.185, x, Math.min(h - 0.02, 0.1), z, pick(['mug_blue', 'pack4', 'mug_sand'], i)); }
  } else if (kind === 'bins') {
    for (const [x, m] of [[-w / 4, 'bin1'], [w / 4, 'bin2']]) { F.rbox(w / 2 - 0.03, Math.min(h - 0.02, 0.4), d * 0.85, 0.02, x, 0, 0, m, 0, 2); }
  } else if (kind === 'towels') {
    for (let x = -w / 2 + 0.12, i = 0; x < w / 2 - 0.1; x += 0.24, i++) folded(F, x, 0, 0, Math.max(1, Math.min(4, Math.floor((h - 0.02) / 0.047))), ['linen_white', 'towel_sand', 'linen_white'], seed + i, 0.22, d * 0.75);
  } else if (kind === 'toiletries') {
    for (let x = -w / 2 + 0.05, i = 0; x < w / 2 - 0.04; x += 0.08, i++) for (const z of [-d * 0.28, 0, d * 0.28]) { const t = rnd(seed + i * 3 + z * 7); if (t < 0.5) F.lathe([[0, 0], [0.028, 0], [0.028, 0.12], [0.012, 0.14], [0.012, 0.16], [0, 0.16]].map(([a, b]) => [a, Math.min(b, h - 0.01)]), x, 0, z, pick(['ceramic', 'bottle_amber', 'mug_sand', 'pack1'], i + t), 14); else F.rbox(0.06, 0.03, 0.06, 0.01, x, 0, z, pick(['ceramic', 'mug_blue', 'towel_sand'], i), 0, 2); }
  } else if (kind === 'clothes') {
    for (let x = -w / 2 + 0.16, i = 0; x < w / 2 - 0.14; x += 0.31, i++) folded(F, x, 0, 0, Math.max(1, Math.min(3, Math.floor((h - 0.02) / 0.047))), ['clothes1', 'clothes2', 'clothes3', 'clothes7', 'clothes5', 'clothes6'], seed * 5 + i, 0.28, d * 0.8);
  } else if (kind === 'socks') {
    for (let x = -w / 2 + 0.04, i = 0; x < w / 2 - 0.03; x += 0.075, i++) for (let z = -d / 2 + 0.05, j = 0; z < d / 2 - 0.04; z += 0.08, j++) F.sphere(0.034, x, 0.03, z, pick(['clothes1', 'clothes2', 'clothes4', 'clothes5', 'clothes6'], i * 7 + j), 10, 0.75);
  } else if (kind === 'frozen') {
    for (let x = -w / 2 + 0.1, i = 0; x < w / 2 - 0.09; x += 0.17, i++) for (const z of [-d * 0.22, d * 0.22]) F.rbox(0.15, Math.min(h - 0.03, 0.06 + rnd(i + z) * 0.08), 0.2, 0.02, x, 0, z, pick(['frost1', 'frost2', 'pack4', 'carton'], i * 3 + z * 5), 0, 2);
  } else if (kind === 'makeup') {
    for (let x = -w / 2 + 0.05, i = 0; x < w / 2 - 0.04; x += 0.07, i++) { F.cyl(0.012, 0.012, 0.09, x, 0, -0.05, pick(['gilt', 'black', 'glass_pink'], i), 10); F.rbox(0.05, 0.015, 0.05, 0.006, x, 0, 0.06, pick(['mug_sand', 'glass_pink', 'gilt'], i + 2), 0, 2); }
  }
}

// Washer / dryer front-loader. origin bottom-centre of the machine front, facing +z.
export function washer(F, label = 'washer') {
  F.rbox(0.6, 0.84, 0.58, 0.02, 0, 0, -0.29, 'ceramic', 0, 2);
  F.box(0.56, 0.1, 0.004, 0, 0.72, 0.002, label === 'washer' ? 'appliance' : 'steel');
  F.cylZ(0.022, 0.006, 0.2, 0.77, 0.006, 'chrome', 20);
  F.torus(0.17, 0.02, 0, 0.4, 0.012, 'chrome', 0);
  F.cylZ(0.16, 0.006, 0, 0.4, 0.004, 'appliance', 40); F.cylZ(0.15, 0.004, 0, 0.4, 0.016, 'glass_cup', 40);
}
