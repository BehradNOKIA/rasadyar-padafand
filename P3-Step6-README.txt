Rasadyar P3-Step6 — Revision History, Quality Trend & Audit Trail

Built directly on P3-Step5 confirmed by the user.

Replace complete files:
1) src/core/rasadyar-data/schema.ts
2) src/core/rasadyar-data/caseRepository.ts
3) src/core/rasadyar-data/reportRepository.ts
4) src/features/analysis/AnalysisCenter.tsx

Add:
5) src/features/analysis/analysisHistory.ts

What P3-Step6 adds:
- Analysis Revision History
- Lightweight Audit Trail
- Quality Score trend across saved revisions
- Snapshot hash for each revision
- Change summary per revision
- Report source snapshot keeps revision history/audit provenance

Revision events:
- created
- draft-saved
- sent-review
- approved
- evidence-added

Audit events:
- case-created
- revision-created
- sent-review
- approved
- evidence-added
- report-created

Storage safeguards:
- Max 25 revisions per Case
- Max 100 audit events per Case
- Revision snapshots store Evidence IDs only
- Full Evidence/archive images are NOT duplicated in revision history

Important:
This is still browser/localStorage prototype audit history.
For production, immutable revisions and audit events should later move to
server-side storage / database.

Build:
npm.cmd run build

Run:
npm.cmd run dev

Functional test:
1) Open an existing Case.
2) Save a draft after changing one field.
3) Confirm «تاریخچه نسخه‌ها و ممیزی پرونده» appears.
4) Confirm a revision is added.
5) Change another analytical field and save again.
6) Confirm a new revision and change summary.
7) Send for Review; confirm new revision/audit event.
8) Superadmin approves; confirm another revision/audit event.
9) Create Report; confirm «ایجاد گزارش» appears in Audit Trail.
10) Quality trend chips should show saved quality scores.

Canonical test:
const d = JSON.parse(localStorage.getItem("rasadyar_data_v1") || "{}");
const c = Object.values(d.cases || {})[0];

console.log({
  title: c?.title,
  revisionNumber: c?.revisionNumber,
  revisions: c?.revisionHistory?.length || 0,
  auditEvents: c?.auditTrail?.length || 0,
  lastRevision:
    c?.revisionHistory?.[c?.revisionHistory?.length - 1],
  lastAudit:
    c?.auditTrail?.[c?.auditTrail?.length - 1]
});

Expected after at least one save:
revisionNumber >= 1
revisions >= 1
auditEvents >= 1

Regression:
- Machine Draft still works.
- Human Review still works.
- Traceability matrix still works.
- Quality panel still works.
- Stale Draft guard still works.
- Send-for-review guard still works.
- Report creation still works.
