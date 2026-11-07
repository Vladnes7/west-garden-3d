// First-person walking with collision, touch joystick, dollhouse orbit view, door interaction.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COLLIDE } from './pieces.js';
import { collisionSegments, roomAt } from './plan.js';

export const VIEWS = {
  living: { p: [2.6, 4.6], look: [0.6, 1.2, 1.2], name: 'Кухня-гостиная' },
  kitchen: { p: [1.2, 5.1], look: [1.2, 1.25, 7.3], name: 'Кухня' },
  hall: { p: [3.65, 4.75], look: [3.65, 1.4, 7.6], name: 'Прихожая' },
  entry: { p: [3.65, 7.3], look: [3.65, 1.45, 4.4], name: 'Вход' },
  bed: { p: [3.75, 3.7], look: [6.1, 1.15, 2.2], name: 'Спальня' },
  bath: { p: [4.9, 6.35], look: [4.95, 1.2, 5.0], name: 'Санузел' },
};

export const HOME = [-0.45, -0.44, 6.61, 8.05]; // whole apartment incl. facades, metres
const TOP_FOV = 6;

export class Player {
  constructor(camera, dom, doors, onInteract) {
    this.camera = camera; this.dom = dom; this.doors = doors;
    this.pos = new THREE.Vector3(3.65, 0, 7.3);
    this.yaw = 0; this.pitch = 0; this.eye = 1.62; this.r = 0.2;
    this.vel = new THREE.Vector2();
    this.keys = {};
    this.locked = false; this.mode = 'walk';
    this.segs = collisionSegments();
    this.boxes = COLLIDE;
    this.joy = { active: false, x: 0, y: 0, id: null };
    this.look = { id: null, x: 0, y: 0 };
    this.onInteract = onInteract;
    this.movers = []; this.lastJoyEnd = 0; this.mouse = null; this.hot = false;
    this.ray = new THREE.Raycaster(); this.ray.far = 3.2;
    this.orbit = new OrbitControls(camera, dom);
    this.orbit.enabled = false; this.orbit.target.set(3.1, 0, 3.8);
    this.orbit.maxPolarAngle = Math.PI * 0.46; this.orbit.minDistance = 4; this.orbit.maxDistance = 26; this.orbit.enableDamping = true;
    this._bind();
  }
  _bind() {
    const d = this.dom;
    addEventListener('keydown', (e) => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyE' || e.code === 'Space') { this.interactCenter(); e.preventDefault(); }
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === d; this.onLock && this.onLock(this.locked); });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || this.mode !== 'walk') return;
      this.yaw -= e.movementX * 0.0022; this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    });
    // desktop drag-to-look fallback (when pointer lock unavailable)
    let drag = null;
    d.addEventListener('mousedown', (e) => { if (this.mode !== 'walk' || this.locked) return; drag = { x: e.clientX, y: e.clientY, moved: false }; });
    d.addEventListener('mousemove', (e) => { this.mouse = { x: e.clientX, y: e.clientY }; });
    d.addEventListener('mouseleave', () => { this.mouse = null; });
    addEventListener('mousemove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; this.yaw -= dx * 0.004; this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - dy * 0.004)); drag.x = e.clientX; drag.y = e.clientY; });
    addEventListener('mouseup', (e) => { if (drag && !drag.moved && this.mode === 'walk') this.interactAt(e.clientX, e.clientY); drag = null; });
    // overview mode: clicks only rotate/zoom; rooms are chosen with the room buttons
    d.addEventListener('click', () => { if (this.mode === 'walk' && this.locked) this.interactCenter(); });
    // touch: left half joystick, right half look; tap = interact
    d.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (this.mode !== 'walk') continue;
        if (t.clientX < innerWidth * 0.45 && t.clientY > innerHeight * 0.3 && this.joy.id === null) {
          const base = this.joyBase ? this.joyBase() : { x: t.clientX, y: t.clientY };
          this.joy = { active: true, id: t.identifier, ox: base.x, oy: base.y, x: 0, y: 0 };
          this._joyMove(t.clientX, t.clientY);
        }
        else if (this.look.id === null) this.look = { id: t.identifier, x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t: performance.now(), tap: t.clientX >= innerWidth * 0.45 && !this.joy.active && performance.now() - this.lastJoyEnd > 350 };
      }
    }, { passive: true });
    d.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) this._joyMove(t.clientX, t.clientY);
        if (t.identifier === this.look.id) { this.yaw -= (t.clientX - this.look.x) * 0.005; this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - (t.clientY - this.look.y) * 0.005)); this.look.x = t.clientX; this.look.y = t.clientY; }
      }
    }, { passive: true });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) { this.joy = { active: false, x: 0, y: 0, id: null }; this.lastJoyEnd = performance.now(); this.onJoy && this.onJoy(this.joy); }
        if (t.identifier === this.look.id) {
          // tap-to-open only on the right (look) side and never while/just after using the joystick
          if (this.look.tap && !this.joy.active && Math.hypot(t.clientX - this.look.sx, t.clientY - this.look.sy) < 8 && performance.now() - this.look.t < 300) this.interactAt(t.clientX, t.clientY);
          this.look = { id: null };
        }
      }
    };
    d.addEventListener('touchend', end); d.addEventListener('touchcancel', end);
  }
  _joyMove(cx, cy) {
    const dx = cx - this.joy.ox, dy = cy - this.joy.oy;
    const m = Math.min(1, Math.hypot(dx, dy) / 54); const a = Math.atan2(dy, dx);
    const dead = m < 0.12 ? 0 : (m - 0.12) / 0.88;
    this.joy.x = Math.cos(a) * dead; this.joy.y = Math.sin(a) * dead; this.joy.kx = Math.cos(a) * m; this.joy.ky = Math.sin(a) * m;
    this.onJoy && this.onJoy(this.joy);
  }
  lock() { if (this.mode === 'walk' && this.dom.requestPointerLock) { try { const p = this.dom.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not available */ } } }
  teleport(view) {
    const v = VIEWS[view]; if (!v) return;
    this.setMode('walk');
    this.pos.set(v.p[0], 0, v.p[1]);
    const dx = v.look[0] - v.p[0], dz = v.look[2] - v.p[1], dy = v.look[1] - this.eye;
    this.yaw = Math.atan2(-dx, -dz); this.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }
  teleportTo(x, z) { if (this.free(x, z)) { this.setMode('walk'); this.pos.set(x, 0, z); return true; } return false; }
  setMode(m) {
    if (m === this.mode) return;
    this.mode = m;
    this.tween = null;
    if (m === 'orbit') {
      if (document.pointerLockElement) document.exitPointerLock();
      this.orbit.enabled = true;
      this.view = 'iso';
      const s = this.shotFor(HOME, 'iso');
      this.applyShot(s); this.orbit.target.copy(s.target); this.orbit.update();
      this._orbitLimits();
    } else {
      this.orbit.enabled = false;
      this.camera.fov = 68; this.camera.near = 0.05; this.camera.far = 400; this.camera.updateProjectionMatrix();
    }
    this.onMode && this.onMode(m);
  }
  // ---- overview: isometric orbit or a plan-like top view (very long lens ≈ orthographic) ----
  // a "shot" = target + spherical angles + visible height h (metres) + fov; distance follows from h and fov,
  // so tweening h and fov together is a smooth dolly-zoom between perspective and the drawing-like plan.
  shotFor(box, view) {
    const [x0, z0, x1, z1] = box;
    const asp = Math.max(0.3, innerWidth / innerHeight);
    const small = innerWidth < 720;
    const w = x1 - x0, d = z1 - z0;
    const target = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
    if (view === 'top') {
      // fit the box, leaving room for the top bar and the room buttons
      const h = Math.max(d * (small ? 1.75 : 1.32), (w / asp) * (small ? 1.2 : 1.2), 2.2);
      target.z += h * (small ? 0.075 : 0.02); // free area sits above the bottom bars
      return { target, polar: 0.0005, az: 0, h, fov: TOP_FOV };
    }
    if (small) target.z += 0.9;
    const h = box === HOME ? Math.max(Math.hypot(w, d) * 0.95, Math.max(w, d) / asp * 1.1) : Math.max(Math.hypot(w, d) * 1.45, (w / asp) * 1.6, 5.6);
    return { target, polar: 0.92, az: box === HOME ? 0.17 : 0.35, h, fov: 45 };
  }
  distFor(s) { return s.h / (2 * Math.tan(THREE.MathUtils.degToRad(s.fov) / 2)); }
  applyShot(s) {
    const cam = this.camera, r = this.distFor(s);
    cam.fov = s.fov;
    cam.position.set(s.target.x + r * Math.sin(s.polar) * Math.sin(s.az), s.target.y + r * Math.cos(s.polar), s.target.z + r * Math.sin(s.polar) * Math.cos(s.az));
    cam.lookAt(s.target);
    this._clip(r);
  }
  _clip(r) { // keep the depth range tight around the model (precision for AO at long-lens distances)
    const cam = this.camera, n = Math.max(0.05, r - 14), f = r + 24;
    if (Math.abs(cam.near - n) > 1e-3 || Math.abs(cam.far - f) > 1e-3 || cam.fov !== this._fov) { cam.near = n; cam.far = f; this._fov = cam.fov; cam.updateProjectionMatrix(); }
  }
  currentShot() {
    const o = this.orbit, off = this.camera.position.clone().sub(o.target);
    const r = off.length(), polar = Math.acos(Math.max(-1, Math.min(1, off.y / r))), az = Math.atan2(off.x, off.z);
    return { target: o.target.clone(), polar, az, h: 2 * r * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2), fov: this.camera.fov };
  }
  // fly to a room (box in metres [x0, z0, x1, z1]) in the given view; HOME = whole apartment
  flyTo(box, view = this.view, dur = 1.1) {
    if (this.mode !== 'orbit') this.setMode('orbit');
    this.view = view;
    const a = this.currentShot(), b = this.shotFor(box, view);
    // shortest way round in azimuth
    let daz = b.az - a.az; daz = Math.atan2(Math.sin(daz), Math.cos(daz)); b.az = a.az + daz;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.tween = { a, b, t: 0, dur: reduce ? 0.01 : dur };
    this.orbit.enabled = false;
  }
  _orbitLimits() {
    const o = this.orbit, top = this.view === 'top';
    o.enableRotate = !top;
    o.minPolarAngle = top ? 0.0005 : 0.15; o.maxPolarAngle = top ? 0.0005 : Math.PI * 0.46;
    const d = this.distFor({ h: 1, fov: this.camera.fov });
    o.minDistance = top ? 1.6 * d : 3; o.maxDistance = top ? 14 * d : 26;
    o.mouseButtons = { LEFT: top ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    o.touches = { ONE: top ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    o.screenSpacePanning = true;
  }
  free(x, z) {
    const r = this.r;
    for (const s of this.allSegs()) if (distSeg(x, z, s) < r) return false;
    for (const b of this.boxes) if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return false;
    return !!roomAt(x * 1000, z * 1000) || this.inOpening(x, z);
  }
  inOpening(x, z) { return x > -0.05 && x < 6.2 && z > -0.05 && z < 7.99; }
  allSegs() {
    const out = this.segs.slice();
    for (const d of this.doors) {
      if (!d.interactive && d.id !== 'd_entry') continue;
      if (d.open > 0.25 && d.id !== 'd_entry') continue;
      const a = d.pivot.rotation.y; const ex = d.hinge[0] + Math.cos(a) * d.W, ez = d.hinge[1] - Math.sin(a) * d.W;
      out.push([d.hinge[0], d.hinge[1], ex, ez]);
    }
    return out;
  }
  update(dt) {
    if (this.mode === 'orbit') {
      const tw = this.tween;
      if (tw) {
        tw.t = Math.min(1, tw.t + dt / tw.dur);
        const e = tw.t < 0.5 ? 4 * tw.t ** 3 : 1 - (-2 * tw.t + 2) ** 3 / 2; // easeInOutCubic
        const L = (p, q) => p + (q - p) * e;
        const s = { target: tw.a.target.clone().lerp(tw.b.target, e), polar: L(tw.a.polar, tw.b.polar), az: L(tw.a.az, tw.b.az),
          h: Math.exp(L(Math.log(tw.a.h), Math.log(tw.b.h))), fov: Math.exp(L(Math.log(tw.a.fov), Math.log(tw.b.fov))) };
        this.applyShot(s);
        if (tw.t >= 1) { this.tween = null; this.orbit.target.copy(tw.b.target); this._orbitLimits(); this.orbit.enabled = true; this.orbit.update(); }
        return;
      }
      this.orbit.update();
      this._clip(this.camera.position.distanceTo(this.orbit.target));
      return;
    }
    const k = this.keys;
    let fx = 0, fz = 0;
    if (k.KeyW || k.ArrowUp) fz -= 1; if (k.KeyS || k.ArrowDown) fz += 1;
    if (k.KeyA || k.ArrowLeft) fx -= 1; if (k.KeyD || k.ArrowRight) fx += 1;
    if (this.joy.active) { fx += this.joy.x; fz += this.joy.y; }
    if (k.KeyQ) this.yaw += dt * 1.8; if (k.KeyR) this.yaw -= dt * 1.8;
    const len = Math.hypot(fx, fz);
    const speed = (k.ShiftLeft || k.ShiftRight ? 2.6 : 1.45);
    const target = new THREE.Vector2();
    if (len > 0.01) {
      const nx = fx / Math.max(1, len), nz = fz / Math.max(1, len);
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      target.set((nx * c + nz * s) * speed, (-nx * s + nz * c) * speed);
    }
    this.vel.lerp(target, 1 - Math.exp(-dt * 10));
    const step = this.vel.clone().multiplyScalar(dt);
    // sub-steps with sliding collision
    const n = Math.ceil(step.length() / 0.05) || 1;
    for (let i = 0; i < n; i++) this.moveBy(step.x / n, step.y / n);
    this.camera.position.set(this.pos.x, this.eye + Math.sin(this.bob = (this.bob || 0) + this.vel.length() * dt * 7) * 0.012 * Math.min(1, this.vel.length()), this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
  moveBy(dx, dz) {
    let x = this.pos.x + dx, z = this.pos.z + dz;
    const r = this.r;
    for (let it = 0; it < 3; it++) {
      for (const s of this.allSegs()) {
        const [px, pz, d] = closest(x, z, s);
        if (d < r && d > 1e-6) { const push = (r - d) / d; x += (x - px) * push; z += (z - pz) * push; }
      }
      for (const b of this.boxes) {
        const cx = Math.max(b[0], Math.min(x, b[2])), cz = Math.max(b[1], Math.min(z, b[3]));
        const ddx = x - cx, ddz = z - cz, d = Math.hypot(ddx, ddz);
        if (d < r) {
          if (d > 1e-6) { x += ddx / d * (r - d); z += ddz / d * (r - d); }
          else { // inside box: push out along smallest axis
            const o = [x - b[0], b[2] - x, z - b[1], b[3] - z]; const m = Math.min(...o);
            if (m === o[0]) x = b[0] - r; else if (m === o[1]) x = b[2] + r; else if (m === o[2]) z = b[1] - r; else z = b[3] + r;
          }
        }
      }
    }
    // never leave the apartment
    if (!roomAt(x * 1000, z * 1000) && !this.nearOpening(x, z)) return;
    this.pos.x = x; this.pos.z = z;
  }
  nearOpening(x, z) { // allow standing inside door/arch thickness
    for (const r of [0.08, 0.12]) for (const [ox, oz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (roomAt((x + ox) * 1000, (z + oz) * 1000)) return true;
    return false;
  }
  interactCenter() { this.interactAt(innerWidth / 2, innerHeight / 2); }
  targets() {
    if (!this._targets || this._targetsN !== this.movers.length) {
      this._targets = []; for (const d of this.doors) if (d.interactive) this._targets.push(...d.meshes);
      for (const m of this.movers) this._targets.push(...m.meshes);
      this._targetsN = this.movers.length;
    }
    return this._targets;
  }
  pick(cx, cy) {
    const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.intersectObjects(this.targets(), false)[0];
    const u = hit && hit.object.userData;
    return u && (u.door || u.mover) ? u : null;
  }
  interactAt(cx, cy) {
    const u = this.pick(cx, cy); if (!u) return false;
    this.onInteract && this.onInteract(u.door || u.mover, !!u.mover);
    return true;
  }
  // highlight the crosshair / pointer when aiming at something that opens
  updateHover() {
    if (this.mode !== 'walk') { if (this.hot) { this.hot = false; this.onHot && this.onHot(false); } return; }
    let hot = false;
    if (this.locked) hot = !!this.pick(innerWidth / 2, innerHeight / 2);
    else if (this.mouse) hot = !!this.pick(this.mouse.x, this.mouse.y);
    if (hot !== this.hot) { this.hot = hot; this.onHot && this.onHot(hot); }
  }
  facing() { return this.yaw; }
}

function closest(x, z, s) {
  const [ax, az, bx, bz] = s; const dx = bx - ax, dz = bz - az; const L2 = dx * dx + dz * dz || 1;
  let t = ((x - ax) * dx + (z - az) * dz) / L2; t = Math.max(0, Math.min(1, t));
  const px = ax + dx * t, pz = az + dz * t;
  return [px, pz, Math.hypot(x - px, z - pz)];
}
function distSeg(x, z, s) { return closest(x, z, s)[2]; }
