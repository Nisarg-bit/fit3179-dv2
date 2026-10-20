// Loads every spec in specs/ into its container and applies shared config.
//
// BUILD versions this file and the stylesheet from index.html, so a hard reload
// picks up new code. Specs are NOT versioned by a query string: GitHub Pages and
// raw.githubusercontent both ignore query strings for caching, so a stale spec
// could survive a BUILD bump. Instead each spec is fetched with
// cache: 'reload', which forces a revalidated network fetch every time.
const BUILD = '2026-10-17c';
// System fonts only: nothing is downloaded, so charts can be drawn straight away.
const BODY_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const DISPLAY_FONT = BODY_FONT;
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
    for (const s of secs) if (s.getBoundingClientRect().top + window.scrollY <= y) cur = s;
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
