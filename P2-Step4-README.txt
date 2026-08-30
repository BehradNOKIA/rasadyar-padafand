Rasadyar P2-Step4 — Report Dual Write

Files:
1) src/core/rasadyar-data/reportRepository.ts   NEW
2) src/core/rasadyar-data/index.ts              REPLACE
3) src/features/reports/ReportCenter.tsx        REPLACE

What this step does:
- Keeps rasadyar_reports fully operational.
- Mirrors Reports into rasadyar_data_v1.reports.
- Stores sourceCaseId/sourceCaseTitle.
- Stores immutable source Case snapshot.
- Stores immutable evidenceSnapshots[].
- Ensures Evidence/Archive canonical records for traceability.
- Existing legacy Reports are mirrored once when Report Center opens.
- Deleting a Report removes the canonical Report record but preserves Evidence/Archive history.

Do NOT:
- delete rasadyar_reports
- delete rasadyar_analyses
- run legacy migration manually

Build:
npm.cmd run build

Runtime test:
1) Open Report Center once.
2) Save/edit/publish any report OR simply let the existing reports load.
3) Browser Console:

const d = JSON.parse(localStorage.getItem("rasadyar_data_v1") || "{}");

console.log({
  cases: Object.keys(d.cases || {}).length,
  evidence: Object.keys(d.evidence || {}).length,
  archives: Object.keys(d.archives || {}).length,
  reports: Object.keys(d.reports || {}).length
});

Inspect Report relations:

console.log(
  Object.values(d.reports || {}).map(r => ({
    id: r.id,
    title: r.title,
    status: r.status,
    sourceCaseId: r.sourceCaseId,
    evidenceSnapshots: r.evidenceSnapshots?.length || 0
  }))
);

Expected:
- reports should be > 0 when legacy rasadyar_reports contains reports.
- sourceCaseId should be present for reports created from Analysis.
- evidenceSnapshots should match the number of evidence items stored in the report.
