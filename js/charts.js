// Loads every spec in specs/ into its container and applies shared config.
//
// BUILD versions this file and the stylesheet from index.html, so a hard reload
// picks up new code. Specs are NOT versioned by a query string: GitHub Pages and
// raw.githubusercontent both ignore query strings for caching, so a stale spec
// could survive a BUILD bump. Instead each spec is fetched with
// cache: 'reload', which forces a revalidated network fetch every time.
const BUILD = '2026-10-08a';
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

async function draw(el) {
  const spec = el.dataset.spec;
  try {
    // cache: 'reload' bypasses the HTTP cache for this request, so an edited
    // spec always takes effect without needing a cache-busting query string.
    const res = await fetch(`specs/${spec}`, { cache: 'reload' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const json = await res.json();
    await vegaEmbed(el, json, {
      actions: { export: true, source: false, compiled: false, editor: false },
      config: THEME(),
      renderer: 'canvas'
    });
  } catch (e) {
    el.innerHTML = `<p style="color:#d03b3b;font-size:14px">Could not load <code>${spec}</code> \u2014 ${e}</p>`;
    console.error(spec, e);
  }
}

document.querySelectorAll('.viz[data-spec]').forEach(draw);
