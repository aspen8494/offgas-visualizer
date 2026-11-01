# Off-Gas Capture Visualizer (HLW Melter)

An interactive, fully client-side diagram of a Hanford HLW glass-melter
off-gas train — **SBS scrubber → WESP → HEME demister → reheat heater →
HEPA → Fan 1 → carbon bed → silver mordenite → regenerative HX + reheat →
SCO → SCR (+NH₃) → stack** — with decontamination-factor (DF) sliders on
every capture stage and live stack-composition readouts.

## Composition basis

Feed and reference stack compositions are campaign-mean steady streams
computed with the [HLW System Modeling facility chain](https://example.com)
(scenario **135.120.100**, campaign 1) on a **hold-rate glass basis of
5.0 t/day** (resolved MFV draw 2.3533 gpm, runtime 233.1 d, 1,165 t glass,
376 canisters). The snapshot shipped in `js/data.js` includes:

- the melter off-gas (261.9 g/s, 68 speciated entries, 700 °F) including
  the SME 200 SCFM melter air;
- per-stage T/P/flow snapshots for the temperature profile;
- the chain-computed stack reference (315.9 g/s, 414.9 °F).

The capture tables seeded into the sliders are the SME-locked values
(`sbs.yaml`, `wesp.yaml`, `heme.yaml`, `heater_hepa.yaml`,
`adsorber_beds.yaml`, `hx_sco_scr.yaml`). With all sliders at their
defaults the client engine reproduces the chain stack within a few
percent on every tracked species (verified by `node tests/verify_engine.js`).

## Run it

Static files only — no build step, no server, no external requests:

```bash
# any static server works
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

Host it as-is on GitHub Pages (repo Settings → Pages → deploy from
`main` root; a ready-made workflow is in
`.github/workflows/pages.yml`), or drop the `index.html` + `js/` + `css/`
tree onto any static host (Netlify, S3, your own web server).

## Using the visualizer

- **Click a stage title** to expand its DF sliders (log-scale DF sliders
  and percent/removal sliders for the catalytic reactors).
- Sliders recompute the full train instantly: per-stage mass flow, the
  mass passed to each stage's sink, and the stack readout (g/s, mol %,
  mass %, and kg per campaign).
- The stack summary bar and per-species table update live; the footer
  number on each card compares its flow against the previous stage.
- DF convention (same as the facility model): DF = m_in / m_captured,
  so DF 1 is pass-through and larger DFs capture more.

## Regenerating the basis snapshot

`scripts/generate_data.py` rebuilds `js/data.js` from
`data/basis.json` (exported by the facility-model harness script
`exports/offgas_visualizer_basis.json` inside the HLW modeling project).
Edit only if you re-run the chain on a different campaign/basis.

## Verification

```bash
node tests/verify_engine.js
```

Compares the default-slider stack flow of every shared species against
the facility-chain reference with per-species tolerances; exits non-zero
on failure. Requires node ≥ 18.