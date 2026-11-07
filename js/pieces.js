// Reusable furniture & fixture pieces. All in meters, local frame: origin on floor,
// +X = width, +Z = front (facing direction), +Y = up.
import * as THREE from 'three';
import { Frame, mat4, planarUV } from './geom.js';

export const LIGHTS = [];   // {x,y,z, kind, room, power}
export const COLLIDE = [];  // AABB footprints [x0,z0,x1,z1] in world meters

// world-space AABB of a local rectangle (w x d centred at cx,cz) under frame F
export function collide(F, w, d, cx = 0, cz = 0) {
  const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  const v = new THREE.Vector3();
  for (const [x, z] of pts) { v.set(cx + x, 0, cz + z).applyMatrix4(F.M); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
  COLLIDE.push([x0, z0, x1, z1]);
}
export function worldPos(F, x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(F.M); }
export function light(F, x, y, z, kind, room, power = 1) { const p = worldPos(F, x, y, z); LIGHTS.push({ x: p.x, y: p.y, z: p.z, kind, room, power }); }

// ---------- textiles ----------
export function rug(F, w, d, mat) { F.rbox(w, 0.01, d, 0.004, 0, 0, 0, 'rug_edge', 0, 2); F.plane(w - 0.004, d - 0.004, 0, 0.0104, 0, mat, 0, -Math.PI / 2); }

// Pleated curtain between two floor points (plan), hanging from y1 down to y0.
export function curtain(B, x0, z0, x1, z1, mat, y1 = 3.08, y0 = 0.01, depth = 0.045) {
  const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.05) return;
  const tx = (x1 - x0) / L, tz = (z1 - z0) / L, nx = tz, nz = -tx;
  const folds = Math.max(3, Math.round(L / 0.11));
  const segU = folds * 6, segV = 6;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= segV; j++) {
    const v = j / segV, y = y0 + (y1 - y0) * v;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      const off = Math.sin(u * folds * Math.PI * 2) * depth * (0.85 + 0.15 * (1 - v)) + Math.sin(u * 7.3 + v * 2) * 0.004;
      const s = u * L;
      pos.push(x0 + tx * s + nx * off, y, z0 + tz * s + nz * off);
      uv.push(s * 1.3, y);
    }
  }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
    const a = j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  B.add(g, mat);
}

export function pillow(F, w, h, t, x, y, z, mat, ry = 0, tilt = -0.25) {
  const g = planarUV(new THREE.SphereGeometry(0.5, 24, 16));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let X = p.getX(i), Y = p.getY(i), Z = p.getZ(i);
    // squash to cushion: flatten edges
    const r = Math.max(Math.abs(X), Math.abs(Y)) * 2;
    X = Math.sign(X) * Math.pow(Math.abs(X * 2), 0.6) * 0.5; Y = Math.sign(Y) * Math.pow(Math.abs(Y * 2), 0.6) * 0.5;
    Z = Z * (1 - r * 0.35);
    p.setXYZ(i, X * w, Y * h, Z * t);
  }
  g.computeVertexNormals();
  F.add(g, mat, mat4(x, y + h / 2, z, ry, tilt));
}

// ---------- seating ----------
export function sofaModular(F, mat, { w = 2.6, d = 0.95, chaiseW = 1.0, chaiseD = 1.6, chaiseLeft = true } = {}) {
  // origin at back-left corner; front toward +z
  const seatH = 0.42, baseH = 0.16, backH = 0.74, backT = 0.24;
  const cx0 = chaiseLeft ? 0 : w - chaiseW;
  // main base & seat (excluding chaise)
  const mx0 = chaiseLeft ? chaiseW : 0, mx1 = chaiseLeft ? w : w - chaiseW;
  F.rbox(w, baseH, d, 0.03, w / 2, 0.02, d / 2, mat);
  F.rbox(chaiseW, baseH, chaiseD, 0.03, cx0 + chaiseW / 2, 0.02, chaiseD / 2, mat);
  // seat cushions main
  const nSeat = 2, sw = (mx1 - mx0) / nSeat;
  for (let i = 0; i < nSeat; i++) F.rbox(sw - 0.01, seatH - baseH - 0.02, d - backT - 0.02, 0.07, mx0 + sw * (i + 0.5), baseH + 0.02, backT + (d - backT) / 2, mat, 0, 4);
  // chaise cushion
  F.rbox(chaiseW - 0.01, seatH - baseH - 0.02, chaiseD - backT - 0.02, 0.08, cx0 + chaiseW / 2, baseH + 0.02, backT + (chaiseD - backT) / 2, mat, 0, 4);
  // back cushions (rounded, slightly reclined)
  F.rbox(w - 0.02, backH - seatH + 0.1, backT, 0.1, w / 2, seatH - 0.1, backT / 2, mat, 0, 4);
  // arms: outer end opposite chaise
  const ax = chaiseLeft ? w - 0.12 : 0.12;
  F.rbox(0.24, 0.62 - baseH, d, 0.1, ax, baseH, d / 2, mat, 0, 4);
  // chaise side arm low
  const cax = chaiseLeft ? 0.11 : w - 0.11;
  F.rbox(0.22, 0.6 - baseH, chaiseD, 0.1, cax, baseH, chaiseD / 2, mat, 0, 4);
  // legs hidden plinth
  F.box(w - 0.1, 0.02, d - 0.1, w / 2, 0, d / 2, 'black');
  F.box(chaiseW - 0.1, 0.02, chaiseD - 0.1, cx0 + chaiseW / 2, 0, chaiseD / 2, 'black');
  collide(F, w, d, w / 2, d / 2); collide(F, chaiseW, chaiseD, cx0 + chaiseW / 2, chaiseD / 2);
}

export function armchair(F, { fabric = 'armchair', wood = 'wood_dark', pillowMat = 'pillow_floral' } = {}) {
  const W = 0.8, D = 0.8;
  // tapered legs
  for (const [x, z] of [[-0.34, 0.33], [0.34, 0.33], [-0.34, -0.33], [0.34, -0.33]]) {
    F.cyl(0.016, 0.024, 0.2, x, 0, z, wood, 10);
  }
  // seat frame & cushion
  F.rbox(W - 0.06, 0.1, D - 0.04, 0.02, 0, 0.2, 0.02, fabric);
  F.rbox(W - 0.14, 0.13, D - 0.18, 0.06, 0, 0.29, 0.06, fabric, 0, 4);
  // back (slightly reclined)
  const back = F.sub(0, 0.3, -0.33, 0, -0.12);
  back.rbox(W - 0.08, 0.6, 0.12, 0.05, 0, 0, 0, fabric, 0, 4);
  // open wooden side frames (rails)
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.02);
    F.box(0.035, 0.36, 0.035, x, 0.2, 0.33, wood);
    F.box(0.035, 0.035, D - 0.06, x, 0.56, 0.0, wood);
    F.box(0.035, 0.6, 0.035, x, 0.2, -0.33, wood);
    F.box(0.03, 0.03, D - 0.1, x, 0.3, 0.0, wood);
  }
  pillow(F, 0.46, 0.4, 0.14, 0, 0.42, -0.18, pillowMat, 0, -0.2);
  collide(F, W, D);
}

export function chairBoucle(F, { fabric = 'chair_boucle', frame = 'black' } = {}) {
  for (const [x, z] of [[-0.2, 0.19], [0.2, 0.19], [-0.2, -0.19], [0.2, -0.19]]) F.cyl(0.012, 0.012, 0.44, x, 0, z, frame, 8);
  F.rbox(0.5, 0.09, 0.48, 0.04, 0, 0.42, 0.01, fabric, 0, 4);
  const b = F.sub(0, 0.5, -0.2, 0, -0.08);
  b.rbox(0.5, 0.36, 0.08, 0.04, 0, 0, 0, fabric, 0, 4);
  // back loop
  F.box(0.014, 0.42, 0.014, -0.06, 0.48, -0.25, frame); F.box(0.014, 0.42, 0.014, 0.06, 0.48, -0.25, frame);
}

export function officeChair(F, mat = 'leather') {
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const s = F.sub(0, 0.05, 0, a); s.box(0.03, 0.025, 0.3, 0, 0, 0.15, 'black'); s.sphere(0.025, 0, 0.025, 0.3, 'black', 10); }
  F.cyl(0.025, 0.025, 0.36, 0, 0.06, 0, 'chrome', 12);
  F.rbox(0.5, 0.08, 0.48, 0.035, 0, 0.42, 0.02, mat, 0, 3);
  const b = F.sub(0, 0.52, -0.2, 0, -0.15);
  b.rbox(0.46, 0.5, 0.05, 0.03, 0, 0, 0, mat, 0, 3);
  F.box(0.04, 0.12, 0.03, 0, 0.47, -0.22, 'black');
}

// ---------- tables ----------
export function coffeeCube(F, w, h, mat) {
  F.rbox(w, h, w, 0.012, 0, 0, 0, mat, 0, 2);
  collide(F, w, w);
}
export function vaseGinger(F, x, y, z, s = 1) {
  F.lathe([[0, 0], [0.05 * s, 0], [0.06 * s, 0.02 * s], [0.1 * s, 0.1 * s], [0.11 * s, 0.17 * s], [0.08 * s, 0.25 * s], [0.045 * s, 0.27 * s], [0.045 * s, 0.29 * s], [0.06 * s, 0.3 * s], [0.04 * s, 0.33 * s], [0, 0.34 * s]], x, y, z, 'porcelain', 32);
}
export function vaseBranches(F, x, y, z, s = 1) {
  F.lathe([[0, 0], [0.04 * s, 0], [0.07 * s, 0.08 * s], [0.06 * s, 0.16 * s], [0.03 * s, 0.22 * s], [0.035 * s, 0.25 * s], [0, 0.25 * s]], x, y, z, 'ceramic', 24);
  const R = (k) => Math.sin(k * 12.9898) * 0.5 + 0.5;
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3, h = (0.35 + R(i) * 0.25) * s;
    const p0 = [x, y + 0.22 * s, z], p1 = [x + Math.cos(a) * 0.08 * s, y + 0.22 * s + h * 0.6, z + Math.sin(a) * 0.08 * s], p2 = [x + Math.cos(a) * 0.16 * s, y + 0.22 * s + h, z + Math.sin(a) * 0.16 * s];
    F.tube([p0, p1, p2], 0.004 * s, 'branch', 8, false, 4);
    for (let k = 0; k < 6; k++) { const t = 0.4 + k * 0.1; F.sphere(0.012 * s, p0[0] + (p2[0] - p0[0]) * t + (R(i * 7 + k) - 0.5) * 0.04, p0[1] + (p2[1] - p0[1]) * t, p0[2] + (p2[2] - p0[2]) * t + (R(i * 3 + k) - 0.5) * 0.04, 'blossom', 6); }
  }
}
export function books(F, x, y, z, ry = 0) {
  const s = F.sub(x, y, z, ry);
  s.box(0.24, 0.03, 0.18, 0, 0, 0, 'book1'); s.box(0.22, 0.025, 0.16, 0.01, 0.03, 0, 'book2'); s.box(0.2, 0.02, 0.15, -0.005, 0.055, 0, 'book3');
}

export function diningTable(F, d = 1.0, topMat = 'travertine', baseMat = 'wood_dark') {
  F.cyl(d / 2, d / 2, 0.035, 0, 0.715, 0, topMat, 64);
  F.lathe([[0, 0], [0.26, 0], [0.26, 0.03], [0.16, 0.06], [0.12, 0.3], [0.11, 0.55], [0.16, 0.68], [0.3, 0.715], [0, 0.715]], 0, 0, 0, baseMat, 48);
  collide(F, d * 0.75, d * 0.75);
}

// ---------- lighting fixtures ----------
export function rosette(F, x, z, r = 0.32, y = 3.0) {
  const pts = [[0, 0]];
  for (let i = 0; i <= 24; i++) { const t = i / 24; const rr = r * t; pts.push([rr, -0.012 - 0.018 * Math.sin(t * Math.PI) - 0.006 * Math.sin(t * Math.PI * 10)]); }
  pts.push([r, 0]);
  F.lathe(pts.reverse().map(([a, b]) => [a, b]), x, y, z, 'rosette', 64);
}

export function chandelierShades(F, x, z, room, { arms = 8, R = 0.5, drop = 0.9, metal = 'black', accent = 'brass' } = {}) {
  const top = 3.0, y = top - drop;
  F.cyl(0.06, 0.06, 0.03, x, top - 0.03, z, metal, 24);
  F.cyl(0.008, 0.008, drop - 0.15, x, y + 0.15, z, metal, 8);
  F.lathe([[0, 0], [0.035, 0], [0.04, 0.08], [0.025, 0.16], [0, 0.16]], x, y, z, accent, 24);
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + 0.2;
    const ex = x + Math.cos(a) * R, ez = z + Math.sin(a) * R;
    F.tube([[x, y + 0.06, z], [x + Math.cos(a) * R * 0.5, y + 0.04, z + Math.sin(a) * R * 0.5], [ex, y + 0.08, ez], [ex, y + 0.14, ez]], 0.008, metal, 12, false, 6);
    F.cyl(0.018, 0.018, 0.05, ex, y + 0.13, ez, accent, 12);
    F.sphere(0.022, ex, y + 0.2, ez, 'bulb', 12);
    // tapered drum shade
    F.cyl(0.075, 0.11, 0.16, ex, y + 0.15, ez, 'lampshade', 28, true);
  }
  light(F, x, y + 0.15, z, 'chandelier', room, 1.0);
}

export function crystalChandelier(F, x, z, room, { R = 0.38, drop = 1.0, mat = 'crystal' } = {}) {
  const top = 3.0, y = top - drop;
  F.cyl(0.07, 0.07, 0.03, x, top - 0.03, z, 'gilt', 24);
  F.cyl(0.006, 0.006, 0.25, x, top - 0.28, z, 'gilt', 6);
  // basket of crystal strands
  F.torus(R, 0.012, x, y + 0.55, z, 'gilt');
  F.torus(R * 0.65, 0.01, x, y + 0.25, z, 'gilt');
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2;
    const p0 = [x + Math.cos(a) * R, y + 0.55, z + Math.sin(a) * R];
    const p1 = [x + Math.cos(a) * R * 0.7, y + 0.18, z + Math.sin(a) * R * 0.7];
    const p2 = [x, y, z];
    F.tube([p0, p1, p2], 0.01, mat, 10, false, 4);
    if (i % 2 === 0) F.sphere(0.02, p0[0], p0[1] - 0.04, p0[2], mat, 8);
  }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; F.cyl(0.01, 0.01, 0.07, x + Math.cos(a) * R, y + 0.56, z + Math.sin(a) * R, 'bulb', 8); }
  F.sphere(0.045, x, y + 0.02, z, mat, 16);
  // canopy chain
  F.tube([[x, top - 0.28, z], [x + Math.cos(0) * R * 0.95, y + 0.56, z]], 0.003, 'gilt', 4); F.tube([[x, top - 0.28, z], [x - R * 0.95, y + 0.56, z]], 0.003, 'gilt', 4);
  F.tube([[x, top - 0.28, z], [x, y + 0.56, z + R * 0.95]], 0.003, 'gilt', 4); F.tube([[x, top - 0.28, z], [x, y + 0.56, z - R * 0.95]], 0.003, 'gilt', 4);
  light(F, x, y + 0.4, z, 'chandelier', room, 0.9);
}

export function tieredChandelier(F, x, z, room) { // pink murano tubes (bedroom)
  const top = 3.0, y = top - 1.05;
  F.cyl(0.07, 0.07, 0.03, x, top - 0.03, z, 'brass', 24);
  F.cyl(0.006, 0.006, 0.3, x, top - 0.33, z, 'brass', 6);
  const tiers = [[0.36, 0.75, 0.32], [0.28, 0.48, 0.3], [0.18, 0.24, 0.26], [0.09, 0.02, 0.22]];
  for (const [r, yy, len] of tiers) {
    F.torus(r, 0.006, x, y + yy + len, z, 'brass');
    const n = Math.round(r * 70);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; F.cyl(0.014, 0.014, len, x + Math.cos(a) * r, y + yy, z + Math.sin(a) * r, 'glass_pink', 8); }
  }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; F.sphere(0.025, x + Math.cos(a) * 0.15, y + 0.85, z + Math.sin(a) * 0.15, 'bulb', 10); }
  light(F, x, y + 0.6, z, 'chandelier', room, 0.9);
}

export function linearChandelier(F, x, z, room) { // black geometric with glass cylinders (boy)
  const top = 3.0, y = 2.25;
  F.cyl(0.05, 0.05, 0.03, x, top - 0.03, z, 'black', 20);
  F.cyl(0.008, 0.008, top - y, x, y, z, 'black', 8);
  const arms = [[0, 0.55], [1.1, 0.5], [2.2, 0.6], [3.3, 0.45], [4.4, 0.55], [5.4, 0.5]];
  for (const [a, L] of arms) {
    const ex = x + Math.cos(a) * L, ez = z + Math.sin(a) * L, yy = y + (a % 2) * 0.1;
    F.tube([[x, yy, z], [ex, yy, ez]], 0.008, 'black', 4, false, 6);
    F.cyl(0.035, 0.035, 0.1, ex, yy - 0.02, ez, 'globe', 16);
    F.cyl(0.037, 0.037, 0.015, ex, yy + 0.08, ez, 'black', 16);
  }
  light(F, x, y, z, 'chandelier', room, 0.85);
}

export function sconceGlobe(F, x, y, z, ry, metal = 'brass', room) {
  const s = F.sub(x, y, z, ry);
  s.box(0.06, 0.16, 0.02, 0, -0.08, 0.01, metal);
  s.cylZ(0.008, 0.1, 0, 0, 0.06, metal, 8);
  s.sphere(0.075, 0, 0.0, 0.14, 'globe', 24);
  if (room) light(s, 0, 0, 0.14, 'sconce', room, 0.25);
}

export function spot(F, x, z, y = 2.999, r = 0.035) {
  F.cyl(r + 0.012, r + 0.012, 0.004, x, y - 0.004, z, 'trim', 20);
  F.cyl(r, r, 0.002, x, y - 0.006, z, 'spot', 20);
}

export function tableLamp(F, x, y, z, room, base = 'ceramic') {
  F.lathe([[0, 0], [0.06, 0], [0.08, 0.08], [0.085, 0.16], [0.05, 0.24], [0.02, 0.26], [0, 0.26]], x, y, z, base, 24);
  F.cyl(0.006, 0.006, 0.1, x, y + 0.26, z, 'brass', 6);
  F.cyl(0.1, 0.14, 0.18, x, y + 0.32, z, 'lampshade', 28, true);
  if (room) light(F, x, y + 0.38, z, 'lamp', room, 0.25);
}

export function floorLamp(F, x, z, room) {
  F.cyl(0.13, 0.14, 0.03, x, 0, z, 'black', 28);
  F.lathe([[0, 0], [0.03, 0], [0.04, 0.2], [0.06, 0.32], [0.03, 0.42], [0.05, 0.55], [0.07, 0.7], [0.03, 0.85], [0.045, 1.0], [0.02, 1.15], [0.02, 1.35], [0, 1.35]], x, 0.03, z, 'wood_dark', 24);
  F.cyl(0.006, 0.006, 0.12, x, 1.38, z, 'brass', 6);
  F.cyl(0.2, 0.22, 0.32, x, 1.42, z, 'lampshade', 36, true);
  light(F, x, 1.55, z, 'lamp', room, 0.35);
  COLLIDE.push([x - 0.16, z - 0.16, x + 0.16, z + 0.16]);
}

export function pictureLight(F, x, y, z, ry) {
  const s = F.sub(x, y, z, ry);
  s.box(0.05, 0.06, 0.02, 0, 0, 0.01, 'brass');
  s.tube([[0, 0.03, 0.02], [0, 0.08, 0.1], [0, 0.07, 0.16]], 0.006, 'brass', 8);
  s.cylX(0.022, 0.34, 0, 0.07, 0.17, 'brass', 16);
}

export function frameArt(F, w, h, x, y, z, ry, artMat, frameMat = 'black') {
  const s = F.sub(x, y, z, ry);
  s.box(w, h, 0.025, 0, 0, 0.0125, frameMat);
  s.box(w - 0.1, h - 0.1, 0.004, 0, 0.05, 0.026, 'linen_white');
  s.plane(w - 0.18, h - 0.18, 0, h / 2, 0.029, artMat);
}

// ---------- casework ----------
// Shaker door front (frame + recessed panel) facing +z, origin bottom-centre at z=0
export function shakerDoor(F, w, h, mat, { frame = 0.065, handle = 'black', handleSide = 'R', handleType = 'bar', depth = 0.019 } = {}) {
  F.box(w - 0.004, h - 0.004, depth * 0.6, 0, 0.002, depth * 0.3, mat);
  F.box(w - 0.004, frame, depth, 0, 0.002, depth / 2, mat);
  F.box(w - 0.004, frame, depth, 0, h - frame - 0.002, depth / 2, mat);
  F.box(frame, h - 2 * frame, depth, -w / 2 + frame / 2, frame, depth / 2, mat);
  F.box(frame, h - 2 * frame, depth, w / 2 - frame / 2, frame, depth / 2, mat);
  if (handle) {
    const hx = handleSide === 'R' ? w / 2 - 0.04 : handleSide === 'L' ? -w / 2 + 0.04 : 0;
    if (handleType === 'bar') { F.box(0.012, 0.012, 0.03, hx, h > 0.5 ? h * 0.5 - 0.08 : h - 0.06, depth + 0.012, handle); F.box(0.012, 0.012, 0.03, hx, h > 0.5 ? h * 0.5 + 0.08 : h - 0.06, depth + 0.012, handle); }
    if (handleType === 'bar') F.box(0.012, h > 0.5 ? 0.2 : 0.012, 0.012, hx, h > 0.5 ? h * 0.5 - 0.1 : h - 0.066, depth + 0.026, handle);
    if (handleType === 'pull') F.box(h > 0.5 ? 0.012 : 0.16, h > 0.5 ? 0.18 : 0.012, 0.014, hx, h > 0.5 ? h * 0.5 - 0.09 : h - 0.07, depth + 0.02, handle);
    if (handleType === 'long') F.box(0.014, 0.6, 0.02, hx, h * 0.45 - 0.3, depth + 0.02, handle);
    if (handleType === 'knob') F.sphere(0.014, hx, h * 0.5, depth + 0.02, handle, 10);
  }
}
export function flatDoor(F, w, h, mat, handle, handleType = 'long', side = 'R') {
  F.box(w - 0.004, h - 0.004, 0.019, 0, 0.002, 0.0095, mat);
  if (handle) { const hx = side === 'R' ? w / 2 - 0.05 : side === 'L' ? -w / 2 + 0.05 : 0; F.box(0.014, handleType === 'long' ? 0.5 : 0.2, 0.02, hx, h * 0.45 - (handleType === 'long' ? 0.25 : 0.1), 0.03, handle); }
}
// Arched-top panel door (girls wardrobe)
export function archPanelDoor(F, w, h, mat, handle = 'brass', side = 'R') {
  F.box(w - 0.004, h - 0.004, 0.02, 0, 0.002, 0.01, mat);
  const inset = 0.07, r = (w - 2 * inset) / 2;
  const top = h - inset - r;
  // raised moulding frame following arch
  const pts = [[-w / 2 + inset, inset], [-w / 2 + inset, top]];
  for (let k = 0; k <= 16; k++) { const a = Math.PI - (k / 16) * Math.PI; pts.push([Math.cos(a) * r, top + Math.sin(a) * r]); }
  pts.push([w / 2 - inset, inset]); pts.push([-w / 2 + inset, inset]);
  F.tube(pts.map(([x, y]) => [x, y, 0.022]), 0.007, mat, 60, false, 6);
  F.box(0.012, 0.28, 0.02, (side === 'L' ? -1 : 1) * (w / 2 - 0.035), h * 0.45, 0.032, handle);
}

export function glassCabinetDoor(F, w, h, glass = 'glass_display', frame = 'black') {
  const fw = 0.025;
  F.box(w - 0.004, fw, 0.02, 0, 0.002, 0.01, frame); F.box(w - 0.004, fw, 0.02, 0, h - fw - 0.002, 0.01, frame);
  F.box(fw, h, 0.02, -w / 2 + fw / 2, 0, 0.01, frame); F.box(fw, h, 0.02, w / 2 - fw / 2, 0, 0.01, frame);
  F.box(w - 2 * fw, h - 2 * fw, 0.004, 0, fw, 0.01, glass);
}

// Porcelain display items on a shelf
export function porcelainSet(F, w, y, z, seed = 1) {
  const R = (k) => (Math.sin(k * 91.7 + seed * 13.3) * 0.5 + 0.5);
  let x = -w / 2 + 0.02;
  let k = 0;
  for (;;) {
    const t = R(k++);
    const kind = t < 0.4 ? 'plate' : t < 0.75 ? 'vase' : 'jug';
    const wd = kind === 'plate' ? 0.2 : kind === 'vase' ? 0.13 : 0.1;
    if (x + wd > w / 2 - 0.015) { if (wd > 0.1 && x + 0.1 <= w / 2 - 0.015) { F.lathe([[0, 0], [0.04, 0], [0.05, 0.05], [0.03, 0.12], [0.035, 0.16], [0, 0.16]], x + 0.05, y, z, 'porcelain', 20); } break; }
    if (kind === 'plate') { const s = F.sub(x + wd / 2, y + 0.095, z - 0.04, 0, -0.15); s.cylZ(0.09, 0.012, 0, 0, 0, 'porcelain', 32); }
    else if (kind === 'vase') vaseGinger(F, x + wd / 2, y, z, 0.48 + R(k++) * 0.2);
    else F.lathe([[0, 0], [0.04, 0], [0.05, 0.05], [0.03, 0.12], [0.035, 0.16], [0, 0.16]], x + wd / 2, y, z, 'porcelain', 20);
    x += wd + 0.01;
  }
}

// ---------- sanitary ----------
export function wallToilet(F, seatMat = 'ceramic') {
  // origin at wall, facing +z
  const g = new THREE.SphereGeometry(0.2, 32, 16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    x *= 0.9; z = z * 1.35; if (y > 0.05) y = 0.05 + (y - 0.05) * 0.2; if (y < -0.1) y = -0.1 + (y + 0.1) * 0.6;
    const sq = 0.15; x = Math.sign(x) * Math.min(Math.abs(x), 0.18 - sq * 0.1 * Math.abs(z));
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  F.add(g, seatMat, mat4(0, 0.33, 0.3));
  F.rbox(0.36, 0.2, 0.18, 0.05, 0, 0.24, 0.09, seatMat, 0, 4);
  F.rbox(0.37, 0.03, 0.5, 0.012, 0, 0.385, 0.27, seatMat, 0, 3);
  F.rbox(0.36, 0.035, 0.08, 0.012, 0, 0.4, 0.04, seatMat, 0, 3);
}
export function flushPlate(F, x, y, z, ry, mat = 'brass') {
  const s = F.sub(x, y, z, ry);
  s.rbox(0.25, 0.165, 0.008, 0.003, 0, 0, 0.004, mat, 0, 2);
  s.cylZ(0.045, 0.01, -0.055, 0.082, 0.01, mat, 24); s.cylZ(0.045, 0.01, 0.055, 0.082, 0.01, mat, 24);
}
export function wallFaucet(F, x, y, z, ry, mat = 'brass') {
  const s = F.sub(x, y, z, ry);
  s.cylZ(0.03, 0.01, 0, 0, 0.005, mat, 24);
  s.cylZ(0.012, 0.18, 0, 0, 0.09, mat, 16);
  s.cylZ(0.022, 0.01, 0.12, 0.0, 0.005, mat, 24); s.box(0.012, 0.06, 0.012, 0.12, 0, 0.02, mat);
}
export function deckFaucet(F, x, y, z, ry, mat = 'brass') {
  const s = F.sub(x, y, z, ry);
  s.cyl(0.022, 0.025, 0.06, 0, 0, 0, mat, 20);
  s.tube([[0, 0.05, 0], [0, 0.3, 0], [0, 0.36, 0.06], [0, 0.32, 0.17], [0, 0.26, 0.18]], 0.011, mat, 24, false, 10);
  s.box(0.012, 0.012, 0.09, 0.03, 0.07, 0, mat);
}
export function rainShower(F, x, y, z, ry, mat = 'bronze') {
  const s = F.sub(x, y, z, ry);
  s.cylZ(0.03, 0.01, 0, 0, 0.005, mat, 20);
  s.tube([[0, 0, 0.005], [0, 0, 0.3]], 0.01, mat, 4, false, 8);
  s.cyl(0.15, 0.15, 0.012, 0, -0.04, 0.38, mat, 40);
  s.cyl(0.012, 0.012, 0.04, 0, -0.03, 0.38, mat, 8);
}
export function thermostat(F, x, y, z, ry, mat = 'bronze') {
  const s = F.sub(x, y, z, ry);
  for (const dx of [-0.12, 0, 0.12]) { s.cylZ(0.035, 0.01, dx, 0, 0.005, mat, 24); s.cylZ(0.022, 0.04, dx, 0, 0.025, mat, 20); }
  // hand shower on slide bar
  s.box(0.02, 0.9, 0.02, -0.3, -0.6, 0.02, mat);
  s.cyl(0.02, 0.018, 0.2, -0.3, 0.05, 0.05, mat, 16);
}
