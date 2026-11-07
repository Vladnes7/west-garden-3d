import * as THREE from 'three';
import * as T from './textures.js';
import { frame } from './util.js';

export const MAT = {};          // key -> material
export const TEX = {};          // key -> texture
let maxAniso = 8;

function tex(c, tileMeters = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tileMeters, 1 / tileMeters);
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);

export async function buildMaterials(renderer, progress) {
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const step = async (label) => { progress && progress(label); await frame(); };

  await step('Паркет «английская ёлка»');
  const hb = T.herringbone(2048, 6);
  TEX.wood = tex(hb.map, hb.tile); TEX.woodBump = tex(hb.bump, hb.tile, false); TEX.woodRough = tex(hb.rough, hb.tile, false);

  await step('Шпон и рейка');
  TEX.veneer = tex(T.veneer(1024, 3), 1.1);
  TEX.veneer2 = tex(T.veneer(1024, 8), 1.1);
  TEX.flutedBump = tex(T.fluted(512, 24), 0.42, false); // ~17.5 mm pitch
  TEX.slatBump = tex(T.fluted(512, 12), 0.6, false);    // 50 mm slats

  await step('Камень и мрамор');
  const mc = {};
  for (const k of ['velvet', 'verde', 'cloud', 'sand', 'nero', 'calacatta', 'stone']) mc[k] = T.marble(k, 1024);
  for (const k in mc) TEX['m_' + k] = tex(mc[k], k === 'velvet' ? 1.2 : 1.0);
  TEX.travPearl = tex(T.travertinePearl(1024), 1.2);
  TEX.travertine = tex(T.travertine(1024), 1.2);

  await step('Штукатурка и краска');
  TEX.stucco = tex(T.stucco(1024, 5), 1.6); TEX.stuccoBump = tex(T.stucco(1024, 5), 1.6, false);
  TEX.paint = tex(T.stucco(512, 11), 3.0, false);

  await step('Ткани');
  const fab = { weave: T.fabric('weave'), boucle: T.fabric('boucle'), tweed: T.fabric('tweed'), linen: T.fabric('linen'), velvet: T.fabric('velvet') };
  for (const k in fab) { TEX['f_' + k] = tex(fab[k], k === 'tweed' ? 0.12 : 0.25); TEX['fb_' + k] = tex(fab[k], k === 'tweed' ? 0.12 : 0.25, false); }

  await step('Декор');
  TEX.lattice = tex(T.lattice(512, 6, 0.38), 0.42, false); TEX.lattice.generateMipmaps = false; TEX.lattice.minFilter = THREE.LinearFilter;
  TEX.screen = tex(T.screenTex(), 1); TEX.screen.repeat.set(1, 1);
  TEX.laptop = tex(T.laptopScreen(), 1); TEX.laptop.repeat.set(1, 1);
  TEX.city = tex(T.cityPanorama(4096, 1024), 1); TEX.city.repeat.set(1, 1); TEX.city.wrapT = THREE.ClampToEdgeWrapping;
  TEX.sketch1 = tex(T.sketch(1), 1); TEX.sketch1.repeat.set(1, 1); TEX.sketch2 = tex(T.sketch(2), 1); TEX.sketch2.repeat.set(1, 1);

  await step('Материалы');
  const wood = (color, rough = 0.55, map = TEX.veneer) => std({ color, map, roughness: rough, metalness: 0 });
  const fluted = (color, rough = 0.55) => std({ color, map: TEX.veneer2, bumpMap: TEX.flutedBump, bumpScale: 3, roughness: rough });
  const fabricM = (kind, color, rough = 0.95, sheen) => {
    const m = phys({ color, map: TEX['f_' + kind], bumpMap: TEX['fb_' + kind], bumpScale: kind === 'boucle' ? 1.8 : 0.8, roughness: rough, metalness: 0 });
    if (sheen) { m.sheen = 1; m.sheenRoughness = 0.35; m.sheenColor = new THREE.Color(sheen); }
    return m;
  };
  const marbleM = (k, rough = 0.2) => std({ map: TEX['m_' + k], roughness: rough, metalness: 0 });
  const paintM = (color) => std({ color, roughnessMap: TEX.paint, roughness: 0.92, bumpMap: TEX.paint, bumpScale: 0.15 });

  Object.assign(MAT, {
    // floors
    floor_wood: std({ map: TEX.wood, bumpMap: TEX.woodBump, bumpScale: 1.2, roughnessMap: TEX.woodRough, roughness: 0.85, color: '#b08f70' }),
    floor_bath: std({ map: TEX.m_velvet, roughness: 0.32 }),
    // walls
    w_living: paintM('#e4dcd1'),                                    // К-2 decorative paint (warm greige)
    w_bed: paintM('#e1d8cc'),
    w_hall: std({ color: '#ddd2c3', map: TEX.stucco, bumpMap: TEX.stuccoBump, bumpScale: 0.5, roughness: 0.9 }), // ДШ-1
    w_bath: std({ map: TEX.travPearl, roughness: 0.4 }),             // КГ-2 Travertine Pearl Vein
    plaster: std({ color: '#ebe6de', roughness: 0.92 }),
    ceiling: std({ color: '#f2f0eb', roughness: 0.95 }),
    cut: std({ color: '#2a2826', roughness: 1 }),
    shadowgap: std({ color: '#151413', roughness: 1 }),
    trim: std({ color: '#ece7df', roughness: 0.6 }),
    // wood (Д-1 MDF veneer), fluted panels, doors
    wood: wood('#8c6c52', 0.55),
    wood_fluted: fluted('#8a6a50', 0.6),
    wood_slat: std({ color: '#86684f', map: TEX.veneer2, bumpMap: TEX.slatBump, bumpScale: 4, roughness: 0.6 }),
    wood_dark: wood('#5d4637', 0.5),
    oak_dark: wood('#5d4637', 0.5),
    oak_light: wood('#c8b096', 0.55),
    door_hall: std({ color: '#ddd2c3', map: TEX.stucco, bumpMap: TEX.stuccoBump, bumpScale: 0.4, roughness: 0.85 }),
    door_entry: wood('#6e5442', 0.5, TEX.veneer2),
    // kitchen
    k_wood: wood('#8c6c52', 0.55),
    k_fluted: fluted('#8a6a50', 0.6),
    k_cream: std({ color: '#e8e1d5', roughness: 0.45 }),
    k_top: marbleM('sand', 0.35),
    k_splash: marbleM('verde', 0.12),
    // metals & glass
    black: std({ color: '#1c1c1d', metalness: 0.5, roughness: 0.5 }),
    hw: std({ color: '#222224', metalness: 0.7, roughness: 0.38 }),        // handles, faucets, fixtures (black brushed)
    chrome: std({ color: '#d6d8da', metalness: 1, roughness: 0.12 }),
    steel: std({ color: '#9ea2a6', metalness: 1, roughness: 0.3 }),
    brass: std({ color: '#c8a064', metalness: 1, roughness: 0.28 }),
    gilt: std({ color: '#c79a4a', metalness: 1, roughness: 0.32 }),
    glass: std({ color: '#c7d4dc', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false }),
    glass_shower: std({ color: '#dfe7ea', roughness: 0.03, transparent: true, opacity: 0.14, depthWrite: false }),
    glass_display: std({ color: '#cfd3d2', roughness: 0.05, transparent: true, opacity: 0.2, depthWrite: false }),
    glass_smoke: std({ color: '#6d6a66', roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }),
    mirror: std({ color: '#cfd5d8', metalness: 1, roughness: 0.02 }),
    // per-room mirrors: each gets its own baked cube reflection (see main.js bakeMirrors)
    mirror_bed: std({ color: '#d6dadc', metalness: 1, roughness: 0.0 }),
    mirror_hall: std({ color: '#d6dadc', metalness: 1, roughness: 0.0 }),
    mirror_bath: std({ color: '#d6dadc', metalness: 1, roughness: 0.0 }),
    win_frame: std({ color: '#2b2b2c', roughness: 0.5, metalness: 0.3 }),
    blind: fabricM('linen', '#e9e2d6', 1),
    outside: new THREE.MeshBasicMaterial({ map: TEX.city, side: THREE.BackSide, fog: false }),
    // textiles
    curtain: fabricM('linen', '#d8ccbb', 0.95),
    sheer: std({ color: '#f6f3ee', roughness: 1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    sofa: fabricM('boucle', '#ece5d8', 1),
    chair_green: fabricM('velvet', '#5f6a4c', 0.8, '#8f9a74'),
    pouf_green: fabricM('boucle', '#5e6650', 1),
    bed_fabric: fabricM('linen', '#ebe5db', 0.95),
    linen_white: fabricM('linen', '#f4f1eb', 1),
    throw_olive: fabricM('weave', '#8f9171', 1),
    throw_knit: fabricM('tweed', '#d6ccbb', 1),
    pillow_white: fabricM('linen', '#efebe3', 0.95),
    pillow_sand: fabricM('weave', '#d7c9b4', 1),
    pillow_pattern: fabricM('tweed', '#cfc6b8', 1),
    cushion: fabricM('linen', '#d9d3c8', 0.95),
    rug_cream: fabricM('boucle', '#e7e0d3', 1),
    rug_edge: std({ color: '#ddd3bf', roughness: 1 }),
    leather: std({ color: '#7a4f35', roughness: 0.55 }),
    // decor & misc
    terra: std({ color: '#8a5340', roughness: 0.55, map: TEX.veneer2 }),
    terra_waffle: std({ color: '#8a5340', roughness: 0.6, bumpMap: TEX.lattice, bumpScale: 6 }),
    w_fluted: std({ color: '#e7e0d6', bumpMap: TEX.flutedBump, bumpScale: 3, roughness: 0.85 }),
    wood_bath: wood('#b8966f', 0.5, TEX.veneer),
    wardrobe_cream: std({ color: '#e3dccf', roughness: 0.5 }),
    olive_strip: std({ color: '#5a5f47', roughness: 0.55 }),
    sink_gm: std({ color: '#3a3a3c', metalness: 0.85, roughness: 0.35 }),
    glass_fluted: std({ color: '#e4ded4', roughness: 0.2, transparent: true, opacity: 0.32, bumpMap: TEX.flutedBump, bumpScale: 2.5, depthWrite: false }),
    lattice: std({ color: '#efebe4', alphaMap: TEX.lattice, alphaTest: 0.5, roughness: 0.6, side: THREE.DoubleSide }),
    lacquer_white: std({ color: '#f1ede6', roughness: 0.3 }),
    lacquer_sage: std({ color: '#8e977d', roughness: 0.45 }),
    shelf_green: std({ color: '#3f4637', roughness: 0.65 }),
    stone_light: marbleM('calacatta', 0.25),
    marble_velvet: marbleM('velvet', 0.2),
    ceramic: std({ color: '#f7f6f3', roughness: 0.12 }),
    porcelain: std({ color: '#f1eee8', roughness: 0.15 }),
    appliance: std({ color: '#141516', roughness: 0.15, metalness: 0.4 }),
    tv: std({ map: TEX.screen, roughness: 0.1, metalness: 0.2 }),
    laptop: std({ map: TEX.laptop, roughness: 0.2, emissive: '#ffffff', emissiveMap: TEX.laptop, emissiveIntensity: 0.25 }),
    led: new THREE.MeshBasicMaterial({ color: '#ffd9a8' }),
    spot: new THREE.MeshBasicMaterial({ color: '#fff6e8' }),
    bulb: std({ color: '#fff3dc', emissive: '#ffd59a', emissiveIntensity: 0.0 }),
    globe: std({ color: '#f6efe2', roughness: 0.35, transparent: true, opacity: 0.94, emissive: '#ffd6a0', emissiveIntensity: 0.0 }),
    lampshade: std({ color: '#efe3cc', roughness: 0.9, emissive: '#ffcc88', emissiveIntensity: 0, side: THREE.DoubleSide }),
    ceramic_lamp: std({ color: '#efe9e0', roughness: 0.3, emissive: '#ffd6a0', emissiveIntensity: 0 }),
    art1: std({ map: TEX.sketch1, roughness: 0.9 }), art2: std({ map: TEX.sketch2, roughness: 0.9 }),
    plant: std({ color: '#5b6b45', roughness: 0.8, side: THREE.DoubleSide }),
    branch: std({ color: '#5a4434', roughness: 0.9 }),
    blossom: std({ color: '#f1e6e2', roughness: 0.9 }),
    book1: std({ color: '#cdbfa8', roughness: 0.8 }), book2: std({ color: '#5a6a72', roughness: 0.8 }), book3: std({ color: '#8b4a3a', roughness: 0.8 }),
    radiator: std({ color: '#efede9', roughness: 0.45, metalness: 0.2 }),
    socket: std({ color: '#2a2a2b', roughness: 0.5 }),
    // clothes & cabinet contents (shared casework catalog)
    clothes1: fabricM('weave', '#d9d2c5', 1), clothes2: fabricM('weave', '#5f6b78', 1), clothes3: fabricM('weave', '#8e7660', 1), clothes4: fabricM('weave', '#2e3440', 1),
    clothes5: fabricM('weave', '#c9b8a2', 1), clothes6: fabricM('weave', '#7d8467', 1), clothes7: fabricM('weave', '#f2eee6', 1),
    drawer_box: std({ color: '#e6ded2', roughness: 0.6 }),
    fridge_in: std({ color: '#f4f5f4', roughness: 0.35, emissive: '#ffffff', emissiveIntensity: 0.12 }),
    box_linen: fabricM('linen', '#cdc2b0', 0.95),
    shoe_light: std({ color: '#d8c8b0', roughness: 0.6 }),
    carton: std({ color: '#f2efe8', roughness: 0.7 }),
    pack1: std({ color: '#3b5470', roughness: 0.6 }), pack2: std({ color: '#b4523a', roughness: 0.6 }),
    pack3: std({ color: '#d8b46a', roughness: 0.6 }), pack4: std({ color: '#4f7a65', roughness: 0.6 }),
    food_rice: std({ color: '#ece4d2', roughness: 0.9 }), food_brown: std({ color: '#7b5233', roughness: 0.85 }),
    food_yellow: std({ color: '#e2bf4f', roughness: 0.6 }), food_orange: std({ color: '#d9752c', roughness: 0.55 }),
    food_green: std({ color: '#6d8f3e', roughness: 0.55 }), food_red: std({ color: '#b2342a', roughness: 0.45 }),
    jar_glass: std({ color: '#e6eef0', roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
    glass_cup: std({ color: '#e3ecee', roughness: 0.04, transparent: true, opacity: 0.3, depthWrite: false }),
    mug_blue: std({ color: '#5d7d9e', roughness: 0.25 }), mug_sand: std({ color: '#d9c7ab', roughness: 0.3 }),
    bottle_green: std({ color: '#2f4a32', roughness: 0.1, metalness: 0.1 }), bottle_amber: std({ color: '#7a4a1e', roughness: 0.1, metalness: 0.1 }),
    bottle_oil: std({ color: '#c9a53f', roughness: 0.1, transparent: true, opacity: 0.85 }),
    bin1: std({ color: '#d5d3cf', roughness: 0.5 }), bin2: std({ color: '#8d9a8a', roughness: 0.5 }),
    towel_sand: fabricM('weave', '#cdb79a', 1),
    frost1: std({ color: '#c8dbe6', roughness: 0.4 }), frost2: std({ color: '#e6d9c4', roughness: 0.5 }),
    glass_pink: std({ color: '#e7a6a8', roughness: 0.1, transparent: true, opacity: 0.55 }),
  });
  for (const k in MAT) { const m = MAT[k]; m.name = k; m.userData.map0 = m.map; m.userData.r0 = m.roughness; m.userData.m0 = m.metalness; }
}

// ---------------- Configurator catalog ----------------
const C = (name, color, extra = {}) => ({ name, color, ...extra });
const tx = (key) => () => TEX[key];

export const ROOMS_UI = [
  { id: 'living', name: 'Кухня-гостиная' },
  { id: 'hall', name: 'Прихожая' },
  { id: 'bed', name: 'Спальня' },
  { id: 'bath', name: 'Санузел' },
];

export const CONTROLS = [
  // whole apartment
  { id: 'floor', room: '*', label: 'Паркет (английская ёлка)', mats: ['floor_wood'], options: [C('Дуб тёплый (проект)', '#b08f70'), C('Дуб натуральный', '#cfb08c'), C('Дуб светлый', '#e2d2bd'), C('Дуб дымчатый', '#8f7a68'), C('Орех', '#7d5d45')] },
  { id: 'wood', room: '*', label: 'Дерево: МДФ-панели, рейка, откосы', mats: ['wood', 'wood_fluted', 'wood_slat', 'k_wood', 'k_fluted'], options: [C('Орех тёплый (проект)', '#8c6c52'), C('Дуб натуральный', '#b99a7a'), C('Дуб светлый', '#d1bba0'), C('Тёмный орех', '#5e4636'), C('Венге', '#3e3129')] },
  { id: 'hw', room: '*', label: 'Ручки, смесители, фурнитура', mats: ['hw'], options: [C('Чёрный брашированный (проект)', '#222224'), C('Графит', '#4a4b4d'), C('Латунь', '#c8a064', { roughness: 0.28, metalness: 1 }), C('Хром', '#d9dcdf', { roughness: 0.12, metalness: 1 })] },
  // living + kitchen
  { id: 'w_living', room: 'living', label: 'Стены (декоративная краска К-2)', mats: ['w_living'], options: [C('Грейж (проект)', '#e4dcd1'), C('Тёплый белый', '#efebe4'), C('Песок', '#dacbb6'), C('Шалфей', '#c9cdbb'), C('Глина', '#cdb8a6')] },
  { id: 'sofa', room: 'living', label: 'Диван-конструктор (букле)', mats: ['sofa'], options: [C('Молочный (проект)', '#ece5d8'), C('Песочный', '#cdbb9f'), C('Серо-бежевый', '#b9b1a5'), C('Оливковый', '#848566'), C('Терракота', '#a8644b')] },
  { id: 'chair_green', room: 'living', label: 'Стулья Fless (велюр)', mats: ['chair_green'], options: [C('Оливковый (проект)', '#5f6a4c'), C('Мох', '#46523a'), C('Карамель', '#a07650'), C('Беж', '#c8b9a3'), C('Графит', '#47484a')] },
  { id: 'k_splash', room: 'living', label: 'Кухонный фартук', mats: ['k_splash'], options: [C('Зелёный мрамор (рендер)', '#ffffff', { map: tx('m_verde') }), C('Grey Cloud (КГ-3)', '#ffffff', { map: tx('m_cloud') }), C('Brown Velvet', '#ffffff', { map: tx('m_velvet') }), C('Неро Маркина', '#ffffff', { map: tx('m_nero') })] },
  { id: 'k_top', room: 'living', label: 'Столешница', mats: ['k_top'], options: [C('Песочный камень (проект)', '#ffffff', { map: tx('m_sand') }), C('Brown Velvet', '#ffffff', { map: tx('m_velvet') }), C('Калакатта', '#ffffff', { map: tx('m_calacatta') }), C('Неро Маркина', '#ffffff', { map: tx('m_nero') })] },
  { id: 'k_cream', room: 'living', label: 'Верхние фасады над мойкой', mats: ['k_cream'], options: [C('Кремовый (проект)', '#e8e1d5'), C('Белый', '#f3f1ec'), C('Шалфей', '#a9b19a'), C('Графит', '#3f4042')] },
  { id: 'lattice', room: 'living', label: 'Перфорированная панель', mats: ['lattice'], options: [C('Белая (проект)', '#efebe4'), C('Песочная', '#d6c8b3'), C('Чёрная', '#262626')] },
  { id: 'curtain', room: 'living', label: 'Шторы и римские шторы', mats: ['curtain', 'blind'], options: [C('Лён натуральный (проект)', '#d8ccbb'), C('Белый лён', '#efebe4'), C('Олива', '#8b8c6c'), C('Графит', '#59595b')] },
  // hall
  { id: 'w_hall', room: 'hall', label: 'Стены и скрытые двери (штукатурка ДШ-1)', mats: ['w_hall', 'door_hall'], options: [C('Бежевая (проект)', '#ddd2c3'), C('Светлая', '#ebe5dc'), C('Тауп', '#b9aa98'), C('Шалфей', '#c3c7b4'), C('Терракота', '#b7826a')] },
  { id: 'pouf_green', room: 'hall', label: 'Пуф Блум', mats: ['pouf_green'], options: [C('Оливковый (проект)', '#5e6650'), C('Молочный', '#e7e0d2'), C('Карамель', '#a37a52')] },
  { id: 'door_entry', room: 'hall', label: 'Входная дверь', mats: ['door_entry'], options: [C('Орех (проект)', '#6e5442'), C('Дуб светлый', '#b99a7a'), C('Графит', '#3a3a3b', { map: null })] },
  // bedroom
  { id: 'w_bed', room: 'bed', label: 'Стены спальни', mats: ['w_bed'], options: [C('Грейж (проект)', '#e1d8cc'), C('Тёплый белый', '#efebe4'), C('Шалфей', '#c7cbb7'), C('Пудра', '#e0cfc6')] },
  { id: 'bed_fabric', room: 'bed', label: 'Кровать Boca Airblade', mats: ['bed_fabric'], options: [C('Светлый лён (проект)', '#ebe5db'), C('Серо-бежевый', '#bdb3a6'), C('Олива', '#7f8165'), C('Графит', '#56575a')] },
  { id: 'throw_olive', room: 'bed', label: 'Плед', mats: ['throw_olive'], options: [C('Олива (проект)', '#8f9171'), C('Терракота', '#a8674c'), C('Песок', '#cbb796'), C('Графит', '#4b4c4e')] },
  { id: 'shelf_green', room: 'bed', label: 'Задник стеллажа', mats: ['shelf_green'], options: [C('Тёмно-оливковый (проект)', '#4f5644'), C('Орех', '#6d5240'), C('Молочный', '#e6dfd3')] },
  // bath
  { id: 'w_bath', room: 'bath', label: 'Стены санузла', mats: ['w_bath'], options: [C('Travertine Pearl Vein (проект)', '#ffffff', { map: tx('travPearl') }), C('Травертин классический', '#ffffff', { map: tx('travertine') }), C('Brown Velvet', '#ffffff', { map: tx('m_velvet') }), C('Калакатта', '#ffffff', { map: tx('m_calacatta') })] },
  { id: 'floor_bath', room: 'bath', label: 'Пол и раковина', mats: ['floor_bath', 'marble_velvet'], options: [C('Brown Velvet (проект)', '#ffffff', { map: tx('m_velvet') }), C('Калакатта', '#ffffff', { map: tx('m_calacatta') }), C('Травертин', '#ffffff', { map: tx('travPearl') }), C('Неро Маркина', '#ffffff', { map: tx('m_nero') })] },
];

export function applyOption(ctrl, idx) {
  const o = ctrl.options[idx];
  for (const k of ctrl.mats) {
    const m = MAT[k]; if (!m) continue;
    if (o.color) m.color.set(o.color);
    const t = 'map' in o ? (typeof o.map === 'function' ? o.map() : o.map) : m.userData.map0;
    if (m.map !== (t || null)) { m.map = t || null; m.needsUpdate = true; }
    m.roughness = o.roughness !== undefined ? o.roughness : m.userData.r0;
    if (m.metalness !== undefined) m.metalness = o.metalness !== undefined ? o.metalness : m.userData.m0;
  }
  if (typeof window !== 'undefined' && window.__bakeMirrors) window.__bakeMirrors(); // mirrors pick up the new finish
}
