// West Garden fit-out per the design renders and elevations. World meters: x east, z south (plan y), y up.
// Frame helpers: W.sub(x, y, z, ry). ry=-HP faces west (local x = world z); ry=HP faces east (local x = -world z);
// ry=PI faces north (local x = -world x); ry=0 faces south.
import * as THREE from 'three';
import { Batch, Frame, mat4 } from './geom.js';
import * as P from './pieces.js';
import * as CW from './casework.js';
import { CEIL, LOW } from './plan.js';

const HP = Math.PI / 2, PI = Math.PI;

export function buildRooms(scene) {
  const group = new THREE.Group(); group.name = 'furniture'; scene.add(group);
  CW.setRoot(group);
  const B = new Batch();
  const W = new Frame(B);
  living(B, W); kitchen(B, W); hall(B, W); bedroom(B, W); bath(B, W);
  curtains(B);
  outside(B);
  B.build(group, { name: 'furn' });
  return group;
}

// ------------------------------------------------------------ shared bits
const flat = (L, w, h, mat, t = 0.019) => L.box(w - 0.003, h - 0.003, t, 0, 0.0015, t / 2, mat);
function spotDuo(W, x, z, y = CEIL) { // QUASAR 55 DUO: black rectangular trim with two lenses
  W.box(0.16, 0.004, 0.085, x, y - 0.004, z, 'black');
  for (const dx of [-0.038, 0.038]) W.cyl(0.026, 0.026, 0.002, x + dx, y - 0.006, z, 'spot', 18);
}
function spotFlat(W, x, z, y = LOW) { W.cyl(0.04, 0.04, 0.004, x, y - 0.004, z, 'black', 20); W.cyl(0.03, 0.03, 0.002, x, y - 0.006, z, 'spot', 20); }
function spotSurface(W, x, z, y = CEIL) { W.cyl(0.04, 0.04, 0.12, x, y - 0.12, z, 'lacquer_white', 20); W.cyl(0.028, 0.028, 0.002, x, y - 0.122, z, 'spot', 16); }

// ------------------------------------------------------------ LIVING (кухня-гостиная, жилая часть)
function living(B, W) {
  // rug Д-2 2300×1700
  P.rug(W.sub(1.45, 0, 1.75), 1.7, 2.3, 'rug_cream');
  sofa(W);
  coffeeTable(W.sub(1.98, 0.004, 2.25));
  tvWall(W);
  westWallPanels(W);
  // dining: round table Ø900 (ТОК Алтай) + 4 Fless chairs
  const tx = 1.25, tz = 4.03;
  W.cyl(0.45, 0.45, 0.035, tx, 0.715, tz, 'wood_dark', 64);
  W.lathe([[0, 0], [0.24, 0], [0.24, 0.02], [0.2, 0.04], [0.17, 0.2], [0.16, 0.5], [0.18, 0.66], [0.26, 0.715], [0, 0.715]], tx, 0.004, tz, 'wood_dark', 48);
  P.collide(W.sub(tx, 0, tz), 0.62, 0.62);
  for (let i = 0; i < 4; i++) {
    const a = i * HP; const x = tx + Math.sin(a) * 0.62, z = tz + Math.cos(a) * 0.62;
    flessChair(W.sub(x, 0.004, z, a + PI));
  }
  W.lathe([[0, 0], [0.05, 0], [0.11, 0.06], [0.13, 0.14], [0.1, 0.24], [0.04, 0.29], [0.035, 0.31], [0, 0.31]], tx + 0.05, 0.75, tz - 0.04, 'ceramic', 32);
  P.vaseBranches(W, tx + 0.05, 1.04, tz - 0.04, 0.9);
  W.sphere(0.06, tx - 0.2, 0.81, tz + 0.12, 'lacquer_white', 20);
  cirkus(W, tx, tz);
  // floor lamp TUBS (T-2) and ceiling track (ТР-1 + ЛС-1)
  W.cyl(0.13, 0.14, 0.015, 0.3, 0.004, 3.05, 'black', 32); W.cyl(0.012, 0.012, 1.62, 0.3, 0.02, 3.05, 'black', 10);
  W.box(0.5, 0.022, 0.03, 0.47, 1.62, 3.05, 'black'); W.box(0.46, 0.004, 0.012, 0.48, 1.613, 3.05, 'led');
  P.light(W, 0.5, 1.55, 3.05, 'lamp', 'living', 0.35);
  P.COLLIDE.push([0.16, 2.92, 0.44, 3.18]);
  W.box(0.05, 0.006, 4.0, 0.6, CEIL - 0.006, 2.7, 'black');
  for (const z of [1.3, 2.7, 4.1]) { W.box(0.035, 0.035, 0.46, 0.6, CEIL - 0.045, z, 'black'); W.box(0.025, 0.003, 0.44, 0.6, CEIL - 0.048, z, 'led'); }
  P.light(W, 0.6, 2.5, 2.7, 'spot', 'living', 0.6);
  for (const z of [1.0, 2.18, 3.32, 4.54]) spotDuo(W, 2.02, z);
  // radiator under the window behind a fluted MDF grille (ИМ-17)
  W.box(2.23, 0.47, 0.2, 1.215, 0.0, 0.1, 'w_fluted'); W.box(2.25, 0.03, 0.24, 1.215, 0.46, 0.11, 'wood');
  P.COLLIDE.push([0.08, 0, 2.35, 0.24]);
  // decor on the sill
  P.books(W, 1.7, 0.49, -0.15, 0.2); W.lathe([[0, 0], [0.06, 0], [0.08, 0.1], [0.05, 0.2], [0, 0.2]], 0.5, 0.49, -0.16, 'ceramic', 24);
}

function sofa(W) {
  // modular boucle sofa (ИМ-18): two seat modules along the west wall + chaise module toward the window
  const s = 'sofa';
  const F = W.sub(0, 0.004, 0);
  // seat modules y(z) 1.45..2.85, depth x 0.03..1.05
  for (const [z0, z1] of [[1.45, 2.15], [2.15, 2.85]]) {
    F.rbox(1.0, 0.24, z1 - z0 - 0.01, 0.07, 0.54, 0.0, (z0 + z1) / 2, s, 0, 4);
    F.rbox(0.9, 0.17, z1 - z0 - 0.03, 0.08, 0.58, 0.23, (z0 + z1) / 2, s, 0, 4);
    F.rbox(0.3, 0.42, z1 - z0 - 0.02, 0.12, 0.19, 0.3, (z0 + z1) / 2, s, 0, 5);
  }
  // chaise module z 0.45..1.45 extends to x 1.75
  F.rbox(1.72, 0.24, 0.99, 0.08, 0.89, 0.0, 0.95, s, 0, 4);
  F.rbox(1.62, 0.17, 0.95, 0.09, 0.93, 0.23, 0.97, s, 0, 4);
  F.rbox(0.3, 0.42, 0.98, 0.12, 0.19, 0.3, 0.96, s, 0, 5);
  F.rbox(1.0, 0.26, 0.26, 0.11, 0.54, 0.38, 0.58, s, 0, 5); // low arm toward the window
  P.collide(W, 1.05, 2.4, 0.53, 1.65); P.collide(W, 1.75, 1.0, 0.88, 0.95);
  // cushions + throw
  P.pillow(F, 0.55, 0.5, 0.17, 0.3, 0.48, 1.8, 'pillow_white', HP, -0.3);
  P.pillow(F, 0.5, 0.42, 0.15, 0.36, 0.48, 1.25, 'pillow_white', HP, -0.3);
  P.pillow(F, 0.42, 0.3, 0.12, 0.45, 0.47, 1.95, 'pillow_pattern', HP + 0.1, -0.25);
  P.pillow(F, 0.36, 0.24, 0.12, 0.5, 0.45, 1.05, 'pillow_sand', HP - 0.2, -0.2);
  F.rbox(0.62, 0.03, 0.7, 0.015, 0.62, 0.405, 2.5, 'throw_knit', 0.15, 2);
  F.rbox(0.03, 0.28, 0.66, 0.012, 1.02, 0.14, 2.52, 'throw_knit', 0.15, 2);
}

function coffeeTable(F) { // РОЛ 600: terracotta drum with waffle relief
  F.cyl(0.3, 0.3, 0.03, 0, 0.42, 0, 'terra', 48);
  F.cyl(0.21, 0.21, 0.42, 0, 0, 0, 'terra_waffle', 32);
  P.books(F, 0.06, 0.45, 0.04, 0.3);
  F.lathe([[0, 0], [0.035, 0], [0.04, 0.09], [0.037, 0.09], [0.032, 0.004], [0, 0.004]], -0.12, 0.45, -0.05, 'glass_cup', 16);
  P.collide(F, 0.5, 0.5);
}

function tvWall(W) {
  // ИМ-16: 400-deep built-in on the partition (front at x = 2.645), z 0.33..4.41; vertical veneer boards to the ceiling
  const T = W.sub(2.645, 0, 0, -HP); // local x = world z, front +z faces west, depth -z (into the wall)
  const u0 = 0.33, u1 = 4.41, d = 0.4, top = CEIL - 0.1; // stops under the cornice line
  const nich0 = 0.1, nich1 = 0.5;   // lit recessed base niche
  // carcass skin & niche
  const ni = u1 - u0 - 0.04; // niche parts stop inside the 20 mm end panels (no coplanar faces)
  T.box(ni, nich0, 0.36, (u0 + u1) / 2, 0, -0.2, 'shadowgap');
  T.box(ni, nich1 - nich0, 0.02, (u0 + u1) / 2, nich0, -0.21, 'lacquer_sage');
  T.box(ni, 0.02, 0.2, (u0 + u1) / 2, nich0, -0.1, 'lacquer_sage');
  T.box(ni - 0.01, 0.008, 0.012, (u0 + u1) / 2, nich1 - 0.012, -0.02, 'led');
  P.light(T, 1.9, 0.45, 0.1, 'led', 'living', 0.12);
  T.box(0.02, top, d, u0 + 0.01, 0, -d / 2, 'wood'); T.box(0.02, top, d, u1 - 0.01, 0, -d / 2, 'wood');
  T.box(u1 - u0 - 0.04, 0.02, d, (u0 + u1) / 2, top - 0.02, -d / 2, 'wood');
  const board = (a, b, y0, y1, hinge, fill) => {
    const w = b - a, c = (a + b) / 2;
    CW.carcass(T.sub(c, y0, -0.02), w, y1 - y0, d - 0.02, 'wood', { shelves: (y1 - y0) > 1 ? [0.45, 0.9, 1.35, 1.8].filter((y) => y < y1 - y0 - 0.1) : [] });
    CW.hinged(T.sub(c, y0, 0), w, hinge, (L) => flat(L, w, y1 - y0, 'wood'), { angle: 1.6 });
    for (const e of [a, b]) T.box(0.005, y1 - y0, 0.012, e, y0, -0.004, 'shadowgap');
    if (fill) fill(c, w, y0);
  };
  const shelfStuff = (c, w, y0) => {
    for (const [i, y] of [0.02, 0.47, 0.92, 1.37, 1.82].entries()) {
      if (y0 + y > top - 0.3) break;
      if (i % 2) P.books(T, c, y0 + y, -0.22, 0.1); else CW.storeBox(T, c - w / 2 + 0.05, y0 + y, -0.22, w - 0.1, 0.26, 0.3, i % 4 ? 'box_linen' : 'pack1');
    }
  };
  board(u0 + 0.02, 0.93, nich1, top - 0.02, 'L', shelfStuff);
  // TV section 0.93..2.77: upper doors (3) + recessed TV panel
  for (let k = 0; k < 3; k++) { const a = 0.93 + k * 0.613, b = a + 0.613; board(a, b, 1.83, top - 0.02, k === 2 ? 'R' : 'L', null); CW.storeBox(T, a + 0.05, 1.85, -0.22, 0.5, 0.28, 0.3, 'box_linen'); }
  T.box(1.84, 1.33, 0.02, 1.85, nich1, -0.03, 'wood');
  T.rbox(1.25, 0.72, 0.035, 0.004, 1.85, 0.93, 0.0, 'appliance', 0, 2); T.box(1.22, 0.69, 0.002, 1.85, 0.945, 0.018, 'tv');
  board(2.77, 3.37, nich1, top - 0.02, 'R', shelfStuff);
  // open shelving column 0.38 with dark frame
  const sc = 3.56;
  T.box(0.38, top - nich1, 0.01, sc, nich1, -0.38, 'shelf_green');
  for (const y of [0.5, 1.0, 1.5, 2.0]) { T.box(0.36, 0.022, 0.37, sc, nich1 + y, -0.2, 'wood_dark'); T.box(0.34, 0.006, 0.01, sc, nich1 + y - 0.008, -0.02, 'led'); }
  T.box(0.02, top - nich1, 0.4, sc - 0.19, nich1, -0.2, 'wood_dark'); T.box(0.02, top - nich1, 0.4, sc + 0.19, nich1, -0.2, 'wood_dark');
  P.books(T, sc - 0.03, nich1 + 0.522, -0.22, 0.05); T.lathe([[0, 0], [0.05, 0], [0.07, 0.08], [0.04, 0.18], [0, 0.18]], sc, nich1 + 1.022, -0.2, 'ceramic', 24);
  P.books(T, sc + 0.02, nich1 + 1.522, -0.22, -0.1); T.sphere(0.07, sc, nich1 + 2.09, -0.2, 'terra', 16);
  board(3.75, u1 - 0.02, nich1, top - 0.02, 'R', shelfStuff);
  // floating fluted TV console in the niche
  T.box(2.6, 0.3, 0.45, 1.95, 0.14, 0.03, 'wood_fluted');
  T.box(2.6, 0.02, 0.45, 1.95, 0.44, 0.03, 'wood');
  P.books(T, 2.6, 0.46, 0.05, 0.1); P.books(T, 1.4, 0.46, 0.08, -0.2);
  P.COLLIDE.push([2.2, 0.33, 3.05, 4.41]);
}

function westWallPanels(W) {
  // ИМ-19: painted moulding grid with fluted inserts (west wall x = 0), z 0..3.275 north of the lattice
  const m = 'w_living', t = 0.016, bw = 0.045;
  const cols = [0, 0.28, 0.86, 1.13, 2.18, 2.7, 3.275];
  const rows = [0.0, 0.86, 2.3, CEIL - 0.1];
  for (const z of cols) W.box(t, rows[3] - 0.03, bw, t / 2, 0.03, Math.max(z, bw / 2), m);
  for (const y of rows.slice(1, 3)) W.box(t, bw, 3.275, t / 2, y - bw / 2, 3.275 / 2, m);
  W.box(t, bw, 3.275, t / 2, rows[3] - bw, 3.275 / 2, m);
  const insert = (z0, z1, y0, y1) => W.box(0.008, y1 - y0 - bw, z1 - z0 - bw, 0.004, y0 + bw / 2, (z0 + z1) / 2, 'w_fluted');
  insert(0.28, 0.86, 0.86, 2.3); insert(0.86, 1.13, 2.3, rows[3]); insert(2.18, 2.7, 2.3, rows[3]); insert(1.13, 2.18, 0.4, 0.86);
  // perforated lattice panel 1290 × 2450 at z 3.275..4.565
  W.box(0.02, 2.45, 1.29, 0.04, 0.0, 3.92, 'lattice');
  W.box(0.03, 2.45, 0.02, 0.04, 0.0, 3.285, 'lattice'); W.box(0.03, 2.45, 0.02, 0.04, 0.0, 4.555, 'lattice');
}

function flessChair(F) { // Fless: horseshoe upholstered back on walnut frame
  for (const [x, z] of [[-0.2, 0.2], [0.2, 0.2], [-0.21, -0.18], [0.21, -0.18]]) F.cyl(0.014, 0.018, 0.46, x, 0, z, 'wood_dark', 10);
  F.rbox(0.48, 0.1, 0.46, 0.04, 0, 0.44, 0.02, 'chair_green', 0, 4);
  F.box(0.44, 0.03, 0.42, 0, 0.42, 0.02, 'wood_dark');
  // curved back band built from segments around the rear
  const R = 0.26, n = 18;
  for (let i = 0; i < n; i++) {
    const a0 = PI + 0.1 + (i / n) * (PI - 0.2), a1 = PI + 0.1 + ((i + 1) / n) * (PI - 0.2), a = (a0 + a1) / 2;
    const x = Math.cos(a) * R, z = Math.sin(a) * R * 0.92;
    const seg = 2 * R * Math.sin((a1 - a0) / 2) + 0.03;
    F.box(seg, 0.2, 0.075, x, 0.6, z, 'chair_green', -a - HP);
  }
  const top = []; for (let i = 0; i <= 24; i++) { const a = PI + 0.1 + (i / 24) * (PI - 0.2); top.push([Math.cos(a) * R, 0.8, Math.sin(a) * R * 0.92]); }
  F.tube(top, 0.038, 'chair_green', 48, false, 10);
  const bot = top.map(([x, , z]) => [x, 0.6, z]); F.tube(bot, 0.036, 'chair_green', 48, false, 10);
  for (const s of [-1, 1]) F.tube([[s * 0.21, 0.46, 0.15], [s * 0.25, 0.6, 0.0], [s * 0.255, 0.7, -0.12]], 0.012, 'wood_dark', 10, false, 6);
}

function cirkus(W, x, z) { // Cirkus (AGO) black 6: inverted-U glass arches on a black ring
  const top = CEIL, y = 2.02;
  W.cyl(0.05, 0.05, 0.02, x, top - 0.02, z, 'black', 20); W.cyl(0.005, 0.005, top - y - 0.15, x, y + 0.15, z, 'black', 6);
  W.torus(0.3, 0.008, x, y + 0.15, z, 'black');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2, cx = x + Math.cos(a) * 0.3, cz = z + Math.sin(a) * 0.3;
    const tx = -Math.sin(a), tz = Math.cos(a); // tangent
    const pts = [];
    for (let k = 0; k <= 12; k++) { const t = PI - (k / 12) * PI; pts.push([cx + tx * Math.cos(t) * 0.07, y + 0.08 + Math.sin(t) * 0.07, cz + tz * Math.cos(t) * 0.07]); }
    pts.unshift([cx - tx * 0.07, y - 0.06, cz - tz * 0.07]); pts.push([cx + tx * 0.07, y - 0.06, cz + tz * 0.07]);
    W.tube(pts, 0.03, 'black', 30, false, 12);
    W.sphere(0.02, cx, y + 0.0, cz, 'bulb', 8);
  }
  P.light(W, x, y, z, 'chandelier', 'living', 1.0);
}

// ------------------------------------------------------------ KITCHEN (ниша, П-образная)
function kitchen(B, W) {
  const plinth = 0.1, base = 0.88, top = 0.92, up0 = 1.52, up1 = LOW, bd = 0.6, ud = 0.35;
  const fill = (k, s = 0) => (f, iw, ih, id) => CW.drawerFill(f, iw, ih, id, k, s);
  // a base module in frame F (local u along the run, front at z = 0)
  const baseUnit = (F, u0, u1, kind, seed = 0) => {
    const w = u1 - u0, c = (u0 + u1) / 2, h = base - plinth;
    F.box(w, plinth, 0.02, c, 0, -0.07, 'shadowgap');
    CW.carcass(F.sub(c, plinth, -0.02), w, h, bd - 0.04, 'k_wood', { top: false, shelves: kind === 'doors' ? [h * 0.45] : [] });
    const dh = 0.2;
    CW.drawer(F.sub(c, base - dh, 0), w, dh - 0.004, 0.5, (L) => flat(L, w, dh, 'k_fluted'), fill(kind === 'cook' ? 'utensils' : 'cutlery', seed));
    if (kind === 'drawers' || kind === 'cook') {
      CW.drawer(F.sub(c, plinth, 0), w, h - dh - 0.004, 0.5, (L) => flat(L, w, h - dh, 'k_wood'), fill(kind === 'cook' ? 'pots' : 'containers', seed), { boxH: 0.34 });
    } else {
      const n = w > 0.5 ? 2 : 1, dw = w / n;
      for (let i = 0; i < n; i++) CW.hinged(F.sub(u0 + dw * (i + 0.5), plinth, 0), dw, i === 0 ? 'L' : 'R', (L) => flat(L, dw, h - dh, 'k_wood'), { angle: 1.5 });
      if (kind === 'sink') {
        F.cyl(0.02, 0.02, 0.32, c, plinth + 0.25, -0.35, 'chrome', 12);
        F.rbox(0.26, 0.34, 0.3, 0.02, c - w / 4, plinth + 0.018, -0.3, 'bin1', 0, 2);
        CW.bottle(F, c + 0.15, plinth + 0.018, -0.2, 'mug_blue', 0.9); CW.bottle(F, c + 0.25, plinth + 0.018, -0.3, 'pack4', 0.8);
      } else {
        CW.kitchenRow(F, u0 + 0.02, u1 - 0.02, plinth + 0.018, -0.3, 'plates', seed);
        CW.kitchenRow(F, u0 + 0.02, u1 - 0.02, plinth + h * 0.45 + 0.018, -0.3, 'packs', seed + 1);
      }
    }
  };
  const upperUnit = (F, u0, u1, n, mat, kinds, seed = 0) => {
    const w = u1 - u0, c = (u0 + u1) / 2, h = up1 - up0;
    CW.carcass(F.sub(c, up0, -0.02), w, h, ud - 0.02, 'k_wood', { shelves: [0.42, 0.84] });
    const dw = w / n;
    for (let i = 0; i < n; i++) CW.hinged(F.sub(u0 + dw * (i + 0.5), up0, 0), dw, i % 2 ? 'R' : 'L', (L) => flat(L, dw, h, mat), { angle: 1.5 });
    const z = -ud / 2 - 0.02;
    kinds.forEach((k, j) => CW.kitchenRow(F, u0 + 0.02, u1 - 0.02, up0 + 0.018 + j * 0.42, z, k, seed + j));
    F.box(w - 0.02, 0.008, 0.02, c, up0 - 0.01, -0.06, 'led');
  };

  // ---- East run (x 1.75..2.35): oven column + cooktop drawers; local u = world z
  const E = W.sub(1.75, 0, 0, -HP);
  { // fluted tall column with built-in oven + microwave (Bosch, black)
    const c = 5.661, w = 0.6, s = E.sub(c, 0, 0);
    CW.carcass(s.sub(0, 0, -0.02), w, up1, bd - 0.04, 'k_wood', { bottom: false, shelves: [plinth, 0.45, 1.5, 2.1] });
    s.box(w - 0.004, plinth, 0.02, 0, 0, -0.07, 'shadowgap');
    s.box(w - 0.036, 1.05, 0.5, 0, 0.45, -0.28, 'k_wood');
    s.box(w - 0.01, 0.6, 0.03, 0, 0.45, 0.0, 'appliance'); s.box(w - 0.12, 0.3, 0.002, 0, 0.6, 0.016, 'glass_smoke'); s.box(w - 0.1, 0.02, 0.03, 0, 0.98, 0.03, 'appliance');
    s.box(w - 0.01, 0.45, 0.03, 0, 1.05, 0.0, 'appliance'); s.box(w - 0.22, 0.28, 0.002, -0.05, 1.12, 0.016, 'glass_smoke');
    for (const [y, dx] of [[1.4, 0.21], [0.95, -0.2], [0.95, 0.2]]) s.cylZ(0.016, 0.02, dx, y, 0.025, 'black', 16);
    s.box(0.04, 0.016, 0.002, 0.21, 1.46, 0.016, 'led');
    CW.drawer(s.sub(0, plinth, 0), w, 0.35 - 0.004, 0.5, (L) => flat(L, w, 0.35, 'k_fluted'), fill('pots', 2), { boxH: 0.24 });
    CW.hinged(s.sub(0, 1.5, 0), w, 'L', (L) => flat(L, w, up1 - 1.5, 'k_fluted'), { angle: 1.5 });
    CW.kitchenRow(s, -w / 2 + 0.03, w / 2 - 0.03, 1.518, -0.3, 'packs', 3); CW.kitchenRow(s, -w / 2 + 0.03, w / 2 - 0.03, 2.118, -0.3, 'jars', 4);
  }
  baseUnit(E, 5.961, 6.77, 'cook', 11);
  // induction hob + cookware
  E.box(0.6, 0.006, 0.52, 6.35, top, -0.3, 'appliance');
  for (const [dx, dz, r] of [[-0.14, -0.12, 0.09], [0.14, -0.12, 0.07], [-0.14, 0.12, 0.07], [0.14, 0.12, 0.09]]) E.cyl(r, r, 0.001, 6.35 + dx, top + 0.006, -0.3 + dz, 'steel', 32, true);
  CW.pot(E, 6.21, top + 0.007, -0.42, 0.1, 0.13); CW.kettle(E, 6.49, top + 0.007, -0.42); CW.pan(E, 6.22, top + 0.007, -0.18, 0.11, 0.7);
  // ---- West run (x 0..0.6): integrated fridge column + base; local u = -world z
  const Wr = W.sub(0.6, 0, 0, HP);
  fridge(Wr.sub(-5.661, 0, 0), up1, plinth);
  baseUnit(Wr, -6.77, -5.961, 'doors', 21);
  // ---- South run (z 6.77..7.37): sink unit + bottle pull-out; local u = 2.35 - world x
  const Sr = W.sub(2.35, 0, 6.77, PI);
  baseUnit(Sr, 0.6, 0.9, 'drawers', 31);
  baseUnit(Sr, 0.9, 1.75, 'sink', 32);
  // blind corners (behind the side runs)
  W.box(0.6, base - plinth, 0.6, 0.3, plinth, 7.07, 'k_wood'); W.box(0.6, base - plinth, 0.6, 2.05, plinth, 7.07, 'k_wood');
  // countertop 40 mm (beige stone) + green marble splash 0.92..1.52
  W.box(0.6, 0.04, 1.41, 0.3, base, 6.665, 'k_top'); W.box(1.15, 0.04, 0.6, 1.175, base, 7.07, 'k_top'); W.box(0.6, 0.04, 1.41, 2.05, base, 6.665, 'k_top');
  W.box(0.012, up0 - top, 1.41, 0.006, top, 6.665, 'k_splash'); W.box(2.35, up0 - top, 0.012, 1.175, top, 7.364, 'k_splash'); W.box(0.012, up0 - top, 1.41, 2.344, top, 6.665, 'k_splash');
  // sink Omoikiri Taki 74 (gunmetal) + Akeno faucet
  const sx = 2.35 - 1.325;
  W.box(0.74, 0.006, 0.45, sx, top + 0.001, 7.07, 'sink_gm'); W.box(0.7, 0.003, 0.41, sx, top + 0.006, 7.07, 'appliance');
  P.deckFaucet(W.sub(sx, 0, 7.07, PI), 0, top, -0.25, 0, 'sink_gm');
  // uppers: wood on the side walls, cream (4 doors) over the sink, built-in hood over the hob
  upperUnit(W.sub(2.0, 0, 0, -HP), 5.961, 7.37, 3, 'k_wood', ['glasses', 'mugs', 'packs'], 41);
  W.box(0.3, 0.02, 0.55, 2.17, up0 - 0.0, 6.35, 'appliance');
  upperUnit(W.sub(0.35, 0, 0, HP), -7.37, -5.961, 3, 'k_wood', ['plates', 'plates', 'jars'], 51);
  upperUnit(W.sub(2.35, 0, 7.02, PI), 0.35, 2.0, 4, 'k_cream', ['jars', 'packs', 'glasses'], 61);
  P.light(W, 1.175, 1.45, 6.9, 'led', 'living', 0.12);
  spotDuo(W, 1.17, 5.72, LOW); spotDuo(W, 1.25, 6.52, LOW);
  P.COLLIDE.push([0, 5.36, 0.6, 7.37], [0.6, 6.77, 1.75, 7.37], [1.75, 5.36, 2.35, 7.37]);
}

function fridge(F, H, plinth) {
  // integrated fridge (plain veneer door, white lit interior with food)
  const w = 0.6;
  CW.carcass(F.sub(0, 0, -0.02), w, H, 0.56, 'k_wood', { bottom: false, shelves: [plinth, 0.8] });
  F.box(w - 0.004, plinth, 0.02, 0, 0, -0.07, 'shadowgap');
  CW.drawer(F.sub(0, plinth, 0), w, 0.7 - 0.004, 0.48, (L) => flat(L, w, 0.7, 'k_wood'), (f, iw, ih, id) => CW.drawerFill(f, iw, ih, id, 'frozen', 3), { boxH: 0.4 });
  const fy = 0.82, fh = H - 0.84;
  CW.carcass(F.sub(0, fy, -0.04), 0.54, fh, 0.5, 'fridge_in', { shelves: [0.36, 0.7, 1.04, 1.36].filter((y) => y < fh - 0.1), shelfMat: 'glass_display' });
  F.box(0.3, 0.008, 0.02, 0, fy + fh - 0.03, -0.12, 'led');
  CW.hinged(F.sub(0, 0.81, 0), w, 'R', (L) => flat(L, w, H - 0.81, 'k_wood'), {
    angle: 1.6,
    back: (L) => {
      L.box(0.52, H - 0.9, 0.012, 0, 0.04, -0.006, 'fridge_in');
      for (const [i, y] of [0.12, 0.5, 0.88, 1.24].entries()) {
        L.box(0.48, 0.07, 0.012, 0, y, -0.1, 'glass_cup'); L.box(0.48, 0.008, 0.09, 0, y, -0.057, 'fridge_in');
        if (i === 0) { CW.bottle(L, -0.15, y + 0.008, -0.056, 'bottle_green', 0.85); CW.carton(L, 0.0, y + 0.008, -0.056, 'carton', 0.2); CW.carton(L, 0.1, y + 0.008, -0.056, 'pack3', 0.2); }
        else if (i === 1) { for (let k = 0; k < 6; k++) CW.bottle(L, -0.19 + k * 0.075, y + 0.008, -0.056, ['food_red', 'bottle_oil', 'food_yellow', 'ceramic', 'food_green', 'pack2'][k], 0.5); }
        else if (i === 2) { for (let k = 0; k < 9; k++) L.sphere(0.02, -0.18 + k * 0.045, y + 0.03, -0.056, 'carton', 10, 1.3); }
        else { L.box(0.12, 0.05, 0.07, -0.1, y + 0.008, -0.056, 'food_yellow'); L.box(0.12, 0.05, 0.07, 0.06, y + 0.008, -0.056, 'carton'); }
      }
    },
  });
  const fz = -0.29, fl = (k) => fy + 0.018 + [0, 0.36, 0.7, 1.04][k];
  F.rbox(0.48, 0.17, 0.4, 0.01, 0, fl(0), fz, 'glass_cup', 0, 2);
  for (let k = 0; k < 8; k++) CW.fruit(F, -0.17 + (k % 4) * 0.115, fl(0) + 0.01, fz - 0.1 + Math.floor(k / 4) * 0.18, 0.034 + (k % 3) * 0.006, ['food_red', 'food_green', 'food_orange', 'food_yellow'][k % 4]);
  CW.carton(F, -0.18, fl(1), fz, 'carton', 0.22); CW.carton(F, -0.09, fl(1), fz, 'carton', 0.22);
  F.rbox(0.16, 0.08, 0.16, 0.02, 0.13, fl(1), fz - 0.1, 'mug_blue', 0, 2);
  CW.jar(F, -0.16, fl(2), fz, 0.045, 0.14, 'food_red'); F.box(0.16, 0.08, 0.1, 0.1, fl(2), fz, 'food_yellow');
  for (let k = 0; k < 4; k++) CW.bottle(F, -0.17 + k * 0.1, fl(3), fz + 0.05, ['bottle_green', 'bottle_amber', 'carton', 'pack4'][k], 0.8);
}

// ------------------------------------------------------------ HALL (прихожая + коридор)
function hall(B, W) {
  // wardrobe niche ИМ-4 (x 2.51..3.09, z 5.40..6.735), front at x = 3.09 facing east; local u = -world z
  const H = W.sub(3.09, 0, 0, HP), top = LOW;
  // north part: two wood doors (coats; robot-vacuum station at the bottom)
  const n0 = -6.05, n1 = -5.40, nc = (n0 + n1) / 2, nw = n1 - n0;
  CW.carcass(H.sub(nc, 0, -0.01), nw, top, 0.57, 'wood', { shelves: [2.25] });
  for (const [i, hinge] of [[0, 'L'], [1, 'R']]) {
    const dw = nw / 2, c = n0 + dw * (i + 0.5);
    CW.hinged(H.sub(c, 0, 0), dw, hinge, (L) => { flat(L, dw, top, 'wood'); L.box(0.014, 1.1, 0.022, (hinge === 'L' ? 1 : -1) * (dw / 2 - 0.04), 0.75, 0.03, 'hw'); }, { angle: 1.6 });
  }
  CW.hanging(H, n0 + 0.03, n1 - 0.03, 1.95, -0.3, ['clothes3', 'clothes4', 'clothes1', 'leather', 'clothes2'], 9, { long: 1.05, v: 0.25 });
  H.rbox(0.33, 0.1, 0.33, 0.04, nc - 0.05, 0.02, -0.28, 'black', 0, 3); H.rbox(0.3, 0.32, 0.18, 0.02, nc - 0.05, 0.02, -0.46, 'appliance', 0, 2); // robot + station
  CW.storeBox(H, n0 + 0.04, 2.27, -0.3, 0.3, 0.26, 0.45, 'box_linen'); CW.storeBox(H, n0 + 0.34, 2.27, -0.3, 0.28, 0.22, 0.45, 'pack1');
  // south part: glass display cabinet with black frame and lit shelves
  const g0 = -6.735, g1 = -6.05, gc = (g0 + g1) / 2, gw = g1 - g0;
  CW.carcass(H.sub(gc, 0, -0.01), gw, top, 0.57, 'wood_dark', { shelves: [0.45, 0.9, 1.35, 1.8, 2.25], shelfMat: 'glass_display' });
  for (const y of [0.45, 0.9, 1.35, 1.8, 2.25]) H.box(gw - 0.06, 0.006, 0.01, gc, y - 0.01, -0.04, 'led');
  CW.hinged(H.sub(gc, 0, 0), gw, 'R', (L) => {
    L.box(gw - 0.004, 0.03, 0.022, 0, 0, 0.011, 'black'); L.box(gw - 0.004, 0.03, 0.022, 0, top - 0.032, 0.011, 'black');
    L.box(0.03, top, 0.022, -gw / 2 + 0.017, 0, 0.011, 'black'); L.box(0.03, top, 0.022, gw / 2 - 0.017, 0, 0.011, 'black');
    L.box(gw - 0.06, top - 0.06, 0.006, 0, 0.03, 0.011, 'glass_smoke'); L.box(0.014, 0.6, 0.02, -gw / 2 + 0.06, 0.9, 0.03, 'hw');
  }, { angle: 1.6 });
  P.light(H, gc, 1.4, -0.2, 'led', 'hall', 0.1);
  for (const [k, y] of [0.47, 0.92, 1.37, 1.82].entries()) {
    if (k % 2) { P.books(H, gc - 0.12, y, -0.3, 0.1); H.lathe([[0, 0], [0.05, 0], [0.07, 0.1], [0.04, 0.2], [0, 0.2]], gc + 0.15, y, -0.3, 'ceramic', 20); }
    else { H.sphere(0.07, gc - 0.15, y + 0.07, -0.3, 'terra', 16); P.books(H, gc + 0.12, y, -0.3, -0.2); }
  }
  P.COLLIDE.push([2.51, 5.4, 3.09, 6.735]);
  // ИМ-3: fluted MDF panel on the electrical block (x = 3.09, z 6.735..7.64)
  W.box(0.02, top, 0.905, 3.1, 0, 7.1875, 'wood_fluted');
  // ИМ-2 floating console with drawer + mirror ЗЕРК.1 (2580×860) on the bathroom wall (x = 4.255)
  const C = W.sub(4.255, 0, 7.07, -HP);
  C.box(0.86, 2.58, 0.012, 0, 0.1, 0.006, 'mirror_hall');
  C.box(0.675, 0.02, 0.2, 0, 0.88, 0.1, 'wood');
  CW.carcass(C.sub(0, 0.73, 0.2), 0.675, 0.15, 0.2, 'wood', { top: false });
  CW.drawer(C.sub(0, 0.735, 0.2), 0.67, 0.14, 0.17, (L) => flat(L, 0.67, 0.14, 'wood'), (f, iw, ih, id) => CW.drawerFill(f, iw, ih, id, 'makeup', 2), { boxH: 0.09 });
  P.books(C, -0.15, 0.9, 0.1, 0.2); C.lathe([[0, 0], [0.04, 0], [0.06, 0.12], [0.03, 0.24], [0, 0.24]], 0.2, 0.9, 0.1, 'ceramic', 20);
  // pouf «Блум» big (green boucle)
  W.lathe([[0, 0], [0.22, 0], [0.27, 0.06], [0.28, 0.2], [0.25, 0.36], [0.15, 0.42], [0, 0.425]], 3.88, 0.004, 6.98, 'pouf_green', 40);
  P.COLLIDE.push([3.62, 6.72, 4.14, 7.24]);
  // coat on the entry wall hook + spots
  for (const [x, z] of [[3.67, 4.88], [3.67, 5.97], [3.67, 7.2]]) spotDuo(W, x, z, LOW);
  P.light(W, 3.67, 2.5, 5.9, 'spot', 'hall', 0.45);
}

// ------------------------------------------------------------ BEDROOM
function bedroom(B, W) {
  // headboard wall (east, x = 6.165): veneer panels, mirror strip ЗЕРК.3, slatted panel, mirror ЗЕРК.2 over the right nightstand
  const E = W.sub(6.165, 0, 0, -HP); // local u = world z, front faces west
  const ph = CEIL - 0.1;
  E.box(0.65, ph, 0.03, 0.95 + 0.325, 0, 0.015, 'wood');
  E.box(0.012, ph, 0.008, 1.64, 0, 0.004, 'shadowgap');
  E.box(0.43, ph, 0.03, 1.68 + 0.215, 0, 0.015, 'wood');
  E.box(0.19, ph, 0.006, 2.205, 0, 0.003, 'mirror_bed');
  E.box(0.43, ph, 0.03, 2.30 + 0.215, 0, 0.015, 'wood');
  E.box(0.72, ph, 0.04, 2.73 + 0.36, 0, 0.02, 'wood_slat');
  E.box(0.012, ph, 0.008, 3.49, 0, 0.004, 'shadowgap');
  E.box(0.754, ph, 0.006, 3.53 + 0.377, 0, 0.003, 'mirror_bed');
  // floating nightstands (wood shelves with a drawer) ИМ-13 / ИМ-11
  for (const [u0, u1, seed] of [[0.97, 1.71, 5], [3.6, 4.27, 6]]) {
    const w = u1 - u0, c = (u0 + u1) / 2, dw = Math.min(0.5, w - 0.06);
    CW.carcass(E.sub(c, 0.25, 0.4), w, 0.12, 0.37, 'wood_dark', { t: 0.02 });
    E.box(w, 0.02, 0.4, c, 0.35, 0.2, 'wood_dark'); // top board runs flush over the drawer front
    E.box(w - dw - 0.004, 0.08, 0.02, c + dw / 2 + 0.002, 0.27, 0.39, 'wood_dark'); // fixed panel beside the drawer
    CW.drawer(E.sub(c - (w - dw) / 2, 0.272, 0.38), dw, 0.076, 0.33, (L) => flat(L, dw, 0.076, 'wood_dark', 0.02), (f, iw, ih, id) => CW.drawerFill(f, iw, ih, id, seed === 5 ? 'makeup' : 'socks', seed), { boxH: 0.055 });
  }
  // Simeon marble table lamp on the right nightstand
  E.lathe([[0, 0], [0.06, 0], [0.06, 0.02], [0.02, 0.05], [0.02, 0.26], [0, 0.26]], 3.98, 0.37, 0.2, 'stone_light', 24);
  E.lathe([[0, 0.18], [0.08, 0.2], [0.11, 0.26], [0.1, 0.3], [0.04, 0.33], [0, 0.335]], 3.98, 0.37, 0.2, 'ceramic_lamp', 28);
  E.lathe([[0, 0], [0.05, 0], [0.05, 0.02], [0.02, 0.04], [0.02, 0.18], [0, 0.18]], 4.16, 0.37, 0.24, 'stone_light', 20);
  P.light(E, 3.98, 0.62, 0.25, 'lamp', 'bed', 0.3);
  // BERENT pendants (П-1) over the left nightstand
  for (const [u, h] of [[1.2, 1.12], [1.48, 1.38]]) {
    const x = 6.165 - 0.25;
    W.cyl(0.004, 0.004, CEIL - h - 0.22, x, h + 0.22, u, 'black', 6);
    W.cyl(0.018, 0.018, 0.12, x, h + 0.1, u, 'stone_light', 12);
    W.lathe([[0, 0.1], [0.04, 0.1], [0.07, 0.06], [0.08, 0.0], [0.07, -0.005], [0, 0.02]], x, h, u, 'globe', 28);
    P.light(W, x, h + 0.02, u, 'lamp', 'bed', 0.22);
  }
  // Boca Airblade floating bed 1800×2000 (head east)
  const bed = W.sub(5.08, 0, 2.64, -HP); // local +z = west (foot)
  bed.box(1.0, 0.15, 1.3, 0, 0.0, 0.05, 'black'); // recessed plinth — the frame appears to float
  bed.rbox(1.86, 0.15, 2.06, 0.04, 0, 0.15, 0.0, 'bed_fabric', 0, 3);
  bed.rbox(1.78, 0.2, 1.98, 0.08, 0, 0.27, 0.0, 'linen_white', 0, 4);
  bed.rbox(1.92, 0.1, 1.5, 0.05, 0, 0.42, 0.22, 'linen_white', 0, 4);
  bed.rbox(1.95, 0.32, 0.04, 0.02, 0, 0.17, 0.98, 'linen_white', 0, 2);
  bed.rbox(1.9, 0.05, 0.55, 0.02, 0, 0.5, 0.55, 'throw_olive', 0, 2);
  bed.rbox(1.86, 0.4, 0.14, 0.07, 0, 0.42, -1.0, 'bed_fabric', 0, 5); // low upholstered headboard
  P.pillow(bed, 0.75, 0.48, 0.17, -0.42, 0.52, -0.78, 'pillow_white', 0, -0.95);
  P.pillow(bed, 0.75, 0.48, 0.17, 0.42, 0.52, -0.78, 'pillow_white', 0, -0.95);
  P.collide(bed, 1.9, 2.1);
  P.rug(W.sub(4.75, 0, 2.64), 2.3, 2.8, 'rug_cream');
  // desk ИМ-14 under the window + drawer unit ИМ-15, tubular radiator Arbonia
  W.box(0.8, 0.65, 0.6, 4.01, 0, 0.47, 'wood_dark');
  CW.drawer(W.sub(4.01, 0.005, 0.77), 0.79, 0.32, 0.5, (L) => flat(L, 0.79, 0.32, 'wood_dark'), (f, iw, ih, id) => CW.drawerFill(f, iw, ih, id, 'clothes', 7), { boxH: 0.2 });
  CW.drawer(W.sub(4.01, 0.33, 0.77), 0.79, 0.31, 0.5, (L) => flat(L, 0.79, 0.31, 'wood_dark'), (f, iw, ih, id) => CW.drawerFill(f, iw, ih, id, 'makeup', 8), { boxH: 0.1 });
  W.box(2.14, 0.045, 0.7, 4.675, 0.7, 0.52, 'wood');
  for (let k = 0; k < 26; k++) for (const dz of [0.25, 0.3, 0.35]) W.cyl(0.011, 0.011, 0.4, 4.5 + k * 0.045, 0.1, dz, 'radiator', 8);
  W.box(1.2, 0.03, 0.12, 5.06, 0.1, 0.3, 'radiator'); W.box(1.2, 0.03, 0.12, 5.06, 0.48, 0.3, 'radiator');
  // laptop, books, branches
  W.box(0.32, 0.012, 0.22, 4.9, 0.745, 0.6, 'steel');
  const lp = W.sub(4.9, 0.757, 0.49, 0, -0.25); lp.box(0.32, 0.21, 0.008, 0, 0, 0, 'steel'); lp.box(0.3, 0.19, 0.002, 0, 0.01, 0.005, 'laptop');
  P.books(W, 4.25, 0.745, 0.45, 0.1); W.cyl(0.07, 0.06, 0.25, 3.8, 0.745, 0.4, 'glass_cup', 20); P.vaseBranches(W, 3.8, 0.99, 0.4, 0.8);
  P.officeChair(W.sub(4.62, 0.004, 1.12, PI + 0.12), 'sofa');
  P.COLLIDE.push([3.61, 0.17, 5.75, 0.87]);
  // shelving column ИМ-14 in the NE corner (x 5.745..6.165, z 0.17..0.95) with olive back
  const sh = W.sub(5.955, 0, 0.95, PI); // front faces north? -> shelves open toward west: use west-facing frame
  void sh;
  const SC = W.sub(5.745, 0, 0, -HP); // local u = world z, front at x 5.745 facing west
  SC.box(0.78, ph, 0.012, 0.56, 0, -0.41, 'shelf_green');
  SC.box(0.02, ph, 0.42, 0.18, 0, -0.21, 'wood'); SC.box(0.02, ph, 0.42, 0.94, 0, -0.21, 'wood');
  CW.carcass(SC.sub(0.56, 0, -0.01), 0.74, 0.7, 0.4, 'wood', { top: true });
  CW.hinged(SC.sub(0.56, 0.0, 0), 0.74, 'L', (L) => flat(L, 0.74, 0.7, 'wood'));
  CW.storeBox(SC, 0.24, 0.02, -0.21, 0.3, 0.26, 0.32, 'box_linen'); CW.folded(SC, 0.72, 0.02, -0.21, 4, ['clothes1', 'clothes5', 'clothes7'], 3);
  for (const [k, y] of [1.17, 1.64, 2.11, 2.6].entries()) {
    SC.box(0.74, 0.025, 0.4, 0.56, y - 0.025, -0.2, 'wood');
    if (k % 2) P.books(SC, 0.4, y, -0.22, 0.1); else { P.books(SC, 0.7, y, -0.22, -0.15); SC.lathe([[0, 0], [0.05, 0], [0.06, 0.1], [0.03, 0.2], [0, 0.2]], 0.35, y, -0.2, 'ceramic', 20); }
  }
  SC.box(0.74, 0.025, 0.4, 0.56, 0.7, -0.2, 'wood');
  SC.box(0.78, 0.025, 0.42, 0.56, ph - 0.025, -0.21, 'wood'); // top board closes the column under the cornice
  P.COLLIDE.push([5.745, 0.17, 6.165, 0.95]);
  // wardrobe ИМ-10 in the bay (front z = 4.285, x 4.41..6.165): cream doors, olive recessed pulls; local x = -world x
  const WD = W.sub(6.165, 0, 4.285, PI);
  // sheet 49: sections 420 / 666 / 666, hinged doors to 2.05, mezzanine doors 2.05..2.57, fixed frieze to the ceiling
  const DH = 2.05, MZ = 2.57, SG = 0.03; // SG = olive recessed pull channel at the handle edge of each section
  CW.carcass(WD.sub(0.8775, 0, -0.01), 1.755, LOW, 0.59, 'wardrobe_cream', { parts: [0.42 - 0.8775, 1.086 - 0.8775], shelves: [[DH, -0.8775 + 0.02, 0.8775 - 0.02], [MZ, -0.8775 + 0.02, 0.8775 - 0.02]] });
  WD.box(1.755, LOW - MZ, 0.019, 0.8775, MZ + 0.002, 0.0095, 'wardrobe_cream'); // frieze
  for (const [a, b] of [[0, 0.42], [0.42, 1.086], [1.086, 1.755]]) {
    const w = b - a - SG - 0.004, c = a + 0.002 + w / 2;
    CW.hinged(WD.sub(c, 0, 0), w, 'L', (L) => flat(L, w, DH - 0.002, 'wardrobe_cream'), { angle: 1.6 });
    CW.hinged(WD.sub(c, DH + 0.002, 0), w, 'L', (L) => flat(L, w, MZ - DH - 0.004, 'wardrobe_cream'), { angle: 1.5 });
    WD.box(SG, MZ, 0.012, b - SG / 2, 0, -0.004, 'olive_strip'); // pull channel, recessed behind the door plane
  }
  CW.fillSection(WD, 0.02, 0.4, 0.02, DH - 0.02, -0.3, 0.52, 'shelves', ['clothes1', 'clothes7', 'clothes5', 'clothes6'], 4);
  CW.fillSection(WD, 0.44, 1.07, 0.02, DH - 0.02, -0.3, 0.52, 'hang', ['clothes1', 'clothes2', 'clothes5', 'clothes7', 'clothes6'], 6);
  CW.fillSection(WD, 1.1, 1.74, 0.02, DH - 0.02, -0.3, 0.52, 'hang', ['clothes3', 'clothes4', 'clothes1', 'clothes6'], 8);
  for (let i = 0; i < 4; i++) CW.storeBox(WD, 0.05 + i * 0.42, DH + 0.02, -0.3, 0.36, 0.3, 0.45, 'box_linen');
  P.COLLIDE.push([4.41, 4.285, 6.165, 4.885]);
  // TV on the partition (x = 3.2) facing east
  W.rbox(0.035, 0.72, 1.25, 0.004, 3.218, 1.15, 2.64, 'appliance', 0, 2); W.box(0.002, 0.69, 1.22, 3.236, 1.165, 2.64, 'tv');
  // lights: 4 double spots, 2 surface spots over the desk, cornice LED along the curtain slot
  for (const [x, z] of [[4.04, 1.34], [5.33, 1.34], [4.04, 3.78], [5.33, 3.78]]) spotDuo(W, x, z);
  spotSurface(W, 4.5, 0.49); spotSurface(W, 5.33, 0.49);
  W.box(2.9, 0.008, 0.012, 4.68, CEIL - 0.008, 0.175, 'led');
  P.light(W, 4.7, 2.5, 2.5, 'spot', 'bed', 0.6);
}

// ------------------------------------------------------------ BATHROOM
function bath(B, W) {
  // sink niche: wood portal ИМ-6, Brown Velvet stone basin (ИМ-8 drawers below), black-framed mirror cabinet ИМ-9
  const V = W.sub(4.89, 0, 5.01, 0); // front faces south (+z)
  const vw = 0.99, vd = 0.58;
  V.box(0.04, LOW, vd, -vw / 2 + 0.02, 0, vd / 2, 'wood_bath'); V.box(0.04, LOW, vd, vw / 2 - 0.02, 0, vd / 2, 'wood_bath');
  V.box(vw, 0.45, vd, 0, LOW - 0.45, vd / 2, 'wood_bath');
  V.box(vw - 0.08, LOW - 0.45 - 0.85, 0.012, 0, 0.85, 0.006, 'marble_velvet');
  // stone basin block with sloped bowl
  const bw2 = vw - 0.08;
  V.box(bw2, 0.1, 0.52, 0, 0.7, 0.27, 'marble_velvet');                       // basin floor block
  V.box(bw2, 0.06, 0.1, 0, 0.8, 0.06, 'marble_velvet');                        // back rim (faucet ledge)
  V.box(bw2, 0.06, 0.06, 0, 0.8, 0.5, 'marble_velvet');                        // front rim
  V.box(0.14, 0.06, 0.36, -bw2 / 2 + 0.07, 0.8, 0.29, 'marble_velvet');        // side rims
  V.box(0.14, 0.06, 0.36, bw2 / 2 - 0.07, 0.8, 0.29, 'marble_velvet');
  V.box(bw2 - 0.3, 0.004, 0.025, 0, 0.8, 0.13, 'appliance');                   // slot drain
  P.wallFaucet(V, 0, 1.02, 0.012, 0, 'hw');
  // drawers under the basin
  CW.carcass(V.sub(0, 0.15, 0.52), vw - 0.08, 0.55, 0.5, 'wood_bath', { top: false });
  CW.drawer(V.sub(0, 0.42, 0.52), vw - 0.09, 0.27, 0.44, (L) => P.shakerDoor(L, vw - 0.09, 0.27, 'wood_bath', { handle: null, frame: 0.04 }), (f, iw, ih, id) => CW.drawerFill(f, iw, ih, id, 'toiletries', 4), { boxH: 0.2 });
  CW.drawer(V.sub(0, 0.15, 0.52), vw - 0.09, 0.265, 0.44, (L) => P.shakerDoor(L, vw - 0.09, 0.265, 'wood_bath', { handle: null, frame: 0.04 }), (f, iw, ih, id) => CW.drawerFill(f, iw, ih, id, 'towels', 5), { boxH: 0.2 });
  // mirror cabinet (opens) with LED
  CW.carcass(V.sub(0, 1.15, 0.14), 0.8, 0.95, 0.13, 'wood_bath');
  CW.drawerFill(V.sub(0, 1.168, 0.075), 0.76, 0.3, 0.1, 'toiletries', 6); CW.drawerFill(V.sub(0, 1.47, 0.075), 0.76, 0.3, 0.1, 'toiletries', 7);
  V.box(0.76, 0.012, 0.11, 0, 1.46, 0.075, 'glass_display'); V.box(0.76, 0.012, 0.11, 0, 1.76, 0.075, 'glass_display');
  CW.hinged(V.sub(0, 1.15, 0.14), 0.8, 'L', (L) => {
    L.box(0.8, 0.95, 0.008, 0, 0, 0.004, 'black'); L.box(0.78, 0.93, 0.004, 0, 0.01, 0.01, 'mirror_bath');
  }, { angle: 1.6 });
  V.box(0.8, 0.008, 0.02, 0, 1.14, 0.1, 'led');
  P.light(V, 0, 1.6, 0.4, 'led', 'bath', 0.14);
  // towels on the basin
  V.rbox(0.25, 0.04, 0.18, 0.015, 0.34, 0.86, 0.38, 'linen_white', 0, 2); V.rbox(0.23, 0.035, 0.16, 0.015, 0.34, 0.9, 0.38, 'towel_sand', 0, 2);
  P.COLLIDE.push([4.395, 5.01, 5.39, 5.6]);
  // washer + dryer column ИМ-7 (x 5.45..6.125, z 5.01..5.68), frame-and-panel light oak doors
  const M = W.sub(5.7875, 0, 5.68, 0); const mw = 0.675;
  W.box(0.06, LOW, 0.6, 5.42, 0, 5.31, 'wood_bath');
  CW.carcass(M.sub(0, 0, -0.01), mw, LOW, 0.66, 'wood_bath', { shelves: [1.78] });
  CW.washer(M.sub(0, 0.06, -0.07)); CW.washer(M.sub(0, 0.92, -0.07), 'dryer');
  CW.folded(M, -0.15, 1.8, -0.35, 5, ['linen_white', 'towel_sand', 'linen_white'], 2, 0.28, 0.3);
  CW.bottle(M, 0.14, 1.8, -0.3, 'mug_blue', 1.0); CW.bottle(M, 0.22, 1.8, -0.42, 'pack4', 0.9);
  CW.storeBox(M, -0.3, 2.2, -0.35, 0.28, 0.26, 0.42, 'box_linen'); CW.storeBox(M, 0.02, 2.2, -0.35, 0.28, 0.26, 0.42, 'box_linen');
  CW.hinged(M.sub(0, 0, 0), mw, 'R', (L) => P.shakerDoor(L, mw, 1.78, 'wood_bath', { handle: null, frame: 0.06 }), { angle: 1.55 });
  CW.hinged(M.sub(0, 1.78, 0), mw, 'R', (L) => P.shakerDoor(L, mw, LOW - 1.78, 'wood_bath', { handle: null, frame: 0.06 }), { angle: 1.55 });
  // towel ring by the door
  W.torus(0.08, 0.006, 4.41, 1.25, 6.62, 'hw', 0, Math.PI * 2, HP);
  P.COLLIDE.push([5.39, 5.01, 6.125, 5.68]);
  // toilet on the installation (front z = 6.829), wood cladding + cabinet ИМ-5 above
  W.box(0.695, 1.12, 0.012, 5.7775, 0, 6.823, 'wood_bath');
  P.wallToilet(W.sub(5.68, 0, 6.829, PI));
  P.flushPlate(W, 5.68, 1.02, 6.817, PI, 'hw');
  W.box(0.03, 0.1, 0.03, 5.48, 0.8, 6.81, 'hw'); W.cylX(0.012, 0.12, 5.5, 0.8, 6.8, 'hw'); // hygienic shower
  const IC = W.sub(5.7775, 1.12, 6.829, PI);
  CW.carcass(IC.sub(0, 0.02, 0), 0.695, LOW - 1.14, 0.236, 'wood_bath', { shelves: [0.5, 1.0] });
  for (const [x, hinge] of [[-0.174, 'L'], [0.174, 'R']]) CW.hinged(IC.sub(x, 0.02, 0), 0.345, hinge, (L) => P.shakerDoor(L, 0.345, LOW - 1.14, 'wood_bath', { handle: null, frame: 0.05 }), { angle: 1.6 });
  for (let i = 0; i < 4; i++) IC.cyl(0.055, 0.055, 0.1, -0.25 + (i % 2) * 0.12, 0.04 + Math.floor(i / 2) * 0.1, -0.12, 'carton', 18);
  CW.drawerFill(IC.sub(0, 0.538, -0.118), 0.65, 0.4, 0.2, 'toiletries', 9);
  CW.drawerFill(IC.sub(0, 1.038, -0.118), 0.65, 0.4, 0.2, 'towels', 10);
  P.COLLIDE.push([5.43, 6.6, 5.95, 6.829]);
  // shower: linear drain, black rain head + thermostat + hand shower, lit vertical niche (marble back)
  W.box(0.7, 0.004, 0.06, 4.8, 0.151, 7.55, 'steel');
  P.rainShower(W.sub(4.75, 0, 7.608, PI), 0, 2.2, 0, 0, 'hw');
  P.thermostat(W.sub(4.95, 0, 7.608, PI), 0, 1.15, 0, 0, 'hw');
  const nz0 = 6.95, nz1 = 7.22;
  W.box(0.006, 1.8, nz1 - nz0, 5.21, 0.3, (nz0 + nz1) / 2, 'marble_velvet');
  for (const y of [0.3, 0.85, 1.25, 1.65, 2.1]) W.box(0.09, 0.025, nz1 - nz0, 5.17, y, (nz0 + nz1) / 2, 'w_bath');
  W.box(0.09, 2.1 - 0.3, 0.025, 5.17, 0.3, nz0 - 0.012, 'w_bath'); W.box(0.09, 2.1 - 0.3, 0.025, 5.17, 0.3, nz1 + 0.012, 'w_bath');
  W.box(0.006, 1.78, 0.008, 5.205, 0.31, nz0 + 0.01, 'led');
  CW.bottle(W, 5.17, 0.875, 7.04, 'bottle_amber', 0.7); CW.bottle(W, 5.17, 0.875, 7.12, 'bottle_amber', 0.7);
  P.light(W, 5.0, 1.2, 7.08, 'led', 'bath', 0.12);
  spotFlat(W, 4.8, 6.12); spotFlat(W, 4.8, 7.1);
  P.light(W, 5.2, 2.4, 6.3, 'spot', 'bath', 0.45);
}

// ------------------------------------------------------------ curtains, outside
function curtains(B) {
  // linen curtains in the ceiling pockets, gathered beside each window
  P.curtain(B, 0.02, 0.14, 0.42, 0.14, 'curtain', 3.1, 0.01, 0.04);
  P.curtain(B, 2.28, 0.14, 2.75, 0.14, 'curtain', 3.1, 0.01, 0.04);
  P.curtain(B, 3.22, 0.085, 3.55, 0.085, 'curtain', 3.1, 0.01, 0.035);
  P.curtain(B, 5.62, 0.085, 5.74, 0.085, 'curtain', 3.1, 0.75, 0.03);
}
function outside(B) {
  const g = new THREE.CylinderGeometry(140, 140, 160, 64, 1, true);
  B.add(g, 'outside', mat4(3.1, -30, 3.8));
}
