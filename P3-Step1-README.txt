Rasadyar P3-Step1 — Structured Analysis Model

This package is based on the exact P2-Step6 version confirmed by the user.

Install:
1) Replace the following complete files:
   src/core/rasadyar-data/schema.ts
   src/core/rasadyar-data/caseRepository.ts
   src/core/rasadyar-data/reportRepository.ts
   src/features/analysis/AnalysisCenter.tsx

2) Add the new file:
   src/features/analysis/structuredAnalysis.ts

No other files need to change in this step.

P3 structured model:
- Situation Summary
- Key Points (synchronized from existing findings)
- Actors / Factors
- Drivers
- Warning Indicators
- Analyst Confidence (synchronized from existing confidence)
- Information Gaps
- Assumptions
- Implications
- Analytical Judgment
- Likely / Worst / Best scenarios
- Indicators for each scenario
- Immediate / Short-term / Medium-term actions
- Monitoring Requirements

Compatibility:
- Existing Cases remain readable.
- Existing Evidence / Archive / Alert / Report workflows are retained.
- Existing fields are not removed.
- rasadyar_data_v1 Case records gain structuredAssessment.
- New reports created from completed Cases now retain structuredAssessment
  inside sourceAnalysisSnapshot.

Build:
npm.cmd run build

Run:
npm.cmd run dev

Regression test:
1) Open an old Analysis Case: it must open normally.
2) Fill one or two new structured fields and save draft.
3) Reopen the same Case: new fields must remain.
4) Existing Evidence cards must still appear.
5) Add an Evidence and save.
6) Send Case for review and approve as before.
7) Optional: convert to Report and confirm Report Center opens.

Canonical check:
const d = JSON.parse(localStorage.getItem("rasadyar_data_v1") || "{}");
const c = Object.values(d.cases || {})[0];
console.log({
  title: c?.title,
  hasStructuredAssessment: !!c?.structuredAssessment,
  situationSummary: c?.structuredAssessment?.situationSummary,
  warningIndicators: c?.structuredAssessment?.warningIndicators,
  likelyIndicators: c?.structuredAssessment?.scenarios?.likely?.indicators,
  immediateAction: c?.structuredAssessment?.actions?.immediate
});

If hasStructuredAssessment is true and saved values appear, P3-Step1 is complete.
