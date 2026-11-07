// Architecture: walls (from the PDF plan), openings, floors, ceilings, cornices, windows, doors.
import * as THREE from 'three';
import { WALLS, WINDOWS } from './plan-data.js';
import { MAT } from './materials.js';
import { Batch, Frame, mat4, quad, flatPoly, sweep, pointInPoly, signedArea, planarUV } from './geom.js';

export const CEIL = 2.8715;     // ГКЛ1 ceiling (slab +3.120 − 248.5)
export const LOW = 2.77;        // ГКЛ2 ceiling: hall, kitchen niche, bathroom, wardrobe bay (slab − 350)
export const WALL_TOP = 3.12;   // structural slab
export const HEAD = 2765;       // window head
export const SILL = 490;
const S = 0.001;

// ---------------- Rooms (finished contours, mm) ----------------
export const ROOMS = [
  { id: 'living', name: 'Кухня-гостиная', wall: 'w_living', floor: 'floor_wood',
    poly: [[0, 0], [3045, 0], [3045, 5290], [2350, 5290], [2350, 7370], [0, 7370]] },
  { id: 'hall', name: 'Прихожая и коридор', wall: 'w_hall', floor: 'floor_wood',
    poly: [[3045, 4420], [4255, 4420], [4255, 7640], [3090, 7640], [3090, 6735], [2510, 6735], [2510, 5400], [3130, 5400], [3130, 5290], [3045, 5290]] },
  { id: 'bed', name: 'Спальня', wall: 'w_bed', floor: 'floor_wood',
    poly: [[3200, 0], [6165, 0], [6165, 4885], [4410, 4885], [4410, 4285], [3200, 4285]] },
  { id: 'bath', name: 'Санузел', wall: 'w_bath', floor: 'floor_bath',
    poly: [[4395, 5010], [6125, 5010], [6125, 6829], [5216, 6829], [5216, 7608], [4395, 7608]] },
];
export const UI_ROOM = { living: 'living', hall: 'hall', bed: 'bed', bath: 'bath' };

export function roomAt(x, y) { for (const r of ROOMS) if (pointInPoly(x, y, r.poly)) return r; return null; }

// ---------------- Openings ----------------
// axis 'x': wall runs N-S (thickness along x: w0..w1), span along y a..b ; axis 'y': wall runs E-W
export const OPENINGS = [
  { id: 'd_bed', kind: 'hidden', axis: 'y', w0: 4285, w1: 4420, a: 3155, b: 4020, top: 2770, hinge: 'a', swing: -1, open: 0.95 },
  { id: 'd_bath', kind: 'hidden', axis: 'x', w0: 4255, w1: 4395, a: 5745, b: 6440, top: 2770, hinge: 'b', swing: -1, open: 0 },
  { id: 'd_entry', kind: 'entry', axis: 'y', w0: 7640, w1: 7980, a: 3140, b: 4220, top: 2300, hinge: 'b', swing: 1, open: 0 },
];
export const SHOWER = { y: 6565, x0: 4395, xh: 4634, x1: 5216, top: 2100 };

// ---------------- Prisms ----------------
const rect = (x0, x1, y0, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
function openingRect(o) { return o.axis === 'x' ? rect(o.w0, o.w1, o.a, o.b) : rect(o.a, o.b, o.w0, o.w1); }

export const PRISMS = [];
for (const p of WALLS) PRISMS.push({ poly: p, z0: 0, z1: WALL_TOP * 1000, kind: 'wall' });
for (const o of OPENINGS) PRISMS.push({ poly: openingRect(o), z0: o.top, z1: WALL_TOP * 1000, kind: 'lintel' });
for (const w of WINDOWS) {
  const r = rect(w.a, w.b, -435, 0);
  PRISMS.push({ poly: r, z0: 0, z1: w.sill, kind: 'sill' });
  PRISMS.push({ poly: r, z0: HEAD, z1: WALL_TOP * 1000, kind: 'lintel' });
}
// toilet installation (TECEprofil 1120) and shower podium (C2)
PRISMS.push({ poly: rect(5430, 6125, 6829, 7065), z0: 0, z1: 1120, kind: 'ledge' });
PRISMS.push({ poly: rect(4395, 5216, 6565, 7608), z0: 0, z1: 150, kind: 'podium' });

function insideSolid(x, y, z) {
  for (const p of PRISMS) if (z >= p.z0 && z <= p.z1 && pointInPoly(x, y, p.poly)) return true;
  return false;
}

// ---------------- Build ----------------
export function buildArchitecture(scene) {
  const root = new THREE.Group(); root.name = 'architecture'; scene.add(root);
  const ceilGroup = new THREE.Group(); ceilGroup.name = 'ceilings'; root.add(ceilGroup);
  const B = new Batch(), BC = new Batch();
  for (const k of ['curtain', 'sheer', 'glass', 'glass_fluted', 'glass_display', 'glass_shower']) if (MAT[k]) MAT[k].side = THREE.DoubleSide;

  for (const pr of PRISMS) {
    const poly = pr.poly;
    const ccwScreen = signedArea(poly) < 0;
    const z0 = pr.z0 * S, z1 = pr.z1 * S;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
      const tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L;
      const ox = ccwScreen ? -ty : ty, oy = ccwScreen ? tx : -tx;
      const n = Math.max(1, Math.round(L / 10));
      const zm = (pr.z0 + Math.min(pr.z1, 2700)) / 2;
      let runStart = 0, runKey = null;
      const keyAt = (t) => {
        const x = a[0] + tx * t + ox * 40, y = a[1] + ty * t + oy * 40;
        if (insideSolid(x, y, zm)) return 'skip';
        if (pr.kind === 'podium') return 'floor_bath';
        if (pr.kind === 'sill' || (pr.kind === 'lintel' && y < 0)) return 'plaster';
        const r = roomAt(x, y);
        return r ? r.wall : 'plaster';
      };
      const flush = (t0, t1, key) => {
        if (key === 'skip' || t1 - t0 < 0.5) return;
        const x0 = (a[0] + tx * t0) * S, y0 = (a[1] + ty * t0) * S, x1 = (a[0] + tx * t1) * S, y1 = (a[1] + ty * t1) * S;
        const g = ccwScreen ? quad(x1, y1, x0, y0, z0, z1) : quad(x0, y0, x1, y1, z0, z1);
        const uvA = g.attributes.uv; const u0 = Math.abs(tx) > Math.abs(ty) ? Math.min(x0, x1) : Math.min(y0, y1);
        for (let k = 0; k < uvA.count; k++) uvA.setX(k, uvA.getX(k) + u0);
        B.add(g, key);
      };
      for (let k = 0; k <= n; k++) {
        const t = (k / n) * L;
        const key = k === n ? null : keyAt(t + (L / n) / 2);
        if (key !== runKey) { if (runKey !== null) flush(runStart, t, runKey); runStart = t; runKey = key; }
      }
    }
    const pm = poly.map(([x, y]) => [x * S, y * S]);
    B.add(flatPoly(pm, z1, true), pr.kind === 'podium' ? 'floor_bath' : pr.kind === 'ledge' ? 'wood' : pr.kind === 'sill' ? 'plaster' : 'cut');
    if (pr.z0 > 0) B.add(flatPoly(pm, z0, false), 'plaster');
  }

  // floors (+ thresholds under openings)
  for (const r of ROOMS) B.add(flatPoly(r.poly.map(([x, y]) => [x * S, y * S]), 0, true), r.floor);
  for (const o of OPENINGS) {
    if (o.kind === 'entry') continue;
    const r = openingRect(o);
    B.add(flatPoly(r.map(([x, y]) => [x * S, y * S]), 0, true), 'floor_wood');
  }
  // entry: floor of the deep MDF portal
  B.add(flatPoly(rect(3140, 4220, 7640, 7980).map(([x, y]) => [x * S, y * S]), 0, true), 'floor_wood');

  buildCeilings(BC);
  buildMouldings(B, BC);
  buildWindows(B);

  B.build(root, { name: 'arch' });
  BC.build(ceilGroup, { name: 'ceil', cast: true });
  const doors = buildDoors(root);
  return { root, ceilGroup, doors };
}

// ---------------- Ceilings ----------------
// main (h), slots up to the slab (curtain pockets), boxes at lower heights; fascias are generated between levels.
const CEILINGS = [
  { room: 'living', h: CEIL, main: rect(0, 3045, 280, 5290), slots: [rect(0, 3045, 0, 280)], boxes: [{ poly: rect(0, 2350, 5290, 7370), h: LOW }], cornice: true },
  { room: 'bed', h: CEIL, main: rect(3200, 6165, 170, 4285), slots: [rect(3200, 6165, 0, 170)], boxes: [{ poly: rect(4410, 6165, 4285, 4885), h: LOW }], cornice: true },
  { room: 'hall', h: LOW, main: ROOMS[1].poly, slots: [], boxes: [], cornice: false },
  { room: 'bath', h: LOW, main: ROOMS[3].poly, slots: [], boxes: [], cornice: false },
];
export const CEIL_SPECS = CEILINGS;

function buildCeilings(BC) {
  for (const c of CEILINGS) {
    BC.add(flatPoly(c.main.map(([x, y]) => [x * S, y * S]), c.h, false), 'ceiling');
    for (const s of c.slots) BC.add(flatPoly(s.map(([x, y]) => [x * S, y * S]), WALL_TOP - 0.002, false), 'ceiling');
    for (const bx of c.boxes) BC.add(flatPoly(bx.poly.map(([x, y]) => [x * S, y * S]), bx.h, false), 'ceiling');
    const mp = c.main;
    for (let i = 0; i < mp.length; i++) {
      const a = mp[i], b = mp[(i + 1) % mp.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 5) continue;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
      for (const sgn of [1, -1]) {
        const px = mx + nx * sgn * 30, py = my + ny * sgn * 30;
        const inSlot = c.slots.some((s) => pointInPoly(px, py, s));
        const box = c.boxes.find((s) => pointInPoly(px, py, s.poly));
        if (!inSlot && !box) continue;
        const h0 = inSlot ? c.h : box.h, h1 = inSlot ? WALL_TOP : c.h;
        BC.add(quad(a[0] * S, a[1] * S, b[0] * S, b[1] * S, h0, h1), 'ceiling');
        BC.add(quad(b[0] * S, b[1] * S, a[0] * S, a[1] * S, h0, h1), 'ceiling');
      }
    }
  }
}

// ---------------- Cornice (Orac C392 «Steps») + hidden skirting shadow gap ----------------
function inward(poly) { return signedArea(poly) > 0 ? poly.slice().reverse() : poly; }
const STEPS = [[0, 0], [0.012, 0], [0.012, 0.022], [0.026, 0.022], [0.026, 0.044], [0.04, 0.044], [0.04, 0.066], [0.054, 0.066], [0.054, 0.1], [0, 0.1]];
const GAP = [[0, 0], [-0.008, 0], [-0.008, 0.012], [0, 0.012]];

function buildMouldings(B, BC) {
  for (const c of CEILINGS) {
    if (!c.cornice) continue;
    // run the stepped cornice along the walls of the main ceiling (skip edges facing the curtain slot or a box)
    const path = inward(c.main);
    for (let i = 0; i < path.length; i++) {
      const a = path[i], b = path[(i + 1) % path.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L; // outward (right of travel, interior on left)
      const out = [mx + nx * 30, my + ny * 30];
      const atSlot = c.slots.some((s) => pointInPoly(out[0], out[1], s));
      const atBox = c.boxes.some((s) => pointInPoly(out[0], out[1], s.poly));
      const geos = sweep([[a[0] * S, a[1] * S], [b[0] * S, b[1] * S]], STEPS, false, c.h - 0.1);
      if (atSlot || atBox) continue;
      for (const g of geos) BC.add(g, 'trim');
    }
  }
  // hidden skirting: dark 12 mm recess along the floor of every room (minus openings)
  for (const r of ROOMS) {
    const poly = inward(r.poly);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 5) continue;
      const tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L;
      const ox = -ty, oy = tx;
      const n = Math.max(1, Math.round(L / 10)); let s0 = null; const runs = [];
      for (let k = 0; k <= n; k++) {
        const t = (k / n) * L;
        const solid = k < n && insideSolid(a[0] + tx * (t + L / n / 2) - ox * 35, a[1] + ty * (t + L / n / 2) - oy * 35, 50);
        if (solid && s0 === null) s0 = t;
        if (!solid && s0 !== null) { runs.push([s0, t]); s0 = null; }
      }
      for (const [t0, t1] of runs) {
        const geos = sweep([[(a[0] + tx * t0) * S, (a[1] + ty * t0) * S], [(a[0] + tx * t1) * S, (a[1] + ty * t1) * S]], GAP, false, 0.001);
        for (const g of geos) B.add(g, 'shadowgap');
      }
    }
  }
}

// ---------------- Windows: black aluminium frames, MDF wood reveals, roman blinds ----------------
function buildWindows(B) {
  const F = new Frame(B);
  for (const w of WINDOWS) {
    const y0 = w.sill * S, y1 = HEAD * S;
    const a = (w.a + 20) * S, b = (w.b - 20) * S, cx = (a + b) / 2, L = b - a, fz = -0.33;
    // MDF reveal lining (Д-1): jambs, head, sill board (seat)
    F.box(0.02, y1 - y0, 0.33, w.a * S + 0.01, y0, -0.165, 'wood');
    F.box(0.02, y1 - y0, 0.33, w.b * S - 0.01, y0, -0.165, 'wood');
    F.box(L, 0.02, 0.33, cx, y1 - 0.02, -0.165, 'wood');
    F.box((w.b - w.a) * S + 0.04, 0.03, 0.37, cx, y0 - 0.026, -0.165, 'wood'); // 4 mm proud of the plaster reveal (no z-fight)
    // frame: perimeter + two mullions (three sashes), slim profiles
    const fw = 0.06;
    F.box(L, fw, 0.07, cx, y0, fz, 'win_frame'); F.box(L, fw, 0.07, cx, y1 - fw, fz, 'win_frame');
    F.box(fw, y1 - y0, 0.07, a + fw / 2, y0, fz, 'win_frame'); F.box(fw, y1 - y0, 0.07, b - fw / 2, y0, fz, 'win_frame');
    const pane = (L - 2 * fw) / 3;
    for (const k of [1, 2]) F.box(0.07, y1 - y0, 0.07, a + fw + pane * k, y0, fz, 'win_frame');
    for (let k = 0; k < 3; k++) {
      const pc = a + fw + pane * (k + 0.5);
      F.box(pane - 0.07, y1 - y0 - 2 * fw, 0.006, pc, y0 + fw, fz, 'glass');
      // sash bead
      F.box(pane - 0.07, 0.025, 0.03, pc, y0 + fw, fz + 0.04, 'win_frame'); F.box(pane - 0.07, 0.025, 0.03, pc, y1 - fw - 0.025, fz + 0.04, 'win_frame');
      if (k !== 1) F.box(0.018, 0.13, 0.025, pc + (k === 0 ? 1 : -1) * (pane / 2 - 0.07), 1.25, fz + 0.06, 'win_frame');
    }
    // roman blinds (linen), one per sash, partly lowered
    for (let k = 0; k < 3; k++) {
      const pc = a + fw + pane * (k + 0.5), bw = pane - 0.02;
      const drop = 0.55 + (k === 1 ? 0.12 : 0.0);
      F.box(bw, 0.04, 0.05, pc, y1 - 0.06, -0.27, 'blind');
      const folds = 4, fh = drop / folds;
      for (let f = 0; f < folds; f++) {
        const yy = y1 - 0.06 - (f + 1) * fh;
        F.rbox(bw, fh + 0.01, 0.03 + (f === folds - 1 ? 0.012 : 0), 0.012, pc, yy, -0.27 + (f % 2) * 0.006, 'blind', 0, 2);
      }
    }
  }
}

// ---------------- Doors ----------------
function oframe(o) {
  const nrm = o.axis === 'y' ? [0, 1] : [1, 0];
  const c = (o.w0 + o.w1) / 2;
  const P = (u, d) => o.axis === 'y' ? [u * S, (c + d) * S] : [(c + d) * S, u * S];
  return { nrm, c, P, th: o.w1 - o.w0 };
}

// flush leaf: hinge at origin, width +X, thickness Z
function flushLeaf(B, w, h, t, mat, handleMat, opts = {}) {
  const F = new Frame(B);
  F.box(w, h, t, w / 2, 0, 0, mat);
  for (const side of [1, -1]) {
    const z = side * (t / 2);
    if (opts.entry) {
      F.box(0.022, 0.35, 0.02, w - 0.08, 0.9, z + side * 0.04, handleMat);
      F.box(0.014, 0.014, 0.045, w - 0.08, 0.95, z + side * 0.02, handleMat); F.box(0.014, 0.014, 0.045, w - 0.08, 1.2, z + side * 0.02, handleMat);
    } else {
      F.cylZ(0.022, 0.008, w - 0.065, 1.0, z + side * 0.004, handleMat, 24);
      F.cylZ(0.008, 0.045, w - 0.065, 1.0, z + side * 0.026, handleMat, 12);
      F.box(0.12, 0.014, 0.014, w - 0.065 - 0.055, 0.993, z + side * 0.048, handleMat);
    }
  }
  if (opts.entry) { for (const y of [0.25, 0.9, 1.55]) F.box(w - 0.16, 0.006, 0.004, w / 2, y, t / 2 + 0.002, 'cut'); F.cylZ(0.012, t + 0.004, w - 0.08, 1.5, 0, handleMat, 12); }
}

function hingeDoor(root, o, W, H, T, mat, handleMat, opts) {
  const { P, nrm } = oframe(o);
  const leafB = new Batch();
  flushLeaf(leafB, W, H, T, mat, handleMat, opts);
  const pivot = new THREE.Group(); pivot.name = o.id;
  const meshes = leafB.build(pivot, { name: o.id });
  const hingeU = o.hinge === 'a' ? o.a + 6 : o.b - 6;
  const [hx, hz] = P(hingeU, opts.offset || 0);
  pivot.position.set(hx, 0.004, hz);
  const dir = o.hinge === 'a' ? [o.axis === 'y' ? 1 : 0, o.axis === 'y' ? 0 : 1] : [o.axis === 'y' ? -1 : 0, o.axis === 'y' ? 0 : -1];
  const base = Math.atan2(-dir[1], dir[0]);
  const want = [nrm[0] * o.swing, nrm[1] * o.swing];
  const test = (s) => { const a = base + s * Math.PI / 2; return Math.cos(a) * want[0] + (-Math.sin(a)) * want[1]; };
  const sign = test(1) > test(-1) ? 1 : -1;
  const door = { id: o.id, o, pivot, meshes, base, sign, open: o.open, target: o.open, max: Math.PI / 2 * 0.96, interactive: o.kind !== 'entry', W, hinge: [hx, hz] };
  pivot.rotation.y = base + sign * door.open * door.max;
  for (const m of meshes) m.userData.door = door;
  root.add(pivot);
  return door;
}

function buildDoors(root) {
  const doors = [];
  for (const o of OPENINGS) {
    const B = new Batch(); const F = new Frame(B);
    const { P } = oframe(o);
    if (o.kind === 'hidden') {
      // invisible aluminium frame: just a dark 3 mm reveal line
      const W = (o.b - o.a - 12) * S, H = (o.top - 14) * S;
      const [x1, z1] = P(o.a + 2, 0), [x2, z2] = P(o.b - 2, 0), [xm, zm] = P((o.a + o.b) / 2, 0), d = (o.w1 - o.w0 + 2) * S;
      // jamb lining in the wall finish; a 3 mm dark reveal only on the two faces
      const dd = d - 0.024, fo = (d - 0.006) / 2;
      if (o.axis === 'y') {
        F.box(0.004, o.top * S, dd, x1, 0, z1, 'door_hall'); F.box(0.004, o.top * S, dd, x2, 0, z2, 'door_hall'); F.box((o.b - o.a) * S, 0.004, dd, xm, o.top * S - 0.004, zm, 'door_hall');
        for (const s of [-1, 1]) { F.box(0.004, o.top * S, 0.006, x1, 0, z1 + s * fo, 'shadowgap'); F.box(0.004, o.top * S, 0.006, x2, 0, z2 + s * fo, 'shadowgap'); F.box((o.b - o.a) * S, 0.004, 0.006, xm, o.top * S - 0.004, zm + s * fo, 'shadowgap'); }
      } else {
        F.box(dd, o.top * S, 0.004, x1, 0, z1, 'door_hall'); F.box(dd, o.top * S, 0.004, x2, 0, z2, 'door_hall'); F.box(dd, 0.004, (o.b - o.a) * S, xm, o.top * S - 0.004, zm, 'door_hall');
        for (const s of [-1, 1]) { F.box(0.006, o.top * S, 0.004, x1 + s * fo, 0, z1, 'shadowgap'); F.box(0.006, o.top * S, 0.004, x2 + s * fo, 0, z2, 'shadowgap'); F.box(0.006, 0.004, (o.b - o.a) * S, xm + s * fo, o.top * S - 0.004, zm, 'shadowgap'); }
      }
      B.build(root, { name: o.id + '-frame' });
      // leaf flush with the face that it opens toward
      const off = (o.swing > 0 ? 1 : -1) * ((o.w1 - o.w0) / 2 - 22);
      doors.push(hingeDoor(root, o, W, H, 0.04, o.id === 'd_bath' ? 'door_hall' : 'door_hall', 'black', { offset: off }));
    } else if (o.kind === 'entry') {
      // deep MDF wood portal (ИМ-1) around the entrance
      const th = (o.w1 - o.w0) * S, top = o.top * S, Wd = (o.b - o.a) * S;
      const [xa, za] = P(o.a + 10, 0), [xb, zb] = P(o.b - 10, 0), [xm, zm] = P((o.a + o.b) / 2, 0);
      F.box(0.02, top, th, xa, 0, za, 'wood'); F.box(0.02, top, th, xb, 0, zb, 'wood'); F.box(Wd, 0.02, th, xm, top - 0.02, zm, 'wood');
      B.build(root, { name: 'entry-portal' });
      doors.push(hingeDoor(root, o, (o.b - o.a - 60) * S, (o.top - 20) * S, 0.07, 'door_entry', 'black', { entry: true, offset: (o.w1 - o.w0) / 2 - 60 }));
    }
  }
  doors.push(...showerGlass(root));
  return doors;
}

// Black-framed clear glass shower screen: fixed panel + hinged door (swings out into the bathroom).
function showerGlass(root) {
  const sh = SHOWER, H = sh.top * S, z = sh.y * S, y0 = 0.15;
  const B = new Batch(); const F = new Frame(B);
  const fw = (sh.xh - sh.x0) * S;
  F.box(fw, H - y0, 0.008, (sh.x0 * S + sh.xh * S) / 2, y0, z, 'glass_fluted');
  F.box(0.02, H - y0, 0.03, sh.x0 * S + 0.01, y0, z, 'black'); // wall profile
  F.box(fw, 0.02, 0.03, (sh.x0 * S + sh.xh * S) / 2, H - 0.02, z, 'black');
  F.box(fw, 0.02, 0.03, (sh.x0 * S + sh.xh * S) / 2, y0, z, 'black');
  F.box(0.02, H - y0, 0.03, sh.xh * S - 0.01, y0, z, 'black');
  F.box((sh.x1 - sh.x0) * S, 0.02, 0.02, (sh.x0 + sh.x1) / 2 * S, H + 0.0, z, 'black'); // top stabiliser bar
  B.build(root, { name: 'shower-fixed' });
  // door leaf
  const lw = (sh.x1 - sh.xh - 8) * S, LB = new Batch(), L = new Frame(LB);
  L.box(lw, H - y0 - 0.02, 0.008, lw / 2, y0 + 0.01, 0, 'glass_fluted');
  L.box(lw, 0.02, 0.025, lw / 2, H - 0.03, 0, 'black'); L.box(lw, 0.02, 0.025, lw / 2, y0 + 0.01, 0, 'black');
  L.box(0.02, H - y0 - 0.02, 0.025, 0.01, y0 + 0.01, 0, 'black'); L.box(0.02, H - y0 - 0.02, 0.025, lw - 0.01, y0 + 0.01, 0, 'black');
  for (const s of [1, -1]) { L.box(0.016, 0.42, 0.016, lw - 0.07, 0.85, s * 0.035, 'black'); L.box(0.012, 0.012, 0.035, lw - 0.07, 0.87, s * 0.018, 'black'); L.box(0.012, 0.012, 0.035, lw - 0.07, 1.25, s * 0.018, 'black'); }
  const pivot = new THREE.Group(); pivot.name = 'shower-door';
  const meshes = LB.build(pivot, { name: 'shower-door' });
  pivot.position.set(sh.xh * S, 0, z);
  const door = { id: 'd_shower', o: { kind: 'shower' }, pivot, meshes, base: 0, sign: 1, open: 0, target: 0, max: Math.PI / 2 * 0.9, interactive: true, W: lw, hinge: [sh.xh * S, z] };
  for (const m of meshes) m.userData.door = door;
  root.add(pivot);
  return [door];
}

// ---------------- Collision segments (2D, meters) ----------------
export function collisionSegments() {
  const segs = [];
  for (const p of PRISMS) {
    if (p.z0 > 900) continue;
    const poly = p.poly;
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; segs.push([a[0] * S, a[1] * S, b[0] * S, b[1] * S]); }
  }
  // fixed shower glass
  segs.push([SHOWER.x0 * S, SHOWER.y * S, SHOWER.xh * S, SHOWER.y * S]);
  return segs;
}
void mat4; void planarUV;

// true when a world point is inside a wall / lintel / built-in prism, or within `pad` m of its face
export function wallHit(x, y, z, pad = 0.012) {
  const X = x / S, Y = z / S, P = pad / S;
  for (const pr of PRISMS) {
    if (pr.kind === 'sill') continue;
    if (y * 1000 < pr.z0 || y * 1000 > pr.z1) continue;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [a, b] of pr.poly) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }
    if (pr.poly.length === 4 ? (X > x0 - P && X < x1 + P && Y > y0 - P && Y < y1 + P) : pointInPoly(X, Y, pr.poly)) return true;
  }
  return false;
}
