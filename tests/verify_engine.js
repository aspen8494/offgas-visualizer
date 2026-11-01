/* Engine-vs-chain verification.
 * Run: node tests/verify_engine.js   (from the repo root)
 * Computes the train with DEFAULT slider values and compares the stack
 * against the facility-chain snapshot shipped in js/data.js. */
"use strict";
global.window = {};   // emulate the browser global for js/data.js
require("../js/data.js");
const E = require("../js/engine.js");
const OG = global.window.OG_BASIS;

function approx(a, b, tol) { return Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-12); }

const cfg = {
  runtime_d: OG.meta.runtime_d,
  mol_per_scfm: OG.meta.mol_per_scfm,
  air_n2_fraction: OG.meta.air_n2_fraction,
  wesp_air_scfm: OG.wesp_air_scfm,
  mw: E.MW_DEFAULT,
  stack_T_F: OG.stack_ref_state.T_F,
  stages: {
    sbs: { dfs: { particulate: 90, HCl: 30, HF: 20, SO2: 30, NO: 2, NO2: 2, Hg: 1, semivolatile: 3 },
           T_F_out: 100, P_out_kPa: 91.3614 },
    wesp: { dfs: { particulate: 98, HCl: 1.5, HF: 1.5, SO2: 1.5, NO: 1, NO2: 1, Hg: 1, semivolatile: 50 },
            T_F_out: 100, P_out_kPa: 90.1160 },
    heme: { dfs: { particulate: 50 }, T_F_out: 100 },
    heater: { dF_F: 36 },
    hepa: { particulate_df: 10000 },
    carbon: { dfs: { Hg: 1000 }, T_F_out: 159 },
    mordenite: { dfs: { I2: 1000 }, T_F_out: 159 },
    sco: { removal: 0.95, species: ["CO", "H2", "CH3CN"] },
    scr: { removal: 0.95, nh3_slip_ppmv: 25, stoich: 1.0 },
  },
};

const res = E.computeTrain(
  { species: OG.feed.map(s => ({ sp: s.sp, ph: s.ph, mol_s: s.mol_s })), T_F: OG.feed_state.T_F },
  cfg);

const ref = {};
for (const r of OG.stack_reference) ref[r.sp] = r.g_s;

let failures = 0;
const rows = [];
for (const r of res.stack) {
  const rref = ref[r.sp];
  if (rref === undefined) {
    if (r.g_s > 1e-6) { rows.push(`NEW  ${r.sp} ${r.g_s.toFixed(3)} g/s (absent from chain reference)`); }
    continue;
  }
  if (r.g_s < 1e-5 && rref < 1e-4) continue;   // trace tail, both ~0
  const tol = { N2: 0.02, O2: 0.02, H2O: 0.05, CO2: 0.10, CO: 0.02, NO: 0.15, NO2: 0.15,
                CH3CN: 0.02, HCl: 0.10, HF: 0.10, SO2: 0.10, Hg: 0.05, NH3: 0.10 }[r.sp] ?? 0.25;
  const ok = approx(r.g_s, rref, tol);
  rows.push(`${ok ? " ok " : "FAIL"} ${r.sp.padEnd(8)} engine ${r.g_s.toFixed(4).padStart(9)}  chain ${rref.toFixed(4).padStart(9)} g/s`);
  if (!ok) failures++;
}
// chain species the engine dropped entirely
for (const sp in ref) {
  const r = res.stack.find(x => x.sp === sp);
  if (!r && ref[sp] > 1e-4) { rows.push(`FAIL ${sp.padEnd(8)} engine ABSENT, chain ${ref[sp].toFixed(4)} g/s`); failures++; }
}

console.log("stack totals: engine", res.stack_total_g_s.toFixed(2), "g/s | chain", OG.stack_ref_state.total_g_s.toFixed(2), "g/s");
console.log(rows.join("\n"));
if (failures || !approx(res.stack_total_g_s, OG.stack_ref_state.total_g_s, 0.05)) {
  console.error(failures ? `\n${failures} FAILURES` : "\ntotal-flow mismatch >5%");
  process.exit(1);
}
console.log("PASS: engine stack reproduces the chain snapshot within tolerance");