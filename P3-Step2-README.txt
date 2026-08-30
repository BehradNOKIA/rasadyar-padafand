Rasadyar P3-Step2 — Evidence-to-Draft Analysis Engine

Basis:
- Built directly on P3-Step1.
- Does NOT require a cloud AI provider.
- Uses the existing WorldMonitor browser ML worker (NER + sentiment) when
  available, and always has a grounded local fallback.

Install complete files:
1) src/core/rasadyar-data/schema.ts
2) src/core/rasadyar-data/caseRepository.ts
3) src/core/rasadyar-data/reportRepository.ts
4) src/features/analysis/AnalysisCenter.tsx

Add:
5) src/features/analysis/analysisDraftEngine.ts

What changes in Analysis Center:
- New button: «تولید پیش‌نویس از شواهد»
- Machine output is shown in a separate preview.
- It is NOT automatically treated as analyst judgment.
- Analyst can:
  A) Apply only to empty fields
  B) Replace the structured assessment after confirmation
- Generated machine draft is stored separately as machineDraft.
- The analyst must still review and save the Case.
- Reports created later retain machineDraft inside the source Case snapshot.

Privacy / provider behavior:
- No cloud call is made by this P3-Step2 engine.
- If browser ML is supported, it uses local NER + sentiment.
- If browser ML is unavailable, deterministic grounded synthesis is used.
- The draft explicitly reports which mode generated it.

Build:
npm.cmd run build

Run:
npm.cmd run dev

Functional test:
1) Open Analysis Center.
2) Open/create a Case with at least 2 Evidence items if possible.
3) Click «تولید پیش‌نویس از شواهد».
4) Preview must appear.
5) Confirm the preview says either:
   - ML محلی مرورگر + قواعد تحلیلی
   OR
   - قواعد محلی مبتنی بر شواهد
6) Click «اعمال فقط در فیلدهای خالی».
7) Save draft.
8) Reopen Case.
9) New structured values must remain.

Canonical test:
const d = JSON.parse(localStorage.getItem("rasadyar_data_v1") || "{}");
const c = Object.values(d.cases || {})[0];

console.log({
  title: c?.title,
  hasMachineDraft: !!c?.machineDraft,
  engineVersion: c?.machineDraft?.engineVersion,
  engineMode: c?.machineDraft?.engineMode,
  evidenceUsed: c?.machineDraft?.evidenceIds?.length || 0,
  generatedAt: c?.machineDraft?.generatedAt,
  machineSituationSummary:
    c?.machineDraft?.assessment?.situationSummary
});

Expected:
hasMachineDraft: true

Important:
This is a draft-support engine, not autonomous decision-making.
The analyst remains responsible for final judgment.
