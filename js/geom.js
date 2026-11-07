import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAT } from './materials.js';

// ---- UV helpers ----
// Planar UVs in meters chosen per-vertex by dominant normal axis (local space).
export function planarUV(g, s = 1) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z * Math.sign(n.getX(i) || 1); v = y; }
    else { u = -x * Math.sign(n.getZ(i) || 1); v = y; }
    uv[i * 2] = u * s; uv[i * 2 + 1] = v * s;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function prep(g) {
  if (g.index) g = g.toNonIndexed();
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) planarUV(g);
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

// ---- Batch: collects geometry per material, merges into few meshes ----
export class Batch {
  constructor() { this.b = new Map(); }
  add(g, mat, m4) {
    g = prep(g.clone ? g : g);
    if (m4) g.applyMatrix4(m4);
    const key = typeof mat === 'string' ? mat : mat.name;
    if (!this.b.has(key)) this.b.set(key, { mat: typeof mat === 'string' ? MAT[mat] : mat, list: [] });
    this.b.get(key).list.push(g);
  }
  build(parent, { cast = true, receive = true, name = 'batch' } = {}) {
    const out = [];
    for (const [key, { mat, list }] of this.b) {
      if (!mat) { console.warn('missing material', key); continue; }
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = name + ':' + key;
      const transparent = mat.transparent || mat.isMeshBasicMaterial;
      mesh.castShadow = cast && !transparent && !/glass|sheer|led|spot|crystal/.test(key);
      mesh.receiveShadow = receive && !mat.isMeshBasicMaterial;
      parent.add(mesh); out.push(mesh);
    }
    this.b.clear();
    return out;
  }
}

// ---- Frame: local transform for building furniture in meters ----
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
export function mat4(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.clone(), new THREE.Vector3(sx, sy, sz));
}

export class Frame {
  constructor(batch, m4 = new THREE.Matrix4()) { this.B = batch; this.M = m4; }
  sub(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) { return new Frame(this.B, this.M.clone().multiply(mat4(x, y, z, ry, rx, rz))); }
  add(g, mat, local) { this.B.add(g, mat, local ? this.M.clone().multiply(local) : this.M); return this; }
  // box: w (x) h (y) d (z), center x,z; bottom y
  box(w, h, d, x, y, z, mat, ry = 0) { const g = planarUV(new THREE.BoxGeometry(w, h, d)); return this.add(g, mat, mat4(x, y + h / 2, z, ry)); }
  rbox(w, h, d, r, x, y, z, mat, ry = 0, seg = 3) {
    r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
    const g = planarUV(new RoundedBoxGeometry(w, h, d, seg, Math.max(r, 0.0005)));
    return this.add(g, mat, mat4(x, y + h / 2, z, ry));
  }
  cyl(rt, rb, h, x, y, z, mat, seg = 24, open = false) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); return this.add(g, mat, mat4(x, y + h / 2, z)); }
  cylX(r, len, x, y, z, mat, seg = 16) { const g = new THREE.CylinderGeometry(r, r, len, seg); return this.add(g, mat, mat4(x, y, z, 0, 0, Math.PI / 2)); }
  cylZ(r, len, x, y, z, mat, seg = 16) { const g = new THREE.CylinderGeometry(r, r, len, seg); return this.add(g, mat, mat4(x, y, z, 0, Math.PI / 2, 0)); }
  sphere(r, x, y, z, mat, seg = 24, sy = 1) { const g = new THREE.SphereGeometry(r, seg, Math.max(8, seg >> 1)); return this.add(g, mat, mat4(x, y, z, 0, 0, 0, 1, sy, 1)); }
  lathe(pts, x, y, z, mat, seg = 40) { const g = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg); return this.add(g, mat, mat4(x, y, z)); }
  torus(R, r, x, y, z, mat, rx = Math.PI / 2, arc = Math.PI * 2, ry = 0) { const g = new THREE.TorusGeometry(R, r, 10, 48, arc); return this.add(g, mat, mat4(x, y, z, ry, rx)); }
  tube(points, r, mat, seg = 32, closed = false, rseg = 8) {
    const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
    return this.add(new THREE.TubeGeometry(c, seg, r, rseg, closed), mat);
  }
  plane(w, h, x, y, z, mat, ry = 0, rx = 0) { const g = new THREE.PlaneGeometry(w, h); return this.add(g, mat, mat4(x, y, z, ry, rx)); }
  // Extrude a THREE.Shape (in XY) by depth along +Z, then place.
  extrude(shape, depth, mat, local, bevel = 0) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 32 });
    planarUV(g);
    return this.add(g, mat, local);
  }
}

// ---- Profile sweep along polyline (XZ plane) with true miters ----
// path: [[x,z],...] meters. profile: [[d,h],...] d = offset to the LEFT of travel direction, h = height.
// For a room polygon wound so that interior is on the left, d>0 goes into room.
export function sweep(path, profile, closed, y0 = 0) {
  const N = path.length;
  const segs = closed ? N : N - 1;
  const dir = [], nrm = [];
  for (let i = 0; i < segs; i++) {
    const a = path[i], b = path[(i + 1) % N];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    dir.push([dx / L, dz / L]);
    nrm.push([dz / L, -dx / L]); // left normal in x-right / z-down plan (screen) == interior for clockwise-on-screen
  }
  const miter = (i) => { // offset vector at vertex i for unit d
    let n1, n2;
    if (closed) { n1 = nrm[(i - 1 + segs) % segs]; n2 = nrm[i % segs]; }
    else { n1 = nrm[Math.max(0, i - 1)]; n2 = nrm[Math.min(segs - 1, i)]; }
    const dot = n1[0] * n2[0] + n1[1] * n2[1];
    const k = 1 / Math.max(0.2, 1 + dot);
    return [(n1[0] + n2[0]) * k, (n1[1] + n2[1]) * k];
  };
  const geoms = [];
  const P = profile.length;
  // profile cumulative length for v
  const pv = [0];
  for (let j = 1; j < P; j++) pv.push(pv[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
  let ucum = 0;
  for (let s = 0; s < segs; s++) {
    const i0 = s, i1 = (s + 1) % N;
    const m0 = miter(i0), m1 = miter(closed ? i1 : s + 1);
    const a = path[i0], b = path[i1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const pos = [], uv = [], idx = [];
    for (let j = 0; j < P; j++) {
      const [d, h] = profile[j];
      pos.push(a[0] + m0[0] * d, y0 + h, a[1] + m0[1] * d);
      pos.push(b[0] + m1[0] * d, y0 + h, b[1] + m1[1] * d);
      uv.push(ucum, pv[j], ucum + L, pv[j]);
    }
    for (let j = 0; j < P - 1; j++) {
      const q = j * 2;
      // orientation: faces point toward +d side (room)
      idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    geoms.push(g);
    ucum += L;
  }
  return geoms;
}

// Common moulding profiles (meters). [d, h] d into room.
export const PROFILES = {
  base: [[0, 0], [0.016, 0], [0.016, 0.07], [0.012, 0.085], [0.008, 0.09], [0.006, 0.096], [0, 0.1]],
  // classic cornice with dentil band, 200 tall, hung so top touches ceiling (h from bottom)
  cornice: [[0, 0], [0.012, 0], [0.012, 0.015], [0.02, 0.02], [0.022, 0.04], [0.03, 0.045], [0.03, 0.062], [0.034, 0.064], [0.034, 0.1], [0.04, 0.104], [0.05, 0.11], [0.065, 0.125], [0.075, 0.14], [0.085, 0.16], [0.095, 0.175], [0.1, 0.182], [0.1, 0.19], [0.12, 0.192], [0.13, 0.2], [0, 0.2]],
  frieze: [[0, 0], [0.008, 0.002], [0.012, 0.01], [0.012, 0.03], [0.008, 0.038], [0, 0.04]],
  molding: [[0, 0], [0.006, 0.002], [0.012, 0.01], [0.014, 0.02], [0.012, 0.028], [0.006, 0.036], [0, 0.04]],
  casing: [[0, 0], [0.012, 0], [0.018, 0.01], [0.02, 0.03], [0.018, 0.06], [0.014, 0.08], [0, 0.085]],
};

// Rectangle molding frame on a wall: wall plane defined by origin (x,z), tangent t, normal n (into room).
export function wallFrame(B, mat, ox, oz, tx, tz, nx, nz, u0, u1, v0, v1, prof = PROFILES.molding) {
  // build closed path in local (u,v) on wall, sweep with profile where d = normal offset, h = across width
  // We construct manually: four straight mitred sticks.
  const w = prof[prof.length - 1][1];
  const sticks = [
    [u0, v0, u1, v0], [u1, v0, u1, v1], [u1, v1, u0, v1], [u0, v1, u0, v0],
  ];
  for (const [a, b, c, d] of sticks) {
    const len = Math.hypot(c - a, d - b);
    const du = (c - a) / len, dv = (d - b) / len; // direction in wall plane
    // inward perpendicular inside frame (left of travel for CCW)
    const pu = -dv, pv = du;
    const pos = [], idx = [];
    for (let j = 0; j < prof.length; j++) {
      const [dd, hh] = prof[j];
      // miter: at corners offset along stick by hh (45°)
      for (const end of [0, 1]) {
        const s = end === 0 ? hh : len - hh;
        const U = a + du * s + pu * hh, V = b + dv * s + pv * hh;
        pos.push(ox + tx * U + nx * dd, V, oz + tz * U + nz * dd);
      }
    }
    for (let j = 0; j < prof.length - 1; j++) { const q = j * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    // ensure facing room: check normal of first triangle
    orientTo(g, nx, 0, nz);
    planarUV(g);
    B.add(g, mat);
  }
  void w;
}

// Vertical quad from (x0,z0) to (x1,z1), heights h0..h1, facing left normal; uv in meters along wall.
export function quad(x0, z0, x1, z1, h0, h1, u0 = 0) {
  const L = Math.hypot(x1 - x0, z1 - z0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, h0, z0, x1, h0, z1, x1, h1, z1, x0, h1, z0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, h0, u0 + L, h0, u0 + L, h1, u0, h1], 2));
  g.setIndex([0, 2, 1, 0, 3, 2]); // faces LEFT of travel (x0,z0)->(x1,z1)
  g.computeVertexNormals();
  return g;
}

// Flip triangle winding if the summed normal points away from (nx,ny,nz).
export function orientTo(g, nx, ny, nz) {
  g.computeVertexNormals();
  const n = g.attributes.normal; let s = 0;
  for (let i = 0; i < n.count; i++) s += n.getX(i) * nx + n.getY(i) * ny + n.getZ(i) * nz;
  if (s < 0) {
    if (g.index) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k]; ix[k] = ix[k + 1]; ix[k + 1] = t; } }
    else { const p = g.attributes.position; for (let k = 0; k < p.count; k += 3) { for (let c = 0; c < 3; c++) { const a = p.array[k * 3 + 3 + c]; p.array[k * 3 + 3 + c] = p.array[k * 3 + 6 + c]; p.array[k * 3 + 6 + c] = a; } } p.needsUpdate = true; }
    g.computeVertexNormals();
  }
  return g;
}

// Sweep a profile [across, out] along a path drawn in a wall plane.
// path: [[u,v]] (u along wall tangent, v = height). Returns geometries in world space.
export function wallSweep(path, profile, closed, origin, t, n) {
  const geos = sweep(path, profile, closed, 0);
  const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(...t), new THREE.Vector3(...n), new THREE.Vector3(0, 1, 0));
  M.setPosition(new THREE.Vector3(...origin));
  return geos.map((g) => { g.applyMatrix4(M); return orientTo(g, n[0], n[1], n[2]); });
}

// Horizontal polygon (meters, [[x,z]]) at height y. faceUp => normal +Y
export function flatPoly(pts, y, faceUp = true) {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ShapeGeometry(shape, 24);
  // ShapeGeometry lies in XY; map (x, y)->(x, z)
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), yy = p.getY(i); p.setXYZ(i, x, y, yy); }
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i));
  g.computeVertexNormals();
  const n = g.attributes.normal;
  const up = n.getY(0) > 0;
  if (up !== faceUp) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k]; ix[k] = ix[k + 1]; ix[k + 1] = t; } g.computeVertexNormals(); }
  return g;
}

export function pointInPoly(x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

export function signedArea(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; a += x0 * y1 - x1 * y0; } return a / 2; }
