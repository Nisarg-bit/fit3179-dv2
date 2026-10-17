// Loads every spec in specs/ into its container and applies shared config.
//
// BUILD versions this file and the stylesheet from index.html, so a hard reload
// picks up new code. Specs are NOT versioned by a query string: GitHub Pages and
// raw.githubusercontent both ignore query strings for caching, so a stale spec
// could survive a BUILD bump. Instead each spec is fetched with
// cache: 'reload', which forces a revalidated network fetch every time.
const BUILD = '2026-10-17a';
const THEME = () => {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  return {
    background: null,
    font: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    title:  { fontSize: 15, anchor: 'start', color: v('--ink'),
              subtitleColor: v('--ink-2'), subtitleFontSize: 12.5, offset: 10 },
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

  const bar = document.createElement('div');
  bar.className = 'map-controls';
  bar.innerHTML =
    '<span class="map-hint">Drag to pan &middot; Ctrl + scroll to zoom</span>' +
    '<button type="button" data-act="in" aria-label="Zoom in">+</button>' +
    '<button type="button" data-act="out" aria-label="Zoom out">−</button>' +
    '<button type="button" data-act="reset" aria-label="Reset the map view">Reset</button>';
  el.prepend(bar);

  const canvas = () => el.querySelector('canvas');
  const refresh = () => {
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

async function draw(el) {
  const spec = el.dataset.spec;
  try {
    // cache: 'reload' bypasses the HTTP cache for this request, so an edited
    // spec always takes effect without needing a cache-busting query string.
    const res = await fetch(`specs/${spec}`, { cache: 'reload' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const json = await res.json();
    const result = await vegaEmbed(el, json, {
      actions: { export: true, source: false, compiled: false, editor: false },
      config: THEME(),
      renderer: 'canvas'
    });
    addMapControls(el, result.view);
  } catch (e) {
    el.innerHTML = `<p style="color:#d03b3b;font-size:14px">Could not load <code>${spec}</code> \u2014 ${e}</p>`;
    console.error(spec, e);
  }
}

document.querySelectorAll('.viz[data-spec]').forEach(draw);
