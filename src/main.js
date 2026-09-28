import { animate, inView, scroll } from 'motion';
import { SCHEDULE, romeNow, openStatus } from './hours.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Hero: 3D solo se WebGL è disponibile ---------- */
function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

function initHero3D() {
  const hero = $('[data-hero]');
  const canvas = $('[data-hero-canvas]');
  if (!hero || !canvas || !supportsWebGL()) return;
  const lowPower = matchMedia('(max-width: 900px), (pointer: coarse)').matches
    || (navigator.hardwareConcurrency || 8) <= 4
    || (navigator.deviceMemory || 8) <= 4;
  document.documentElement.classList.add('has-webgl');
  const fail = (err) => {
    console.warn('3D non disponibile, uso la versione statica.', err);
    document.documentElement.classList.remove('has-webgl', 'webgl-ready');
  };
  // Three.js arriva in un file separato, caricato dopo la pagina (script classico: funziona anche da file locale)
  const script = document.createElement('script');
  script.src = new URL('hero3d.js', document.currentScript?.src || $('script[src*="main.js"]').src).href;
  script.async = true;
  script.onload = () => {
    try {
      window.GymTonicHero.initHero({ canvas, hero, lowPower, reducedMotion }).catch(fail);
    } catch (err) { fail(err); }
  };
  script.onerror = fail;
  document.head.append(script);
}

/* ---------- Header ---------- */
function initHeader() {
  const header = $('[data-header]');
  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-mobile-menu]');
  let lastY = window.scrollY;

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 20);
    const menuOpen = toggle.getAttribute('aria-expanded') === 'true';
    header.classList.toggle('is-hidden', !menuOpen && y > 600 && y > lastY + 4);
    if (y < lastY - 4) header.classList.remove('is-hidden');
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    $('.sr-only', toggle).textContent = open ? 'Chiudi il menu' : 'Apri il menu';
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    header.classList.toggle('is-scrolled', open || window.scrollY > 20);
    if (open) $('a', menu).focus();
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); toggle.focus(); }
  });
  matchMedia('(min-width: 1081px)').addEventListener('change', (e) => e.matches && setMenu(false));

  // voce di menu attiva
  const links = $$('[data-nav] a');
  const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => io.observe(s));
}

/* ---------- Stato apertura (header + sezione orari) ---------- */
function initHours() {
  const pill = $('[data-status]');
  const live = $('[data-live-status]');
  const bars = $('[data-hours-bars]');
  const order = [1, 2, 3, 4, 5, 6, 0];
  const labels = { 0: 'D', 1: 'L', 2: 'M', 3: 'M', 4: 'G', 5: 'V', 6: 'S' };
  const START = 8 * 60;
  const END = 23 * 60;

  bars.innerHTML = order.map((d) => {
    const slot = SCHEDULE[d];
    const bar = slot
      ? `<i style="bottom:${((slot[0] - START) / (END - START)) * 100}%;height:${((slot[1] - slot[0]) / (END - START)) * 100}%"></i>`
      : '';
    return `<div class="bar" data-bar="${d}">${bar}<b>${labels[d]}</b></div>`;
  }).join('');
  inView(bars, () => { bars.classList.add('is-in'); }, { amount: 0.6 });

  const update = () => {
    const now = romeNow();
    const st = openStatus(now);
    for (const el of [pill, live]) {
      el.classList.toggle('is-open', st.open);
      el.classList.toggle('is-closed', !st.open);
    }
    $('[data-status-text]', pill).textContent = st.short;
    $('[data-live-title]', live).textContent = st.title;
    $('[data-live-sub]', live).textContent = st.sub;

    $$('[data-hours-body] tr').forEach((tr) => tr.classList.toggle('is-today', Number(tr.dataset.day) === now.day));
    $$('.bar', bars).forEach((b) => {
      const isToday = Number(b.dataset.bar) === now.day;
      b.classList.toggle('is-today', isToday);
      $('.now-line', b)?.remove();
      if (isToday && now.minutes > START && now.minutes < END) {
        const line = document.createElement('span');
        line.className = 'now-line';
        line.style.bottom = `${((now.minutes - START) / (END - START)) * 100}%`;
        b.append(line);
      }
    });
  };
  update();
  setInterval(update, 30_000);
}

/* ---------- Animazioni di ingresso ---------- */
function initReveals() {
  requestAnimationFrame(() => document.documentElement.classList.add('is-loaded'));
  $$('.hero .reveal').forEach((el) => el.classList.add('is-in'));
  if (reducedMotion) return;

  const targets = $$('.section-head, .spaces-head, .hours-intro, .hours-card, .comfort-card, .plan-card, .reviews-inner > *, .contact-info > *, .form-card, .footer-word');
  targets.forEach((el) => { el.style.opacity = '0'; });
  targets.forEach((el) => {
    inView(el, () => {
      const siblings = el.parentElement ? [...el.parentElement.children].filter((c) => targets.includes(c)) : [el];
      const i = Math.max(0, siblings.indexOf(el));
      animate(el, { opacity: [0, 1], y: [28, 0] }, { duration: 0.9, delay: Math.min(i, 4) * 0.08, ease: [0.16, 1, 0.3, 1] });
    }, { amount: 0.15 });
  });
}

/* ---------- Galleria "Spazi": scroll orizzontale guidato su desktop ---------- */
function initSpaces() {
  const section = $('[data-spaces]');
  const rail = $('[data-rail]');
  const track = $('[data-track]');
  const bar = $('[data-progress]');
  const mq = matchMedia('(min-width: 901px) and (min-height: 620px)');
  let stopScroll = null;

  const distance = () => {
    const gutter = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
    return Math.max(0, track.scrollWidth + gutter * 2 - window.innerWidth);
  };

  const setup = () => {
    stopScroll?.();
    stopScroll = null;
    track.style.transform = '';
    section.style.height = '';
    const pinned = mq.matches && !reducedMotion;
    section.classList.toggle('is-pinned', pinned);

    if (pinned) {
      section.style.height = `${window.innerHeight + distance()}px`;
      stopScroll = scroll((p) => {
        track.style.transform = `translate3d(${-p * distance()}px,0,0)`;
        bar.parentElement.style.setProperty('--p', p);
      }, { target: section, offset: ['start start', 'end end'] });
    } else {
      const onRail = () => {
        const max = rail.scrollWidth - rail.clientWidth;
        bar.parentElement.style.setProperty('--p', max > 0 ? rail.scrollLeft / max : 0);
      };
      rail.addEventListener('scroll', onRail, { passive: true });
      onRail();
      stopScroll = () => rail.removeEventListener('scroll', onRail);
    }
  };

  mq.addEventListener('change', setup);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(setup, 150); });
  // le immagini sono lazy: ricalcola quando il layout è definitivo
  window.addEventListener('load', setup);
  setup();
}

/* ---------- Lightbox ---------- */
function initLightbox() {
  const dialog = $('[data-lightbox-dialog]');
  const img = $('[data-lb-img]', dialog);
  const cap = $('[data-lb-caption]', dialog);
  const items = $$('[data-lightbox]').map((btn) => {
    const im = $('img', btn);
    const title = btn.closest('.space-card').querySelector('h3').textContent;
    return { src: im.currentSrc || im.src, full: im.src.replace('-420', ''), alt: im.alt, title, btn };
  });
  let index = 0;
  let opener = null;

  const show = (i) => {
    index = (i + items.length) % items.length;
    const it = items[index];
    img.src = it.full;
    img.alt = it.alt;
    cap.textContent = `${it.title} — ${it.alt}`;
    img.style.animation = 'none';
    void img.offsetWidth;
    img.style.animation = '';
  };

  items.forEach((it, i) => it.btn.addEventListener('click', () => {
    opener = it.btn;
    show(i);
    dialog.showModal();
  }));
  $('[data-lb-close]', dialog).addEventListener('click', () => dialog.close());
  $('[data-lb-prev]', dialog).addEventListener('click', () => show(index - 1));
  $('[data-lb-next]', dialog).addEventListener('click', () => show(index + 1));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
  dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));

  let sx = null;
  dialog.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  dialog.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    sx = null;
  });
}

/* ---------- Tabs "Per chi" (pattern WAI-ARIA) ---------- */
function initTabs() {
  const root = $('[data-tabs]');
  const tabs = $$('[role="tab"]', root);
  const select = (tab, focus = false) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = $(`#${t.getAttribute('aria-controls')}`);
      panel.hidden = !on;
      if (on && !reducedMotion) {
        panel.classList.remove('is-entering');
        void panel.offsetWidth;
        panel.classList.add('is-entering');
      }
    });
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (e.key in map) {
        e.preventDefault();
        select(tabs[(map[e.key] + tabs.length) % tabs.length], true);
      }
    });
  });

  // i pulsanti nei pannelli preselezionano l'obiettivo nel modulo
  $$('[data-goal]').forEach((a) => a.addEventListener('click', () => {
    const radio = $(`input[name="obiettivo"][value="${a.dataset.goal}"]`);
    if (radio) radio.checked = true;
  }));
}

/* ---------- Modulo contatti ---------- */
function initForm() {
  const form = $('[data-form]');
  const success = $('[data-form-success]');
  const label = $('[data-submit-label]', form);

  const rules = [
    { el: $('#f-name'), err: $('#e-name'), ok: (v) => v.trim().length >= 2 },
    { el: $('#f-phone'), err: $('#e-phone'), ok: (v) => /^[+\d][\d\s./-]{5,}$/.test(v.trim()) },
    { el: $('#f-email'), err: $('#e-email'), ok: (v) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) },
    { el: $('#f-privacy'), err: $('#e-privacy'), ok: (_, el) => el.checked },
  ];

  const check = (r) => {
    const valid = r.ok(r.el.value, r.el);
    r.el.setAttribute('aria-invalid', String(!valid));
    if (valid) r.el.removeAttribute('aria-describedby');
    else r.el.setAttribute('aria-describedby', r.err.id);
    r.err.hidden = valid;
    return valid;
  };
  rules.forEach((r) => {
    r.el.addEventListener('blur', () => { if (r.el.value || r.el.type === 'checkbox') check(r); });
    r.el.addEventListener('input', () => { if (r.el.getAttribute('aria-invalid') === 'true') check(r); });
    r.el.addEventListener('change', () => { if (r.el.type === 'checkbox') check(r); });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const results = rules.map(check);
    const firstBad = rules[results.indexOf(false)];
    if (firstBad) { firstBad.el.focus(); return; }

    const data = Object.fromEntries(new FormData(form));
    const endpoint = form.dataset.endpoint;
    label.textContent = 'Invio in corso…';
    form.querySelector('[type="submit"]').disabled = true;

    let sent = false;
    if (endpoint) {
      // Collegamento reale: impostare data-endpoint (es. Formspree, Make, backend proprio)
      try {
        const res = await fetch(endpoint, {
          method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        sent = res.ok;
      } catch { sent = false; }
    } else {
      await new Promise((r) => setTimeout(r, 700));
    }

    const first = String(data.nome).trim().split(/\s+/)[0];
    $('[data-success-text]', success).textContent = sent
      ? `Grazie ${first}! Ti ricontatteremo al ${data.telefono} per fissare la visita (${data.fascia.toLowerCase()}).`
      : `Grazie ${first}! Ecco il riepilogo: obiettivo "${data.obiettivo}", fascia ${data.fascia.toLowerCase()}, telefono ${data.telefono}.`;
    $$('.form-demo-note', success).forEach((n) => { n.hidden = sent; });
    form.hidden = true;
    success.hidden = false;
    success.focus();
    label.textContent = 'Invia richiesta';
    form.querySelector('[type="submit"]').disabled = false;
  });

  $('[data-form-reset]').addEventListener('click', () => {
    form.reset();
    rules.forEach((r) => { r.el.removeAttribute('aria-invalid'); r.err.hidden = true; });
    success.hidden = true;
    form.hidden = false;
    $('#f-name').focus();
  });
}

/* ---------- Mappa: caricata solo su richiesta (privacy + velocità) ---------- */
function initMap() {
  const btn = $('[data-map-load]');
  btn?.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.google.com/maps?q=Corso+Re+Arduino+87,+10086+Rivarolo+Canavese+TO&output=embed';
    iframe.title = 'Mappa: Gym Tonic, Corso Re Arduino 87, Rivarolo Canavese';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    $('[data-map]').replaceChildren(iframe);
  });
}

/* ---------- Barra azioni mobile ---------- */
function initQuickBar() {
  const bar = $('.quick-bar');
  const hero = $('[data-hero]');
  const contact = $('#contatti');
  let pastHero = false;
  let atContact = false;
  const sync = () => bar.classList.toggle('is-visible', pastHero && !atContact);
  new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; sync(); }, { rootMargin: '-40% 0px 0px 0px' }).observe(hero);
  new IntersectionObserver(([e]) => { atContact = e.isIntersecting; sync(); }, { threshold: 0.2 }).observe($('.form-card', contact));
}

$$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
initHeader();
initHours();
initReveals();
initSpaces();
initLightbox();
initTabs();
initForm();
initMap();
initQuickBar();
initHero3D();
