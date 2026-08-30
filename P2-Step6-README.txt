Rasadyar P2-Step6 — Final Repository Layer

Recommended installation:
1) Replace the ENTIRE folder:
   src/core/rasadyar-data/
   with the folder from this package.

2) Replace:
   src/features/analysis/AnalysisCenter.tsx
   src/features/reports/ReportCenter.tsx

Architecture:
UI -> RasadyarDataService / Repositories -> Storage Adapter -> localStorage
Future:
UI -> Same service/repositories -> API Adapter -> Backend / Database

What changed:
- AnalysisCenter no longer directly reads/writes rasadyar_analyses.
- AnalysisCenter no longer directly reads/writes rasadyar_reports.
- ReportCenter no longer directly reads/writes rasadyar_reports.
- Legacy compatibility and Canonical dual-write are centralized in dataService.ts.
- Canonical read repositories exist for Case/Evidence/Archive/Report/Alert.
- No UI redesign.
- No legacy store deletion.

Do NOT delete:
rasadyar_analyses
rasadyar_reports

Build:
npm.cmd run build

Run:
npm.cmd run dev

Regression test:
- Existing Analysis Cases appear.
- Existing Reports appear.
- Add Evidence and save Case.
- Save/edit Report.
- Alerts still work.

Console:
const s = JSON.parse(localStorage.getItem("rasadyar_data_v1") || "{}");
console.log({
  cases: Object.keys(s.cases || {}).length,
  evidence: Object.keys(s.evidence || {}).length,
  archives: Object.keys(s.archives || {}).length,
  reports: Object.keys(s.reports || {}).length,
  alerts: Object.keys(s.alerts || {}).length
});

If UI remains correct and counts remain populated, P2 can be closed.
