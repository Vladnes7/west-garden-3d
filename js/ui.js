import { CONTROLS, ROOMS_UI, applyOption, TEX } from './materials.js';
import { ROOMS, UI_ROOM } from './plan.js';
import { WALLS } from './plan-data.js';
import { VIEWS, HOME } from './controls.js';
import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const KEY = 'wg103-finish-v1';
let state = {};
try { state = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { state = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } };

export function initUI({ player, lighting, camera, onModeChange, onCut, cutH, FULL }) {
  // restore saved finishes
  for (const c of CONTROLS) if (state[c.id] !== undefined && c.options[state[c.id]]) applyOption(c, state[c.id]);

  let panelRoom = 'living';
  const roomsEl = $('#rooms'), ctrlsEl = $('#ctrls');
  for (const r of ROOMS_UI) {
    const b = document.createElement('button'); b.textContent = r.name; b.dataset.r = r.id;
    b.onclick = () => { panelRoom = r.id; renderPanel(); };
    roomsEl.appendChild(b);
  }
  const thumb = (o) => {
    if (!o.map) return `background:${o.color}`;
    try {
      const t = typeof o.map === 'function' ? o.map() : o.map;
      const img = t && t.image;
      if (img && img.toDataURL) { if (!img._thumb) { const c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d').drawImage(img, 0, 0, img.width / 3, img.height / 3, 0, 0, 64, 64); img._thumb = c.toDataURL('image/jpeg', 0.8); } return `background-image:url(${img._thumb})`; }
    } catch (e) { /* ignore */ }
    return `background:${o.color}`;
  };
  function renderPanel() {
    for (const b of roomsEl.children) b.classList.toggle('on', b.dataset.r === panelRoom);
    ctrlsEl.innerHTML = '';
    const list = CONTROLS.filter((c) => c.room === panelRoom);
    const global = CONTROLS.filter((c) => c.room === '*');
    const addSec = (t) => { const d = document.createElement('div'); d.className = 'sec'; d.textContent = t; ctrlsEl.appendChild(d); };
    const addCtrl = (c) => {
      const wrap = document.createElement('div'); wrap.className = 'ctrl';
      const cur = state[c.id] ?? 0;
      wrap.innerHTML = `<div class="lbl">${c.label}</div><div class="val">${c.options[cur].name}</div>`;
      const sw = document.createElement('div'); sw.className = 'sw';
      c.options.forEach((o, i) => {
        const b = document.createElement('button');
        b.setAttribute('style', thumb(o)); b.title = o.name; b.setAttribute('aria-label', o.name);
        if (i === cur) b.classList.add('on');
        b.onclick = () => { state[c.id] = i; save(); applyOption(c, i); wrap.querySelector('.val').textContent = o.name; for (const x of sw.children) x.classList.remove('on'); b.classList.add('on'); };
        sw.appendChild(b);
      });
      wrap.appendChild(sw); ctrlsEl.appendChild(wrap);
    };
    addSec(ROOMS_UI.find((r) => r.id === panelRoom).name);
    list.forEach(addCtrl);
    addSec('Для всей квартиры');
    global.forEach(addCtrl);
  }
  renderPanel();

  const panel = $('#panel');
  const openPanel = (v) => { panel.classList.toggle('open', v); if (v && document.pointerLockElement) document.exitPointerLock(); };
  $('#openPanel').onclick = () => { panelRoom = currentUIRoom || panelRoom; renderPanel(); openPanel(!panel.classList.contains('open')); };
  $('#closePanel').onclick = () => openPanel(false);
  $('#resetBtn').onclick = () => { for (const c of CONTROLS) { applyOption(c, 0); } state = {}; save(); renderPanel(); toast('Отделка как в проекте'); };

  // mode & time
  const modeSeg = $('#modeSeg'), timeSeg = $('#timeSeg');
  for (const b of modeSeg.children) b.onclick = () => { player.setMode(b.dataset.m); };
  player.onMode = (m) => { for (const b of modeSeg.children) b.classList.toggle('on', b.dataset.m === m); document.body.classList.toggle('walk', m === 'walk'); onModeChange(m); };
  document.body.classList.add('walk');
  for (const b of timeSeg.children) b.onclick = () => { for (const x of timeSeg.children) x.classList.toggle('on', x === b); lighting.setMode(b.dataset.t); };

  // help / start overlay
  const start = $('#start');
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch) { $('#keysDesk').classList.add('hidden'); $('#keysTouch').classList.remove('hidden'); }
  $('#helpBtn').onclick = () => { start.classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock(); };
  $('#enterBtn').onclick = () => { start.classList.add('hidden'); player.setMode('walk'); if (!touch) player.lock(); else if (canFS && !isFS()) toggleFS(); lookHint.style.opacity = '1'; };
  $('#overviewBtn').onclick = () => { start.classList.add('hidden'); player.setMode('orbit'); focusRoom(null, 'top'); };
  $('#gl').addEventListener('click', () => { if (player.mode === 'walk' && !player.locked && !touch && start.classList.contains('hidden') && !panel.classList.contains('open')) player.lock(); });

  const qSeg = $('#qSeg');
  let q0 = 'high'; try { q0 = localStorage.getItem('wg103-quality') || 'high'; } catch (e) { /* */ }
  for (const b of qSeg.children) { b.classList.toggle('on', b.dataset.q === q0); b.onclick = () => { for (const x of qSeg.children) x.classList.toggle('on', x === b); window.__setQuality && window.__setQuality(b.dataset.q); }; }
  const cross = $('#cross');
  player.onLock = (l) => { cross.style.display = l ? 'block' : 'none'; };
  player.onHot = (h) => { cross.classList.toggle('hot', h); $('#gl').style.cursor = h && !player.locked ? 'pointer' : ''; };

  // touch / small-screen layout, persistent joystick, run button
  const body = document.body;
  const setLayout = () => { body.classList.toggle('touch', touch); body.classList.toggle('small', innerWidth < 720 || innerHeight < 460); };
  setLayout(); addEventListener('resize', setLayout);
  const joy = $('#joy'), knob = joy.firstElementChild;
  player.joyBase = () => { const r = joy.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  player.onJoy = (j) => { joy.classList.toggle('active', !!j.active); knob.style.transform = j.active ? `translate(${(j.kx || 0) * 40}px, ${(j.ky || 0) * 40}px)` : ''; if (j.active) hideLookHint(); };
  const lookHint = $('#lookHint'); let hintT;
  const hideLookHint = () => { clearTimeout(hintT); hintT = setTimeout(() => { lookHint.style.opacity = '0'; }, 2500); };

  // fullscreen (laptop: button or F; Android: button; iPhone: home-screen hint)
  const fsEl = document.documentElement;
  const canFS = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
  const isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
  const toggleFS = () => {
    if (!canFS) { toast(standalone ? 'Уже во весь экран' : 'На iPhone: «Поделиться» → «На экран Домой», затем откройте с иконки'); return; }
    try {
      if (isFS()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { const p = (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => toast('Браузер не разрешил полный экран')); try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) { /* */ } }
    } catch (e) { toast('Браузер не разрешил полный экран'); }
  };
  $('#fsBtn').onclick = (e) => { e.stopPropagation(); toggleFS(); };
  addEventListener('keydown', (e) => { if (e.code === 'KeyF' && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) toggleFS(); });
  window.__toggleFS = toggleFS;

  // ---- minimap ----
  const mc = $('#mapc'), ctx = mc.getContext('2d');
  const X0 = -500, Y0 = -500, SX = 7200, SY = 8600;
  const sc = Math.min(mc.width / SX, mc.height / SY);
  const ox = (mc.width - SX * sc) / 2, oy = (mc.height - SY * sc) / 2;
  const toC = (x, y) => [ox + (x - X0) * sc, oy + (y - Y0) * sc];
  const base = document.createElement('canvas'); base.width = mc.width; base.height = mc.height;
  {
    const b = base.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink').trim() || '#2a2622';
    for (const r of ROOMS) {
      b.beginPath(); r.poly.forEach(([x, y], i) => { const [cx, cy] = toC(x, y); i ? b.lineTo(cx, cy) : b.moveTo(cx, cy); }); b.closePath();
      b.fillStyle = { floor_wood: 'rgba(147,173,141,.22)', floor_bath: 'rgba(245,243,238,.2)' }[r.floor]; b.fill();
    }
    b.fillStyle = ink;
    for (const p of WALLS) { b.beginPath(); p.forEach(([x, y], i) => { const [cx, cy] = toC(x, y); i ? b.lineTo(cx, cy) : b.moveTo(cx, cy); }); b.closePath(); b.fill(); }
  }
  mc.addEventListener('click', (e) => {
    const rect = mc.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * mc.width, py = (e.clientY - rect.top) / rect.height * mc.height;
    const x = (px - ox) / sc + X0, y = (py - oy) / sc + Y0;
    goToPoint(x / 1000, y / 1000);
  });
  function goToPoint(x, z) {
    const r = ROOMS.find((q) => pointIn(x * 1000, z * 1000, q.poly));
    if (!r) return;
    if (!player.teleportTo(x, z)) {
      const v = { bed: 'bed', bath: 'bath', hall: 'hall', living: 'living' }[r.id];
      player.teleport(v);
    }
    toast(r.name);
  }

  // ---- overview: room buttons, labels on the model, view switch, wall cut height ----
  // clicking a room flies the camera to a plan view of that room; «Войти» walks into it
  const areaOf = (poly) => { let a = 0; for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; a += x0 * y1 - x1 * y0; } return Math.abs(a) / 2e6; };
  const area = (ids) => ROOMS.filter((r) => ids.includes(r.id)).reduce((s, r) => s + areaOf(r.poly), 0);
  const fmt = (v) => v.toFixed(1).replace('.', ',');
  const roomBar = $('#roomBar'), tip = $('#roomTip'), labelsEl = $('#labels'), goBtn = $('#roomGo');
  const total = ROOMS.reduce((s, r) => s + areaOf(r.poly), 0);
  let focus = null; // ROOM_INFO entry or null = whole apartment
  const barBtns = [];
  const mkBar = (r) => {
    const b = document.createElement('button');
    const m2txt = r ? (r.ids.length ? fmt(area(r.ids)) + ' м²' : 'в кухне-гостиной') : fmt(total) + ' м²';
    b.innerHTML = `<span>${r ? r.name : 'Вся квартира'}</span><small>${m2txt}</small>`;
    b.setAttribute('aria-label', r ? `${r.name}. Вид сверху. ${r.desc}` : 'Вся квартира');
    if (r) {
      const show = () => {
        tip.innerHTML = `<b>${r.name}</b><span class="m2">${m2txt}</span><p>${r.desc}</p><p class="opens">${r.opens}</p><i>Нажмите — вид сверху на комнату</i>`;
        const br = b.getBoundingClientRect(), tw = Math.min(280, innerWidth - 24);
        tip.style.width = tw + 'px';
        tip.style.left = Math.max(12, Math.min(innerWidth - tw - 12, br.left + br.width / 2 - tw / 2)) + 'px';
        tip.style.bottom = (innerHeight - br.top + 10) + 'px';
        tip.classList.add('show');
      };
      b.addEventListener('mouseenter', show); b.addEventListener('focus', show);
      b.addEventListener('mouseleave', hideTip); b.addEventListener('blur', hideTip);
    }
    b.onclick = () => { hideTip(); focusRoom(r, r ? 'top' : player.view); };
    b._r = r; barBtns.push(b); roomBar.appendChild(b);
  };
  const hideTip = () => tip.classList.remove('show');
  mkBar(null); for (const r of ROOM_INFO) mkBar(r);

  const viewSeg = $('#viewSeg'), cutIn = $('#cutH'), cutVal = $('#cutVal'), lblBtn = $('#lblBtn');
  function syncOverview() {
    for (const b of barBtns) b.classList.toggle('on', b._r === focus);
    for (const b of viewSeg.children) b.classList.toggle('on', b.dataset.v === player.view);
    goBtn.classList.toggle('hidden', !focus);
    if (focus) goBtn.innerHTML = `Войти: ${focus.name} <span aria-hidden="true">→</span>`;
    for (const l of labels) l.el.classList.toggle('cur', l.r === focus);
  }
  function focusRoom(r, view) {
    player.flyTo(r ? r.box : HOME, view); // may switch to overview first (which resets the focus)
    focus = r;
    syncOverview();
  }
  for (const b of viewSeg.children) b.onclick = () => focusRoom(focus, b.dataset.v);
  goBtn.onclick = () => { if (focus) { player.teleport(focus.view); toast(focus.name); } };
  let cut = cutH;
  const showCut = () => { cutVal.textContent = cut >= FULL - 0.01 ? 'полные' : fmt(cut) + ' м'; };
  cutIn.value = String(cut); showCut();
  cutIn.addEventListener('input', () => { cut = +cutIn.value; showCut(); onCut(cut); });
  let lblOn = true;
  lblBtn.onclick = () => { lblOn = !lblOn; lblBtn.setAttribute('aria-pressed', String(lblOn)); labelsEl.classList.toggle('hidden', !lblOn); };

  // labels pinned to a free spot of each room's floor
  const labels = ROOM_INFO.map((r) => {
    const el = document.createElement('button'); el.className = 'rlabel';
    el.innerHTML = `<b>${r.name}</b>${r.ids.length ? `<small>${fmt(area(r.ids))} м²</small>` : ''}`;
    el.onclick = () => focusRoom(r, 'top');
    labelsEl.appendChild(el);
    return { r, el, p: new THREE.Vector3(r.label[0], 0.05, r.label[1]) };
  });
  const v3 = new THREE.Vector3();
  function placeLabels() {
    for (const l of labels) {
      v3.copy(l.p).project(camera);
      const x = (v3.x * 0.5 + 0.5) * innerWidth, y = (-v3.y * 0.5 + 0.5) * innerHeight;
      const off = v3.z > 1 || x < -40 || x > innerWidth + 40 || y < -20 || y > innerHeight + 20;
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      l.el.style.visibility = off ? 'hidden' : '';
    }
  }
  const prevMode = player.onMode;
  player.onMode = (m) => { prevMode(m); if (m === 'orbit') { focus = null; syncOverview(); } };
  player.view = 'iso'; syncOverview();

  let currentUIRoom = 'living', lastRoom = '';
  function update() {
    if (player.mode === 'orbit' && lblOn) placeLabels();
    ctx.clearRect(0, 0, mc.width, mc.height);
    ctx.drawImage(base, 0, 0);
    const p = player.mode === 'walk' ? player.pos : null;
    if (p) {
      const [cx, cy] = toC(p.x * 1000, p.z * 1000);
      const a = player.yaw;
      const fx = -Math.sin(a), fz = -Math.cos(a);
      ctx.fillStyle = 'rgba(195,211,190,.3)';
      ctx.beginPath(); ctx.moveTo(cx, cy);
      const ang = Math.atan2(fz, fx);
      ctx.arc(cx, cy, 34, ang - 0.55, ang + 0.55); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#93ad8d'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      const r = ROOMS.find((q) => pointIn(p.x * 1000, p.z * 1000, q.poly));
      if (r && r.name !== lastRoom) { lastRoom = r.name; $('#roomName').textContent = r.name; $('#mapRoom').textContent = r.name; }
      if (r) currentUIRoom = UI_ROOM[r.id];
    } else if (lastRoom !== 'Обзор') { lastRoom = 'Обзор'; $('#roomName').textContent = 'Обзор'; $('#mapRoom').textContent = 'Обзор'; }
  }
  return { update, toast, showStart: () => start.classList.remove('hidden') };
}

const ROOM_INFO = [
  { view: 'living', ids: ['living'], box: [0, 0, 3.045, 7.37], label: [1.6, 3.2], name: 'Кухня-гостиная', desc: 'ТВ-стена из шпона ореха с подсвеченной нишей, панели с рейкой и перфорированная перегородка, диван-конструктор из букле, круглый стол и стулья Fless.', opens: 'Открываются: кухонные шкафы и ящики, холодильник, колонна с духовкой, шкафы ТВ-стены.' },
  { view: 'kitchen', ids: [], box: [0, 5.29, 2.35, 7.37], label: [1.2, 6.45], name: 'Кухня', desc: 'П-образная кухня в нише: тёмный орех и рейка, зелёный мраморный фартук, песочная столешница, мойка Omoikiri.', opens: 'Открываются: все фасады и ящики, холодильник.' },
  { view: 'bed', ids: ['bed'], box: [3.2, 0, 6.165, 4.885], label: [4.1, 3.75], name: 'Спальня', desc: 'Парящая кровать Boca Airblade, стена из шпона с рейкой и зеркальными вставками, рабочий стол у окна, стеллаж с оливковым задником.', opens: 'Открываются: шкаф, тумбы, стеллаж, ящики стола.' },
  { view: 'bath', ids: ['bath'], box: [4.395, 5.01, 6.125, 7.608], label: [5.3, 5.55], name: 'Санузел', desc: 'Травертин Pearl Vein, пол и раковина Brown Velvet, рифлёное стекло душа, чёрная сантехника Ritmonio.', opens: 'Открываются: зеркальный шкаф, ящики тумбы, колонна стиральной и сушильной машин, шкаф над инсталляцией, дверь душа.' },
  { view: 'hall', ids: ['hall'], box: [2.51, 4.42, 4.255, 7.64], label: [3.6, 6.4], name: 'Прихожая', desc: 'Декоративная штукатурка, скрытые двери в цвет стен, витрина в чёрной раме, рифлёная панель, консоль с зеркалом.', opens: 'Открываются: шкаф с одеждой, витрина, ящик консоли.' },
];

function pointIn(x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; }
  return ins;
}

let tt;
export function toast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 1600);
}
void VIEWS; void TEX;
