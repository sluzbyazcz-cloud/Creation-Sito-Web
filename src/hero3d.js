// Disco da bilanciere "Gym Tonic" in 3D: protagonista della prima schermata.
// - trascinabile (con inerzia), tocco/clic = colpo di spinta, tastiera (frecce, Invio)
// - luce che segue il cursore, inclinazione con il giroscopio su mobile, reazione allo scroll
// - versione leggera per mobile / dispositivi poco potenti
// - con prefers-reduced-motion non gira da solo e non fluttua
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Points, Vector2, Vector3, Raycaster,
  LatheGeometry, RingGeometry, CylinderGeometry, BufferGeometry, Float32BufferAttribute,
  MeshPhysicalMaterial, MeshStandardMaterial, PointsMaterial,
  CanvasTexture, DirectionalLight, PointLight, AmbientLight, PMREMGenerator,
  ACESFilmicToneMapping, SRGBColorSpace, DoubleSide, BackSide, AdditiveBlending, MathUtils,
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
  const touch = matchMedia('(pointer: coarse)').matches;
  // il testo del disco usa il font del sito (senza bloccare più di 1,5 s)
  try {
    await Promise.race([document.fonts.load('800 80px "Big Shoulders"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch { /* font di riserva */ }

  const renderer = new WebGLRenderer({
    canvas, alpha: true, antialias: !lowPower, powerPreference: lowPower ? 'low-power' : 'high-performance',
  });
  let dprCap = lowPower ? 1.75 : 2;
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
  // luce calda che segue il cursore sulla superficie del disco
  const cursorLight = new PointLight(0xffa066, 0, 6, 2);
  cursorLight.position.set(0, 0, 2.2);
  scene.add(cursorLight);

  // ---------- disco ----------
  const seg = lowPower ? 72 : 160;
  const root = new Group();
  const punch = new Group(); // "colpo" elastico al tocco
  const orient = new Group();
  orient.rotation.x = Math.PI / 2; // asse del disco verso la camera
  const spinner = new Group();
  orient.add(spinner);
  punch.add(orient);
  root.add(punch);
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

  // mozzo in acciaio: flangia, collare e foro con interno scuro
  const steel = new MeshStandardMaterial({ color: 0xd4d4d8, metalness: 1, roughness: 0.26, side: DoubleSide });
  const hubProfile = [
    [0.125, -0.175], [0.125, 0.175], [0.3, 0.175], [0.325, 0.165], [0.36, 0.13], [0.36, -0.13],
    [0.325, -0.165], [0.3, -0.175], [0.125, -0.175],
  ].map(([x, y]) => new Vector2(x, y));
  spinner.add(new Mesh(new LatheGeometry(hubProfile, seg), steel));
  const collar = new Mesh(
    new LatheGeometry([[0.125, -0.19], [0.125, 0.19], [0.175, 0.19], [0.175, -0.19], [0.125, -0.19]].map(([x, y]) => new Vector2(x, y)), seg),
    new MeshStandardMaterial({ color: 0x9a9aa0, metalness: 1, roughness: 0.4, side: DoubleSide }),
  );
  spinner.add(collar);
  spinner.add(new Mesh(
    new CylinderGeometry(0.126, 0.126, 0.4, seg, 1, true),
    new MeshStandardMaterial({ color: 0x050506, roughness: 1, side: BackSide }),
  ));
  // viti della flangia
  const boltGeo = new CylinderGeometry(0.02, 0.02, 0.02, 12);
  const boltMat = new MeshStandardMaterial({ color: 0x6d6d73, metalness: 1, roughness: 0.35 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    for (const side of [1, -1]) {
      const bolt = new Mesh(boltGeo, boltMat);
      bolt.position.set(Math.cos(a) * 0.245, side * 0.18, Math.sin(a) * 0.245);
      spinner.add(bolt);
    }
  }

  // anello arancione sul bordo esterno
  const bandMat = new MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: 0.35, roughness: 0.4, side: DoubleSide });
  const band = new Mesh(new LatheGeometry([[1.003, -0.035], [1.003, 0.035]].map(([x, y]) => new Vector2(x, y)), seg), bandMat);
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
  const base = { x: 0, y: 0, scale: 1, visH: 1, visW: 1, rx: -0.28, ry: -0.42 };
  function layout() {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const visH = 2 * Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const visW = visH * camera.aspect;
    base.visH = visH;
    base.visW = visW;
    const vh = window.innerHeight;
    if (w > 900) {
      base.scale = Math.min(visH * 0.32, visW * 0.18);
      base.x = visW * 0.285;
      base.y = visH * 0.05;
    } else {
      // stessa composizione del desktop: disco grande, inclinato, che esce dal bordo destro
      base.scale = Math.min(visW * 0.44, (vh / h) * visH * 0.23);
      base.x = visW * 0.2;
      const py = 72 + vh * 0.22; // centro del disco in pixel dall'alto
      base.y = visH * (0.5 - py / h);
    }
    root.scale.setScalar(base.scale);
    render();
  }

  // ---------- interazione ----------
  const state = {
    spin: 0, spinVel: reducedMotion ? 0 : 0.35, baseVel: reducedMotion ? 0 : 0.35,
    tiltX: 0, tiltY: 0, targetTiltX: 0, targetTiltY: 0, dragTilt: 0,
    dragging: false, moved: 0, lastX: 0, lastY: 0, lastT: 0, scroll: 0,
    punch: 0, punchVel: 0, glow: 0, targetGlow: 0, hover: false,
  };
  const hint = hero.querySelector('[data-drag-hint]');
  const hintText = hint?.querySelector('span');
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const tmp = new Vector3();
  // area di presa invisibile: tutto il disco, foro compreso
  const hitDisc = new Mesh(new CylinderGeometry(1.02, 1.02, 0.34, 32), new MeshStandardMaterial());
  hitDisc.visible = false;
  spinner.add(hitDisc);
  const hitTargets = [hitDisc];

  const toNdc = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  const overPlate = (e) => {
    toNdc(e);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(hitTargets, false).length > 0;
  };

  function impulse(dir = 1) {
    state.spinVel += 14 * dir;
    state.punchVel -= 2.2;
    bandMat.emissiveIntensity = 2.2;
    if (navigator.vibrate) navigator.vibrate(12);
    kick();
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    state.targetTiltY = (e.clientX / window.innerWidth - 0.5) * 0.55;
    state.targetTiltX = (e.clientY / window.innerHeight - 0.5) * 0.4;
    // la luce segue il cursore nel piano davanti al disco
    toNdc(e);
    tmp.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position).normalize();
    const d = (2.2 - camera.position.z) / tmp.z;
    cursorLight.position.copy(camera.position).addScaledVector(tmp, d);
    if (!state.dragging) {
      state.hover = overPlate(e);
      canvas.classList.toggle('is-hover', state.hover);
    }
    state.targetGlow = state.hover || state.dragging ? 1 : 0.35;
  }, { passive: true });

  canvas.addEventListener('pointerdown', (e) => {
    if (!overPlate(e)) return;
    state.dragging = true;
    state.moved = 0;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.lastT = performance.now();
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('is-dragging');
    hint?.classList.remove('is-visible');
    requestGyro();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const now = performance.now();
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    const dt = Math.max(16, now - state.lastT) / 1000;
    state.moved += Math.abs(dx) + Math.abs(dy);
    const delta = dx * 0.012;
    state.spin -= delta;
    state.spinVel = MathUtils.clamp(-delta / dt, -18, 18);
    state.dragTilt = MathUtils.clamp(state.dragTilt + dy * 0.004, -0.5, 0.5);
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.lastT = now;
    kick();
  });
  const endDrag = () => {
    if (!state.dragging) return;
    state.dragging = false;
    canvas.classList.remove('is-dragging');
    if (state.moved < 6) impulse(-1); // tocco / clic senza trascinare = spinta
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { state.dragging = false; canvas.classList.remove('is-dragging'); });

  // tastiera: il disco è raggiungibile con Tab
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); impulse(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); state.spinVel -= 4; kick(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); state.spinVel += 4; kick(); }
  });

  // giroscopio (mobile): inclina il disco muovendo il telefono
  let gyroOn = false;
  function onOrient(e) {
    if (e.gamma == null || e.beta == null || (e.gamma === 0 && e.beta === 0)) return; // nessun sensore reale
    gyroOn = true;
    state.targetTiltY = MathUtils.clamp(e.gamma / 45, -1, 1) * 0.45;
    state.targetTiltX = MathUtils.clamp((e.beta - 45) / 45, -1, 1) * 0.3;
    kick();
  }
  function requestGyro() {
    if (gyroOn || reducedMotion || !touch) return;
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      DOE.requestPermission().then((r) => { if (r === 'granted') window.addEventListener('deviceorientation', onOrient); }).catch(() => {});
    }
  }
  if (touch && !reducedMotion && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', onOrient, { passive: true });
  }

  // ---------- loop ----------
  let running = false;
  let visible = true;
  let last = performance.now();
  let t = 0;
  let frames = 0;
  let slowFrames = 0;
  let idleFrames = 0;
  let firstFrame = true;

  function render() {
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      canvas.classList.add('is-ready');
      document.documentElement.classList.add('webgl-ready');
    }
  }

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
      state.spinVel += (state.baseVel - state.spinVel) * Math.min(1, dt * 1.4);
      state.spin += state.spinVel * dt;
      state.dragTilt += (0 - state.dragTilt) * Math.min(1, dt * 3);
    }
    state.tiltX += (state.targetTiltX - state.tiltX) * Math.min(1, dt * 4);
    state.tiltY += (state.targetTiltY - state.tiltY) * Math.min(1, dt * 4);

    // molla del "colpo" + bagliore del bordo che si spegne
    for (let k = 0; k < 4; k++) { // sotto-passi: molla stabile anche con frame lenti
      state.punchVel += (-state.punch * 180 - state.punchVel * 14) * (dt / 4);
      state.punch += state.punchVel * (dt / 4);
    }
    bandMat.emissiveIntensity += (0.35 + Math.min(Math.abs(state.spinVel) / 18, 1) * 0.9 - bandMat.emissiveIntensity) * Math.min(1, dt * 3);
    state.glow += (state.targetGlow - state.glow) * Math.min(1, dt * 5);
    cursorLight.intensity = state.glow * 9;

    const s = state.scroll;
    const bob = reducedMotion ? 0 : Math.sin(t * 1.1) * 0.006 * base.visH;
    spinner.rotation.y = state.spin;
    punch.scale.setScalar(1 + state.punch * 0.08);
    root.position.set(base.x, base.y + bob + s * base.visH * 0.35, 0);
    root.rotation.x = base.rx + state.tiltX + state.dragTilt + s * 1.0;
    root.rotation.y = base.ry + state.tiltY - s * 0.5;
    root.rotation.z = 0.08;

    if (!reducedMotion) {
      const p = dustGeo.attributes.position.array;
      const boost = 1 + Math.min(Math.abs(state.spinVel) / 6, 3);
      for (let i = 0; i < count; i++) {
        p[i * 3 + 1] += speed[i] * dt * boost;
        p[i * 3] += Math.sin(t * 0.3 + i) * 0.002;
        if (p[i * 3 + 1] > 4.5) p[i * 3 + 1] = -4.5;
      }
      dustGeo.attributes.position.needsUpdate = true;
    }

    render();

    // con reduced motion il loop si ferma quando il disco è fermo
    if (reducedMotion && !state.dragging && Math.abs(state.spinVel) < 0.001 && Math.abs(state.punch) < 0.001
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
    document.documentElement.classList.remove('has-webgl', 'webgl-ready');
  });

  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Disco da bilanciere Gym Tonic in 3D. Trascinalo o toccalo per farlo girare; da tastiera usa Invio o le frecce.');
  layout();
  kick();
  if (hintText && touch) hintText.textContent = 'Tocca o trascina il disco';
  setTimeout(() => hint?.classList.add('is-visible'), 400);
  setTimeout(() => hint?.classList.remove('is-visible'), 7000);
}
