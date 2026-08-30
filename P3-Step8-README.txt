Rasadyar P3-Step8 — Final Case Readiness Dashboard

Built directly on P3-Step7 confirmed by the user.

Replace complete files:
1) src/core/rasadyar-data/schema.ts
2) src/core/rasadyar-data/caseRepository.ts
3) src/core/rasadyar-data/reportRepository.ts
4) src/features/analysis/AnalysisCenter.tsx
5) src/features/analysis/analysisHistory.ts

Add:
6) src/features/analysis/caseReadiness.ts

This is the P3 closure step.

Readiness checks:
- Evidence Sufficiency
- Source Diversity
- Archive Coverage
- Structured Analysis Completeness
- Machine Draft Freshness
- Human Review
- Evidence Traceability
- Conflict / Independence Review
- Analysis Quality Threshold
- Information Gaps
- Revision / Audit Trail

Final outputs:
- Case Readiness Score /100
- Ready / Needs Attention / Not Ready
- Blockers
- Warnings
- Strengths
- Final Review Readiness decision

Workflow rule:
When sending a Case to "review", the final P3 readiness gate now applies.
Existing Machine-Draft Human Review safeguards remain in place.

Hard blockers include:
- fewer than 2 Evidence items
- structured analysis completeness below 70%
- stale Machine Draft, when Machine Draft exists
- incomplete Human Review, when Machine Draft exists
- traceability coverage below 50%
- stale Evidence relationship scan
- unresolved HIGH relationship/conflict finding
- very low overall Quality score

Warnings do not block:
- limited source diversity
- low archive coverage
- no relationship scan yet
- open medium findings
- missing explicit information-gap statement
- new unsaved Case with limited Revision/Audit history

Important:
Readiness is a workflow/analysis preparedness metric.
It does NOT prove that the underlying real-world event is true.

Persistence:
- readinessAssessment saved in canonical Case
- retained in report source Case snapshot
- retained in revision snapshots
- Case cards show readiness state

Small regression fix:
- Removes an accidental duplicate persist(updated) call from Step7.

Build:
npm.cmd run build

Run:
npm.cmd run dev

Functional test:
1) Open a Case.
2) Confirm «داشبورد آمادگی پرونده برای بررسی نهایی» appears.
3) Observe blockers/warnings.
4) Try Send for Review with a hard blocker:
   it must be blocked with a Persian message.
5) Resolve blockers:
   - >=2 Evidence
   - structured completeness >=70
   - traceability >=50
   - if Machine Draft exists: fresh + Human Review completed
   - if relationship scan exists: not stale, no unresolved HIGH finding
6) Reach readiness score >=80.
7) Send for Review should succeed.
8) Save and reopen Case; readiness state should remain on the Case.
9) Create Report; sourceAnalysisSnapshot must include readinessAssessment.

Canonical test:
const d = JSON.parse(localStorage.getItem("rasadyar_data_v1") || "{}");
const c = Object.values(d.cases || {})[0];

console.log({
  title: c?.title,
  hasReadiness: !!c?.readinessAssessment,
  readinessScore: c?.readinessAssessment?.score,
  readinessStatus: c?.readinessAssessment?.status,
  readyForFinalReview: c?.readinessAssessment?.readyForFinalReview,
  blockers: c?.readinessAssessment?.blockers?.length || 0,
  warnings: c?.readinessAssessment?.warnings?.length || 0,
  checks: c?.readinessAssessment?.checks?.length || 0
});

Expected after Save:
hasReadiness: true
checks: 11

P3 Regression:
- Machine Draft works
- Human Review works
- Analysis Quality works
- Evidence Traceability works
- Revision/Audit works
- Evidence Conflict Review works
- Report creation works

If all tests pass, P3 can be formally closed.
