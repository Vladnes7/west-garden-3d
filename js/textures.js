// Procedural textures drawn on canvas: no external image files needed.
import { rng, fbm, vnoise, canvas, shade, clamp, mix, smooth, hex, wrapDraw } from './util.js';

const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// ---------- Herringbone oak parquet ----------
// Plank W x nW. Pattern periodic in 45° frame: (1,1) and (n,-n). Canvas covers m*sqrt2 by 2*n*sqrt2 W units.
export function herringbone(size = 2048, n = 6) {
  const m = 2 * n; // square tile: m*sqrt2 == 2n*sqrt2
  const S2 = Math.SQRT2;
  const span = m * S2; // tile side in W units
  const R = rng(7);
  const tones = [];
  for (let i = 0; i < 400; i++) tones.push(R());
  const col = canvas(size), bmp = canvas(size), rgh = canvas(size);
  const cc = col.getContext('2d'), bc = bmp.getContext('2d'), rc = rgh.getContext('2d');
  const ci = cc.createImageData(size, size), bi = bc.createImageData(size, size), ri = rc.createImageData(size, size);
  const base = [168, 140, 112];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const U = (px / size) * span, V = (py / size) * span;
      const x = (U + V) / S2, y = (U - V) / S2;
      const d = x - y;
      // zigzag strips repeat every (n, -n); the strip edge is a staircase, so test the nearest strips
      const b0 = Math.floor((d + n) / (2 * n));
      let b = b0, id = 0, along = 0, across = 0;
      for (const bc of [b0, b0 - 1, b0 + 1]) {
        const lx = x - bc * n, ly = y + bc * n;
        let k = Math.floor(ly);
        if (lx - k >= 0 && lx - k < n) { b = bc; id = 2 * k; along = lx - k; across = ly - k; break; }
        k = Math.floor(lx);
        if (ly - (k + 1) >= 0 && ly - (k + 1) < n) { b = bc; id = 2 * k + 1; along = ly - (k + 1); across = lx - k; break; }
      }
      const len = n;
      // periodic plank identity
      const kk = ((Math.floor(id / 2) % m) + m) % m;
      const bb = ((b % 2) + 2) % 2;
      const pid = (kk * 2 + (id & 1)) * 2 + bb;
      const t = tones[pid % 400], t2 = tones[(pid * 7 + 3) % 400];
      // grain along plank
      const gx = along / len, gy = across;
      const g1 = Math.sin((gy * 9 + vnoise(gx * 3 + pid, gy * 2, 64, 3) * 4 + t2 * 10) * 6.283);
      const g2 = vnoise(gx * 40 + pid * 3.1, gy * 6, 4096, 5);
      const fleck = vnoise(gx * 120, gy * 30 + pid, 8192, 9);
      let shadeV = 0.86 + t * 0.22 + g1 * 0.035 + (g2 - 0.5) * 0.12 + (fleck > 0.82 ? -0.06 : 0);
      // knot-ish darker zones
      const knot = vnoise(gx * 5 + pid * 1.7, gy * 1.5, 512, 11);
      shadeV -= smooth(0.78, 0.95, knot) * 0.12;
      // bevel/gap
      const e = Math.min(along, len - along, across, 1 - across); // in W units (W~100mm)
      const gap = smooth(0.0, 0.035, e);
      const v = shadeV * mix(0.45, 1, gap);
      const warm = 0.96 + t2 * 0.08;
      const i = (py * size + px) * 4;
      ci.data[i] = clamp(base[0] * v * warm, 0, 255);
      ci.data[i + 1] = clamp(base[1] * v, 0, 255);
      ci.data[i + 2] = clamp(base[2] * v / warm, 0, 255);
      ci.data[i + 3] = 255;
      const h = 255 * (0.5 + 0.5 * gap) - (g2 * 22) - (g1 * 6);
      bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = clamp(h, 0, 255); bi.data[i + 3] = 255;
      const r = 150 + t * 40 + (g2 - 0.5) * 50 + (1 - gap) * 80;
      ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = clamp(r, 0, 255); ri.data[i + 3] = 255;
    }
  }
  cc.putImageData(ci, 0, 0); bc.putImageData(bi, 0, 0); rc.putImageData(ri, 0, 0);
  // tile size in meters for W = 0.1 m
  return { map: col, bump: bmp, rough: rgh, tile: span * 0.1 };
}

// ---------- Grasscloth wallpaper (neutral, tinted by material color) ----------
export function grasscloth(size = 1024) {
  const R = rng(21);
  const c = canvas(size), ctx = c.getContext('2d');
  ctx.fillStyle = '#e9e4dc'; ctx.fillRect(0, 0, size, size);
  // horizontal fibres
  for (let i = 0; i < 5200; i++) {
    const y = R() * size, x = R() * size, len = 30 + R() * 260, th = 0.6 + R() * 2.4;
    const l = 200 + R() * 55;
    ctx.strokeStyle = `rgba(${l},${l - 6},${l - 16},${0.25 + R() * 0.45})`;
    ctx.lineWidth = th;
    wrapDraw(size, x, y, len, (px, py) => {
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + len, py + (R() - 0.5) * 1.5); ctx.stroke();
    });
  }
  // slubs (darker short knots)
  for (let i = 0; i < 900; i++) {
    const y = R() * size, x = R() * size, len = 4 + R() * 18;
    ctx.strokeStyle = `rgba(150,140,120,${0.15 + R() * 0.25})`; ctx.lineWidth = 1 + R() * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
  }
  // weft threads
  ctx.globalAlpha = 0.08;
  for (let x = 0; x < size; x += 6 + R() * 2) { ctx.fillStyle = R() > 0.5 ? '#9c9284' : '#fff'; ctx.fillRect(x, 0, 1, size); }
  ctx.globalAlpha = 1;
  // panel seams every half tile (wallpaper strips)
  const bump = canvas(size), b = bump.getContext('2d');
  b.drawImage(c, 0, 0); b.globalCompositeOperation = 'saturation'; b.fillStyle = '#000'; b.fillRect(0, 0, size, size);
  return { map: c, bump, tile: 0.6 };
}

// ---------- Marble family ----------
export function marble(kind, size = 1024) {
  const P = {
    calacatta: { base: '#f4f1ec', base2: '#e9e5de', vein: '#8a8174', vein2: '#c2b29a', f: 2, sharp: 46, amt: 0.8, warp: 2.4, seed: 1 },
    viola: { base: '#f6f2ef', base2: '#ece5e1', vein: '#4a1f1c', vein2: '#8a4a42', f: 2, sharp: 16, amt: 1.0, warp: 3.0, seed: 4 },
    gold: { base: '#f2eee6', base2: '#e8e0d0', vein: '#8b8375', vein2: '#c8a874', f: 2, sharp: 26, amt: 0.75, warp: 2.0, seed: 9 },
    nero: { base: '#1e1d1c', base2: '#2a2826', vein: '#e9e4dc', vein2: '#8c8378', f: 2, sharp: 30, amt: 0.9, warp: 2.4, seed: 12 },
    emperador: { base: '#3e2a1f', base2: '#55392a', vein: '#b49c82', vein2: '#2a1c14', f: 3, sharp: 40, amt: 0.45, warp: 3.0, seed: 15 },
    stone: { base: '#e7e2da', base2: '#d9d2c7', vein: '#b9b0a3', vein2: '#cfc6b9', f: 2, sharp: 30, amt: 0.35, warp: 2.0, seed: 18 },
    graystone: { base: '#8c867f', base2: '#7d776f', vein: '#a8a299', vein2: '#6c665f', f: 2, sharp: 30, amt: 0.3, warp: 2.0, seed: 19 },
    // West Garden: Marvel Diva «Precious Brown Velvet» (white, chocolate + caramel veins)
    velvet: { base: '#f3efe9', base2: '#e8e1d7', vein: '#5b3a28', vein2: '#a7805f', f: 2, sharp: 14, amt: 1.0, warp: 3.2, seed: 23 },
    // green kitchen splash (as in the renders): deep green with pale cloudy veins
    verde: { base: '#46553e', base2: '#5a6a4c', vein: '#a9b394', vein2: '#71805f', f: 2, sharp: 26, amt: 0.6, warp: 3.4, seed: 27 },
    // Grey Cloud (КГ-3 per specification)
    cloud: { base: '#c9c7c2', base2: '#b9b6b0', vein: '#8f8b84', vein2: '#e4e2de', f: 2, sharp: 22, amt: 0.6, warp: 2.6, seed: 31 },
    // warm beige quartz-like countertop
    sand: { base: '#ddd2c1', base2: '#d2c6b3', vein: '#c3b49c', vein2: '#e9e1d4', f: 2, sharp: 30, amt: 0.25, warp: 2.0, seed: 33 },
  }[kind];
  const base = hex(P.base), base2 = hex(P.base2), vein = hex(P.vein), vein2 = hex(P.vein2);
  return shade(size, (u, v) => {
    const w1 = fbm(u, v, 3, 4, P.seed);
    const w2 = fbm(u + 0.37, v + 0.11, 3, 4, P.seed + 3);
    const t = fbm(u + w1 * 0.35 * P.warp / 2, v + w2 * 0.35 * P.warp / 2, P.f, 5, P.seed + 7);
    const ridge = 1 - Math.abs(t * 2 - 1);
    const vv = Math.pow(ridge, P.sharp);
    const t2 = fbm(u * 1 + w2 * 0.6, v + w1 * 0.6, 4, 4, P.seed + 11);
    const ridge2 = Math.pow(1 - Math.abs(t2 * 2 - 1), P.sharp * 2.2);
    const cloud = fbm(u, v, 4, 3, P.seed + 21);
    let c = lerp3(base, base2, smooth(0.35, 0.75, cloud));
    c = lerp3(c, vein2, clamp(vv * 1.3) * 0.3 * P.amt);
    c = lerp3(c, vein, clamp(vv * 1.1 - 0.15) * P.amt);
    c = lerp3(c, vein, ridge2 * 0.45 * P.amt);
    return c;
  });
}

export function onyx(size = 1024) {
  const a = hex('#f3e9d6'), b = hex('#d9bf8f'), c2 = hex('#b98d55'), w = hex('#fffaf0');
  return shade(size, (u, v) => {
    const wv = fbm(u, v, 2, 5, 31);
    const band = 0.5 + 0.5 * Math.sin((v * 3 + u * 1 + wv * 3.2) * 6.283);
    const band2 = 0.5 + 0.5 * Math.sin((v * 9 + wv * 5.0) * 6.283);
    let c = lerp3(a, b, smooth(0.2, 0.95, band) * 0.8);
    c = lerp3(c, c2, smooth(0.75, 1, band2) * 0.35 * band);
    const t = fbm(u + wv * 0.3, v, 3, 4, 33);
    const vein = Math.pow(1 - Math.abs(t * 2 - 1), 30);
    c = lerp3(c, w, vein * 0.8);
    return c;
  });
}

// Breccia (pink clasts in dark matrix) – coffee table
export function breccia(size = 1024) {
  const R = rng(77);
  const pts = [];
  for (let i = 0; i < 46; i++) pts.push([R(), R(), R()]);
  const pinks = ['#efd7cc', '#e6c3b4', '#f4e6dd', '#dcb3a2', '#e9cfc0'].map(hex);
  const mat = hex('#6e4540'), mat2 = hex('#a06a62'), white = hex('#fbf6f1');
  return shade(size, (u, v) => {
    const wu = u + (fbm(u, v, 4, 3, 51) - 0.5) * 0.12, wv = v + (fbm(u, v, 4, 3, 52) - 0.5) * 0.12;
    let d1 = 9, d2 = 9, id = 0;
    for (let i = 0; i < pts.length; i++) {
      let dx = Math.abs(wu - pts[i][0]); dx = Math.min(dx, 1 - dx);
      let dy = Math.abs(wv - pts[i][1]); dy = Math.min(dy, 1 - dy);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; id = i; } else if (d < d2) d2 = d;
    }
    const edge = d2 - d1;
    const n = fbm(u, v, 8, 3, 53);
    const mw = 0.005 + n * 0.014;
    let c = pinks[id % pinks.length];
    const cl = fbm(u * 2, v * 2, 6, 3, 54);
    c = lerp3(c, white, smooth(0.6, 0.9, cl) * 0.5);
    const inner = fbm(u, v, 10, 3, 55);
    c = lerp3(c, mat2, Math.pow(1 - Math.abs(inner * 2 - 1), 18) * 0.5);
    const m = 1 - smooth(mw, mw + 0.01, edge);
    c = lerp3(c, lerp3(mat, mat2, n), m);
    return c;
  });
}

export function travertine(size = 1024) {
  const a = hex('#e4d8c3'), b = hex('#d2c2a6'), p = hex('#b6a588');
  return shade(size, (u, v) => {
    const wv = fbm(u, v, 3, 4, 61);
    const band = 0.5 + 0.5 * Math.sin((v * 7 + wv * 2) * 6.283);
    let c = lerp3(a, b, band * 0.6);
    const pore = vnoise(u * 180, v * 60, 180, 62);
    c = lerp3(c, p, smooth(0.86, 0.97, pore) * 0.7);
    return c;
  });
}

// Travertine «Pearl Vein» large format: light beige, horizontal veining (vein-cut)
export function travertinePearl(size = 1024) {
  const a = hex('#e6dccb'), b = hex('#d8ccb6'), d = hex('#bfae92'), p = hex('#cdbfa6');
  return shade(size, (u, v) => {
    const wv = fbm(u * 0.3, v, 2, 4, 71);
    const band = 0.5 + 0.5 * Math.sin((u * 9 + wv * 1.6) * 6.283);
    const fine = 0.5 + 0.5 * Math.sin((u * 46 + wv * 6) * 6.283);
    let c = lerp3(a, b, band * 0.55);
    c = lerp3(c, d, Math.pow(fine, 14) * 0.35);
    const pore = vnoise(u * 40, v * 160, 40, 72);
    c = lerp3(c, p, smooth(0.84, 0.97, pore) * 0.6);
    return c;
  });
}

// Decorative plaster / microcement (tinted by material color)
export function stucco(size = 1024, seed = 5) {
  return shade(size, (u, v) => {
    const a = fbm(u, v, 3, 5, seed), b = fbm(u, v, 12, 3, seed + 9), c = vnoise(u * 300, v * 300, 300, seed + 4);
    const l = 222 + (a - 0.5) * 34 + (b - 0.5) * 16 + (c - 0.5) * 8;
    return [l, l, l];
  });
}

// Fluted / slatted relief (bump): vertical rounded grooves
export function fluted(size = 512, count = 24) {
  return shade(size, (u) => {
    const t = (u * count) % 1;
    const l = 60 + 195 * Math.sin(Math.PI * Math.min(1, t / 0.86));
    return [l, l, l];
  });
}

// Square-hole lattice (alpha map): white = solid, black = hole
export function lattice(size = 512, cells = 8, bar = 0.32) {
  const c = canvas(size), ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  const s = size / cells, h = s * (1 - bar);
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) ctx.fillRect(i * s + (s - h) / 2, j * s + (s - h) / 2, h, h);
  return c;
}

// ---------- Floor tiles ----------
// Hallway "scallop" tile: white marble with brown emperador crescents.
export function scallopTile(size = 1024, whiteC, brownC) {
  const c = canvas(size), ctx = c.getContext('2d');
  const s = size / 4; // 4 tiles per texture → tile 0.3 m ⇒ texture 1.2 m
  const pw = ctx.createPattern(whiteC, 'repeat');
  const pb = ctx.createPattern(brownC, 'repeat');
  ctx.fillStyle = pw; ctx.fillRect(0, 0, size, size);
  const r = s * 0.36;
  for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) {
    const x = i * s, y = j * s;
    const dir = ((i + j) % 2) ? 1 : -1;
    ctx.fillStyle = pb;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pw;
    ctx.beginPath(); ctx.arc(x + dir * r * 0.62, y, r * 0.98, 0, Math.PI * 2); ctx.fill();
  }
  // grout lines: tile outlines (wavy squares) approximated by arcs + grid
  ctx.strokeStyle = 'rgba(120,110,100,0.55)'; ctx.lineWidth = 1.6;
  for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) {
    const x = i * s, y = j * s; const dir = ((i + j) % 2) ? 1 : -1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + dir * r * 0.62, y, r * 0.98, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(140,130,118,0.35)'; ctx.lineWidth = 1.2;
  for (let k = 0; k <= 4; k++) {
    ctx.beginPath(); ctx.moveTo(k * s + s / 2, 0); ctx.lineTo(k * s + s / 2, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, k * s + s / 2); ctx.lineTo(size, k * s + s / 2); ctx.stroke();
  }
  return { map: c, tile: 1.2 };
}

export function checkerDiag(size = 1024, aC, bC) {
  const c = canvas(size), ctx = c.getContext('2d');
  const pa = ctx.createPattern(aC, 'repeat'), pb = ctx.createPattern(bC, 'repeat');
  ctx.fillStyle = pa; ctx.fillRect(0, 0, size, size);
  const n = 4; const s = size / n; // diamonds
  ctx.fillStyle = pb;
  // simpler: per-diamond parity using rotated grid
  ctx.save();
  ctx.beginPath();
  for (let j = -n; j <= 2 * n; j++) for (let i = -n; i <= 2 * n; i++) {
    if (((i + j) & 1) !== 0) continue;
    // diamond centers on lattice rotated 45°
    const cx = (i - j) * s / 2, cy = (i + j) * s / 2;
    ctx.moveTo(cx, cy - s / 2); ctx.lineTo(cx + s / 2, cy); ctx.lineTo(cx, cy + s / 2); ctx.lineTo(cx - s / 2, cy); ctx.closePath();
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(110,104,96,0.5)'; ctx.lineWidth = 1.5;
  for (let k = -2 * n; k <= 2 * n; k++) {
    ctx.beginPath(); ctx.moveTo(k * s - size, -size + 0); ctx.lineTo(k * s + size, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(k * s + size, -size + 0); ctx.lineTo(k * s - size, size); ctx.stroke();
  }
  ctx.restore();
  return { map: c, tile: 1.7 }; // diamond side ~0.3 m
}

// Grid tile (large format stone / zellige)
export function tileGrid(baseC, cols, rows, opt = {}) {
  const w = opt.w || 1024, h = opt.h || 1024;
  const c = canvas(w, h), ctx = c.getContext('2d');
  const R = rng(opt.seed || 5);
  const cw = w / cols, ch = h / rows;
  const pat = ctx.createPattern(baseC, 'repeat');
  ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const v = opt.vary || 0;
    if (v) { ctx.fillStyle = `rgba(${R() > 0.5 ? '255,255,255' : '120,110,100'},${R() * v})`; ctx.fillRect(i * cw, j * ch, cw, ch); }
    if (opt.glaze) {
      const g = ctx.createRadialGradient(i * cw + cw * R(), j * ch + ch * R(), 1, i * cw + cw / 2, j * ch + ch / 2, Math.max(cw, ch));
      g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(160,150,140,0.10)');
      ctx.fillStyle = g; ctx.fillRect(i * cw, j * ch, cw, ch);
    }
  }
  ctx.strokeStyle = opt.grout || 'rgba(150,140,128,0.7)'; ctx.lineWidth = opt.gw || 2;
  for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, h); ctx.stroke(); }
  for (let j = 0; j <= rows; j++) { ctx.beginPath(); ctx.moveTo(0, j * ch); ctx.lineTo(w, j * ch); ctx.stroke(); }
  // bump: grout lines dark
  const b = canvas(w, h), bc = b.getContext('2d');
  bc.fillStyle = '#fff'; bc.fillRect(0, 0, w, h);
  bc.strokeStyle = '#000'; bc.lineWidth = (opt.gw || 2) * 1.6;
  for (let i = 0; i <= cols; i++) { bc.beginPath(); bc.moveTo(i * cw, 0); bc.lineTo(i * cw, h); bc.stroke(); }
  for (let j = 0; j <= rows; j++) { bc.beginPath(); bc.moveTo(0, j * ch); bc.lineTo(w, j * ch); bc.stroke(); }
  if (opt.glaze) { // wavy zellige surface
    const img = bc.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (img.data[i] < 128) continue;
      const n = vnoise(x / 40, y / 40, Math.round(w / 40), 9) * 90;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 165 + n;
    }
    bc.putImageData(img, 0, 0);
  }
  return { map: c, bump: b };
}

// ---------- Wood veneer (vertical grain, neutral; tinted by color) ----------
export function veneer(size = 1024, seed = 3) {
  // straight-grain veneer: fine pore lines + soft growth bands, low contrast (tinted by the material color)
  const a = hex('#cdb9a1'), b = hex('#b49c82'), d = hex('#9a8068');
  return shade(size, (u, v) => {
    const w = fbm(u, v * 0.12, 2, 3, seed);
    const band = 0.5 + 0.5 * Math.sin((u * 14 + w * 2.2) * 6.283);
    const lines = vnoise(u * 520, v * 3, 520, seed + 2);
    const pores = vnoise(u * 900, v * 60, 900, seed + 5);
    let c = lerp3(a, b, smooth(0.2, 1.0, band) * 0.45);
    c = lerp3(c, d, smooth(0.55, 1.0, lines) * 0.35);
    c = lerp3(c, d, smooth(0.8, 1.0, pores) * 0.2);
    const cath = Math.pow(0.5 + 0.5 * Math.sin((u * 3 + w * 1.5 + v * 0.35) * 6.283), 14);
    c = lerp3(c, d, cath * 0.18);
    return c;
  });
}

// ---------- Fabrics (neutral; tinted) ----------
export function fabric(kind = 'weave', size = 512) {
  const seed = { weave: 81, boucle: 82, tweed: 83, linen: 84, velvet: 85 }[kind];
  const c = shade(size, (u, v, x, y) => {
    let l = 225;
    if (kind === 'weave' || kind === 'linen') {
      const p = ((x >> 1) + (y >> 1)) & 1;
      l = 214 + p * 14 + (vnoise(u * 64, v * 4, 64, seed) - 0.5) * 30 + (vnoise(u * 3, v * 120, 3, seed + 1) - 0.5) * 18;
    } else if (kind === 'boucle') {
      const n1 = vnoise(u * 140, v * 140, 140, seed), n2 = vnoise(u * 60, v * 60, 60, seed + 1);
      l = 200 + n1 * 50 + n2 * 20;
    } else if (kind === 'tweed') {
      const s = vnoise(u * 220, v * 10, 220, seed);
      const s2 = vnoise(u * 90, v * 340, 90, seed + 5);
      l = 120 + s * 120 + (s2 > 0.8 ? 60 : 0) - (s2 < 0.15 ? 50 : 0);
    } else if (kind === 'velvet') {
      l = 225 + (fbm(u, v, 6, 3, seed) - 0.5) * 30;
    }
    l = clamp(l, 0, 255);
    return [l, l, l];
  }, size);
  return c;
}

export function stripes(size = 512, a = '#111', b = '#f4f1ea', count = 16, vertical = true) {
  const c = canvas(size), ctx = c.getContext('2d');
  ctx.fillStyle = b; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = a;
  const w = size / count;
  for (let i = 0; i < count; i += 2) vertical ? ctx.fillRect(i * w, 0, w, size) : ctx.fillRect(0, i * w, size, w);
  return c;
}

// ---------- Wallpaper: blue chinoiserie / toile (seamless) ----------
export function chinoiserie(size = 1024, palette = ['#24407f', '#3e62ab', '#7f9bd6', '#b9c9ec'], bg = '#f2eee4', seed = 91) {
  const R = rng(seed);
  const c = canvas(size), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);
  const P = palette;
  // branches
  for (let i = 0; i < 16; i++) {
    const x = R() * size, y = R() * size, ang = R() * 6.28, L = 140 + R() * 260;
    ctx.strokeStyle = P[R() > 0.5 ? 1 : 2]; ctx.lineWidth = 2 + R() * 3; ctx.lineCap = 'round';
    wrapDraw(size, x, y, L + 40, (px, py) => {
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.bezierCurveTo(px + Math.cos(ang) * L * 0.3 + 30, py + Math.sin(ang) * L * 0.3 - 20, px + Math.cos(ang) * L * 0.7 - 20, py + Math.sin(ang) * L * 0.7 + 30, px + Math.cos(ang) * L, py + Math.sin(ang) * L);
      ctx.stroke();
    });
  }
  // leaves
  for (let i = 0; i < 170; i++) {
    const x = R() * size, y = R() * size, a = R() * 6.28, s = 10 + R() * 18;
    ctx.fillStyle = P[1 + Math.floor(R() * 3)];
    wrapDraw(size, x, y, s * 2, (px, py) => {
      ctx.save(); ctx.translate(px, py); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = P[0]; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke();
      ctx.restore();
    });
  }
  // peonies
  for (let i = 0; i < 13; i++) {
    const x = R() * size, y = R() * size, s = 40 + R() * 46;
    wrapDraw(size, x, y, s * 1.4, (px, py) => {
      const layers = 4;
      for (let l = layers; l >= 1; l--) {
        const rr = s * l / layers;
        const petals = 7 + l * 2;
        for (let p = 0; p < petals; p++) {
          const a = p / petals * 6.283 + l * 0.4;
          ctx.fillStyle = l === layers ? P[2] : l > 2 ? P[1] : P[0];
          ctx.strokeStyle = P[0]; ctx.lineWidth = 1;
          ctx.save(); ctx.translate(px + Math.cos(a) * rr * 0.55, py + Math.sin(a) * rr * 0.55); ctx.rotate(a);
          ctx.beginPath(); ctx.ellipse(0, 0, rr * 0.5, rr * 0.32, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      }
      ctx.fillStyle = P[0]; ctx.beginPath(); ctx.arc(px, py, s * 0.16, 0, 6.283); ctx.fill();
    });
  }
  // small blossoms
  for (let i = 0; i < 50; i++) {
    const x = R() * size, y = R() * size, s = 4 + R() * 6;
    ctx.fillStyle = P[R() > 0.5 ? 2 : 3];
    wrapDraw(size, x, y, s * 2, (px, py) => {
      for (let p = 0; p < 5; p++) { const a = p * 1.2566; ctx.beginPath(); ctx.arc(px + Math.cos(a) * s, py + Math.sin(a) * s, s * 0.7, 0, 6.283); ctx.fill(); }
    });
  }
  return c;
}

// ---------- Mural (grisaille trees), single panel ----------
export function mural(w = 1024, h = 2048) {
  const R = rng(101);
  const c = canvas(w, h), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ecebe6'); g.addColorStop(0.7, '#e4e2dc'); g.addColorStop(1, '#d8d5cd');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const tree = (x, base, height, scale, tone) => {
    ctx.strokeStyle = `rgba(${tone},${tone},${tone - 6},0.9)`; ctx.lineCap = 'round';
    const branch = (x0, y0, ang, len, wd, depth) => {
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + (R() - 0.5) * len * 0.4, (y0 + y1) / 2, x1, y1); ctx.stroke();
      if (depth <= 0) {
        for (let k = 0; k < 26; k++) {
          const lx = x1 + (R() - 0.5) * 70 * scale, ly = y1 + (R() - 0.5) * 50 * scale;
          const t = tone + 20 + R() * 40;
          ctx.fillStyle = `rgba(${t},${t + 2},${t - 4},${0.35 + R() * 0.4})`;
          ctx.beginPath(); ctx.ellipse(lx, ly, (5 + R() * 9) * scale, (3 + R() * 5) * scale, R() * 3, 0, 6.283); ctx.fill();
        }
        return;
      }
      const n = 2 + (R() > 0.6 ? 1 : 0);
      for (let i = 0; i < n; i++) branch(x1, y1, ang + (R() - 0.5) * 1.3, len * (0.62 + R() * 0.2), wd * 0.62, depth - 1);
    };
    branch(x, base, -Math.PI / 2 + (R() - 0.5) * 0.2, height * 0.32, 18 * scale, 6);
  };
  tree(w * 0.35, h * 0.98, h * 0.95, 1.2, 150);
  tree(w * 0.8, h * 0.98, h * 0.7, 0.9, 175);
  tree(w * 0.1, h * 0.98, h * 0.6, 0.8, 185);
  // ground grasses
  for (let i = 0; i < 400; i++) {
    const x = R() * w, y = h * (0.9 + R() * 0.1); const t = 160 + R() * 50;
    ctx.strokeStyle = `rgba(${t},${t},${t - 5},0.5)`; ctx.lineWidth = 1 + R() * 2;
    ctx.beginPath(); ctx.moveTo(x, h); ctx.quadraticCurveTo(x + (R() - 0.5) * 30, y, x + (R() - 0.5) * 40, y - 40 * R()); ctx.stroke();
  }
  return c;
}

// ---------- Rugs ----------
export function rug(kind, w = 1024, h = 1024) {
  const R = rng(200 + kind.length);
  const c = canvas(w, h), ctx = c.getContext('2d');
  if (kind === 'living') { // broken stripes beige / sage
    ctx.fillStyle = '#ece4d0'; ctx.fillRect(0, 0, w, h);
    const rows = 22, rh = h / rows;
    for (let j = 0; j < rows; j++) {
      let x = 0; const off = (j % 2) * 37;
      while (x < w) {
        const len = 40 + Math.floor(R() * 4) * 40;
        if (((x / 40 + j) & 1) === 0) { ctx.fillStyle = j % 4 < 2 ? '#c9c099' : '#d9d1b2'; ctx.fillRect(x + off % 40, j * rh + 3, len - 6, rh - 6); }
        x += len;
      }
    }
    ctx.strokeStyle = '#c6bc94'; ctx.lineWidth = 26; ctx.strokeRect(13, 13, w - 26, h - 26);
  } else if (kind === 'maze') {
    ctx.fillStyle = '#ebe4d6'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d8ccb6'; ctx.lineWidth = 9; ctx.lineCap = 'square';
    const g = 40;
    for (let i = 0; i < 260; i++) {
      let x = Math.floor(R() * w / g) * g, y = Math.floor(R() * h / g) * g;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) { if (R() > 0.5) x += (R() > 0.5 ? 1 : -1) * g * (1 + Math.floor(R() * 3)); else y += (R() > 0.5 ? 1 : -1) * g * (1 + Math.floor(R() * 3)); ctx.lineTo(x, y); }
      ctx.stroke();
    }
  } else if (kind === 'blue') { // girls: ivory with blue border
    ctx.fillStyle = '#f1ede4'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4c66a8'; ctx.lineWidth = 18; ctx.strokeRect(40, 40, w - 80, h - 80);
    ctx.strokeStyle = '#9fb0d8'; ctx.lineWidth = 6; ctx.strokeRect(75, 75, w - 150, h - 150);
    ctx.fillStyle = '#7d93c9';
    for (let i = 0; i < 30; i++) { const x = 120 + R() * (w - 240), y = 120 + R() * (h - 240); ctx.beginPath(); ctx.arc(x, y, 6 + R() * 8, 0, 6.28); ctx.fill(); }
    for (let k = 0; k < 40; k++) { const t = k / 40; ctx.fillStyle = '#4c66a8'; ctx.beginPath(); ctx.arc(40 + t * (w - 80), 18, 6, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(40 + t * (w - 80), h - 18, 6, 0, 6.28); ctx.fill(); }
  } else if (kind === 'checker') { // bedroom: cream with terracotta squares
    ctx.fillStyle = '#ece3d3'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c7a493'; ctx.lineWidth = 20; ctx.strokeRect(30, 30, w - 60, h - 60);
    const n = 7, s = (w - 160) / n;
    ctx.fillStyle = '#b4614c';
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if ((i + j) % 2 === 0) ctx.fillRect(80 + i * s + s * 0.3, 80 + j * s * (h / w) + s * 0.3, s * 0.4, s * 0.4 * (h / w));
  }
  // fibre noise
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) { const n = (R() - 0.5) * 18; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- Art sketches / misc ----------
export function sketch(seed = 1, w = 512, h = 640) {
  const R = rng(300 + seed);
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#f3efe6'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(60,55,50,0.75)'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 26; i++) {
    ctx.beginPath(); let x = w * 0.3 + R() * w * 0.4, y = h * 0.3 + R() * h * 0.4; ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 140; y += (R() - 0.5) * 140; ctx.quadraticCurveTo(x + (R() - 0.5) * 60, y + (R() - 0.5) * 60, x, y); }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(176,120,90,0.35)'; ctx.beginPath(); ctx.ellipse(w * 0.55, h * 0.45, 50, 70, 0.4, 0, 6.28); ctx.fill();
  return c;
}

export function screenTex(w = 1024, h = 576) { // TV off: subtle reflection gradient
  const c = canvas(w, h), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#16181b'); g.addColorStop(0.5, '#0b0c0e'); g.addColorStop(1, '#141618');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  return c;
}

export function laptopScreen(w = 512, h = 320) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#2b3a55'); g.addColorStop(0.6, '#6b5b7b'); g.addColorStop(1, '#c58f6b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  return c;
}

// Porcelain (blue & white) for vases/plates
export function porcelain(size = 512) {
  const c = chinoiserie(size, ['#1d3577', '#2c4fa0', '#5b7cc7', '#a8bde8'], '#f7f6f2', 93);
  return c;
}

// City panorama for windows (equirect-like strip)
// High-floor view (cylinder r=140 m, y -110..50): horizon at eye level (v = 0.30), roofs, parks and a river below it.
export function cityPanorama(w = 4096, h = 1024) {
  const R = rng(500);
  const c = canvas(w, h), ctx = c.getContext('2d');
  const hz = Math.round(h * 0.3);
  const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const haze = hex('#dfe5e8');
  const tint = (rgb, f, a = 1) => `rgba(${rgb.map((v, i) => Math.round(v + (haze[i] - v) * f)).join(',')},${a})`;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#8fb0cf'); sky.addColorStop(0.65, '#c3d5e4'); sky.addColorStop(1, '#e3e8ea');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hz + 2);
  for (let i = 0; i < 90; i++) { // flat cumulus
    const x = R() * w, y = R() * hz * 0.75, sx = 80 + R() * 260, sy = sx * (0.18 + R() * 0.15);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, sy / sx);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, sx); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-sx, -sx, sx * 2, sx * 2); ctx.restore();
  }
  // distant skyline on the horizon
  for (let i = 0; i < 260; i++) { const bw = 4 + R() * 16, bh = 3 + R() * (R() < 0.08 ? 34 : 12), x = R() * w; ctx.fillStyle = tint([150, 160, 172], 0.55 + R() * 0.25, 0.9); ctx.fillRect(x, hz - bh, bw, bh + 2); }
  // ground base
  const gr = ctx.createLinearGradient(0, hz, 0, h);
  gr.addColorStop(0, '#c3cac6'); gr.addColorStop(0.2, '#97a28a'); gr.addColorStop(1, '#5c6e48');
  ctx.fillStyle = gr; ctx.fillRect(0, hz, w, h - hz);
  // river band (Setun valley feel) across part of the view
  ctx.fillStyle = tint([126, 146, 158], 0.35);
  ctx.beginPath(); ctx.moveTo(0, hz + 34);
  for (let x = 0; x <= w; x += 64) ctx.lineTo(x, hz + 34 + Math.sin(x / 520) * 10 + Math.sin(x / 170) * 3);
  for (let x = w; x >= 0; x -= 64) ctx.lineTo(x, hz + 46 + Math.sin(x / 520) * 12 + Math.sin(x / 200) * 3);
  ctx.closePath(); ctx.fill();
  // city blocks and tree clusters, far → near (lower in the texture = closer = bigger)
  const items = [];
  for (let i = 0; i < 4200; i++) items.push(Math.pow(R(), 0.8));
  items.sort((a, b) => a - b);
  const roofs = [[176, 170, 160], [150, 148, 145], [168, 120, 96], [196, 190, 178], [120, 122, 126], [205, 200, 190]];
  const greens = [[78, 98, 62], [96, 116, 72], [64, 84, 56], [112, 128, 84]];
  for (const t of items) {
    const y = hz + 8 + (h - hz) * Math.pow(t, 1.35), sc = 2 + 70 * Math.pow(t, 1.6), f = Math.pow(1 - t, 2.4) * 0.6, x = R() * w;
    if (R() < 0.64) { // tree crowns
      const gc = greens[Math.floor(R() * greens.length)], r = sc * (0.35 + R() * 0.35);
      for (let k = 0; k < 4; k++) { ctx.fillStyle = tint(gc.map((v) => v * (0.85 + R() * 0.3)), f); ctx.beginPath(); ctx.ellipse(x + (R() - 0.5) * r * 1.6, y + (R() - 0.5) * r * 0.5, r, r * 0.7, 0, 0, 6.283); ctx.fill(); }
    } else { // building: roof + lit facade + window rows
      const rc = roofs[Math.floor(R() * roofs.length)], bw = sc * (1 + R() * 2.2), bh = sc * (0.4 + R() * (R() < 0.15 ? 3.5 : 1.2)), rd = sc * 0.45;
      ctx.fillStyle = tint(rc.map((v) => v * 0.78), f); ctx.fillRect(x, y - bh, bw, bh);
      ctx.fillStyle = tint(rc, f); ctx.fillRect(x, y - bh - rd, bw, rd);
      if (sc > 9) { ctx.fillStyle = tint([70, 80, 92], f, 0.55); for (let yy = y - bh + sc * 0.12; yy < y - sc * 0.1; yy += sc * 0.22) for (let xx = x + sc * 0.08; xx < x + bw - sc * 0.1; xx += sc * 0.18) ctx.fillRect(xx, yy, sc * 0.09, sc * 0.1); }
    }
  }
  // horizon haze
  const hg = ctx.createLinearGradient(0, hz - 30, 0, hz + 90);
  hg.addColorStop(0, 'rgba(223,229,232,0)'); hg.addColorStop(0.35, 'rgba(223,229,232,0.7)'); hg.addColorStop(1, 'rgba(223,229,232,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, hz - 30, w, 120);
  return c;
}
