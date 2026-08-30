Rasadyar P3-Step3 — Analyst vs Machine Review

Basis:
- Built directly on the P3-Step2 version already confirmed by the user.
- Adds an auditable Human-in-the-loop review record.
- No cloud AI dependency is introduced.

Install complete files:
1) src/core/rasadyar-data/schema.ts
2) src/core/rasadyar-data/caseRepository.ts
3) src/core/rasadyar-data/reportRepository.ts
4) src/features/analysis/AnalysisCenter.tsx

Add:
5) src/features/analysis/humanReview.ts

Main workflow:
Evidence
 -> Machine Draft
 -> Analyst Assessment
 -> Side-by-side Human Review
 -> Case Review
 -> Report

Review decisions:
- accepted       = تأیید تحلیلگر
- edited         = اصلاح‌شده توسط تحلیلگر
- rejected       = رد تحلیل ماشینی
- needs-review   = نیازمند بررسی بیشتر

Important safeguards:
- Human review is tied to the exact machineDraft.draftId.
- If Evidence changes after machine draft generation, the draft is marked stale.
- A stale draft cannot be finalized in Human Review.
- Editing analyst assessment invalidates the previous Human Review.
- Generating a new machine draft invalidates the previous Human Review.
- If a Case has a machineDraft, it cannot be sent to "review" until the
  Human Review is completed.
- Cases without machineDraft keep the previous workflow unchanged.
- Reports created from the Case retain both machineDraft and humanReview
  inside sourceAnalysisSnapshot.

Functional test:
1) Open a Case that has a machine draft.
2) Click «مقایسه ماشین / تحلیلگر».
3) Confirm side-by-side comparison appears.
4) Set a decision for each section.
5) Leave one section as «نیازمند بررسی بیشتر» and click complete:
   completion must be rejected.
6) Resolve all sections as accepted / edited / rejected.
7) Click «تکمیل بازبینی انسانی».
8) Save draft.
9) Reopen Case and confirm review remains.
10) Send for review. It should now succeed.

Stale-draft test:
1) Generate a machine draft.
2) Add or remove Evidence.
3) Open Human Review.
4) A stale warning must appear.
5) Finalizing review must be blocked until draft regeneration.

Canonical test:
const d = JSON.parse(localStorage.getItem("rasadyar_data_v1") || "{}");
const c = Object.values(d.cases || {})[0];

console.log({
  title: c?.title,
  machineDraftId: c?.machineDraft?.draftId,
  hasHumanReview: !!c?.humanReview,
  humanReviewStatus: c?.humanReview?.status,
  reviewedBy: c?.humanReview?.reviewedBy,
  reviewedSections:
    Object.keys(c?.humanReview?.sections || {}).length,
  completedAt: c?.humanReview?.completedAt
});

Expected after completion + save:
hasHumanReview: true
humanReviewStatus: "completed"
reviewedSections: 11
