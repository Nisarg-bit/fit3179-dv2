
---

## Note on data paths in the chart specifications

Every `.vg.json` in `/specs` loads its data from an absolute URL:

    https://raw.githubusercontent.com/Nisarg-bit/fit3179-dv2/main/data/<file>

raw.githubusercontent.com serves these with `access-control-allow-origin: *`, so a
spec can be pasted straight into the Vega Editor (vega.github.io/editor) and will
render — relative paths such as `data/states.csv` would not resolve there.

Consequence to be aware of: these URLs hard-code the repository name and the `main`
branch. Renaming the repo or the default branch breaks every chart.
