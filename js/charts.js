// Loads every spec in specs/ into its container and applies shared config.
//
// BUILD: bump this whenever a spec changes. GitHub Pages caches static assets,
// so without it the browser keeps serving the previous version of a .vg.json
// and edits appear to have no effect.
const BUILD = '2026-10-07i';
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
    await vegaEmbed(el, `specs/${spec}?v=${BUILD}`, {
      actions: { export: true, source: false, compiled: false, editor: false },
      config: THEME(),
      renderer: 'canvas'
    });
  } catch (e) {
    el.innerHTML = `<p style="color:#d03b3b;font-size:14px">Could not load <code>${spec}</code> — ${e}</p>`;
    console.error(spec, e);
  }
}

document.querySelectorAll('.viz[data-spec]').forEach(draw);

// redraw on theme change so chart ink follows the page
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  document.querySelectorAll('.viz[data-spec]').forEach(el => { el.innerHTML = ''; draw(el); });
});
