Rasadyar P3-Step7 — Evidence Consistency & Conflict Review

Built directly on P3-Step6 confirmed by the user.

Replace complete files:
1) src/core/rasadyar-data/schema.ts
2) src/core/rasadyar-data/caseRepository.ts
3) src/core/rasadyar-data/reportRepository.ts
4) src/features/analysis/AnalysisCenter.tsx
5) src/features/analysis/analysisHistory.ts

Add:
6) src/features/analysis/evidenceRelationship.ts

New capability:
- Local Evidence relationship scan
- Possible contradiction detection
- Cross-source corroboration candidates
- Near-duplicate detection
- Same-source concentration warning
- Temporal divergence
- Location divergence
- Analyst review status + note
- Stale-scan detection if Evidence changes
- Revision History records relationship-review changes
- Report sourceAnalysisSnapshot retains the relationship review

Review statuses:
- unreviewed
- accepted
- resolved
- dismissed
- needs-review

Important:
This is NOT fact verification.
The detector uses local lightweight heuristics:
- lexical overlap
- negation asymmetry
- source metadata
- timestamps
- geography

Every finding remains advisory until analyst review.

Build:
npm.cmd run build

Run:
npm.cmd run dev

Functional test:
1) Open a Case with at least 2 Evidence items.
2) Confirm «بازبینی تعارض، هم‌پوشانی و استقلال شواهد» appears.
3) Click «اسکن تعارض و هم‌پوشانی».
4) Review one finding and add an analyst note.
5) Save and reopen the Case.
6) Review status and note must remain.
7) Add/remove Evidence.
8) Stale scan warning should appear until scanning again.
9) Save after review changes.
10) Revision History should mention changes to Evidence relationship review.

Canonical test:
const d = JSON.parse(localStorage.getItem("rasadyar_data_v1") || "{}");
const c = Object.values(d.cases || {})[0];
const r = c?.evidenceRelationshipRegister;

console.log({
  title: c?.title,
  hasRelationshipRegister: !!r,
  scanVersion: r?.scanVersion,
  scannedEvidence: r?.evidenceIds?.length || 0,
  findings: r?.findings?.length || 0,
  unreviewed:
    (r?.findings || []).filter(x => x.reviewStatus === "unreviewed").length,
  accepted:
    (r?.findings || []).filter(x => x.reviewStatus === "accepted").length,
  resolved:
    (r?.findings || []).filter(x => x.reviewStatus === "resolved").length
});

Expected after scan + save:
hasRelationshipRegister: true
scanVersion: "local-heuristic-v1"

Regression:
- Machine Draft still works.
- Human Review still works.
- Evidence Traceability still works.
- Quality panel still works.
- Revision/Audit Trail still works.
- Stale Machine Draft guard still works.
- Send-for-review guard still works.
- Report creation still works.
