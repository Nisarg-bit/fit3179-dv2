// Loads every spec in specs/ into its container and applies shared config.
//
// BUILD versions this file and the stylesheet from index.html, so a hard reload
// picks up new code. Specs are NOT versioned by a query string: GitHub Pages and
// raw.githubusercontent both ignore query strings for caching, so a stale spec
// could survive a BUILD bump. Instead each spec is fetched with
// cache: 'reload', which forces a revalidated network fetch every time.
const BUILD = '2026-10-17c';
const BODY_FONT = 'Figtree, system-ui, -apple-system, "Segoe UI", sans-serif';
const DISPLAY_FONT = '"Zilla Slab", Rockwell, Georgia, serif';
// Canvas text is measured at draw time, so wait (briefly) for the web fonts before the
// first chart is drawn; if they are blocked the system fallbacks are used after 2.5 s.
const fontsReady = Promise.race([
  Promise.all(['400 13px Figtree', '600 13px Figtree', '700 13px Figtree', '600 17px "Zilla Slab"']
    .map(f => document.fonts.load(f))).catch(() => {}),
  new Promise(r => setTimeout(r, 2500))
]);
const THEME = () => {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  return {
    background: null,
    font: BODY_FONT,
    title:  { font: DISPLAY_FONT, fontWeight: 600, fontSize: 17, anchor: 'start', color: v('--ink'),
              subtitleFont: BODY_FONT, subtitleColor: v('--ink-2'), subtitleFontSize: 12.5, offset: 10 },
    axis:   { labelColor: v('--muted'), titleColor: v('--ink-2'),
              gridColor: v('--grid'), domainColor: v('--rule'), tickColor: v('--rule'),
              labelFontSize: 12, titleFontSize: 12, titleFontWeight: 600,
              titlePadding: 10, grid: true },
    legend: { labelColor: v('--ink-2'), titleColor: v('--ink-2'),
              labelFontSize: 12, titleFontSize: 12, titleFontWeight: 600, symbolSize: 90 },
    view:   { stroke: null },
    range:  { ramp: ['#cde2fb','#9ec5f4','#6da7ec','#3987e5','#2a78d6','#256abf','#184f95'],
              category: ['#2a78d6','#eb6834','#1baf7a'],
              diverging: ['#184f95','#2a78d6','#86b6ef','#f0efec','#ec8b8b','#d03b3b','#9b2020'] },
    text:   { color: v('--ink-2') },
    mark:   { color: v('--accent') }
  };
};


// Projected bounding boxes of each state at projection scale 1 (conic equal area,
// the same projection every map spec uses): [x0, y0, x1, y1]. The map centre is
// (0.018354, 0.926161) and the base scale is min(width / 0.628148, height / 0.602988) * 0.94.
const STATE_BOUNDS = {
  'New South Wales': [0.12945, 0.96675, 0.32625, 1.12885],
  'Victoria': [0.12399, 1.05426, 0.24932, 1.15056],
  'Queensland': [0.09294, 0.62467, 0.33243, 0.98725],
  'South Australia': [-0.04646, 0.9095, 0.13937, 1.12519],
  'Western Australia': [-0.29572, 0.69615, -0.04411, 1.08182],
  'Tasmania': [0.16057, 1.15479, 0.2222, 1.22766],
  'Northern Territory': [-0.05104, 0.64726, 0.10077, 0.91111],
  'Australian Capital Territory': [0.23709, 1.08609, 0.24653, 1.09974]
};
const MAP_CENTRE = [0.018354, 0.926161];

// Click-to-highlight for the bump chart. The spec has a plain `picked` param that its
// colour conditions read; a Vega-Lite point selection cannot span lines, dots and
// labels at once, so the clicks are wired here. Double-click clears the highlight.
function addPickHighlight(view) {
  let ok = false;
  try { view.signal('picked'); ok = true; } catch (e) { ok = false; }
  if (!ok) return;
  const pick = v => view.signal('picked', v).run();
  view.addEventListener('click', (e, item) => {
    const st = item && item.datum && item.datum.state;
    if (st) pick(st);
  });
  view.addEventListener('dblclick', () => pick(null));
}

// Zoom and pan for the five maps. Each map spec declares three plain params
// (mapZoom, mapPanX, mapPanY) that drive its projection; this wires buttons,
// mouse drag and Ctrl/Cmd + scroll to them. Specs without those params are left alone.
function addMapControls(el, view) {
  let ok = false;
  try { ok = typeof view.signal('mapZoom') === 'number'; } catch (e) { ok = false; }
  if (!ok) return;

  const MIN = 1, MAX = 16;
  const get = () => ({ z: view.signal('mapZoom'), x: view.signal('mapPanX'), y: view.signal('mapPanY') });
  const set = (z, x, y) => view.signal('mapZoom', z).signal('mapPanX', x).signal('mapPanY', y).run();
  const zoomAt = (factor, cx, cy) => {            // cx, cy: offset from the map centre, in px
    const s = get();
    const z = Math.min(MAX, Math.max(MIN, s.z * factor));
    if (z === s.z) return;
    const r = z / s.z;
    set(z, cx - (cx - s.x) * r, cy - (cy - s.y) * r);
    refresh();
  };

  // zoom and pan that frame one state (used by the dropdown on the dot map)
  const viewFor = name => {
    const b = STATE_BOUNDS[name];
    if (!b) return { z: 1, x: 0, y: 0 };
    const w = view.width(), h = view.height();
    const base = Math.min(w / 0.628148, h / 0.602988) * 0.94;
    const z = Math.min(MAX, Math.max(MIN, 0.8 * Math.min(w / ((b[2] - b[0]) * base), h / ((b[3] - b[1]) * base))));
    return { z, x: -base * z * ((b[0] + b[2]) / 2 - MAP_CENTRE[0]), y: -base * z * ((b[1] + b[3]) / 2 - MAP_CENTRE[1]) };
  };
  const hasStatePicker = el.dataset.spec === '08-campground-dots.vg.json';

  const bar = document.createElement('div');
  bar.className = 'map-controls';
  bar.innerHTML =
    (hasStatePicker
      ? '<label class="map-state">Show state <select aria-label="Zoom the map to a state">' +
        '<option value="">All of Australia</option><option value="custom" hidden>Custom view</option>' +
        Object.keys(STATE_BOUNDS).sort().map(n => '<option>' + n + '</option>').join('') +
        '</select></label>'
      : '') +
    '<button type="button" data-act="in" aria-label="Zoom in">+</button>' +
    '<button type="button" data-act="out" aria-label="Zoom out">−</button>' +
    '<button type="button" data-act="reset" aria-label="Reset the map view">Reset</button>';
  el.prepend(bar);

  const canvas = () => el.querySelector('canvas');
  const picker = bar.querySelector('select');
  const syncPicker = () => {
    if (!picker) return;
    const s = get();
    if (s.z === 1 && s.x === 0 && s.y === 0) { picker.value = ''; return; }
    const t = viewFor(picker.value);
    const same = picker.value && picker.value !== 'custom' &&
      Math.abs(t.z - s.z) < 0.01 && Math.abs(t.x - s.x) < 1 && Math.abs(t.y - s.y) < 1;
    if (!same) picker.value = 'custom';
  };
  if (picker) picker.addEventListener('change', () => {
    if (picker.value === 'custom') return;
    const t = viewFor(picker.value);
    set(t.z, t.x, t.y);
    refresh();
  });
  const refresh = () => {
    syncPicker();
    const c = canvas();
    if (c) c.style.cursor = get().z > 1 ? 'grab' : 'default';
    bar.querySelector('[data-act="reset"]').disabled = get().z === 1 && get().x === 0 && get().y === 0;
  };
  bar.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'in') zoomAt(1.6, 0, 0);
    if (b.dataset.act === 'out') zoomAt(1 / 1.6, 0, 0);
    if (b.dataset.act === 'reset') { set(1, 0, 0); refresh(); }
  });

  // offset of the pointer from the centre of the map frame
  const offsetFrom = ev => {
    const r = canvas().getBoundingClientRect();
    const o = view.origin();
    const pad = view.padding();
    const pl = typeof pad === 'number' ? pad : (pad.left || 0);
    const pt = typeof pad === 'number' ? pad : (pad.top || 0);
    return [ev.clientX - r.left - o[0] - pl - view.width() / 2,
            ev.clientY - r.top - o[1] - pt - view.height() / 2];
  };

  el.addEventListener('wheel', ev => {
    if (!(ev.ctrlKey || ev.metaKey)) return;      // plain scrolling still scrolls the page
    ev.preventDefault();
    const [cx, cy] = offsetFrom(ev);
    zoomAt(Math.exp(-ev.deltaY * 0.0025), cx, cy);
  }, { passive: false });

  let drag = null;
  el.addEventListener('pointerdown', ev => {
    if (ev.pointerType !== 'mouse' || ev.button !== 0 || get().z <= 1) return;
    if (!ev.target.closest('canvas')) return;
    drag = { sx: ev.clientX, sy: ev.clientY, ...get(), moved: false };
  });
  window.addEventListener('pointermove', ev => {
    if (!drag) return;
    const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    canvas().style.cursor = 'grabbing';
    set(drag.z, drag.x + dx, drag.y + dy);
  });
  window.addEventListener('pointerup', () => { if (drag) { drag = null; refresh(); } });
  refresh();
}

// Faceted charts cannot use width: "container", so size the panels from the space
// the card actually has. Without this the small multiples stop short of the right edge.
function fitFacetWidth(el, json) {
  if (!json.facet || !json.spec) return;
  const W = el.clientWidth || 900;
  json.columns = W < 700 ? 2 : 4;
  const spacing = 20, axis = 50, slack = 14;
  json.spec.width = Math.max(110, Math.floor((W - axis - spacing * (json.columns - 1) - slack) / json.columns));
}

let facetTimer;
window.addEventListener('resize', () => {
  clearTimeout(facetTimer);
  facetTimer = setTimeout(() => {
    document.querySelectorAll('.viz[data-spec="15-state-smallmultiples.vg.json"]').forEach(el => {
      const cols = el.clientWidth < 700 ? 2 : 4;
      if (el.dataset.cols !== String(cols) || Math.abs((Number(el.dataset.w) || 0) - el.clientWidth) > 24) { el.innerHTML = ''; draw(el); }
    });
  }, 250);
});

async function draw(el) {
  const spec = el.dataset.spec;
  try {
    // cache: 'reload' bypasses the HTTP cache for this request, so an edited
    // spec always takes effect without needing a cache-busting query string.
    await fontsReady;
    const res = await fetch(`specs/${spec}`, { cache: 'reload' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const json = await res.json();
    fitFacetWidth(el, json);
    const result = await vegaEmbed(el, json, {
      actions: { export: true, source: false, compiled: false, editor: false },
      config: THEME(),
      renderer: 'canvas'
    });
    el.dataset.w = el.clientWidth; el.dataset.cols = json.columns || '';
    addMapControls(el, result.view);
    addPickHighlight(result.view);
  } catch (e) {
    el.innerHTML = `<p style="color:#d03b3b;font-size:14px">Could not load <code>${spec}</code> \u2014 ${e}</p>`;
    console.error(spec, e);
  }
}

document.querySelectorAll('.viz[data-spec]').forEach(draw);


// Highlights the navbar link for the section currently under the bar.
(() => {
  const links = [...document.querySelectorAll('.topnav a[href^="#"]')].filter(a => a.getAttribute('href').length > 1 && a.getAttribute('href') !== '#top');
  const secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (!secs.length) return;
  const update = () => {
    const y = window.scrollY + 100;
    let cur = null;
    for (const s of secs) if (s.offsetTop <= y) cur = s;
    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atEnd) cur = secs[secs.length - 1];
    links.forEach(a => {
      const on = cur && a.getAttribute('href') === '#' + cur.id;
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      if (on) { const ul = a.closest('ul'); const r = a.getBoundingClientRect(), u = ul.getBoundingClientRect();
        if (r.left < u.left || r.right > u.right) ul.scrollTo({ left: a.offsetLeft - 40, behavior: 'smooth' }); }
    });
  };
  let t; window.addEventListener('scroll', () => { cancelAnimationFrame(t); t = requestAnimationFrame(update); }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();


// Campervan road dividers: the van drives across as the divider scrolls through the
// window, and its wheels turn with it. Reduced-motion users get a parked van.
(() => {
  const roads = [...document.querySelectorAll('.road')];
  if (!roads.length) return;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const update = () => {
    const vh = window.innerHeight;
    roads.forEach(r => {
      const top = r.getBoundingClientRect().top;
      const p = still ? 0.5 : Math.min(1, Math.max(0, (vh - top) / (vh * 0.85)));
      r.style.setProperty('--p', p.toFixed(4));
      r.style.setProperty('--spin', (still ? 0 : p * 1800).toFixed(1) + 'deg');
    });
  };
  let t; window.addEventListener('scroll', () => { cancelAnimationFrame(t); t = requestAnimationFrame(update); }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
