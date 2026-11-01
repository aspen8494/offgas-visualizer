#!/usr/bin/env python3
"""Generate js/data.js for the off-gas visualizer from the extracted basis.

Run: python3 scripts/generate_data.py   (from the repo root)
Reads data/basis.json (produced by the HLW model harness) and emits a
self-contained window.OG_BASIS blob.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = json.load(open(os.path.join(ROOT, "data", "basis.json")))

og = B["streams"]["melter_offgas"]
st = B["streams"]["stack"]

# Molar mass map (g/mol) for the species this app tracks.
MW = {
    "H2O": 18.015, "N2": 28.014, "O2": 31.998, "NO": 30.006, "NO2": 46.006,
    "CO": 28.010, "CO2": 44.009, "CH3CN": 41.052, "HCl": 36.461,
    "HF": 20.006, "SO2": 64.066, "SO3": 80.064, "Hg": 200.592,
    "I2": 253.808, "H3BO3": 61.831, "Na2O": 61.979, "SiO2": 60.084,
    "Al2O3": 101.961, "B2O3": 69.620, "CaO": 56.077, "K2O": 94.196,
    "Fe2O3": 159.687, "Cr2O3": 151.990, "P2O5": 283.919, "NiO": 74.692,
    "UO3": 286.028, "ThO2": 264.036, "MgO": 40.304, "ZnO": 81.380,
    "TiO2": 79.866, "Li2O": 29.879, "MnO2": 86.937, "ZrO2": 123.222,
    "Tc2O7": 263.004, "CsOH": 149.912, "Cs2O": 281.810, "SeO2": 110.958,
    "LiBO2": 49.754, "Br2": 159.808, "NH3": 17.031, "HNO3": 63.012,
    "RuO4": 211.054, "Cl2": 70.906, "SrO": 103.619, "BaO": 153.326,
    "La2O3": 325.81, "CeO2": 172.114, "Nd2O3": 336.478,
}


def mw_of(key):
    return MW.get(key, 100.0)


feed = []
for r in og["species"]:
    feed.append({
        "sp": r["species"], "ph": r["phase"], "mw": mw_of(r["species"]),
        "mol_s": r["mol_s"], "g_s": r["g_s"],
    })

stack_ref = []
for r in st["species"]:
    stack_ref.append({
        "sp": r["species"], "ph": r["phase"],
        "mol_pct": r["mol_pct"], "g_s": r["g_s"],
    })

out = {
    "meta": {
        "source": ("HLW System Modeling facility chain, campaign 135.120.100 "
                   "c1, hold-rate glass basis 5.0 t/d"),
        "tag": B["basis"]["scenario_tag"],
        "campaign_idx": B["basis"]["campaign_idx"],
        "glass_tpd_resolved": B["basis"]["campaign_glass_t"],
        "mf_flow_gpm": B["basis"]["mf_flow_gpm_resolved"],
        "runtime_d": B["basis"]["runtime_d"],
        "glass_t": B["basis"]["glass_t"],
        "canisters": B["basis"]["canisters"],
        "mol_per_scfm": 0.0199186,
        "air_n2_fraction": 0.79,
    },
    "feed": feed,                      # melter off-gas (includes 200 scfm melter air)
    "stack_reference": stack_ref,      # chain-computed stack for comparison
    "feed_state": {"T_F": og["T_F"], "P_kPa": og["P_kPa"],
                   "total_g_s": og["g_s_total"]},
    "stack_ref_state": {"T_F": st["T_F"], "total_g_s": st["g_s_total"]},
    "wesp_air_scfm": 300.0,
    "hepa_particulate_df": 10000.0,
}
out["stage_states"] = {k: {"T_F": v["T_F"], "P_kPa": v["P_kPa"],
                           "flow_g_s": v["flow_g_s"]}
                       for k, v in (B.get("stage_states") or {}).items()}

js = ("// Auto-generated from the HLW facility-model basis "
      "(scripts/generate_data.py).\n"
      "// Basis: campaign " + out["meta"]["tag"] + " c" +
      str(out["meta"]["campaign_idx"]) + ", 5 t/d hold-rate glass basis.\n"
      "window.OG_BASIS = ")
js += json.dumps(out, separators=(",", ":")) + ";\n"

os.makedirs(os.path.join(ROOT, "js"), exist_ok=True)
p = os.path.join(ROOT, "js", "data.js")
open(p, "w").write(js)
print("wrote", p, "| feed species:", len(feed),
      "| feed g/s:", round(og["g_s_total"], 2))