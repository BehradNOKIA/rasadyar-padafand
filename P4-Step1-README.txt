Rasadyar P4-Step1 — Unified Source Intake Foundation

Built directly on P3-Step8 confirmed by the user.
P3 is now closed. P4 starts with this integration foundation.

AnalysisBridge:
The complete replacement file included here is based on the last confirmed
P2-Step2 AnalysisBridge. P3 did not modify AnalysisBridge.

Replace complete files:
1) src/core/rasadyar-data/schema.ts
2) src/core/rasadyar-data/evidenceRepository.ts
3) src/core/rasadyar-data/reportRepository.ts
4) src/features/analysis/analysisBridge.ts
5) src/features/analysis/AnalysisCenter.tsx
6) src/features/reports/ReportCenter.tsx

Add:
7) src/features/analysis/sourceIntake.ts

P4-Step1 objective:
Create ONE normalized source contract so future monitoring panels can enter:
Source -> Evidence -> Archive -> Case -> Analysis -> Report

New Evidence families:
- sanctions
- radiation
- economic
- cyber
- aviation
- maritime
- weather
Existing:
- news
- live-stream
- alert
- map
- infrastructure
- manual

Main adapter:
openAnalysisWithSourceObservation(observation)

The adapter:
1) normalizes the source object
2) creates a stable Evidence ID
3) preserves provider/externalId/domain/severity/confidence/tags/metadata
4) creates a metadata-card Archive when no image is provided
5) passes Evidence through the existing AnalysisBridge
6) keeps canonical dual-write active
7) opens/stages Evidence in AnalysisCenter
8) Report snapshots preserve source metadata

Automatic analysis-domain routing:
cyber -> سایبری
sanctions/economic -> اقتصادی
radiation -> پرتویی
infrastructure -> زیرساخت
aviation/maritime -> حمل‌ونقل
weather -> طبیعی

Important:
This step is the P4 connector FOUNDATION.
It does not fabricate or fetch source data and does not yet modify a specific
WorldMonitor source panel.

Build:
npm.cmd run build

Run:
npm.cmd run dev

Regression:
- News -> Analysis
- Live Stream -> Analysis
- Alert -> Analysis
- all P3 workflows
- Report creation

Future panel integration contract:

import {
  openAnalysisWithSourceObservation,
} from "../features/analysis/sourceIntake";

openAnalysisWithSourceObservation({
  kind: "infrastructure",
  title: "عنوان واقعی رویداد",
  provider: "نام منبع واقعی",
  externalId: "شناسه واقعی منبع",
  observedAt: new Date().toISOString(),
  summary: "خلاصه واقعی داده",
  severity: "high",
  metadata: {
    assetType: "power",
  },
});

Do not invent values. Each P4-Step2+ connector should map its real source
object into this contract.
