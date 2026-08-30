Rasadyar P2-Step5 — Alert -> Evidence -> Case

Files:
1) src/core/rasadyar-data/alertRepository.ts   NEW
2) src/core/rasadyar-data/caseRepository.ts    REPLACE
3) src/core/rasadyar-data/index.ts             REPLACE
4) src/components/StrategicRiskPanel.ts        REPLACE

Behavior:
- StrategicRiskPanel alerts are mirrored into rasadyar_data_v1.alerts.
- Every alert gets/keeps evidenceId = alert-evidence-<alertId>.
- Case sync automatically rebuilds alert.caseIds[] from Case.evidenceIds[].
- Alert status automatically becomes linked-to-case when it is attached to a Case.
- Existing workflow remains active.
- No legacy keys are deleted.

Build:
npm.cmd run build

Runtime test:
1) npm.cmd run dev
2) Open/refresh the Strategic Risk / Alerts panel once.
3) Console:

const d = JSON.parse(localStorage.getItem("rasadyar_data_v1") || "{}");

console.log({
  cases: Object.keys(d.cases || {}).length,
  evidence: Object.keys(d.evidence || {}).length,
  archives: Object.keys(d.archives || {}).length,
  reports: Object.keys(d.reports || {}).length,
  alerts: Object.keys(d.alerts || {}).length
});

console.table(
  Object.values(d.alerts || {}).map(a => ({
    title: a.title,
    priority: a.priority,
    status: a.status,
    evidenceId: a.evidenceId,
    caseIds: (a.caseIds || []).join(", ")
  }))
);

Link test:
- Click "افزودن به تحلیل" on one strategic alert.
- Add it to an existing open Case or create/save a new Case.
- Re-run the console.table above.
- That alert should have:
    status = "linked-to-case"
    caseIds = [the selected Case id]
