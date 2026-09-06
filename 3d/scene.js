/* ------------------------------------------------------------------
   The Journey to Me — the 3D scene.

   A real three-dimensional space: a walnut table, a candle burning at
   the back of it, and the journal lying open in the light.  Nothing here
   is a picture of a book — the covers, the page block and every leaf you
   turn are geometry, and the candle is a light source, so the shadow
   under the book and the shine along the gold are worked out fresh every
   frame from wherever the flame happens to be.

   The page turn is the part worth reading.  A page is not a card that
   flips: it is a strip that bends.  `shapeLeaf` walks along the page from
   the spine to the outer edge, curving a little more with every step,
   and drops each vertex wherever that walk lands it.
------------------------------------------------------------------- */

import * as THREE from 'three';
import { OrbitControls } from './lib/controls/OrbitControls.js';
import { EffectComposer } from './lib/postprocessing/EffectComposer.js';
import { RenderPass } from './lib/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './lib/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './lib/postprocessing/OutputPass.js';
import { buildPages, paintPage, isWritable, dayPage, CLOSING_BUTTON, PAGE_W, PAGE_H } from './pages.js';
import * as cloud from './cloud.js';

/* ------------------------------------------------------------ the book */

const PW = 0.206;                 // page width, metres
const PH = PW * 1.370;            // the straight-on cover's ratio
const OVER = 0.007;               // how far the boards overhang the pages
const CW = PW + OVER, CH = PH + OVER * 2;
const COVER_T = 0.005;            // board thickness
const BLOCK_T = 0.030;            // the whole page block

const PAGES = buildPages();
const NLEAF = (PAGES.length - 1) / 2;
const LEAF_T = BLOCK_T / NLEAF;

const SPINE_Y = COVER_T + BLOCK_T / 2;      // the hinge line, mid-height
const COVER_OFF = (COVER_T + BLOCK_T) / 2;  // board's offset from that hinge

const STORE = 'journey-to-me-3d';

// One real candle, roughly a candela, thirty centimetres from the book.  Every
// other light in the scene is a fraction of it.
const CANDLE = 1.9;

/* --------------------------------------------------------------- state */

const state = {
  coverOpen: 0,          // 0 closed, 1 open
  leaf: 0,               // leaves already turned
  turn: null,            // {from, to, t, dir, leaf}
  entries: JSON.parse(localStorage.getItem(STORE) || '{}'),
  focus: null,
  caretOn: true,
  ready: false,
  side: 1                // -1 left page, +1 right — only used one page at a time
};

/* ------------------------------------------------------------ renderer */

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.10;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0406);
scene.fog = new THREE.FogExp2(0x0d0507, 1.35);

const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 12);
/* Almost straight down. "A straight look at the pages" means looking square at
   them, so they read as rectangles rather than as a raking, foreshortened
   perspective — the 10 degrees that are left keep a sliver of the page block
   visible, so it still reads as a real book with thickness. */
camera.position.set(0, 0.500, 0.088);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.030, 0.000);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 0.28;
controls.maxDistance = 1.10;
/* One fixed look at the book, and no swinging about.

   This started with a free orbit, was narrowed to a downward-only arc, and the
   client has now asked for it to stop moving altogether: "just a straight
   look". So rotation is off entirely. Zoom stays — she still wants to be able
   to get closer, especially on a phone.

   The limits are left in place rather than deleted. They are what keeps the
   camera honest if rotation is ever turned back on, and OrbitControls still
   consults them when it clamps a programmatic move. */
controls.enableRotate = false;
controls.minPolarAngle = 0.05;
controls.maxPolarAngle = 1.02;
controls.minAzimuthAngle = -1.05;
controls.maxAzimuthAngle = 1.05;
controls.rotateSpeed = 0.55;

/* ------------------------------------------------------------ textures */

const loader = new THREE.TextureLoader();
let pending = 0;
function tex(url, srgb, repeat) {
  pending++;
  const t = loader.load(url, () => { if (--pending === 0) state.ready = true; },
    undefined, () => { if (--pending === 0) state.ready = true; });
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

const woodMap = tex('assets/wood.webp', true, 3);
const woodNrm = tex('assets/wood_n.webp', false, 3);
const woodRgh = tex('assets/wood_r.webp', false, 3);
const leatherNrm = tex('assets/leather_n.webp', false, 3);
const leatherRgh = tex('assets/leather_r.webp', false, 3);
const coverMap = tex('../assets/cover.webp', true);
const petalMaps = [1, 2, 3, 4, 5, 6].map(n => tex(`assets/petal${n}.webp`, true));
const petalNrm = tex('assets/petal_n.webp', false);

// The paper and cover bitmaps are also wanted as plain images, for painting
// pages onto 2D canvases.
const paperImg = new Image(); paperImg.src = '../assets/paper.webp';
const coverImg = new Image(); coverImg.src = '../assets/cover.webp';

/* Fine horizontal lines, so the cut edge of the page block reads as paper
   rather than as a cream-coloured brick. */
function edgeTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#e6d8bd';
  x.fillRect(0, 0, 4, 512);
  for (let i = 0; i < 512; i += 2) {
    x.fillStyle = `rgba(120,96,64,${0.10 + Math.random() * 0.20})`;
    x.fillRect(0, i, 4, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const edgeMap = edgeTexture();

/* ------------------------------------------------------- page textures */

/* Only six or seven page faces can be on screen at once, so six or seven
   canvases are kept and recycled.  Painting all ninety would cost a few
   hundred megabytes of texture memory for nothing. */
const POOL = 8;
const pool = [];
const live = new Map();        // page index -> pool slot
let clock = 0;

for (let i = 0; i < POOL; i++) {
  const c = document.createElement('canvas');
  c.width = PAGE_W; c.height = PAGE_H;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  pool.push({ canvas: c, ctx: c.getContext('2d'), tex: t, idx: -1, used: -1 });
}

function paint(slot, idx) {
  paintPage(slot.ctx, PAGES[idx], {
    paperImg, coverImg,
    entries: state.entries,
    caretOn: state.caretOn,
    focus: state.focus
  });
  slot.tex.needsUpdate = true;
}

function pageTexture(idx) {
  if (idx < 0 || idx >= PAGES.length) return null;
  let slot = live.get(idx);
  if (!slot) {
    slot = pool.reduce((a, b) => (a.used <= b.used ? a : b));
    if (slot.idx >= 0) live.delete(slot.idx);
    slot.idx = idx;
    live.set(idx, slot);
    paint(slot, idx);
  }
  slot.used = ++clock;
  return slot.tex;
}

function repaint(idx) {
  const slot = live.get(idx);
  if (slot) paint(slot, idx);
}

/* ---------------------------------------------------------- the table */

const table = new THREE.Mesh(
  new THREE.BoxGeometry(2.4, 0.05, 1.5),
  new THREE.MeshStandardMaterial({
    map: woodMap, normalMap: woodNrm, roughnessMap: woodRgh,
    roughness: 1, metalness: 0,
    normalScale: new THREE.Vector2(0.32, 0.32)
  })
);
table.position.y = -0.025;
table.receiveShadow = true;
scene.add(table);

/* Something dark behind the table so the petals and the dust have a wall to
   fall against, rather than fading into the clear colour. */
const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 3),
  new THREE.MeshStandardMaterial({ color: 0x2a0f14, roughness: 1, metalness: 0 })
);
backdrop.position.set(0, 0.9, -1.05);
scene.add(backdrop);

/* ------------------------------------------------------------- lights */

const warmAmbient = new THREE.AmbientLight(0x4a2218, 0.30);
scene.add(warmAmbient);

/* The flame: two crossed billboards with a soft additive gradient, so it has
   some body from every angle without needing a particle system. */
function flameTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 78, 2, 64, 70, 60);
  g.addColorStop(0.00, 'rgba(255,255,246,1)');
  g.addColorStop(0.22, 'rgba(255,224,150,0.95)');
  g.addColorStop(0.52, 'rgba(255,150,44,0.55)');
  g.addColorStop(1.00, 'rgba(120,40,0,0)');
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(64, 72, 30, 56, 0, 0, 7);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const flameMat = new THREE.MeshBasicMaterial({
  map: flameTexture(), transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.95
});

const waxMat = new THREE.MeshStandardMaterial({
  color: 0xf2e2c4, roughness: 0.5, metalness: 0,
  emissive: 0xa85c1c, emissiveIntensity: 0.16       // wax glows from within
});
const brassMat = new THREE.MeshStandardMaterial({
  color: 0x9a6a2a, roughness: 0.34, metalness: 0.85
});

// What the shadow-casting spot points at: the book, at the origin.
const aim = new THREE.Object3D();
aim.position.set(0, 0.02, 0);
scene.add(aim);

/* A candle has to stand taller than the book, or it lights nothing but the
   fore edge — which is exactly how the first pass of this scene went wrong. */
function makeCandle(h, r, power, shadows) {
  const g = new THREE.Group();

  const dish = new THREE.Mesh(new THREE.CylinderGeometry(r * 2.1, r * 2.4, 0.006, 30), brassMat);
  dish.position.y = 0.003;
  dish.castShadow = false;
  dish.receiveShadow = true;
  g.add(dish);

  const wax = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, h, 28), waxMat);
  wax.position.y = 0.006 + h / 2;
  wax.castShadow = false;
  wax.receiveShadow = true;
  g.add(wax);

  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0011, 0.0011, 0.009, 6),
    new THREE.MeshStandardMaterial({ color: 0x140d08, roughness: 1 })
  );
  wick.position.y = 0.006 + h + 0.003;
  g.add(wick);

  const flame = new THREE.Group();
  flame.position.y = 0.006 + h + 0.019;
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.019, 0.033), flameMat);
    m.rotation.y = i * Math.PI / 2;
    flame.add(m);
  }
  g.add(flame);

  const light = new THREE.PointLight(0xffb474, power * (shadows ? 0.45 : 1), 4, 2);
  light.position.y = flame.position.y;
  g.add(light);

  scene.add(g);
  const c = { group: g, flame, light, power, spot: null };

  /* Shadows come from a spot, not from the point light.

     A shadow-casting point light renders a cube map, and the seam between two
     of its faces fell straight down the open page as a hard vertical line —
     half the spread a stop darker than the other half, with a crisp edge.  A
     spot has one map and no seams, and aimed from the flame it throws the
     same shadow. */
  if (shadows) {
    const spot = new THREE.SpotLight(0xffb474, power * 0.80, 4, 1.20, 0.62, 2);
    spot.position.copy(light.position);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.0009;
    spot.shadow.normalBias = 0.0035;
    spot.shadow.camera.near = 0.02;
    spot.shadow.camera.far = 2.0;
    spot.shadow.focus = 1;
    g.add(spot);
    spot.target = aim;
    c.spot = spot;
  }
  return c;
}

// The tall one at the back right does the work, and casts the shadow.
const candle = makeCandle(0.205, 0.0135, CANDLE, true);
candle.group.position.set(0.395, 0, -0.315);

// A shorter one back left, so the far edge of the book is not a silhouette.
const candle2 = makeCandle(0.140, 0.0125, CANDLE * 0.46, false);
candle2.group.position.set(-0.375, 0, -0.335);

const candles = [candle, candle2];

// Warmth from off-frame, low and to the front — a hearth, or the rest of the
// room.  It only exists to stop the near edge going to pure black.
const hearth = new THREE.PointLight(0xff7a34, 0.30, 2.6, 2);
hearth.position.set(-0.44, 0.17, 0.52);
scene.add(hearth);

// A rose-coloured rim from behind the book — the only light here that is not
// candle-orange, and the reason a falling petal reads against the dark.
const rim = new THREE.PointLight(0xff3d78, 0.58, 1.9, 2);
rim.position.set(-0.06, 0.30, -0.52);
scene.add(rim);

// A whisper from the front, so the cut edge of the page block is paper rather
// than a black slot.
const front = new THREE.PointLight(0xffc190, 0.075, 1.6, 2);
front.position.set(0.02, 0.115, 0.42);
scene.add(front);

// And a low bounce off the table itself, keeping the undersides alive.
const bounce = new THREE.PointLight(0xff8a3c, 0.028, 1.3, 2);
bounce.position.set(0.04, 0.015, 0.14);
scene.add(bounce);

/* ------------------------------------------------- the daylight sky rig

   The client asked for a light blue sky with clouds on the storybook version,
   then chose this one.  Rather than guess which she wants here, the scene is
   built twice and switched: the candlelit table above, and below a daytime sky
   with the book resting on a sea of cloud.

   Everything is generated, not photographed — the same sky and cloud plates the
   storybook version uses.  A photographed sky brings its own sun with it, and
   the moment the book's shadow disagrees with that sun the whole thing reads as
   a cut-out. */

const dayRig = new THREE.Group();
dayRig.visible = false;
scene.add(dayRig);

const skyMap    = tex('../assets/sky.webp', true);
const cloudFar  = tex('../assets/clouds-far.webp', true);
const cloudNear = tex('../assets/clouds-near.webp', true);
const cloudSeaMap = tex('../assets/clouds-sea.webp', true);
cloudSeaMap.wrapS = cloudSeaMap.wrapT = THREE.RepeatWrapping;
// 14m of plane. At 11 tiles the whole visible foreground was a quarter of one
// puff, which renders as flat card; 48 puts a cloud top at roughly two thirds
// the width of the book, which is the scale that reads as a cloud sea.
cloudSeaMap.repeat.set(48, 48);
cloudFar.wrapS  = THREE.RepeatWrapping;  cloudFar.repeat.set(4, 1);
cloudNear.wrapS = cloudNear.wrapT = THREE.RepeatWrapping;
cloudNear.repeat.set(4, 1);

/* The dome. BackSide, unlit, and NOT tone mapped.
   ACES is doing the right thing to the leather and the paper, but run a flat
   sky colour through it and the blue comes back as grey — the camera only ever
   sees the pale band near the horizon, which is exactly the part ACES
   desaturates hardest. A sky is the light in the scene, not a surface lit by
   it, so it opts out. */
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(7, 40, 24),
  new THREE.MeshBasicMaterial({
    map: skyMap, side: THREE.BackSide, fog: false, toneMapped: false
  })
);
dayRig.add(skyDome);

/* ...except it cannot actually opt out.  ACES is applied by the OutputPass to
   the WHOLE FRAME, so a per-material `toneMapped: false` never reaches it, and
   the curve desaturates hardest exactly where a sky lives — up near white.
   Measured against the flat 2D version of this very same plate, the dome was
   coming back with 18% of its saturation: a sunny afternoon rendered as an
   overcast one.

   Boosting the blue does not fix it — pushed six times over, saturation still
   only reached 0.18 against the 2D sky's 0.27, because ACES compresses every
   channel towards white at that brightness.  Bringing the exposure down does
   reach it, at the cost of dimming the pages, which is not a trade worth making.

   So the sky is written PRE-COMPENSATED: the exact inverse of the tone curve is
   applied here, and the OutputPass's ACES then undoes it, leaving the plate on
   screen exactly as painted.  The matrices are the inverses of three's own, and
   the round trip is exact to four decimal places on real colours.  This is what
   `toneMapped: false` was asking for and could not have. */
const skyExposure = { value: 0.92 };

const SKY_GLSL = `uniform float uExposure;

vec3 invRRTAndODTFit(vec3 y) {
  vec3 A = vec3(1.0) - 0.983729 * y;
  vec3 B = vec3(0.0245786) - 0.432951 * y;
  vec3 C = -(vec3(0.000090537) + 0.238081 * y);
  vec3 disc = max(vec3(0.0), B * B - 4.0 * A * C);
  return (-B + sqrt(disc)) / (2.0 * A);
}

vec3 unACES(vec3 c) {
  const mat3 InvOutput = mat3(
    vec3( 0.643038,  0.059269,  0.005962),
    vec3( 0.311187,  0.931436,  0.063929),
    vec3( 0.045775,  0.009295,  0.930118));
  const mat3 InvInput = mat3(
    vec3( 1.764741, -0.147028, -0.036337),
    vec3(-0.675778,  1.160252, -0.162436),
    vec3(-0.088963, -0.013224,  1.198773));
  vec3 v = InvOutput * clamp(c, vec3(0.0), vec3(0.99));
  v = invRRTAndODTFit(v);
  v = InvInput * v;
  return max(vec3(0.0), v) * (0.6 / max(0.0001, uExposure));
}
`;

function unToneMap(material) {
  material.onBeforeCompile = sh => {
    sh.uniforms.uExposure = skyExposure;
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', SKY_GLSL + '\nvoid main() {')
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb = unACES(diffuseColor.rgb);`);
  };
  material.needsUpdate = true;
}
unToneMap(skyDome.material);

/* The same trick for a LIT surface, and it has to be injected somewhere else.
   `map_fragment` runs before the lighting and before the fog, so compensating
   there would leave both to be crushed by the curve anyway. The very end of the
   shader is after all three, so what is compensated is the pixel as it will
   actually appear. */
function unToneMapLit(material) {
  material.onBeforeCompile = sh => {
    sh.uniforms.uExposure = skyExposure;
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', SKY_GLSL + '\nvoid main() {')
      .replace('#include <dithering_fragment>',
               '#include <dithering_fragment>\n  gl_FragColor.rgb = unACES(gl_FragColor.rgb);');
  };
  material.needsUpdate = true;
}

/* A band of cloud around the horizon rather than a full sphere: the plate's
   alpha closes at its own top and bottom, so wrapped over a whole dome it would
   leave a bare ring of sky at the zenith. */
const cloudBand = new THREE.Mesh(
  new THREE.SphereGeometry(6.4, 40, 20, 0, Math.PI * 2, 0.62, 0.76),
  new THREE.MeshBasicMaterial({
    map: cloudFar, side: THREE.BackSide, transparent: true,
    depthWrite: false, fog: false, toneMapped: false, opacity: 0.95
  })
);
unToneMap(cloudBand.material);
dayRig.add(cloudBand);

/* What the book rests on. Fog is what sells it: the plane runs out to 14m, and
   without fog its far edge is a hard horizon line across the sky. */
const seaGeom = new THREE.PlaneGeometry(14, 14, 90, 90);
{
  /* Roll the surface gently, or it is a printed carpet rather than cloud. The
     displacement is damped to nothing within 0.45m of the origin, because the
     book has to lie flat on it — a book resting on a slope reads as a mistake
     long before it reads as weather. */
  const p = seaGeom.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const r = Math.hypot(x, y);
    const damp = Math.min(1, Math.max(0, (r - 0.32) / 0.7));
    const h = Math.sin(x * 9.1) * Math.cos(y * 7.7) * 0.012
            + Math.sin(x * 3.3 + 1.7) * Math.sin(y * 2.9) * 0.030
            + Math.sin(x * 1.1 + 0.6) * Math.cos(y * 0.9) * 0.055;
    p.setZ(i, h * damp);
  }
  seaGeom.computeVertexNormals();
}
/* The tint is the whole difference between a sunny day and an overcast one.
   Looking almost straight down, the sky DOME is never actually in shot — hiding
   it changes not one pixel — so what surrounds the book is this cloud floor, and
   its plate is white cloud. White cloud, lit white, reads as overcast however
   blue the sky above it is. Tinting it towards the sky's own blue is what puts
   the weather back: measured against the flat 2D version the client asked me to
   match, this lands at 0.25 saturation against its 0.27, where the untinted
   floor managed 0.04, and with the emissive below, 0.95 brightness against its
   0.95 — the daylight now measures as the same weather. */
const cloudSea = new THREE.Mesh(
  seaGeom,
  new THREE.MeshStandardMaterial({
    map: cloudSeaMap, color: 0xa5cdf0, roughness: 1, metalness: 0,
    bumpMap: cloudSeaMap, bumpScale: 0.5,
    /* Tint alone could not do it. A tint MULTIPLIES, so every bit of colour it
       added cost brightness, and the client's second note was exactly that —
       bluer, but duller than the 2D version. The emissive puts the light back
       without taking the colour away, and because this surface is written
       pre-compensated it is not squeezed by the tone curve on the way out. It
       carries the cloud plate as its own map, or the added light is flat and
       washes the cloud tops out of the picture. */
    emissive: 0xa5cdf0, emissiveMap: cloudSeaMap, emissiveIntensity: 0.45
  })
);
cloudSea.rotation.x = -Math.PI / 2;
cloudSea.position.y = -0.004;
cloudSea.receiveShadow = true;
unToneMapLit(cloudSea.material);
dayRig.add(cloudSea);

/* Sky above, warm bounce below. The sky half was a cold blue and the ground
   half plain white, which is why the leather and the paper came out cool. */
const skyAmbient = new THREE.HemisphereLight(0xeaf3ff, 0xffe4c2, 0.80);
dayRig.add(skyAmbient);

// One sun, high and a little to the left, matching the glow painted into the
// sky plate — so the book's shadow falls the way the sky says it should.
const sun = new THREE.DirectionalLight(0xffeccb, 2.15);
sun.position.set(-0.62, 1.35, 0.52);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.0030;
sun.shadow.camera.near = 0.05;
sun.shadow.camera.far = 4;
sun.shadow.camera.left = -0.6;
sun.shadow.camera.right = 0.6;
sun.shadow.camera.top = 0.6;
sun.shadow.camera.bottom = -0.6;
dayRig.add(sun);
dayRig.add(sun.target);

// A cool fill from the opposite side, so the shaded board is sky-blue rather
// than black — outdoors, the shadow side is lit by the sky itself.
/* Sky light on the shaded side is genuinely blue, but at 0.55 of a saturated
   blue it was tinting the whole book. Softer, and much paler. */
const skyFill = new THREE.DirectionalLight(0xdce9f6, 0.30);
skyFill.position.set(0.75, 0.45, -0.55);
dayRig.add(skyFill);

/* ------------------------------------------------------- switching rigs */

const candleRig = [table, backdrop, warmAmbient, candle.group, candle2.group,
                   hearth, rim, front, bounce];

const MODE_KEY = 'journey-to-me-3d-mode';
/* Daylight is what a first-time reader sees. Anyone who has chosen candlelight
   before still gets candlelight — the stored choice wins over the default. */
let mode = localStorage.getItem(MODE_KEY) === 'candle' ? 'candle' : 'day';

const CANDLE_BG = new THREE.Color(0x0a0406);
const candleFog = new THREE.FogExp2(0x0d0507, 1.35);
// The fog has to be the colour of the sky where it meets the cloud sea, or the
// far edge of the sea shows up as a band of the wrong blue along the horizon.
/* Density is a balance, not a taste: FogExp2 fades by 1 - exp(-(density*d)^2),
   so at 0.95 the book itself — only 0.6m away — was 28% hazed. At 0.62 the book
   keeps 87% of itself while the cloud sea is 80% gone by two metres, which is
   what puts blue sky behind it instead of a floor of cloud to the horizon. */
const dayFog    = new THREE.FogExp2(0x8dc2ef, 0.62);

function setMode(next) {
  mode = next === 'day' ? 'day' : 'candle';
  const day = mode === 'day';

  candleRig.forEach(o => { o.visible = !day; });
  dayRig.visible = day;

  // In daylight the dome IS the background, and it is drawn without tone
  // mapping — leaving a background colour behind it only risks a mismatch
  // showing through at the poles.
  scene.background = day ? null : CANDLE_BG;
  scene.fog = day ? dayFog : candleFog;

  /* THE light blue overlay. Fog is applied by DISTANCE to everything in the
     scene, and the book is half a metre away, so roughly a tenth of sky blue
     was being washed straight over the cover and the pages — exactly the
     "overlay" the client could see and I could not name.

     The fog is there for the cloud sea, which needs to fade into the sky. So
     the book opts out of it in daylight, and keeps it in candlelight, where
     fading into the dark is the whole effect. */
  book.traverse(o => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach(m => {
      if (m && m.fog !== undefined && m.fog === day) { m.fog = !day; m.needsUpdate = true; }
    });
  });

  // Bloom that reads as candleglow against black turns a bright sky to milk.
/* Zero in daylight, not 0.10: the sky is written pre-compensated and so
     carries linear values far above 1.0, which sail past any bloom threshold
     and put a haze back over the very thing this is meant to keep crisp. */
  bloom.strength = day ? 0.0 : 0.34;
  bloom.threshold = day ? 0.94 : 0.86;
  /* ACES is applied by the OutputPass, to the whole frame — a per-material
     toneMapped:false never reaches it. So the sky cannot opt out, and the only
     way to keep it blue rather than grey is to sit it lower on the curve:
     drop the exposure and put the light back with the sun and the sky fill.
     At 1.10 the sky came out the colour of wet concrete. */
  /* 1.12 rather than 0.92 in daylight: she asked for the sunlight to reach the
     BOOK as well, not just the sky. The pages go from 0.834 to 0.867 and keep
     their warmth at 0.29 saturation. Candlelight is deliberately untouched. */
  renderer.toneMappingExposure = day ? 1.12 : 1.10;
  skyExposure.value = renderer.toneMappingExposure;

  // Petals lit for a candle are nearly black in daylight, and the stardust is
  // a warm glow that only exists because the room is dark.
  petals.forEach(p => { p.material.emissiveIntensity = day ? 0.06 : 0.30; });
  dustMat.uniforms.uDay.value = day ? 1 : 0;

  document.body.classList.toggle('day', day);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', day ? '#a8d2f5' : '#0a0406');
  const line = document.getElementById('bootLine');
  if (line) line.textContent = day ? 'opening the sky' : 'lighting the candle';

  modeCandleBtn.classList.toggle('on', !day);
  modeDayBtn.classList.toggle('on', day);
  localStorage.setItem(MODE_KEY, mode);
  reframe();
}

/* ------------------------------------------------------------ the book */

const book = new THREE.Group();
scene.add(book);

const leatherMat = new THREE.MeshStandardMaterial({
  color: 0x4a1220, roughness: 1, metalness: 0.04,
  normalMap: leatherNrm, roughnessMap: leatherRgh,
  normalScale: new THREE.Vector2(0.7, 0.7)
});
/* The inside of the boards.  When the book is open this is half of what you
   are looking at, and a flat colour there reads as an unfinished model. */
function endpaperTexture() {
  const c = document.createElement('canvas');
  c.width = 620; c.height = 828;
  const x = c.getContext('2d');
  x.fillStyle = '#5c1526';
  x.fillRect(0, 0, 620, 828);

  // Marbled paper: overlapping soft blooms, no two the same.
  for (let i = 0; i < 260; i++) {
    const px = Math.random() * 620, py = Math.random() * 828;
    const r = 18 + Math.random() * 90;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    const warm = Math.random() > 0.45;
    g.addColorStop(0, warm ? 'rgba(140,32,54,0.24)' : 'rgba(46,8,20,0.24)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }

  x.strokeStyle = 'rgba(196,152,84,0.62)';
  x.lineWidth = 3;
  x.strokeRect(42, 42, 620 - 84, 828 - 84);
  x.lineWidth = 1;
  x.strokeRect(52, 52, 620 - 104, 828 - 104);

  x.fillStyle = 'rgba(214,172,98,0.72)';
  x.textAlign = 'center';
  x.font = 'italic 34px Didot,"Bodoni MT",Georgia,serif';
  x.fillText('The Journey to Me', 310, 424);
  x.save();
  x.translate(310, 456);
  x.rotate(Math.PI / 4);
  x.fillRect(-5, -5, 10, 10);
  x.restore();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const endpaperMat = new THREE.MeshStandardMaterial({
  map: endpaperTexture(), roughness: 0.95, metalness: 0
});

const flippedEndpaper = endpaperTexture();
flippedEndpaper.center.set(0.5, 0.5);
flippedEndpaper.rotation = Math.PI;
const endpaperFlippedMat = new THREE.MeshStandardMaterial({
  map: flippedEndpaper, roughness: 0.95, metalness: 0
});
const coverArtMat = new THREE.MeshStandardMaterial({
  map: coverMap, roughness: 0.62, metalness: 0.22,
  normalMap: leatherNrm, normalScale: new THREE.Vector2(0.35, 0.35)
});

function board() {
  const g = new THREE.BoxGeometry(CW, COVER_T, CH);
  const m = new THREE.Mesh(g, [
    leatherMat, leatherMat, coverArtMat, endpaperFlippedMat, leatherMat, leatherMat
  ]);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Back board — never moves.  The pages sit on it.
const backBoard = board();
backBoard.material = [leatherMat, leatherMat, endpaperMat, leatherMat, leatherMat, leatherMat];
backBoard.position.set(CW / 2, COVER_T / 2, 0);
book.add(backBoard);

// Front board — hinges about the spine and swings all the way over.
const coverPivot = new THREE.Group();
coverPivot.position.set(0, SPINE_Y, 0);
book.add(coverPivot);
const frontBoard = board();
frontBoard.position.set(CW / 2, COVER_OFF, 0);
coverPivot.add(frontBoard);

// The spine, which stands tall when the book is shut and folds into the
// gutter as it opens.
const spine = new THREE.Mesh(new THREE.BoxGeometry(1, 1, CH), leatherMat);
spine.castShadow = spine.receiveShadow = true;
book.add(spine);

// The two stacks of pages.  Boxes, scaled every frame as leaves move across.
const blockMat = new THREE.MeshStandardMaterial({
  map: edgeMap, color: 0xcdbb9c, roughness: 0.96, metalness: 0
});
edgeMap.repeat.set(1, 24);

function stack() {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), blockMat);
  m.castShadow = m.receiveShadow = true;
  book.add(m);
  return m;
}
const stackR = stack(), stackL = stack();

/* --------------------------------------------------------------- leaves */

const SEG_X = 48, SEG_Z = 8;

function leafGeometry() {
  const g = new THREE.PlaneGeometry(1, 1, SEG_X, SEG_Z);
  g.rotateX(-Math.PI / 2);           // lie flat, front face up
  return g;
}

function leafMeshes(geom) {
  // The emissive colour is fixed here rather than assigned later: changing a
  // colour is a uniform update, but introducing one to a material that had
  // none forces the shader to be rebuilt, and that stutters mid-turn.
  const opts = {
    roughness: 0.93, metalness: 0,
    emissive: new THREE.Color(0xffcf9a), emissiveIntensity: 0
  };
  const front = new THREE.Mesh(geom, new THREE.MeshStandardMaterial(
    { ...opts, side: THREE.FrontSide }));
  const back = new THREE.Mesh(geom, new THREE.MeshStandardMaterial(
    { ...opts, side: THREE.BackSide }));
  front.castShadow = back.castShadow = true;
  front.receiveShadow = back.receiveShadow = true;
  book.add(front); book.add(back);
  return { geom, front, back };
}

const topR = leafMeshes(leafGeometry());   // the right-hand page you are reading
const topL = leafMeshes(leafGeometry());   // the left-hand page
const flying = leafMeshes(leafGeometry()); // the one in the air, mid-turn

/* Shape one leaf.

   `phi` is how far it has swung: 0 lying on the right, PI lying on the left.
   The leaf is walked from the spine outwards in SEG_X steps.  At each step the
   direction of travel has turned a little further — that accumulating turn is
   the whole trick, and it is why the page bows up off the stack in the middle
   of a turn and then settles flat at either end instead of scything through
   the paper below it.

   `lift` is the height difference between where the leaf starts and where it
   lands; it rides around the hinge with the leaf so the ends line up exactly
   with the two stacks. */
const BEND = 1.22;
/* How deeply a resting page dips into the gutter.  This has to stay smaller
   than the clearance between the page and the block beneath it — at 7.5mm the
   page sank into the block near the spine and the block's cream top face
   showed through, which read as a hard vertical band down the middle of every
   spread and looked exactly like a shadow bug. */
const GUTTER = 0.0022;
const LIE = 0.0006;              // how far a resting page floats above its stack

function shapeLeaf(obj, phi, pivotY, lift, t) {
  const pos = obj.geom.attributes.position;
  const uv = obj.geom.attributes.uv;
  const sinP = Math.sin(phi), cosP = Math.cos(phi);
  const K = BEND * sinP;

  // Walk the page: integrate the direction of travel along its length.
  const N = SEG_X;
  const xs = new Float32Array(N + 1), ys = new Float32Array(N + 1);
  let ax = 0, ay = 0;
  for (let i = 1; i <= N; i++) {
    const s = (i - 0.5) / N;
    const th = phi + K * Math.pow(s, 1.25);
    ax += Math.cos(th) / N;
    ay += Math.sin(th) / N;
    xs[i] = ax; ys[i] = ay;
  }

  const droop = GUTTER * cosP * cosP;
  const ripple = 0.0028 * sinP;

  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    const k = Math.min(N, Math.round(u * N));
    const z = (0.5 - v) * PH;

    let x = xs[k] * PW - lift * sinP;
    let y = pivotY + ys[k] * PW + lift * cosP;

    y -= droop * Math.exp(-u * 6.5);                       // pages dip into the gutter
    y += ripple * Math.sin(u * Math.PI) * Math.cos(v * 7.0 + t * 1.7);

    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  obj.geom.computeVertexNormals();
  obj.geom.computeBoundingSphere();
}

/* ---------------------------------------------------------- petals */

function petalGeometry() {
  const g = new THREE.PlaneGeometry(1, 1, 8, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    // A saddle, so a petal never looks like a sticker even edge-on.
    p.setZ(i, (x * x * 0.9 - y * y * 0.45) * 0.34);
  }
  g.computeVertexNormals();
  return g;
}
const petalGeom = petalGeometry();

/* "No floating flowers on the page", and the camera now looks almost straight
   DOWN at the book, framed tight on it.  Those two facts together decide
   everything here, and the first attempt got both wrong.

   Straight down, a petal falling vertically travels along the view axis: it
   grows a little and goes nowhere on screen.  The client's reading was exactly
   right — "it looks like they are no longer moving".  Falling is not motion any
   more; only movement ACROSS the frame is.

   And the frame is cropped so close that there is barely any world space
   outside the book that is on screen at all — measured, the visible table at
   page height is about as wide as the book itself.  Choosing world coordinates
   and hoping they land in the margin put all twenty-six of them off screen.

   So a petal is positioned in SCREEN space and unprojected back into the world
   at a chosen depth.  "Not in front of the book" is a statement about the
   screen, so that is where it should be enforced: each petal is given a channel
   beside the book's own screen rectangle and never leaves it.  This holds at
   any window shape, in portrait, in single-page mode and at any zoom, because
   the rectangle is measured every frame rather than assumed. */

/* Seen from almost overhead the book is a flat rectangle, so its silhouette is
   its TOP face — the underside projects inside the top and never widens it.
   Four corners, at the open extent and a little above the page surface so a
   leaf in mid-turn is covered.  Using all eight corners of a tall box instead
   inflated the rectangle by about a fifth and swallowed the very margins the
   petals have to live in. */
const BOOK_TOP_Y = 0.052;
const BOOK_CORNERS = [
  new THREE.Vector3(-CW, BOOK_TOP_Y, -CH / 2),
  new THREE.Vector3( CW, BOOK_TOP_Y, -CH / 2),
  new THREE.Vector3(-CW, BOOK_TOP_Y,  CH / 2),
  new THREE.Vector3( CW, BOOK_TOP_Y,  CH / 2)
];

const CHANNELS = ['top', 'left', 'right'];

function petalStart(i) {
  /* Top first: the band above the pages is the widest clear strip and the one
     a reader actually looks at.  The sides carry the rest. */
  const lane = CHANNELS[i % 3 === 0 ? 1 + (i % 2) : 0];
  return {
    lane,
    along: Math.random(),                      // where it is along its channel
    band: 0.18 + Math.random() * 0.64,         // where across the channel's width
    speed: (Math.random() < 0.5 ? -1 : 1) * (0.055 + Math.random() * 0.085),
    depth: 0.55 + Math.random() * 0.30,        // metres from the camera
    swayAmp: 0.010 + Math.random() * 0.018,    // in screen heights
    sway: 0.4 + Math.random() * 1.5,
    phase: Math.random() * 9,
    spin: (Math.random() - 0.5) * 1.7,
    tumble: 0.6 + Math.random() * 1.6
  };
}

const petals = [];
for (let i = 0; i < 20; i++) {
  const m = new THREE.Mesh(petalGeom, new THREE.MeshStandardMaterial({
    map: petalMaps[i % petalMaps.length],
    normalMap: petalNrm, normalScale: new THREE.Vector2(0.5, 0.5),
    transparent: true, alphaTest: 0.42, side: THREE.DoubleSide,
    roughness: 0.62, metalness: 0,
    emissive: 0x8c1230, emissiveIntensity: 0.30
  }));
  const sc = 0.007 + Math.random() * 0.007;
  m.scale.set(sc, sc * 1.25, sc);
  m.userData = petalStart(i);
  m.castShadow = false;
  scene.add(m);
  petals.push(m);
}

/* There used to be nine more lying on the table, so it would not look freshly
   swept.  They never moved — the whole point, and fine when the camera could be
   anywhere.  Fixed almost overhead and this close in, one sits just behind the
   book and reads as a sticker somebody forgot to animate.  They are gone. */

/* ---- where the book is, in pixels, this frame ---- */
const bookRect = { x0: 0, x1: 0, y0: 0, y1: 0, ok: false };
const _v = new THREE.Vector3();

function measureBook() {
  const el = renderer.domElement;
  const w = el.clientWidth || 1, h = el.clientHeight || 1;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of BOOK_CORNERS) {
    _v.copy(c).project(camera);
    /* A corner behind the camera projects to a mirrored, meaningless point.
       Widening to the whole frame is the safe reading of that. */
    if (_v.z > 1) { x0 = 0; x1 = w; y0 = 0; y1 = h; break; }
    const px = (_v.x * 0.5 + 0.5) * w, py = (-_v.y * 0.5 + 0.5) * h;
    if (px < x0) x0 = px; if (px > x1) x1 = px;
    if (py < y0) y0 = py; if (py > y1) y1 = py;
  }
  bookRect.x0 = x0; bookRect.x1 = x1; bookRect.y0 = y0; bookRect.y1 = y1;
  bookRect.ok = true;
  return { w, h };
}

const _dir = new THREE.Vector3();

function placePetal(p, t, dt) {
  const d = p.userData;
  const el = renderer.domElement;
  const w = el.clientWidth || 1, h = el.clientHeight || 1;
  const tanHalf = Math.tan(camera.fov * Math.PI / 360);

  // Half the petal's diagonal — its true reach, whatever way it is tumbling.
  const worldR = p.scale.y * 0.64;
  const rAt = depth => (worldR / (2 * depth * tanHalf)) * h;

  d.along += d.speed * dt;
  if (d.along > 1.12) d.along = -0.12;
  if (d.along < -0.12) d.along = 1.12;

  /* How much clear screen each channel has beside the book.  Which channels
     exist at all depends entirely on the window: on a wide desktop the book
     runs off the top of the frame and the band above it is simply not there,
     while in portrait the sides are gone instead.  A petal born into a channel
     that does not exist would just never be drawn — which is how fifteen of the
     twenty-two silently disappeared — so it moves to one that does. */
  const rooms = {
    top: bookRect.y0,
    left: bookRect.x0,
    right: w - bookRect.x1
  };
  const pad = h * 0.012;
  const minRoom = 2 * rAt(1.8) + pad;
  if (rooms[d.lane] < minRoom) {
    let best = d.lane, bestRoom = rooms[d.lane];
    for (const k of CHANNELS) if (rooms[k] > bestRoom) { best = k; bestRoom = rooms[k]; }
    if (bestRoom < minRoom) { p.visible = false; return; }
    // It was not being drawn anyway, so re-entering from the edge cannot jump.
    d.lane = best;
    d.along = d.speed > 0 ? -0.12 : 1.12;
  }
  const room = rooms[d.lane];
  let depth = d.depth;
  let r = rAt(depth);
  if (2 * r + pad > room) {
    const want = Math.max(3, (room - pad) / 2);
    depth = Math.min(1.8, worldR / (2 * want * tanHalf) * h);
    r = rAt(depth);
  }
  if (r < 3.5 || 2 * r + pad > room) { p.visible = false; return; }

  const swayPx = Math.sin(t * d.sway + d.phase) * d.swayAmp * h * 0.35;
  const across = r + d.band * (room - pad - 2 * r);
  let px, py;
  if (d.lane === 'top') {
    px = -0.06 * w + d.along * 1.12 * w;
    py = across + swayPx;
  } else {
    /* Only the upper part of the frame.  Lower down the screen IS nearer the
       camera — the table is only half a metre away — so there is no distance
       left to put a petal at without it looming.  It fades out on the way down
       rather than blinking off. */
    py = -0.06 * h + d.along * 0.78 * h;
    px = d.lane === 'left' ? across + swayPx : w - across + swayPx;
  }

  // Screen point -> a ray from the camera -> a world point `depth` along it.
  _v.set((px / w) * 2 - 1, -(py / h) * 2 + 1, 0.5).unproject(camera);
  _dir.copy(_v).sub(camera.position).normalize();

  /* Down a side channel the ray dives under the table, and along the top one it
     runs into the backdrop, before it has gone the full distance.  Pull the
     petal nearer along the SAME ray rather than moving it sideways — the screen
     position, and therefore the clearance, is preserved exactly. */
  if (_dir.y < -1e-4) depth = Math.min(depth, (camera.position.y - 0.02) / -_dir.y);
  if (_dir.z < -1e-4) depth = Math.min(depth, (camera.position.z + 1.00) / -_dir.z);
  depth = Math.max(0.12, depth);

  /* Fade in and out at the ends of the run, and fade out if being pulled in
     towards the table has made it too big for its channel.  Nothing about a
     petal should ever pop. */
  const ends = Math.min(d.along + 0.06, 1.06 - d.along) / 0.18;
  const grown = rAt(depth) / Math.max(1, r);
  const fit = grown <= 1.05 ? 1 : Math.max(0, 1 - (grown - 1.05) * 4);
  const a = Math.max(0, Math.min(1, ends)) * fit;
  if (a <= 0.01) { p.visible = false; return; }

  p.visible = true;
  p.material.opacity = a;
  /* The cutout threshold has to come down with the opacity, or it wins: three
     tests the texture's alpha AFTER opacity is applied, so a fixed 0.42 discards
     the whole petal the moment it fades below it — a pop wearing a fade's
     clothes.  Never let it reach zero, which would recompile the shader. */
  p.material.alphaTest = Math.max(0.02, 0.42 * a);
  p.position.copy(camera.position).addScaledVector(_dir, depth);
}

/* ------------------------------------------------------------ stardust */

function dustTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,244,214,1)');
  g.addColorStop(0.3, 'rgba(255,206,124,0.55)');
  g.addColorStop(1, 'rgba(255,150,60,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const DUST = 1400;
const dustGeom = new THREE.BufferGeometry();
{
  const p = new Float32Array(DUST * 3);
  const ph = new Float32Array(DUST);
  const sz = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    // Gathered around the book, thinning out towards the edges of the frame.
    const r = Math.pow(Math.random(), 0.6);
    const a = Math.random() * Math.PI * 2;
    p[i * 3] = Math.cos(a) * r * 0.85;
    p[i * 3 + 1] = Math.random() * 0.75;
    p[i * 3 + 2] = Math.sin(a) * r * 0.6 - 0.05;
    ph[i] = Math.random() * 100;
    sz[i] = 0.9 + Math.random() * 2.6;
  }
  dustGeom.setAttribute('position', new THREE.BufferAttribute(p, 3));
  dustGeom.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  dustGeom.setAttribute('psize', new THREE.BufferAttribute(sz, 1));
}

const dustMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uMap: { value: dustTexture() },
    uScale: { value: 1 },
    uDay: { value: 0 }
  },
  vertexShader: `
    attribute float phase;
    attribute float psize;
    uniform float uTime;
    uniform float uScale;
    varying float vTwinkle;
    void main() {
      vec3 p = position;
      /* Dust drifts: it rises slowly on the heat of the candle and wanders. */
      p.y += mod(uTime * 0.012 + phase * 0.01, 0.85);
      p.x += sin(uTime * 0.28 + phase) * 0.018;
      p.z += cos(uTime * 0.21 + phase * 1.7) * 0.018;
      vTwinkle = pow(0.5 + 0.5 * sin(uTime * 2.6 + phase * 6.0), 3.0);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = min(psize * uScale * (0.09 / -mv.z) * 26.0 * (0.35 + vTwinkle), 9.0);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform sampler2D uMap;
    uniform float uDay;
    varying float vTwinkle;
    void main() {
      vec4 c = texture2D(uMap, gl_PointCoord);
      /* Added light on a black room is a spark; added light on a bright sky is
         barely a smudge, so in daylight the dust is fewer, harder glints —
         weight the twinkle instead of the base so only the peaks show. */
      float a = c.a * mix(0.10 + 0.90 * vTwinkle,
                          0.62 * pow(vTwinkle, 1.6), uDay);
      gl_FragColor = vec4(c.rgb, a);
      if (gl_FragColor.a < 0.01) discard;
    }`,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
scene.add(new THREE.Points(dustGeom, dustMat));

/* ----------------------------------------------------------- post */

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.55, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* How far back the camera has to stand for the whole book to fit.

   Open, the book is twice the width it is shut, and on a phone held upright
   there is barely half the width to put it in — a fixed camera runs the
   spread straight off both sides of the screen.  So the distance is worked
   out from the book's actual size and the camera's actual field of view,
   every time either of them changes. */
/* ------------------------------------------------- one page at a time

   On a phone or a tablet held upright the open spread is two pages wide in a
   frame that is tall and narrow, so the book ends up small and the writing
   needs pinching to read. The client asked for one page, filling the screen.

   Nothing about the book changes: both pages are still there and still turn.
   Only the camera's target and the width it fits to move — so pinch zoom, page
   turns, the tabs and the writing all carry on working untouched. */
let singlePage = false;
let wasSinglePage = false;
const pageMid = new THREE.Vector3(0, 0.030, 0);

function wantsSinglePage() {
  return singlePage && state.coverOpen > 0.62;
}

/* Which page the camera is looking at: -1 left, +1 right. The inspiration is
   always on the right, so that is where it starts. */
function faceSide(side) {
  if (side) state.side = side;
  reframe();
}

function fitDistance() {
  if (wantsSinglePage()) {
    // one page wide, one page tall, and a little air around it
    const halfW = PW * 0.5 * 1.06;
    const halfH = PH * 0.5 * 1.24;
    const vFov = camera.fov * Math.PI / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    return Math.max(halfW / Math.tan(hFov / 2),
                    halfH * foreshorten() / Math.tan(vFov / 2));
  }
  const wide = CW + PW * Math.min(1, state.coverOpen * 1.6);
  // More room above and below than at the sides: filling the width is what
  // makes the book read, but cropping the candles out of the top of the frame
  // loses the whole point of a candlelit table.
  //
  // These numbers are deliberately unchanged — the client said she likes how
  // close up this already is, so daylight is framed exactly as candlelight is.
  // A closer daylight frame was tried and it clipped the fore edge; "cropped"
  // is the one word this client has used about every draft.
  const halfW = wide * 0.5 * 1.12;
  const halfH = CH * 0.5 * 1.14;
  const vFov = camera.fov * Math.PI / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const dW = halfW / Math.tan(hFov / 2);
  const dH = halfH * foreshorten() / Math.tan(vFov / 2);
  return Math.max(dW, dH);
}

/* How much of the book's depth the camera actually sees: cos of the angle off
   vertical. Straight down it is 1 and none of the depth is lost; from a low
   angle it shrinks. This used to be the constant 0.70, which was right for the
   old raking view and framed a top-down one far too loosely. */
const fsVec = new THREE.Vector3();
function foreshorten() {
  fsVec.copy(camera.position).sub(controls.target);
  const r = fsVec.length();
  return r < 1e-6 ? 1 : THREE.MathUtils.clamp(fsVec.y / r, 0.55, 1);
}

const off = new THREE.Vector3();
let wasPortrait = null;
let dustScale = 1;
function reframe() {
  // Where the camera is pointed: the middle of the book, or the middle of one
  // page when a phone is showing them one at a time.
  pageMid.set(wantsSinglePage() ? (state.side || 1) * (PW / 2) : 0, 0.030, 0);

  const d = THREE.MathUtils.clamp(fitDistance(), controls.minDistance, controls.maxDistance);
  off.copy(camera.position).sub(controls.target);
  if (off.lengthSq() < 1e-9) off.set(0.02, 0.288, 0.548);
  controls.target.copy(pageMid);
  camera.position.copy(controls.target).add(off.setLength(d));
  camera.lookAt(controls.target);
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / h;
  const portrait = w / h < 0.95;
  camera.fov = portrait ? 50 : 34;
  camera.updateProjectionMatrix();
  dustScale = Math.min(h / 760, 1.6);

  /* One page at a time when the spread will not fit comfortably: a phone in
     either orientation, or a tablet held upright. The test is the frame, not
     the device — a narrow desktop window gets the same treatment, which is also
     how it can be checked without a phone to hand. */
  singlePage = w < 820 || portrait;
  document.body.classList.toggle('single-page', singlePage);

  controls.maxDistance = Math.max(1.10, fitDistance() * 1.3);

  if (portrait !== wasPortrait) {
    wasPortrait = portrait;
    /* Looking at one page, look at it squarely — the steep angle only ever
       existed to spend a tall frame on a wide spread, and it makes handwriting
       harder to read. */
    camera.position.copy(controls.target).add(
      new THREE.Vector3(0, 0.500, 0.088));
    document.body.classList.toggle('portrait', portrait);
  }
  reframe();
}
addEventListener('resize', resize);

/* ------------------------------------------------------- book updating */

function leafFront(j) { return 1 + 2 * j; }
function leafBack(j) { return 2 + 2 * j; }

function updateBook(t) {
  const open = state.coverOpen;
  const turn = state.turn;

  // How far each stack has grown.  During a turn the leaf in the air belongs
  // to neither, and its thickness is shared out as it crosses.
  let kL = state.leaf, kR = NLEAF - state.leaf;
  if (turn) {
    const p = turn.t;
    if (turn.dir > 0) { kL = state.leaf + p; kR = NLEAF - state.leaf - p; }
    else { kL = state.leaf - p; kR = NLEAF - state.leaf + p; }
  }
  const tL = Math.max(0.0002, kL * LEAF_T);
  const tR = Math.max(0.0002, kR * LEAF_T);

  // The cover swings; everything else waits for it to be out of the way.
  coverPivot.rotation.z = open * Math.PI;
  book.position.x = -(CW / 2) * (1 - open);

  // Shut, the spine stands the full height of the book; open, it lies down.
  const shut = 1 - open;
  const spineH = COVER_T * 2 + BLOCK_T * shut;
  spine.scale.set(0.010, spineH, 1);
  spine.position.set(-0.004, spineH / 2, 0);

  // The stacks are trimmed a shade under the pages, and their tops sit just
  // below the lowest point of the page lying on them, so a page can dip into
  // the gutter without ever cutting through the block.
  const SINK = GUTTER - LIE + 0.0002;
  const hR = Math.max(0.0002, tR - SINK), hL = Math.max(0.0002, tL - SINK);

  stackR.visible = kR > 0.02;
  stackR.scale.set(PW - 0.0024, hR, PH - 0.0024);
  stackR.position.set(PW / 2, COVER_T + hR / 2, 0);

  stackL.visible = open > 0.5 && kL > 0.02;
  stackL.scale.set(PW - 0.0024, hL, PH - 0.0024);
  stackL.position.set(-PW / 2, COVER_T + hL / 2, 0);

  // While the cover is still coming over, the pages underneath stay hidden.
  const showPages = open > 0.62;

  const rightIdx = leafFront(state.leaf + (turn && turn.dir > 0 ? 1 : 0));
  const leftIdx = leafBack(state.leaf - 1 - (turn && turn.dir < 0 ? 1 : 0));

  topR.front.visible = topR.back.visible = false;
  topL.front.visible = topL.back.visible = false;
  flying.front.visible = flying.back.visible = false;

  if (showPages) {
    const rt = pageTexture(rightIdx);
    if (rt) {
      topR.front.material.map = rt;
      topR.front.material.needsUpdate = true;
      topR.front.visible = true;
      shapeLeaf(topR, 0, COVER_T + tR + LIE, 0, t);
    }
    const lt = pageTexture(leftIdx);
    if (lt && leftIdx >= 1) {
      const m = topL.back.material;
      m.map = lt;
      m.needsUpdate = true;
      topL.back.visible = true;
      shapeLeaf(topL, Math.PI, COVER_T + tL + LIE, 0, t);
    }
  }

  if (turn && showPages) {
    const phi = turn.from + (turn.to - turn.from) * ease(turn.t);
    // A leaf at rest on the right sits at `yStart`; on the left, at `yEnd`.
    // Both ends of the swing must meet their stack exactly, in either
    // direction, which is what the pivot and the lift are solving for.
    const yStart = COVER_T + tR + LIE + 0.0004;
    const yEnd = COVER_T + tL + LIE + 0.0004;
    shapeLeaf(flying, phi, (yStart + yEnd) / 2, (yStart - yEnd) / 2, t);

    const f = pageTexture(leafFront(turn.leaf));
    const b = pageTexture(leafBack(turn.leaf));
    if (f) { flying.front.material.map = f; flying.front.material.needsUpdate = true; flying.front.visible = true; }
    if (b) { flying.back.material.map = b; flying.back.material.needsUpdate = true; flying.back.visible = true; }

    // Held up against the candle, paper glows.  A real page is translucent;
    // this is the cheap version of that, and it only shows mid-swing.
    const glow = Math.sin(turn.t * Math.PI) * 0.13;
    flying.front.material.emissiveIntensity = glow;
    flying.back.material.emissiveIntensity = glow;
  }
}

function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

/* ---------------------------------------------------- mirrored backsides */

// Back faces are read from behind, so their picture has to run the other way.
for (const o of [topL, topR, flying]) {
  o.back.material.onBeforeCompile = s => {
    // Guarded: the material is compiled once before it has ever been given a
    // page, and vMapUv does not exist until it has one.
    s.vertexShader = s.vertexShader.replace(
      '#include <uv_vertex>',
      '#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv.x = 1.0 - vMapUv.x;\n#endif'
    );
  };
}

/* ------------------------------------------------------------ turning */

const TURN_MS = 1050;
const COVER_MS = 1400;

const isOpen = () => state.coverOpen > 0.999;
function canTurn() { return isOpen() && !state.turn; }

function next() {
  if (!isOpen()) { openCover(); return; }
  /* Showing one page, the arrows walk PAGE by page: left, right, then turn the
     leaf and land on the left of the next spread — which is how a book reads. */
  if (wantsSinglePage() && state.side < 0) { faceSide(1); return; }
  if (!canTurn() || state.leaf >= NLEAF - 1) return;
  state.turn = { from: 0, to: Math.PI, t: 0, dir: 1, leaf: state.leaf, ms: TURN_MS };
  if (wantsSinglePage()) faceSide(-1);
  blur();
}

function prev() {
  if (wantsSinglePage() && state.side > 0 && state.leaf > 0) { faceSide(-1); return; }
  if (isOpen() && state.leaf === 0) { closeCover(); return; }
  if (!canTurn() || state.leaf <= 0) return;
  state.turn = { from: Math.PI, to: 0, t: 0, dir: -1, leaf: state.leaf - 1, ms: TURN_MS };
  if (wantsSinglePage()) faceSide(1);
  blur();
}

let coverAnim = null;
function openCover() {
  if (coverAnim || isOpen()) return;
  coverAnim = { from: state.coverOpen, to: 1, t: 0 };
  state.side = 1;      // the first page anyone sees is a right-hand one
  hint(false);
}
function closeCover() {
  if (coverAnim || state.coverOpen === 0) return;
  coverAnim = { from: state.coverOpen, to: 0, t: 0 };
  blur();
}

/* ------------------------------------------------------------- writing */

const input = document.getElementById('keys');

function focusPage(idx) {
  if (state.focus === idx) return;
  const was = state.focus;
  state.focus = idx;
  if (was !== null) repaint(was);
  if (idx !== null) {
    input.value = state.entries[idx] || '';
    input.focus({ preventScroll: true });
    repaint(idx);
  }
  document.body.classList.toggle('writing', idx !== null);
}
function blur() {
  if (state.focus === null) return;
  const was = state.focus;
  state.focus = null;
  input.blur();
  repaint(was);
  document.body.classList.remove('writing');
}

input.addEventListener('input', () => {
  if (state.focus === null) return;
  state.entries[state.focus] = input.value;
  // The device copy is written every keystroke and is what makes the journal
  // work with no internet. The account copy, if there is one, is queued and
  // sent after a pause.
  localStorage.setItem(STORE, JSON.stringify(state.entries));
  cloud.save(state.focus, input.value);
  repaint(state.focus);
});
input.addEventListener('keydown', e => {
  if (e.key === 'Escape') { blur(); e.preventDefault(); }
});

/* --------------------------------------------------------- interaction */

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null;

canvas.addEventListener('pointerdown', e => {
  down = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 6) return;                     // that was a drag, not a click

  const r = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ndc, camera);

  if (!isOpen()) {
    const hit = ray.intersectObject(frontBoard, false);
    if (hit.length) openCover();
    return;
  }

  const targets = [];
  if (topR.front.visible) targets.push(topR.front);
  if (topL.back.visible) targets.push(topL.back);
  const hit = ray.intersectObjects(targets, false)[0];
  if (!hit) { blur(); return; }

  const onRight = hit.object === topR.front;
  const u = hit.uv ? (onRight ? hit.uv.x : 1 - hit.uv.x) : 0.5;

  // The outer eighth of a page is its corner: that is where you turn it.
  if (u > 0.88) { onRight ? next() : prev(); return; }

  if (wantsSinglePage()) faceSide(onRight ? 1 : -1);
  const idx = onRight ? leafFront(state.leaf) : leafBack(state.leaf - 1);

  /* The last page carries a painted "Return to the cover". There is no DOM on a
     page — it is a picture on a piece of geometry — so the button is hit-tested
     from where on the page the ray landed, which is what the UV already is. */
  if (PAGES[idx] && PAGES[idx].t === 'closing' && hit.uv) {
    const v = 1 - hit.uv.y;                       // uv.y counts up, the page counts down
    if (u > CLOSING_BUTTON.x0 && u < CLOSING_BUTTON.x1 &&
        v > CLOSING_BUTTON.y0 && v < CLOSING_BUTTON.y1) {
      blur();
      state.turn = null;
      state.leaf = 0;
      state.side = 1;
      closeCover();
      updateTabs();
      return;
    }
  }

  if (isWritable(PAGES[idx])) focusPage(idx); else blur();
});

addEventListener('keydown', e => {
  if (state.focus !== null && e.key !== 'Escape') return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { next(); e.preventDefault(); }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { prev(); e.preventDefault(); }
});

document.getElementById('next').onclick = next;
document.getElementById('prev').onclick = prev;

function hint(show) {
  document.getElementById('hint').classList.toggle('gone', !show);
}

/* ---------------------------------------------------------------- loop */

const clk = new THREE.Clock();
let caretT = 0;
let simT = 0;             // the scene's own clock, so it can be driven by hand

/* One tick.  Split out from the animation loop so a recording can advance the
   scene by an exact fixed step and render one frame at a time — a screen
   capture of a loop running at whatever frame rate this machine manages would
   show the page turn stuttering, which is a lie about the animation. */
function step(dt) {
  simT += dt;
  const t = simT;

  // Candle flicker.  Three waves at frequencies that share no common multiple,
  // so the light never settles into a visible beat — one sine on its own reads
  // as a pulsing lamp, not a flame.
  candles.forEach((c, i) => {
    const o = i * 3.1;
    const fl = 0.82
      + 0.10 * Math.sin(t * 2.7 + o)
      + 0.05 * Math.sin(t * 6.1 + o * 1.7)
      + 0.04 * Math.sin(t * 13.7 + o * 0.6);
    c.light.intensity = c.power * (c.spot ? 0.45 : 1) * fl;
    if (c.spot) c.spot.intensity = c.power * 0.80 * fl;
    c.flame.scale.set(0.92 + fl * 0.13, 0.84 + fl * 0.24, 1);
    c.flame.position.x = Math.sin(t * 5.3 + o) * 0.0011;
    c.light.position.x = Math.sin(t * 5.3 + o) * 0.004;
    c.light.position.z = Math.cos(t * 3.9 + o) * 0.004;
    if (i === 0) bounce.intensity = 0.028 * fl;
  });

  if (coverAnim) {
    coverAnim.t = Math.min(1, coverAnim.t + dt * 1000 / COVER_MS);
    state.coverOpen = coverAnim.from + (coverAnim.to - coverAnim.from) * ease(coverAnim.t);
    if (coverAnim.t >= 1) { state.coverOpen = coverAnim.to; coverAnim = null; reframe(); }
  }

  if (state.turn) {
    state.turn.t += dt * 1000 / state.turn.ms;
    if (state.turn.t >= 1) {
      state.leaf += state.turn.dir;
      state.turn = null;
    }
  }

  caretT += dt;
  if (caretT > 0.5) {
    caretT = 0;
    if (state.focus !== null) {
      state.caretOn = !state.caretOn;
      repaint(state.focus);
    }
  }

  dustMat.uniforms.uTime.value = t;
  dustMat.uniforms.uScale.value = dustScale *
    THREE.MathUtils.clamp(0.58 / camera.position.distanceTo(controls.target), 0.45, 1.2);

  updateBook(t);
  /* The framing changes as the cover swings open — whole book while it is shut,
     one page once it is properly open. Watch for the crossing rather than
     reframing every frame. */
  const wantOne = wantsSinglePage();
  if (wantOne !== wasSinglePage) { wasSinglePage = wantOne; reframe(); }
  syncTabs();
  controls.update();

  /* Last, and in this order.  The petals are placed against the book's measured
     position ON SCREEN, so the camera must already be where it will be rendered
     from — a frame of lag here shows up as petals sliding over the page while
     the reader is pinching to zoom. */
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  measureBook();
  for (const p of petals) {
    const d = p.userData;
    placePetal(p, t, dt);
    p.rotation.set(
      t * d.tumble + d.phase,
      t * d.spin,
      Math.sin(t * d.sway + d.phase) * 0.6
    );
  }

  composer.render();
}

let running = true;
function frame() {
  if (running) requestAnimationFrame(frame);
  step(Math.min(clk.getDelta(), 0.1));
}

/* ------------------------------------------------- day tabs and the switch */

const modeCandleBtn = document.getElementById('modeCandle');
const modeDayBtn = document.getElementById('modeDay');
modeCandleBtn.addEventListener('click', () => setMode('candle'));
modeDayBtn.addEventListener('click', () => setMode('day'));

/* The numbered tabs from the storybook version, which the client asked for by
   name. Each one jumps to the leaf that shows that day's inspiration. */
const tabsEl = document.getElementById('tabs');
const tabEls = [];

function leafOfPage(p) {
  // leaf j shows page 1+2j on its front, so the leaf that opens onto page p is
  // the one whose front is p when p is odd, and whose back is p when it is even
  return Math.max(0, Math.min(NLEAF - 1, Math.floor((p - 1) / 2)));
}

function goToPage(p) {
  const target = leafOfPage(p);
  if (!isOpen()) { openCover(); }
  state.turn = null;
  state.leaf = target;
  // odd page numbers are right-hand pages here, and every day's inspiration is
  // on one — so land the camera on the side the page it was asked for is on
  faceSide(p % 2 === 1 ? 1 : -1);
  blur();
  updateTabs();
}

{
  const cover = document.createElement('div');
  cover.className = 'tab';
  cover.textContent = '❦';
  cover.title = 'The cover';
  cover.addEventListener('click', () => { closeCover(); state.leaf = 0; updateTabs(); });
  tabsEl.appendChild(cover);
  tabEls.push({ el: cover, day: null });

  JOURNAL.days.forEach(d => {
    const t = document.createElement('div');
    t.className = 'tab';
    t.textContent = String(d.n);
    t.title = 'Day ' + d.n + ' — ' + d.title;
    t.addEventListener('click', () => goToPage(dayPage(d.n)));
    tabsEl.appendChild(t);
    tabEls.push({ el: t, day: d.n });
  });

  // and one for the last page, marked the way the cover's is
  const endIdx = PAGES.findIndex(q => q.t === 'closing');
  if (endIdx > 0) {
    const t = document.createElement('div');
    t.className = 'tab';
    t.textContent = '✦';
    t.title = JOURNAL.closing.title;
    t.addEventListener('click', () => goToPage(endIdx));
    tabsEl.appendChild(t);
    tabEls.push({ el: t, day: null, page: endIdx });
  }
}

/* Called every frame, but the DOM is only touched when something has actually
   changed — restyling 22 tabs at 60fps for nothing is a real cost on a phone. */
let tabKey = '';
function syncTabs() {
  const k = state.leaf + '|' + (state.coverOpen > 0.999 ? 1 : 0);
  if (k === tabKey) return;
  tabKey = k;
  updateTabs();
}

/* Which tab is lit: whichever days are on the two pages currently facing the
   reader. Reading it off PAGES rather than off the day arithmetic means it
   cannot drift if the page list changes again. */
function updateTabs() {
  const open = isOpen();
  const shown = new Set();
  if (open) {
    // At rest the right page is leafFront(leaf) and the left is
    // leafBack(leaf - 1) — 1 + 2L and 2L. Taking 2 + 2L would light the tab
    // for the page hidden UNDER the leaf you are looking at.
    for (const p of [2 * state.leaf, 1 + 2 * state.leaf]) {
      const pg = PAGES[p];
      if (pg && pg.day) shown.add(pg.day.n);
    }
  }
  const facing = open ? [2 * state.leaf, 1 + 2 * state.leaf] : [];
  tabEls.forEach(t => {
    let on;
    if (t.page !== undefined) on = facing.indexOf(t.page) !== -1;   // the last page
    else if (t.day === null) on = !open;                            // the cover
    else on = shown.has(t.day);
    t.el.classList.toggle('active', on);
  });
}

/* ------------------------------------------------------------ accounts

   All of this is dormant until config.js has a project url and an anon key in
   it. Without them `cloud.configured()` is false, the sign-in screen is never
   shown, and the journal saves to the device exactly as it did before — which
   is also the behaviour anyone gets who chooses "just use this device". */

const authEl = document.getElementById('auth');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPass = document.getElementById('authPass');
const authGo = document.getElementById('authGo');
const authMsg = document.getElementById('authMsg');
const authSwap = document.getElementById('authSwap');
const authSkip = document.getElementById('authSkip');
const authForgot = document.getElementById('authForgot');
const accountEl = document.getElementById('account');
const accountWho = document.getElementById('accountWho');
const accountOut = document.getElementById('accountOut');
const accountIn = document.getElementById('accountIn');

const SKIP_KEY = 'journey-to-me-3d-device-only';
let signingUp = false;
let resetting = false;      // came back from a password-reset email

function say(text, ok) {
  authMsg.textContent = text || '';
  authMsg.classList.toggle('ok', !!ok);
}

/* The corner strip has two jobs: it says who is signed in, and it is the way TO
   an account for anybody who wants one. Since the journal no longer opens on a
   sign-in wall, this strip is the only route in — so it shows whenever accounts
   exist at all, not only after somebody has already made a choice. */
function showAccount() {
  const u = cloud.currentUser();
  accountEl.hidden = !cloud.configured();
  accountWho.textContent = u ? (u.email || 'signed in') : '';
  accountOut.hidden = !u;
  accountIn.hidden = !!u;
}

function setSigningUp(on) {
  signingUp = on;
  resetting = false;
  authEmail.style.display = '';
  authEmail.disabled = false;
  authGo.textContent = on ? 'Create account' : 'Sign in';
  authPass.setAttribute('autocomplete', on ? 'new-password' : 'current-password');
  authPass.placeholder = 'password';
  authSwap.textContent = on ? 'I already have an account' : 'Create an account instead';
  authSwap.hidden = false;
  authForgot.hidden = on;
  say('');
}

/* Coming back from the reset email the same form takes a NEW password instead
   of an old one — the token in the link is the proof of identity. */
function setResetting() {
  resetting = true;
  signingUp = false;
  authGo.textContent = 'Set new password';
  /* Hiding a `required` field is not enough: the browser refuses to submit the
     form because it cannot focus the empty control to complain about it, and
     the submit handler never runs at all. It has to be disabled as well —
     disabled controls are skipped by validation. */
  authEmail.style.display = 'none';
  authEmail.disabled = true;
  authPass.placeholder = 'your new password';
  authPass.setAttribute('autocomplete', 'new-password');
  authSwap.hidden = true;
  authForgot.hidden = true;
  say('Choose a new password.', true);
}

/* Pull whatever the account holds, fold in anything written on this device
   before signing in, and repaint whatever is on screen. */
async function adoptAccount() {
  try {
    state.entries = await cloud.merge(state.entries);
    localStorage.setItem(STORE, JSON.stringify(state.entries));
    live.forEach((slot, idx) => paint(slot, idx));
  } catch (e) {
    say('Signed in, but could not load your writing: ' + e.message);
    return false;
  }
  return true;
}

authSwap.addEventListener('click', () => setSigningUp(!signingUp));

authSkip.addEventListener('click', () => {
  // Remembered, or the journal asks the same question every single time it is
  // opened — which is the fastest way to make somebody stop opening it.
  localStorage.setItem(SKIP_KEY, '1');
  authEl.hidden = true;
  say('');
  showAccount();
});

accountIn.addEventListener('click', () => {
  setSigningUp(false);
  authEl.hidden = false;
});

authForgot.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  if (!email) { say('Put your email in the box above first.'); return; }
  authGo.disabled = true;
  say('Sending…');
  try {
    await cloud.resetPassword(email);
    /* Never confirm whether an address has an account — that turns the form
       into a way of finding out who is registered.

       Do say what to look for, though. The first person to use this went to her
       inbox, found an email with the journal's name on it, clicked the link in
       that one — and it was the wrong email entirely. Naming the subject line
       costs nothing and saves the guess. */
    say('If there is an account for that address, a link is on its way. Look for ' +
        'an email titled “Reset Your Password” — check your spam folder if it ' +
        'is not there.', true);
  } catch (err) {
    say(err.message || 'Could not send that just now.');
  }
  authGo.disabled = false;
});

authForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email = authEmail.value.trim();
  const pass = authPass.value;

  if (resetting) {
    if (pass.length < 6) { say('At least six characters, please.'); return; }
    authGo.disabled = true;
    say('Saving your new password…');
    try {
      await cloud.changePassword(pass);
      await cloud.loadUser();
      if (await adoptAccount()) {
        say('');
        authPass.value = '';
        authEmail.style.display = '';
        authEmail.disabled = false;
        authEl.hidden = true;
        localStorage.removeItem(SKIP_KEY);
        showAccount();
      }
    } catch (err) {
      say(err.message || 'That link may have expired — ask for another.');
    }
    authGo.disabled = false;
    return;
  }

  if (!email || pass.length < 6) {
    say('An email and a password of at least six characters, please.');
    return;
  }
  authGo.disabled = true;
  say(signingUp ? 'Creating your account…' : 'Signing in…');
  try {
    if (signingUp) {
      const r = await cloud.signUp(email, pass);
      if (r.needsConfirmation) {
        say('Almost there — check your email and click the link, then sign in.', true);
        setSigningUp(false);
        authGo.disabled = false;
        return;
      }
    } else {
      await cloud.signIn(email, pass);
    }
    if (await adoptAccount()) {
      say('');
      authPass.value = '';
      authEl.hidden = true;
      // Signing in supersedes an earlier "just this device"
      localStorage.removeItem(SKIP_KEY);
      showAccount();
    }
  } catch (err) {
    say(err.message || 'That did not work. Please try again.');
  }
  authGo.disabled = false;
});

accountOut.addEventListener('click', async () => {
  try { await cloud.flushNow(); } catch (e) { /* nothing more we can do */ }
  cloud.signOut();
  // The writing belongs to the account now, so it must not be left sitting on
  // a shared computer for whoever opens the journal next.
  state.entries = {};
  localStorage.removeItem(STORE);
  live.forEach((slot, idx) => paint(slot, idx));
  showAccount();
  setSigningUp(false);
  // Back to the book, not to a wall — signing out is not a way of being locked
  // out of a journal that now lives on the device.
  authEl.hidden = true;
});

cloud.onSyncState((kind, detail) => {
  if (kind === 'error') say('Could not reach your account: ' + detail);
});

if (cloud.configured()) {
  // Keys alone are not enough — the table has to exist too. Until it does the
  // journal stays exactly as it was, rather than offering an account that
  // cannot hold anything.
  cloud.ready().then(ok => {
    if (!ok) return;

    // A password-reset email lands back here with a token in the URL fragment.
    const link = cloud.claimLinkSession();
    if (link && link.type === 'error') {
      setSigningUp(false);
      authEl.hidden = false;
      say(link.message + ' — ask for a new link below.');
    } else if (link) {
      setResetting();
      authEl.hidden = false;
    } else if (cloud.currentUser()) {
      adoptAccount();
    } else {
      /* Nobody is asked to sign in to read their own journal. It opens on the
         book; the corner strip is there for anyone who wants their writing to
         follow them to another device. */
      setSigningUp(false);
      authEl.hidden = true;
    }
    showAccount();
  });
}

// Anything still queued when the tab closes gets one last try.
window.addEventListener('beforeunload', () => { cloud.flushNow(); });

/* -------------------------------------------------------------- start */

setMode(mode);
updateTabs();
resize();
frame();

// Pages painted before the handwriting font arrives are painted in a serif;
// repaint whatever is already on screen once it lands.
if (document.fonts && document.fonts.load) {
  document.fonts.load('40px Caveat').then(() => {
    live.forEach((slot, idx) => paint(slot, idx));
  }).catch(() => {});
}

// Wait for the cover art before showing anything, or the book opens on a
// blank red board.
const boot = setInterval(() => {
  if (coverImg.complete && paperImg.complete && pending === 0) {
    clearInterval(boot);
    document.body.classList.add('loaded');
  }
}, 120);
setTimeout(() => { clearInterval(boot); document.body.classList.add('loaded'); }, 8000);

// Handy for a demo: jump straight to a day.
window.goToDay = n => {
  const target = Math.floor((dayPage(n) - 1) / 2);
  state.leaf = Math.max(0, Math.min(NLEAF - 1, target));
  state.coverOpen = 1;
  state.turn = null;
};
window.__scene = {
  THREE,
  state, PAGES, NLEAF, camera, controls, pool, live, renderer, scene,
  candles, topL, topR, flying, petals, skyExposure,
  next, prev, openCover, closeCover, focusPage, blur, repaint,
  // Hand control, for recording a walkthrough at an exact frame rate.
  capture(on) { running = !on; if (!on) { clk.getDelta(); requestAnimationFrame(frame); } },
  step,
  write(text) {
    if (state.focus === null) return;
    state.entries[state.focus] = text;
    input.value = text;
    repaint(state.focus);
  }
};
