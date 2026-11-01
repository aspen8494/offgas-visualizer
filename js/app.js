/* Off-gas capture visualizer — UI wiring (client-side only).
 * Requires window.OG_BASIS (js/data.js) and OG_ENGINE (js/engine.js). */
"use strict";

const B = window.OG_BASIS;
const E = window.OG_ENGINE;

/* ------------------------------------------------ stage definitions ---- */
/* Slider seeds come from the facility model's SME data (units/*.yaml). */
const STAGE_DEFS = [
  { id: "sbs", title: "SBS Scrubber", cond: "quench → 100 °F, saturated; −35 in WC",
    groups: [
      ["particulate", "Particulate (glass dust)", 90, 3],
      ["HCl", "HCl", 30, 3],
      ["HF", "HF", 20, 3],
      ["SO2", "SO₂", 30, 3],
      ["NO", "NO", 2, 3],
      ["NO2", "NO₂", 2, 3],
      ["Hg", "Mercury (Hg)", 1, 3],
      ["semivolatile", "Semivolatiles (Tc, Cs, I, Br, Se, Li)", 3, 3],
    ] },
  { id: "wesp", title: "WESP (wet electrostatic precipitator)", cond: "→ 100 °F; 300 SCFM air injection",
    groups: [
      ["particulate", "Particulate", 98, 3],
      ["HCl", "HCl", 1.5, 3],
      ["HF", "HF", 1.5, 3],
      ["SO2", "SO₂", 1.5, 3],
      ["NO", "NO", 1, 3],
      ["NO2", "NO₂", 1, 3],
      ["Hg", "Mercury (Hg)", 1, 3],
      ["semivolatile", "Semivolatiles", 50, 3],
    ] },
  { id: "heme", title: "HEME Demister", cond: "droplet separator; no re-saturation",
    groups: [
      ["mist", "Droplets (mist)", 3, 3],
      ["particulate", "Particulate", 50, 3],
    ] },
  { id: "hepa", title: "HEPA Filter", cond: "10⁴ particulate DF at 900 SCFM design",
    groups: [
      ["particulate", "Particulate", 10000, 0],
    ] },
  { id: "carbon", title: "Carbon Bed", cond: "activated carbon, Hg adsorption; 8 in WC",
    groups: [
      ["Hg", "Mercury (Hg)", 1000, 3],
    ] },
  { id: "mordenite", title: "Silver Mordenite", cond: "AgI chemisorption; 4 in WC",
    groups: [
      ["I2", "Iodine (I₂)", 1000, 3],
    ] },
  { id: "sco", title: "SCO (selective catalytic oxidation)", cond: "650 °F; 4 in WC; O₂ excess",
    reactive: true,
    groups: [
      ["removal", "CO / H₂ / CH₃CN conversion", 0.95, 0.001, 1.0, "%"],
    ] },
  { id: "scr", title: "SCR (selective catalytic reduction)", cond: "NOx abatement; 4 in WC; NH₃ reagent",
    reactive: true,
    groups: [
      ["removal", "NOx removal", 0.95, 0.001, 1.0, "%"],
      ["nh3_slip", "NH₃ slip", 25, 0, 200, "ppmv"],
    ] },
];
// non-composition stages, rendered as pass-through cards
const PASS_DEFS = [
  { id: "heater", title: "Reheat Heater", cond: "+36 °F above dew point" },
  { id: "fan1", title: "Fan 1", cond: "35 in WC boost" },
  { id: "hx", title: "Regenerative HX + Reheat 2", cond: "→ 650 °F" },
  { id: "fan2", title: "Fan 2 + Stack", cond: "lift to 102 kPa exhaust" },
];

const DEFAULTS = {};
for (const d of STAGE_DEFS)
  for (const g of d.groups) DEFAULTS[d.id + "::" + g[0]] = g[2];

function cfgFromSliders() {
  const cfg = {
    runtime_d: B.meta.runtime_d,
    mol_per_scfm: B.meta.mol_per_scfm,
    air_n2_fraction: B.meta.air_n2_fraction,
    wesp_air_scfm: B.wesp_air_scfm,
    mw: E.MW_DEFAULT,
    stages: {
      sbs: { dfs: dfsOf("sbs"), T_F_out: STAGE_T.sbs, P_out_kPa: 91.3614 },
      wesp: { dfs: dfsOf("wesp"), T_F_out: STAGE_T.wesp, P_out_kPa: 90.1160 },
      heme: { dfs: dfsOf("heme"), T_F_out: STAGE_T.heme },
      heater: { dF_F: 36 },
      hepa: { particulate_df: val("hepa::particulate") },
      carbon: { dfs: dfsOf("carbon"), T_F_out: STAGE_T.carbon },
      mordenite: { dfs: dfsOf("mordenite"), T_F_out: STAGE_T.mordenite },
      sco: { removal: val("sco::removal"),
             species: ["CO", "H2", "CH3CN"] },
      scr: { removal: val("scr::removal"),
             nh3_slip_ppmv: val("scr::nh3_slip"), stoich: 1.0 },
    },
    stack_T_F: SNAP.stack ? SNAP.stack.T_F : undefined,
  };
  return cfg;
}
function dfsOf(id) {
  const o = {};
  for (const d of STAGE_DEFS) if (d.id === id)
    for (const g of d.groups) o[g[0]] = val(id + "::" + g[0]);
  return o;
}
function val(key) {
  const el = document.getElementById("sl-" + key);
  return el ? Number(el.value) : DEFAULTS[key];
}

/* ------------------------------------------------------ rendering ---- */
const STAGE_T = {};   // filled from the model snapshot below
const SNAP = (B.stage_states || {});
function snapT(mapKey, fallback) {
  return SNAP[mapKey] ? SNAP[mapKey].T_F : fallback;
}
STAGE_T.sbs = snapT("sbs_out", 100);
STAGE_T.wesp = snapT("wesp_out", 100);
STAGE_T.heme = snapT("heme_out", 100);
STAGE_T.carbon = snapT("carbon_bed_out", 159);
STAGE_T.mordenite = snapT("mordenite_out", 159);

const feedGS = B.feed_state.total_g_s;

function fmt(x, d = 2) {
  if (x === 0) return "0";
  if (x >= 1000 || x < 0.01 && x > 0) return x.toExponential(d);
  return x.toLocaleString(undefined, { maximumFractionDigits: d });
}

function render() {
  const res = E.computeTrain(
    { species: B.feed.map(s => ({ sp: s.sp, ph: s.ph, mol_s: s.mol_s })), T_F: B.feed_state.T_F },
    cfgFromSliders());

  // stage cards
  const rail = document.getElementById("train");
  rail.innerHTML = "";
  const flow0 = res.stages[0] ? feedGS : feedGS;
  let prev = feedGS;

  function card(id, title, cond, gS, capture, idx) {
    const el = document.createElement("div");
    el.className = "stage open";
    el.dataset.id = id;
    const capTxt = Object.entries(capture || {})
      .sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([sp, g]) => `${sp} ${fmt(g)} g/s`).join(" · ");
    const dfSummary = (STAGE_DEFS.find(d => d.id === id) || { groups: [] }).groups
      .filter(g => g[0] !== "removal" && g[0] !== "nh3_slip")
      .map(g => `${g[1]} <b>${prettyDF(val(id + "::" + g[0]))}</b>`).join(", ");
    el.innerHTML = `
      <div class="stage-head">
        <span class="stage-title">${title} <span class="caret" data-cat="1">▾ expand</span></span>
        <span class="stage-cond">${cond}</span>
        <span class="stage-flow">▲ ${fmt(gS, 1)} g/s${gS !== undefined ? `<span class="muted"> (${fmt(gS / prev * 100 - 100, 1)}% of inlet)</span>` : ""}</span>
      </div>
      <div class="stage-body">
        ${dfSummary ? `<div class="muted" style="margin-bottom:6px">Decontamination factors (DF = m<sub>in</sub>/m<sub>captured</sub>) — ${dfSummary}</div>` : ""}
        <div class="sliders"></div>
        <div class="muted" id="cap-${id}" style="margin-top:6px">${capTxt ? "→ sink: " + capTxt : ""}</div>
      </div>`;
    addSliders(el.querySelector(".sliders"), STAGE_DEFS.find(d => d.id === id), id, () => render());
    el.querySelector(".stage-title").addEventListener("click", () => el.classList.toggle("open"));
    rail.appendChild(el);
    if (gS !== undefined) prev = gS;
  }

  // feed card
  feedCard(rail);

  let si = 0, pi = 0;
  const order = ["sbs", "heater", "wesp", "heme", "hepa", "fan1", "carbon",
                 "mordenite", "hx", "sco", "scr", "fan2"];
  for (const id of order) {
    const pass = PASS_DEFS.find(p => p.id === id);
    if (pass) {
      const snapKey = { heater: "heater_out", fan1: "fan1_out", hx: "hx_cold_out", fan2: "stack" }[id];
      passCard(rail, pass.title, pass.cond,
        SNAP[snapKey] ? SNAP[snapKey].T_F : undefined, () => render());
      continue;
    }
    const st = res.stages[si]; si++;
    const def = STAGE_DEFS.find(d => d.id === id);
    const cap = Object.entries(st.capture_g_s)
      .filter(([sp]) => sp !== "_nh3_dosed_g_s")
      .sort((a, b) => b[1] - a[1]).slice(0, 4);
    card(id, def.title, def.cond, st.g_s_total, Object.fromEntries(cap), si);
    const c = res.stages[si - 1].capture_g_s._nh3_dosed_g_s;
    if (c) {
      const capEl = document.getElementById("cap-" + id);
      capEl.innerHTML += ` · NH₃ dosed ${fmt(c)} g/s reagent`;
    }
  }

  renderStack(res);
}

function passCard(rail, title, cond, T_F) {
  const el = document.createElement("div");
  el.className = "stage";
  el.innerHTML = `
    <div class="stage-head">
      <span class="stage-title">${title}</span>
      <span class="stage-cond">${cond}${T_F !== undefined ? ` · ${Math.round(T_F)} °F` : ""}</span>
      <span class="stage-flow muted">no composition change</span>
    </div>`;
  rail.appendChild(el);
}

function feedCard(rail) {
  const el = document.createElement("div");
  el.className = "stage open";
  el.innerHTML = `
    <div class="stage-head">
      <span class="stage-title">Melter Off-Gas</span>
      <span class="stage-cond">700 °F · 100.1 kPa · incl. 200 SCFM melter air</span>
      <span class="stage-flow">${fmt(feedGS, 1)} g/s</span>
    </div>
    <div class="stage-body">
      <div class="muted">Campaign-mean feed after the melter (135.120.100 c1,
      5 t/d basis): 68 tracked species. Top-8 by mass:</div>
      <div style="font-family:var(--mono);font-size:12px;color:var(--accent);margin-top:4px">
        ${B.feed.slice(0, 8).map(r => `${r.sp} ${fmt(r.g_s, 2)}`).join(" · ")}
      </div>
    </div>`;
  el.querySelector(".stage-title").addEventListener("click", () => el.classList.toggle("open"));
  rail.appendChild(el);
}

function prettyDF(df) {
  if (df >= 1000) return df.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (df < 1.001 && df > 0.999) return "1 (pass-through)";
  return df.toFixed(2);
}

function addSliders(box, def, id, cb) {
  if (!def) return;
  for (const [key, label, defv, lo, hi, unit] of def.groups) {
    const row = document.createElement("div");
    row.className = "sl";
    const key_full = `${id}::${key}`;
    if (unit === "%") {                       // fraction slider (0–100 %)
      row.innerHTML = `<label>${label}</label>
        <input type="range" id="sl-${key_full}" min="${lo}" max="${hi}"
               step="${(hi - lo) / 999 || 0.001}" value="${defv}">
        <span class="val" id="vl-${key_full}"></span>`;
      const upd = () => {
        const v = row.querySelector("input").value;
        row.querySelector(".val").textContent = (Number(v) * 100).toFixed(1) + " %";
      };
      row.querySelector("input").addEventListener("input", () => { upd(); cb(); });
      upd();
    } else if (unit === "ppmv") {             // linear slip slider
      row.innerHTML = `<label>${label}</label>
        <input type="range" id="sl-${key_full}" min="${lo}" max="${hi}"
               step="1" value="${defv}">
        <span class="val" id="vl-${key_full}"></span>`;
      const upd = () => {
        row.querySelector(".val").textContent = row.querySelector("input").value + " ppmv";
      };
      row.querySelector("input").addEventListener("input", () => { upd(); cb(); });
      upd();
    } else {                                  // DF slider, log scale
      const lo2 = Math.log10(1), hi2 = Math.log10(hi || 1e5);
      row.innerHTML = `<label>${label}</label>
        <input type="range" id="sl-${key_full}" min="${lo2}" max="${hi2}"
               step="${((hi2 - lo2) / 200).toFixed(4)}" value="${Math.log10(Math.max(defv, 1))}">
        <span class="val" id="vl-${key_full}"></span>`;
      const upd = () => {
        const df = Math.pow(10, Number(row.querySelector("input").value));
        row.querySelector(".val").textContent = prettyDF(df);
      };
      // slider stores log10 DF; map onto the engine value
      const input = row.querySelector("input");
      input.dataset.logdf = "1";
      input.addEventListener("input", () => { upd(); cb(); });
      input.id = "sl-" + key_full;
      // log-DF sliders: engine reads Math.pow(10, value) through valDF
      input.dataset.kind = "logdf";
      upd();
    }
    box.appendChild(row);
  }
}

const _nativeVal = val;
function val(key) {
  const el = document.getElementById("sl-" + key);
  if (!el) return DEFAULTS[key];
  const v = Number(el.value);
  return el.dataset.kind === "logdf" ? Math.pow(10, v) : v;
}

/* ------------------------------------------------------------ stack ---- */
const STACK_COLORS = ["#4fd1c5", "#5b8def", "#f6a34a", "#e06c9f", "#9f7be5",
                      "#3fb86f", "#c0523f", "#778faa", "#2a9d8f"];

function renderStack(res) {
  // summary bar: top 8 species by mass
  const sum = document.getElementById("stack-summary");
  const top = res.stack.slice(0, 8);
  const tot = res.stack_total_g_s;
  let left = 0;
  const bar = top.map((r, i) => {
    const w = r.g_s / tot * 100;
    const seg = `<div style="width:${w}%;background:${STACK_COLORS[i % STACK_COLORS.length]}"
      title="${r.sp} ${r.mass_pct.toFixed(2)} mass %"></div>`;
    return seg;
  }).join("");
  sum.innerHTML = `
    <div class="stack-bar">${bar}</div>
    <div class="stack-legend">${top.map((r, i) =>
      `<span class="dot" style="background:${STACK_COLORS[i % STACK_COLORS.length]}"></span>${r.sp}`).join(" &nbsp; ")}</div>`;

  document.getElementById("stack-summary").title = "Stack mass composition (top 8)";

  const tb = document.querySelector("#stack-table tbody");
  const rt_s = B.meta.runtime_d * 86400;
  tb.innerHTML = res.stack.map(r => `
    <tr><td>${r.sp}${r.ph === "cr" ? " 💠" : ""}</td><td>${fmt(r.g_s)}</td>
    <td>${r.mol_pct.toFixed(3)}</td><td>${r.mass_pct.toFixed(3)}</td>
    <td>${fmt(r.g_s * rt_s / 1000, 1)}</td></tr>`).join("");

  document.getElementById("stack-note").textContent =
    `Total ${fmt(res.stack_total_g_s, 1)} g/s at ${Math.round(res.stack_T_F)} °F · ` +
    `model reference ${fmt(B.stack_ref_state.total_g_s, 1)} g/s at ${Math.round(B.stack_ref_state.T_F)} °F`;

  // capture ledger
  const t = E.totalCaptureKg(res);
  const rows = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const cb = document.querySelector("#capture-table tbody");
  cb.innerHTML = rows.map(([sp, kg]) =>
    `<tr><td>${sp}</td><td>${fmt(kg, 1)}</td></tr>`).join("") || '<tr><td colspan="2" class="muted">none</td></tr>';
}

/* -------------------------------------------------------------- init ---- */
document.getElementById("basis-line").textContent =
  `Scenario ${B.meta.tag} · campaign ${B.meta.campaign_idx} · glass ${B.meta.glass_t.toFixed(1)} t ` +
  `(${B.meta.glass_tpd_resolved.toFixed(2)} t/d hold-rate basis) · runtime ${B.meta.runtime_d.toFixed(1)} d · ` +
  `${B.meta.canisters.toFixed(0)} canisters`;

render();

document.title = "Off-Gas Capture Visualizer — " + B.meta.tag;