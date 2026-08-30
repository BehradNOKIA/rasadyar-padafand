Rasadyar P3-Step5 — Evidence Traceability & Citation Matrix

Built directly on P3-Step4 confirmed by the user.

Replace complete files:
1) src/core/rasadyar-data/schema.ts
2) src/core/rasadyar-data/caseRepository.ts
3) src/core/rasadyar-data/reportRepository.ts
4) src/features/analysis/AnalysisCenter.tsx
5) src/features/analysis/analysisDraftEngine.ts
6) src/features/analysis/analysisQuality.ts

Add:
7) src/features/analysis/evidenceTraceability.ts

New capability:
- Analyst-curated Evidence -> analytical-section traceability.
- 11 sections aligned with Human Review.
- Evidence checkbox selection per section.
- Analyst note per section.
- Machine Draft can suggest citation links for empty sections.
- Machine suggestions remain advisory.
- Report source Case snapshot retains traceability.

Quality:
- New 11th quality dimension: traceabilityCoverage.
- Review-readiness requires at least 50% traceability coverage.
- This affects advisory Quality Readiness only; existing Human Review gate remains.

Important:
A citation link means the Evidence informed the analytical section.
It does not mean the Evidence proves the claim or has been independently verified.

Build:
npm.cmd run build

Run:
npm.cmd run dev

Functional test:
1) Open a Case with Evidence.
2) Confirm «ردیابی شواهد و ماتریس استناد تحلیلی» appears.
3) Link Evidence to several analytical sections.
4) Add citation notes.
5) Save and reopen.
6) Links and notes must remain.
7) Quality panel must show «پوشش استناد تحلیلی».

For machine suggestions:
- Generate a NEW Machine Draft after installing Step5.
- Click «پیشنهاد استناد ماشین».
- Only empty citation sections should be filled.

Canonical test:
const d = JSON.parse(localStorage.getItem("rasadyar_data_v1") || "{}");
const c = Object.values(d.cases || {})[0];

console.log({
  title: c?.title,
  hasTraceability: !!c?.evidenceTraceability,
  traceabilityVersion: c?.evidenceTraceability?.version,
  linkedSections:
    Object.values(c?.evidenceTraceability?.sections || {})
      .filter(s => (s?.evidenceIds || []).length > 0).length,
  machineSuggestedFromDraftId:
    c?.evidenceTraceability?.machineSuggestedFromDraftId,
  qualityTraceabilityScore:
    c?.qualityAssessment?.traceabilityCoverageScore,
  qualityDimensions:
    c?.qualityAssessment?.dimensions?.length
});

Expected after save:
hasTraceability: true
qualityDimensions: 11

New Machine Draft citation test:
console.log({
  hasEvidenceCitations: !!c?.machineDraft?.evidenceCitations,
  citationSections:
    Object.keys(c?.machineDraft?.evidenceCitations || {}).length
});

Expected after regenerating Machine Draft:
hasEvidenceCitations: true
citationSections: 11
