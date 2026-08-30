Rasadyar P2-Step3 — Analysis Case Dual Write

Files:
1) src/core/rasadyar-data/caseRepository.ts   NEW
2) src/core/rasadyar-data/index.ts            REPLACE
3) src/features/analysis/AnalysisCenter.tsx   REPLACE

What this step does:
- Keeps rasadyar_analyses fully operational.
- Mirrors Analysis Cases to rasadyar_data_v1.cases.
- Stores Case -> evidenceIds[] relationships.
- Ensures Evidence/Archive are canonical before linking.
- Existing legacy Cases are mirrored once when Analysis Center opens.
- Deleting a Case removes the canonical Case record but preserves Evidence/Archive history.

Do NOT:
- delete rasadyar_analyses
- delete rasadyar_reports
- run legacy migration manually

Build:
npm.cmd run build

Runtime test:
1) Open Analysis Center.
2) Create or edit/save one Case with at least one Evidence.
3) Browser Console:

const d = JSON.parse(localStorage.getItem("rasadyar_data_v1") || "{}");
console.log({
  cases: Object.keys(d.cases || {}).length,
  evidence: Object.keys(d.evidence || {}).length,
  archives: Object.keys(d.archives || {}).length
});

To inspect Case -> Evidence relationship:
console.log(
  Object.values(d.cases || {}).map(c => ({
    id: c.id,
    title: c.title,
    status: c.status,
    evidenceIds: c.evidenceIds
  }))
);
