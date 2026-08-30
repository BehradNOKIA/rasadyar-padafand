Rasadyar P3-Step4 — Analysis Quality & Confidence

Basis:
- Built directly on P3-Step3 confirmed by the user.
- No new cloud/API dependency.
- Scores ANALYTICAL PROCESS QUALITY, not truth of real-world claims.

Install complete files:
1) src/core/rasadyar-data/schema.ts
2) src/core/rasadyar-data/caseRepository.ts
3) src/core/rasadyar-data/reportRepository.ts
4) src/features/analysis/AnalysisCenter.tsx

Add:
5) src/features/analysis/analysisQuality.ts

Quality dimensions:
- Evidence Quality
- Source Diversity
- Freshness
- Archive Coverage
- Evidence Consistency / corroboration proxy
- Information Gap Handling
- Human Review Completion
- Machine–Analyst Agreement
- Analytical Completeness
- Confidence Calibration

Important:
Machine–Analyst Agreement has zero weight in Overall Score.
Disagreeing with AI is not treated as low-quality analysis.

Evidence Consistency is a metadata-based proxy and does not claim
content-level fact verification.

Outputs:
- Overall Analysis Quality Score /100
- Quality Level
- Review Readiness
- Evidence Strength Score
- Analyst Confidence
- Suggested Evidence-based Confidence
- Machine Draft stale state
- Machine–Analyst Agreement %
- Strengths
- Cautions

Persistence:
- On Case save, a qualityAssessment snapshot is saved.
- Canonical Case retains qualityAssessment.
- Report sourceAnalysisSnapshot retains qualityAssessment.

Build:
npm.cmd run build

Run:
npm.cmd run dev

Functional test:
1) Open Analysis Center.
2) Open an existing Case with Evidence.
3) Confirm «کیفیت و اطمینان پرونده تحلیل» appears.
4) Scores should react when Evidence/structured fields/Human Review/confidence change.
5) Save Case and reopen it.
6) Case card should show Quality /100.

Canonical test:
const d = JSON.parse(localStorage.getItem("rasadyar_data_v1") || "{}");
const c = Object.values(d.cases || {})[0];

console.log({
  title: c?.title,
  hasQualityAssessment: !!c?.qualityAssessment,
  overallScore: c?.qualityAssessment?.overallScore,
  qualityLevel: c?.qualityAssessment?.qualityLevel,
  reviewReadiness: c?.qualityAssessment?.reviewReadiness,
  evidenceStrength: c?.qualityAssessment?.evidenceStrengthScore,
  suggestedConfidence:
    c?.qualityAssessment?.suggestedEvidenceConfidence,
  agreement:
    c?.qualityAssessment?.machineAnalystAgreementRate,
  dimensions:
    c?.qualityAssessment?.dimensions?.length
});

Expected after Save:
hasQualityAssessment: true
dimensions: 10

Regression:
- Machine Draft generation still works.
- Human Review still works.
- Stale Draft guard still works.
- Send-for-review guard still works.
- Report creation still works.
