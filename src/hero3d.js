// Disco da bilanciere "Gym Tonic" in 3D: protagonista della prima schermata.
// - trascinabile (con inerzia), segue il puntatore, reagisce allo scroll
// - versione leggera per mobile / dispositivi poco potenti
// - con prefers-reduced-motion non gira da solo e non fluttua
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Points, Vector2,
  LatheGeometry, RingGeometry, BufferGeometry, Float32BufferAttribute,
  MeshPhysicalMaterial, MeshStandardMaterial, PointsMaterial,
  CanvasTexture, DirectionalLight, PointLight, AmbientLight, PMREMGenerator,
  ACESFilmicToneMapping, SRGBColorSpace, DoubleSide, AdditiveBlending, MathUtils,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const ORANGE = 0xff6a13;
const TAU = Math.PI * 2;

function plateTexture(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const h = size / 2;
  g.translate(h, h);

  // scanalature concentriche della gomma
  g.strokeStyle = 'rgba(255,255,255,0.045)';
  g.lineWidth = size * 0.002;
  for (let r = 0.44; r < 1; r += 0.018) {
    g.beginPath(); g.arc(0, 0, r * h, 0, TAU); g.stroke();
  }

  // anelli arancioni
  g.strokeStyle = '#ff6a13';
  g.lineWidth = size * 0.008;
  g.beginPath(); g.arc(0, 0, h * 0.965, 0, TAU); g.stroke();
  g.lineWidth = size * 0.004;
  g.beginPath(); g.arc(0, 0, h * 0.69, 0, TAU); g.stroke();

  // testo circolare
  const text = 'GYM TONIC  •  RIVAROLO CANAVESE  •  GYM TONIC  •  RIVAROLO CANAVESE  •  ';
  const fontPx = size * 0.074;
  g.font = `800 ${fontPx}px "Big Shoulders", "Arial Narrow", sans-serif`;
  g.fillStyle = '#ff6a13';
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  const radius = h * 0.83;
  const total = g.measureText(text).width;
  const spacing = (TAU * radius) / total; // adatta il testo all'intera circonferenza
  let angle = -Math.PI / 2;
  for (const ch of text) {
    const w = g.measureText(ch).width * spacing;
    angle += (w / radius) / 2;
    g.save();
    g.rotate(angle + Math.PI / 2);
    g.translate(0, -radius);
    g.fillText(ch, 0, 0);
    g.restore();
    angle += (w / radius) / 2;
  }

  // "20" e "KG" in grande, ai lati del mozzo
  g.fillStyle = '#f4f1ec';
  g.font = `900 ${size * 0.13}px "Big Shoulders", "Arial Narrow", sans-serif`;
  g.fillText('20', -h * 0.56, 0);
  g.fillText('KG', h * 0.56, 0);

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

export async function initHero({ canvas, hero, lowPower, reducedMotion }) {
  // il testo del disco usa il font del sito
  try { await document.fonts.load('800 80px "Big Shoulders"'); } catch { /* fallback font */ }

  const renderer = new WebGLRenderer({
    canvas, alpha: true, antialias: !lowPower, powerPreference: lowPower ? 'low-power' : 'high-performance',
  });
  let dprCap = lowPower ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // ---------- luci ----------
  scene.add(new AmbientLight(0xffffff, 0.15));
  const key = new DirectionalLight(0xfff1e6, 2.2);
  key.position.set(-3, 4, 6);
  scene.add(key);
  const rim = new PointLight(ORANGE, 60, 20, 2);
  rim.position.set(3.2, 1.5, -2.5);
  scene.add(rim);
  const under = new PointLight(ORANGE, 18, 14, 2);
  under.position.set(-2.5, -2.5, 2.5);
  scene.add(under);

  // ---------- disco ----------
  const seg = lowPower ? 72 : 160;
  const root = new Group();
  const orient = new Group();
  orient.rotation.x = Math.PI / 2; // asse del disco verso la camera
  const spinner = new Group();
  orient.add(spinner);
  root.add(orient);
  scene.add(root);

  // profilo della gomma (raggio, spessore) ruotato attorno all'asse
  const rubberProfile = [
    [0.35, -0.12], [0.88, -0.12], [0.9, -0.14], [0.925, -0.152], [0.97, -0.152], [0.992, -0.135],
    [1.0, -0.1], [1.0, 0.1], [0.992, 0.135], [0.97, 0.152], [0.925, 0.152], [0.9, 0.14],
    [0.88, 0.12], [0.35, 0.12], [0.35, -0.12],
  ].map(([x, y]) => new Vector2(x, y));
  const rubber = new Mesh(
    new LatheGeometry(rubberProfile, seg),
    new MeshPhysicalMaterial({
      color: 0x0e0e10, roughness: 0.78, metalness: 0.0, clearcoat: 0.25, clearcoatRoughness: 0.6,
      envMapIntensity: 0.35, side: DoubleSide,
    }),
  );
  spinner.add(rubber);

  // mozzo in acciaio cromato
  const hubProfile = [
    [0.1, -0.175], [0.1, 0.175], [0.32, 0.175], [0.36, 0.15], [0.36, -0.15], [0.32, -0.175], [0.1, -0.175],
  ].map(([x, y]) => new Vector2(x, y));
  const hub = new Mesh(
    new LatheGeometry(hubProfile, seg),
    new MeshStandardMaterial({ color: 0xd8d8dc, metalness: 1, roughness: 0.18, side: DoubleSide }),
  );
  spinner.add(hub);

  // anello arancione sul bordo esterno
  const band = new Mesh(
    new LatheGeometry([[1.003, -0.035], [1.003, 0.035]].map(([x, y]) => new Vector2(x, y)), seg),
    new MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: 0.35, roughness: 0.4, side: DoubleSide }),
  );
  spinner.add(band);

  // grafica stampata sulle due facce
  const tex = plateTexture(lowPower ? 1024 : 2048);
  const decalMat = new MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.18,
    transparent: true, roughness: 0.5, metalness: 0, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
  const decalGeo = new RingGeometry(0.36, 0.88, seg, 1);
  const front = new Mesh(decalGeo, decalMat);
  front.rotation.x = -Math.PI / 2;
  front.position.y = 0.1215;
  spinner.add(front);
  const back = new Mesh(decalGeo, decalMat);
  back.rotation.x = Math.PI / 2;
  back.rotation.z = Math.PI;
  back.scale.x = -1; // la scritta resta leggibile anche sul retro
  back.position.y = -0.1215;
  spinner.add(back);

  // ---------- polvere di magnesite nella luce ----------
  const count = lowPower ? 160 : 520;
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = MathUtils.randFloatSpread(12);
    pos[i * 3 + 1] = MathUtils.randFloatSpread(8);
    pos[i * 3 + 2] = MathUtils.randFloat(-4, 2.5);
    speed[i] = MathUtils.randFloat(0.05, 0.22);
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const dust = new Points(dustGeo, new PointsMaterial({
    size: lowPower ? 0.05 : 0.04, map: dotTexture(), color: 0xffb27a, transparent: true, opacity: 0.55,
    depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true,
  }));
  scene.add(dust);

  // ---------- layout responsivo ----------
  const base = { x: 0, y: 0, scale: 1, visH: 1 };
  function layout() {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const visH = 2 * Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const visW = visH * camera.aspect;
    base.visH = visH;
    if (w > 900) {
      base.scale = Math.min(visH * 0.32, visW * 0.18);
      base.x = visW * 0.285;
      base.y = visH * 0.05;
    } else {
      base.scale = Math.min(visW * 0.3, visH * 0.15);
      base.x = 0;
      const py = 72 + h * 0.17; // centro del disco in pixel dall'alto
      base.y = visH * (0.5 - py / h);
    }
    root.scale.setScalar(base.scale);
    render();
  }

  // ---------- interazione ----------
  const state = {
    spin: 0, spinVel: reducedMotion ? 0 : 0.35, baseVel: reducedMotion ? 0 : 0.35,
    tiltX: 0, tiltY: 0, targetTiltX: 0, targetTiltY: 0,
    dragging: false, lastX: 0, lastT: 0, scroll: 0,
  };
  const hint = hero.querySelector('[data-drag-hint]');

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    state.targetTiltY = (e.clientX / window.innerWidth - 0.5) * 0.55;
    state.targetTiltX = (e.clientY / window.innerHeight - 0.5) * 0.4;
  }, { passive: true });

  canvas.addEventListener('pointerdown', (e) => {
    state.dragging = true;
    state.lastX = e.clientX;
    state.lastT = performance.now();
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('is-dragging');
    hint?.classList.remove('is-visible');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const now = performance.now();
    const dx = e.clientX - state.lastX;
    const dt = Math.max(16, now - state.lastT) / 1000;
    const delta = dx * 0.012;
    state.spin -= delta;
    state.spinVel = MathUtils.clamp(-delta / dt, -18, 18);
    state.lastX = e.clientX;
    state.lastT = now;
    kick();
  });
  const endDrag = () => { state.dragging = false; canvas.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ---------- loop ----------
  let running = false;
  let visible = true;
  let last = performance.now();
  let t = 0;
  let frames = 0;
  let slowFrames = 0;
  let idleFrames = 0;

  function render() { renderer.render(scene, camera); }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    // qualità adattiva: se i primi frame sono lenti, riduce la risoluzione
    if (frames < 90) {
      frames++;
      if (dt > 0.03) slowFrames++;
      if (frames === 90 && slowFrames > 40 && dprCap > 1) {
        dprCap = 1;
        renderer.setPixelRatio(1);
        layout();
      }
    }

    if (!state.dragging) {
      state.spinVel += (state.baseVel - state.spinVel) * Math.min(1, dt * 1.6);
      state.spin += state.spinVel * dt;
    }
    state.tiltX += (state.targetTiltX - state.tiltX) * Math.min(1, dt * 4);
    state.tiltY += (state.targetTiltY - state.tiltY) * Math.min(1, dt * 4);

    const s = state.scroll;
    const bob = reducedMotion ? 0 : Math.sin(t * 1.1) * 0.06 * base.visH * 0.1;
    spinner.rotation.y = state.spin;
    root.position.set(base.x, base.y + bob + s * base.visH * 0.35, 0);
    root.rotation.x = -0.28 + state.tiltX + s * 1.0;
    root.rotation.y = -0.42 + state.tiltY - s * 0.5;
    root.rotation.z = 0.08;

    if (!reducedMotion) {
      const p = dustGeo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        p[i * 3 + 1] += speed[i] * dt;
        p[i * 3] += Math.sin(t * 0.3 + i) * 0.002;
        if (p[i * 3 + 1] > 4.5) p[i * 3 + 1] = -4.5;
      }
      dustGeo.attributes.position.needsUpdate = true;
    }

    render();

    // con reduced motion il loop si ferma quando il disco è fermo
    if (reducedMotion && !state.dragging && Math.abs(state.spinVel) < 0.001
      && Math.abs(state.targetTiltX - state.tiltX) < 0.001 && Math.abs(state.targetTiltY - state.tiltY) < 0.001) {
      if (++idleFrames > 10) { running = false; return; }
    } else idleFrames = 0;

    requestAnimationFrame(frame);
  }

  function kick() {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? kick() : stop();
  }).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : kick()));

  window.addEventListener('scroll', () => {
    state.scroll = MathUtils.clamp(window.scrollY / hero.clientHeight, 0, 1);
    kick();
  }, { passive: true });
  window.addEventListener('pointermove', kick, { passive: true });

  new ResizeObserver(layout).observe(hero);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    stop();
    document.documentElement.classList.remove('has-webgl');
  });

  layout();
  kick();
  canvas.classList.add('is-ready');
  setTimeout(() => hint?.classList.add('is-visible'), 400);
  setTimeout(() => hint?.classList.remove('is-visible'), 7000);
}
