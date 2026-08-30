Rasadyar P2-Step2 — Evidence + Archive Dual Write

Replace/add exactly these files:

1) src/core/rasadyar-data/evidenceRepository.ts   [NEW]
2) src/core/rasadyar-data/index.ts                [REPLACE]
3) src/features/analysis/analysisBridge.ts        [REPLACE]

Do NOT run legacy migration yet.
Do NOT delete rasadyar_analyses / rasadyar_reports.

Test:
- npm.cmd run build
- npm.cmd run dev
- Add one NEW live/news/alert evidence to Analysis
- Browser console:
  const d = JSON.parse(localStorage.getItem("rasadyar_data_v1") || "{}");
  console.log({
    evidence: Object.keys(d.evidence || {}).length,
    archives: Object.keys(d.archives || {}).length
  });
