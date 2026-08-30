import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import { getCSSColor } from '@/utils';
import {
  calculateStrategicRiskOverview,
  getRecentAlerts,
  getAlertCount,
  type StrategicRiskOverview,
  type UnifiedAlert,
  type AlertPriority,
} from '@/services/cross-module-integration';
import { detectConvergence, type GeoConvergenceAlert } from '@/services/geo-convergence';
import {
  dataFreshness,
  getStatusColor,
  getStatusIcon,
  type DataFreshnessSummary,
} from '@/services/data-freshness';
import type { CountryScore } from '@/services/country-instability';
import { fetchCachedRiskScores, isElevatedCiiScore, toCountryScore, type CachedRiskScores } from '@/services/cached-risk-scores';
import { getCachedPosture } from '@/services/cached-theater-posture';
import { trustedHtml } from '@/utils/dom-utils';
import { openAnalysisWithEvidence } from '@/features/analysis/analysisBridge';
import { openAnalysisWithSourceObservation } from '@/features/analysis/sourceIntake';
import { can } from '@/auth/accessControl';
import { getCurrentUser } from '@/auth/userStore';
import { syncCanonicalAlerts } from '@/core/rasadyar-data';

type StrategicRiskDisplayLevel = 'critical' | 'high' | 'elevated' | 'normal' | 'low';
type StrategicRiskDisplayBand = {
  min: number;
  levelKey: StrategicRiskDisplayLevel;
  colorVar: string;
};

const STRATEGIC_RISK_BANDS: readonly StrategicRiskDisplayBand[] = [
  { min: 81, levelKey: 'critical', colorVar: '--semantic-critical' },
  { min: 66, levelKey: 'high', colorVar: '--semantic-high' },
  { min: 51, levelKey: 'elevated', colorVar: '--semantic-elevated' },
  { min: 31, levelKey: 'normal', colorVar: '--semantic-normal' },
  { min: 0, levelKey: 'low', colorVar: '--semantic-low' },
] as const;

export class StrategicRiskPanel extends Panel {
  private overview: StrategicRiskOverview | null = null;
  private alerts: UnifiedAlert[] = [];
  private convergenceAlerts: GeoConvergenceAlert[] = [];
  private freshnessSummary: DataFreshnessSummary | null = null;
  private unsubscribeFreshness: (() => void) | null = null;
  private onLocationClick?: (lat: number, lon: number) => void;
  private breakingAlerts: Map<string, { threatLevel: 'critical' | 'high'; timestamp: number }> = new Map();
  private boundOnBreaking: ((e: Event) => void) | null = null;
  private breakingExpiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super({
      id: 'strategic-risk',
      title: t('panels.strategicRisk'),
      showCount: false,
      trackActivity: true,
      infoTooltip: t('components.strategicRisk.infoTooltip'),
    });
    this.init();
  }

  private async init(): Promise<void> {
    this.showLoading();
    try {
      // Subscribe to data freshness changes - debounce to avoid excessive recalculations
      let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
      this.unsubscribeFreshness = dataFreshness.subscribe(() => {
        // Debounce refresh to batch multiple rapid updates
        if (refreshTimeout) clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
          this.refresh();
        }, 500);
      });

      // Listen for breaking news events (dispatched on document)
      this.boundOnBreaking = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (!detail?.id) return;
        const level = detail.threatLevel;
        if (level !== 'critical' && level !== 'high') return;
        this.breakingAlerts.set(detail.id, {
          threatLevel: level,
          timestamp: Date.now(),
        });
        this.refresh();
      };
      document.addEventListener('wm:breaking-news', this.boundOnBreaking);

      await this.refresh();
    } catch (error) {
      console.error('[StrategicRiskPanel] Init error:', error);
      this.showError(t('common.failedRiskOverview'), () => void this.refresh());
    }
  }

  private lastRiskFingerprint = '';

  public async refresh(): Promise<boolean> {
    this.freshnessSummary = dataFreshness.getSummary();
    this.convergenceAlerts = detectConvergence();

    // Prune stale breaking alerts (>30 min)
    const BREAKING_TTL = 30 * 60 * 1000;
    const now = Date.now();
    const cutoff = now - BREAKING_TTL;
    const staleIds: string[] = [];
    for (const [id, entry] of this.breakingAlerts) {
      if (entry.timestamp < cutoff) staleIds.push(id);
    }
    for (const id of staleIds) this.breakingAlerts.delete(id);

    // Schedule next expiry-driven refresh
    if (this.breakingExpiryTimer) clearTimeout(this.breakingExpiryTimer);
    if (this.breakingAlerts.size > 0) {
      let earliest = Infinity;
      for (const entry of this.breakingAlerts.values()) {
        if (entry.timestamp < earliest) earliest = entry.timestamp;
      }
      const msUntilExpiry = (earliest + BREAKING_TTL) - now + 500;
      this.breakingExpiryTimer = setTimeout(() => this.refresh(), Math.max(1000, msUntilExpiry));
    }

    // Severity-weighted score: critical=15, high=8
    let breakingScore = 0;
    for (const entry of this.breakingAlerts.values()) {
      breakingScore += entry.threatLevel === 'critical' ? 15 : 8;
    }
    breakingScore = Math.min(15, breakingScore);

    // Gather theater postures from cached service
    const cachedPosture = getCachedPosture();
    const postures = cachedPosture?.postures;
    const staleFactor = cachedPosture?.stale ? 0.5 : 1;

    // Prefer server/cached scores before calculating the overview so the
    // cross-module alert baseline is not seeded from local CII on first refresh.
    const cachedRiskScores = await fetchCachedRiskScores(this.signal);
    if (!this.element?.isConnected) return false;

    if (!cachedRiskScores) {
      this.overview = null;
      this.alerts = [];
      this.setDataBadge('unavailable');
      this.showError(t('common.failedRiskOverview'), () => void this.refresh());
      console.warn('[StrategicRiskPanel] Canonical backend risk scores unavailable');
      return false;
    }

    const localOverview = calculateStrategicRiskOverview(
      this.convergenceAlerts,
      postures ?? undefined,
      breakingScore,
      staleFactor
    );
    this.overview = localOverview;
    this.alerts = getRecentAlerts(24);

    /*
     * P2-Step5:
     * mirror current Strategic Alerts into rasadyar_data_v1.alerts.
     * The panel remains fully operational even if canonical sync fails.
     */
    const canonicalAlertResult =
      syncCanonicalAlerts(
        this.alerts.map(
          (alert) => ({
            id:
              alert.id,

            title:
              alert.title,

            summary:
              alert.summary,

            alertType:
              alert.type,

            priority:
              alert.priority,

            timestamp:
              alert.timestamp,

            countries:
              alert.countries || [],

            lat:
              alert.location?.lat,

            lon:
              alert.location?.lon,

            source:
              "سامانه هشدارهای راهبردی رصدیار پدافند",

            evidenceId:
              `alert-evidence-${alert.id}`,
          })
        )
      );

    if (
      !canonicalAlertResult.ok
    ) {
      console.warn(
        "[StrategicRiskPanel] Canonical Alert mirror failed.",
        canonicalAlertResult.error
      );
    }

    this.applyCachedRiskOverview(cachedRiskScores, localOverview);
    console.log('[StrategicRiskPanel] Using cached scores from backend');

    const badgeDetail = this.freshnessSummary
      ? t('components.strategicRisk.sourcesDetail', {
        active: this.freshnessSummary.activeSources,
        total: this.freshnessSummary.totalSources,
      })
      : undefined;
    this.setDataBadge('cached', badgeDetail);

    this.render();

    const alertIds = this.alerts.map(a => a.id).sort().join(',');
    const fp = `${this.overview?.compositeScore}|${this.overview?.trend}|${alertIds}`;
    const changed = fp !== this.lastRiskFingerprint;
    this.lastRiskFingerprint = fp;
    return changed;
  }

  private cachedTrendToOverviewTrend(trend: string): StrategicRiskOverview['trend'] {
    if (trend === 'rising' || trend === 'escalating') return 'escalating';
    if (trend === 'falling' || trend === 'de-escalating') return 'de-escalating';
    return 'stable';
  }

  private cachedTimestamp(cached: CachedRiskScores): Date | null {
    const raw = cached.strategicRisk.lastUpdated ?? cached.computedAt;
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private cachedTopRisks(cached: CachedRiskScores, ciiScores: CountryScore[]): string[] {
    const contributors = cached.strategicRisk.contributors
      .filter((c) => c.score > 0)
      .slice(0, 5)
      .map((c) => `${c.country}: ${c.score} (${c.level})`);
    if (contributors.length > 0) return contributors;
    return ciiScores
      .filter((s) => s.score > 0)
      .slice(0, 5)
      .map((s) => `${s.name}: ${s.score} (${s.level})`);
  }

  private applyCachedRiskOverview(cached: CachedRiskScores, localOverview: StrategicRiskOverview): void {
    const ciiScores = cached.cii
      .map(toCountryScore)
      .sort((a, b) => b.score - a.score);

    this.overview = {
      ...localOverview,
      avgCIIDeviation: ciiScores[0]?.score ?? cached.strategicRisk.score,
      compositeScore: Math.max(0, Math.min(100, Math.round(cached.strategicRisk.score))),
      trend: this.cachedTrendToOverviewTrend(cached.strategicRisk.trend),
      topRisks: this.cachedTopRisks(cached, ciiScores),
      unstableCountries: ciiScores.filter(s => isElevatedCiiScore(s.score)).slice(0, 5),
      timestamp: this.cachedTimestamp(cached),
      degraded: cached.degraded,
      stale: cached.stale,
    };
  }

  private getScoreColor(score: number): string {
    return getCSSColor(this.getFallbackScoreBand(score).colorVar);
  }

  private getScoreLevel(score: number): string {
    return t(`countryBrief.levels.${this.getFallbackScoreBand(score).levelKey}`);
  }

  private getFallbackScoreBand(score: number): typeof STRATEGIC_RISK_BANDS[number] {
    return STRATEGIC_RISK_BANDS.find((band) => score >= band.min) ?? STRATEGIC_RISK_BANDS[STRATEGIC_RISK_BANDS.length - 1]!;
  }

  private getTrendEmoji(trend: string): string {
    switch (trend) {
      case 'escalating': return '📈';
      case 'de-escalating': return '📉';
      default: return '➡️';
    }
  }

  private getTrendColor(trend: string): string {
    switch (trend) {
      case 'escalating': return getCSSColor('--semantic-critical');
      case 'de-escalating': return getCSSColor('--semantic-normal');
      default: return getCSSColor('--text-dim');
    }
  }


  private getPriorityColor(priority: AlertPriority): string {
    switch (priority) {
      case 'critical': return getCSSColor('--semantic-critical');
      case 'high': return getCSSColor('--semantic-high');
      case 'medium': return getCSSColor('--semantic-elevated');
      case 'low': return getCSSColor('--semantic-normal');
    }
  }

  private getPriorityEmoji(priority: AlertPriority): string {
    switch (priority) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
    }
  }

  private getTypeEmoji(type: string): string {
    switch (type) {
      case 'convergence': return '🎯';
      case 'cii_spike': return '📊';
      case 'cascade': return '🔗';
      case 'sanctions': return '🚫';
      case 'radiation': return '☢️';
      case 'composite': return '⚠️';
      default: return '📍';
    }
  }

  /**
   * Render full data view - normal operation
   */
  private renderFullData(): string {
    if (!this.overview || !this.freshnessSummary) return '';

    const score = this.overview.compositeScore;
    const color = this.getScoreColor(score);
    const level = this.getScoreLevel(score);
    const scoreDeg = Math.round((score / 100) * 270);

    const cacheStateBanner = this.renderCachedRiskStateBanner();

    return `
      <div class="strategic-risk-panel">
        ${cacheStateBanner}

        <div class="risk-gauge">
          <div class="risk-score-container">
            <div class="risk-score-ring" style="--score-color: ${color}; --score-deg: ${scoreDeg}deg;">
              <div class="risk-score-inner">
                <div class="risk-score" style="color: ${color}">${score}</div>
                <div class="risk-level" style="color: ${color}">${level}</div>
              </div>
            </div>
          </div>
          <div class="risk-trend-container">
            <span class="risk-trend-label">${t('components.strategicRisk.trend')}</span>
            <div class="risk-trend" style="color: ${this.getTrendColor(this.overview.trend)}">
              ${this.getTrendEmoji(this.overview.trend)} ${this.overview.trend === 'escalating' ? t('components.strategicRisk.trends.escalating') : this.overview.trend === 'de-escalating' ? t('components.strategicRisk.trends.deEscalating') : t('components.strategicRisk.trends.stable')}
            </div>
          </div>
        </div>

        ${this.renderMetrics()}
        ${this.renderFreshnessSurface()}
        ${this.renderTopRisks()}
        ${this.renderRecentAlerts()}

        <div class="risk-footer">
          <span class="risk-updated">${t('components.strategicRisk.updated', { time: this.formatOverviewTimestamp() })}</span>
          <button class="risk-refresh-btn">${t('components.strategicRisk.refresh')}</button>
        </div>
      </div>
    `;
  }

  private renderCachedRiskStateBanner(): string {
    if (!this.overview || (!this.overview.degraded && !this.overview.stale)) return '';
    const labels = [
      this.overview.degraded ? t('components.strategicRisk.sourceStates.degraded') : '',
      this.overview.stale ? t('components.strategicRisk.sourceStates.stale') : '',
    ].filter(Boolean);
    return `<div class="risk-status-banner risk-status-cached">
      <span class="risk-status-icon">!</span>
      <span class="risk-status-text">${t('components.strategicRisk.cachedCiiStatus', { states: labels.join(' · ') })}</span>
    </div>`;
  }

  private renderFreshnessSurface(): string {
    if (!this.freshnessSummary) return '';
    const sources = dataFreshness.getAllSources()
      .filter(source => source.status !== 'no_data' && source.status !== 'disabled')
      .sort((a, b) => {
        const order: Record<string, number> = { error: 0, very_stale: 1, stale: 2, fresh: 3 };
        return (order[a.status] ?? 4) - (order[b.status] ?? 4);
      })
      .slice(0, 6);

    if (sources.length === 0) return '';
    return `
      <div class="risk-section">
        <div class="risk-section-title">${t('components.strategicRisk.dataFreshness')}</div>
        <div class="risk-sources-compact">
          ${sources.map(source => `
            <span class="risk-source-chip" title="${escapeHtml(source.healthStatus || source.status)}" style="border-color: ${getStatusColor(source.status)}">
              <span class="risk-source-dot" style="color: ${getStatusColor(source.status)}">${getStatusIcon(source.status)}</span>
              <span class="risk-source-name">${escapeHtml(source.name)}</span>
              <span class="risk-source-time">${escapeHtml(dataFreshness.getTimeSince(source.id))}</span>
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderMetrics(): string {
    if (!this.overview) return '';

    const alertCounts = getAlertCount();

    return `
      <div class="risk-metrics">
        <div class="risk-metric">
          <span class="risk-metric-value">${this.overview.convergenceAlerts}</span>
          <span class="risk-metric-label">${t('components.strategicRisk.convergenceMetric')}</span>
        </div>
        <div class="risk-metric">
          <span class="risk-metric-value">${this.overview.avgCIIDeviation.toFixed(1)}</span>
          <span class="risk-metric-label">${t('components.strategicRisk.ciiDeviation')}</span>
        </div>
        <div class="risk-metric">
          <span class="risk-metric-value">${this.overview.infrastructureIncidents}</span>
          <span class="risk-metric-label">${t('components.strategicRisk.infraEvents')}</span>
        </div>
        <div class="risk-metric">
          <span class="risk-metric-value">${alertCounts.critical + alertCounts.high}</span>
          <span class="risk-metric-label">${t('components.strategicRisk.highAlerts')}</span>
        </div>
      </div>
    `;
  }

  private renderTopRisks(): string {
    if (!this.overview || this.overview.topRisks.length === 0) {
      return `<div class="risk-empty">${t('components.strategicRisk.noRisks')}</div>`;
    }

    // Get convergence zone for first risk if available
    const topZone = this.overview.topConvergenceZones[0];

    return `
      <div class="risk-section">
        <div class="risk-section-title">${t('components.strategicRisk.topRisks')}</div>
        <div class="risk-list">
          ${this.overview.topRisks.map((risk, i) => {
      // First risk is convergence - make it clickable if we have location
      const isConvergence = i === 0 && risk.startsWith('Convergence:') && topZone;
      if (isConvergence) {
        return `
                <div class="risk-item risk-item-clickable" data-lat="${topZone.lat}" data-lon="${topZone.lon}">
                  <span class="risk-rank">${i + 1}.</span>
                  <span class="risk-text">${escapeHtml(risk)}</span>
                  <span class="risk-location-icon">↗</span>
                </div>
              `;
      }
      return `
              <div class="risk-item">
                <span class="risk-rank">${i + 1}.</span>
                <span class="risk-text">${escapeHtml(risk)}</span>
              </div>
            `;
    }).join('')}
        </div>
      </div>
    `;
  }

  private canAddAlertToAnalysis(): boolean {
    return can(
      getCurrentUser(),
      "analysis.create"
    );
  }

  private getAlertPriorityLabel(
    priority: AlertPriority
  ): string {
    switch (priority) {
      case "critical":
        return "بحرانی";

      case "high":
        return "بالا";

      case "medium":
        return "متوسط";

      case "low":
        return "پایین";

      default:
        return priority;
    }
  }

  private getAlertTypeLabel(
    type: UnifiedAlert["type"]
  ): string {
    switch (type) {
      case "convergence":
        return "همگرایی رخدادها";

      case "cii_spike":
        return "جهش شاخص بی‌ثباتی";

      case "cascade":
        return "اثر آبشاری زیرساخت";

      case "sanctions":
        return "تحریم";

      case "radiation":
        return "پرتویی";

      case "composite":
        return "ترکیبی";

      default:
        return type;
    }
  }

  private buildAlertArchiveCard(
    alert: UnifiedAlert,
    archivedAt: string
  ): string {
    const title =
      escapeHtml(
        alert.title
      );

    const type =
      escapeHtml(
        this.getAlertTypeLabel(
          alert.type
        )
      );

    const priority =
      escapeHtml(
        this.getAlertPriorityLabel(
          alert.priority
        )
      );

    const countries =
      escapeHtml(
        alert.countries?.length
          ? alert.countries.join("، ")
          : "نامشخص"
      );

    const time =
      escapeHtml(
        alert.timestamp.toLocaleString(
          "fa-IR"
        )
      );

    const svg = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="960"
        height="540"
        viewBox="0 0 960 540"
      >
        <rect
          width="960"
          height="540"
          fill="#07110c"
        />

        <rect
          x="34"
          y="34"
          width="892"
          height="472"
          rx="20"
          fill="#0a1b12"
          stroke="#1b5e3b"
          stroke-width="2"
        />

        <text
          x="880"
          y="88"
          direction="rtl"
          text-anchor="end"
          fill="#78e0ad"
          font-size="24"
          font-family="Tahoma, Arial, sans-serif"
        >
          آرشیو هشدار رصدیار پدافند
        </text>

        <text
          x="880"
          y="148"
          direction="rtl"
          text-anchor="end"
          fill="#ffffff"
          font-size="30"
          font-weight="700"
          font-family="Tahoma, Arial, sans-serif"
        >
          ${title}
        </text>

        <line
          x1="80"
          y1="184"
          x2="880"
          y2="184"
          stroke="#193d2b"
          stroke-width="2"
        />

        <text
          x="880"
          y="232"
          direction="rtl"
          text-anchor="end"
          fill="#b8c8bf"
          font-size="20"
          font-family="Tahoma, Arial, sans-serif"
        >
          نوع هشدار: ${type}
        </text>

        <text
          x="880"
          y="278"
          direction="rtl"
          text-anchor="end"
          fill="#b8c8bf"
          font-size="20"
          font-family="Tahoma, Arial, sans-serif"
        >
          سطح شدت: ${priority}
        </text>

        <text
          x="880"
          y="324"
          direction="rtl"
          text-anchor="end"
          fill="#b8c8bf"
          font-size="20"
          font-family="Tahoma, Arial, sans-serif"
        >
          کشور / منطقه: ${countries}
        </text>

        <text
          x="880"
          y="370"
          direction="rtl"
          text-anchor="end"
          fill="#b8c8bf"
          font-size="20"
          font-family="Tahoma, Arial, sans-serif"
        >
          زمان هشدار: ${time}
        </text>

        <text
          x="880"
          y="438"
          direction="rtl"
          text-anchor="end"
          fill="#688679"
          font-size="16"
          font-family="Tahoma, Arial, sans-serif"
        >
          زمان آرشیو: ${escapeHtml(
            new Date(
              archivedAt
            ).toLocaleString(
              "fa-IR"
            )
          )}
        </text>
      </svg>
    `;

    return (
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(svg)
    );
  }

  private addRadiationAlertToAnalysis(
    alert: UnifiedAlert
  ): void {
    if (
      !this.canAddAlertToAnalysis()
    ) {
      return;
    }

    const archivedAt =
      new Date().toISOString();

    const priorityLabel =
      this.getAlertPriorityLabel(
        alert.priority
      );

    const countries =
      alert.countries?.length
        ? alert.countries.join("، ")
        : "";

    const summaryParts = [
      `نوع رویداد: پرتویی`,
      `سطح هشدار: ${priorityLabel}`,
      countries
        ? `کشور / منطقه: ${countries}`
        : "",
      alert.summary,
    ].filter(Boolean);

    openAnalysisWithSourceObservation({
      id:
        `alert-evidence-${alert.id}`,

      externalId:
        alert.id,

      kind:
        "radiation",

      title:
        alert.title,

      provider:
        "سامانه هشدارهای راهبردی رصدیار پدافند",

      source:
        "سامانه هشدارهای راهبردی رصدیار پدافند",

      sourceDomain:
        "پرتویی",

      observationType:
        "strategic-risk-radiation-alert",

      country:
        alert.countries?.[0],

      region:
        countries || undefined,

      lat:
        alert.location?.lat,

      lon:
        alert.location?.lon,

      observedAt:
        alert.timestamp.toISOString(),

      summary:
        summaryParts.join("\n"),

      severity:
        alert.priority ===
          "critical"
          ? "critical"
          : alert.priority ===
              "high"
            ? "high"
            : alert.priority ===
                "medium"
              ? "medium"
              : "low",

      tags: [
        "radiation",
        "strategic-risk",
        "alert",
        alert.priority,
      ],

      metadata: {
        alertId:
          alert.id,

        alertType:
          alert.type,

        alertPriority:
          alert.priority,

        countries:
          alert.countries || [],

        originalSummary:
          alert.summary,

        sourcePanel:
          "strategic-risk",

        locationLat:
          alert.location?.lat ??
          null,

        locationLon:
          alert.location?.lon ??
          null,
      },

      archive: {
        archiveId:
          `radiation-${alert.id}-${Date.now()}`,

        archivedAt,

        archiveVersion:
          1,

        snapshotKind:
          "metadata-card",

        snapshotDataUrl:
          this.buildAlertArchiveCard(
            alert,
            archivedAt
          ),

        mediaType:
          "radiation",

        channelName:
          "هشدارهای راهبردی رصدیار",

        playbackState:
          `priority:${alert.priority}`,

        note:
          "این کارت آرشیوی در لحظه افزودن رویداد پرتویی به پرونده تحلیل ساخته شده و عنوان، شدت، منطقه و زمان هشدار را مستقل از داده زنده پنل حفظ می‌کند.",
      },
    });
  }

  private addSanctionsAlertToAnalysis(
    alert: UnifiedAlert
  ): void {
    if (
      !this.canAddAlertToAnalysis()
    ) {
      return;
    }

    const archivedAt =
      new Date().toISOString();

    const priorityLabel =
      this.getAlertPriorityLabel(
        alert.priority
      );

    const countries =
      alert.countries?.length
        ? alert.countries.join("، ")
        : "";

    const summaryParts = [
      `نوع رویداد: تحریم`,
      `سطح هشدار: ${priorityLabel}`,
      countries
        ? `کشور / منطقه: ${countries}`
        : "",
      alert.summary,
    ].filter(Boolean);

    openAnalysisWithSourceObservation({
      id:
        `alert-evidence-${alert.id}`,

      externalId:
        alert.id,

      kind:
        "sanctions",

      title:
        alert.title,

      provider:
        "سامانه هشدارهای راهبردی رصدیار پدافند",

      source:
        "سامانه هشدارهای راهبردی رصدیار پدافند",

      sourceDomain:
        "اقتصادی",

      observationType:
        "strategic-risk-sanctions-alert",

      country:
        alert.countries?.[0],

      region:
        countries || undefined,

      lat:
        alert.location?.lat,

      lon:
        alert.location?.lon,

      observedAt:
        alert.timestamp.toISOString(),

      summary:
        summaryParts.join("\n"),

      severity:
        alert.priority ===
          "critical"
          ? "critical"
          : alert.priority ===
              "high"
            ? "high"
            : alert.priority ===
                "medium"
              ? "medium"
              : "low",

      tags: [
        "sanctions",
        "strategic-risk",
        "alert",
        alert.priority,
      ],

      metadata: {
        alertId:
          alert.id,

        alertType:
          alert.type,

        alertPriority:
          alert.priority,

        countries:
          alert.countries || [],

        originalSummary:
          alert.summary,

        sourcePanel:
          "strategic-risk",

        locationLat:
          alert.location?.lat ??
          null,

        locationLon:
          alert.location?.lon ??
          null,
      },

      archive: {
        archiveId:
          `sanctions-${alert.id}-${Date.now()}`,

        archivedAt,

        archiveVersion:
          1,

        snapshotKind:
          "metadata-card",

        snapshotDataUrl:
          this.buildAlertArchiveCard(
            alert,
            archivedAt
          ),

        mediaType:
          "sanctions",

        channelName:
          "هشدارهای راهبردی رصدیار",

        playbackState:
          `priority:${alert.priority}`,

        note:
          "این کارت آرشیوی در لحظه افزودن رویداد تحریمی به پرونده تحلیل ساخته شده و عنوان، شدت، منطقه و زمان هشدار را مستقل از داده زنده پنل حفظ می‌کند.",
      },
    });
  }

  private addAlertToAnalysis(
    alert: UnifiedAlert
  ): void {
    if (
      !this.canAddAlertToAnalysis()
    ) {
      return;
    }

    if (
      alert.type ===
      "sanctions"
    ) {
      this.addSanctionsAlertToAnalysis(
        alert
      );

      return;
    }

    if (
      alert.type ===
      "radiation"
    ) {
      this.addRadiationAlertToAnalysis(
        alert
      );

      return;
    }

    const archivedAt =
      new Date().toISOString();

    const priorityLabel =
      this.getAlertPriorityLabel(
        alert.priority
      );

    const typeLabel =
      this.getAlertTypeLabel(
        alert.type
      );

    const countries =
      alert.countries?.length
        ? alert.countries.join("، ")
        : "";

    const summaryParts = [
      `سطح هشدار: ${priorityLabel}`,
      `نوع تهدید: ${typeLabel}`,
      countries
        ? `کشور / منطقه: ${countries}`
        : "",
      alert.summary,
    ].filter(Boolean);

    openAnalysisWithEvidence({
      id:
        `alert-evidence-${alert.id}`,

      kind:
        "alert",

      title:
        alert.title,

      source:
        "سامانه هشدارهای راهبردی رصدیار پدافند",

      country:
        alert.countries?.[0],

      region:
        countries || undefined,

      lat:
        alert.location?.lat,

      lon:
        alert.location?.lon,

      timestamp:
        alert.timestamp.toISOString(),

      summary:
        summaryParts.join("\n"),

      archive: {
        archiveId:
          `alert-${alert.id}-${Date.now()}`,

        archivedAt,

        archiveVersion:
          1,

        snapshotKind:
          "metadata-card",

        snapshotDataUrl:
          this.buildAlertArchiveCard(
            alert,
            archivedAt
          ),

        mediaType:
          "alert",

        channelName:
          "هشدارهای راهبردی رصدیار",

        playbackState:
          `priority:${alert.priority}`,

        note:
          "این کارت آرشیوی در لحظه افزودن هشدار به پرونده تحلیل ساخته شده و عنوان، نوع، شدت، منطقه و زمان هشدار را به‌صورت مستقل حفظ می‌کند.",
      },
    });
  }

  private renderRecentAlerts(): string {
    if (this.alerts.length === 0) {
      return '';
    }

    const displayAlerts = this.alerts.slice(0, 5);

    const canAddToAnalysis =
      this.canAddAlertToAnalysis();

    return `
      <div class="risk-section">
        <div class="risk-section-title">${t('components.strategicRisk.recentAlerts', { count: String(this.alerts.length) })}</div>
        <div class="risk-alerts">
          ${displayAlerts.map(alert => {
      const hasLocation =
        typeof alert.location?.lat === "number" &&
        typeof alert.location?.lon === "number";

      const clickableClass =
        hasLocation
          ? 'risk-alert-clickable'
          : '';

      const locationAttrs =
        hasLocation
          ? `data-lat="${alert.location!.lat}" data-lon="${alert.location!.lon}"`
          : '';

      const alertId =
        escapeHtml(
          alert.id
        );

      const analysisButton =
        canAddToAnalysis
          ? `
              <button
                type="button"
                class="risk-alert-analysis-btn"
                data-alert-id="${alertId}"
                title="افزودن این هشدار به پرونده تحلیل"
                style="
                  margin-top:5px;
                  align-self:flex-start;
                  padding:4px 8px;
                  border:1px solid rgba(52,211,153,.28);
                  border-radius:5px;
                  background:rgba(20,83,45,.45);
                  color:#d1fae5;
                  font-family:inherit;
                  font-size:9px;
                  line-height:1.4;
                  cursor:pointer;
                "
              >
                افزودن به تحلیل
              </button>
            `
          : '';

      return `
              <div
                class="risk-alert ${clickableClass}"
                data-alert-card-id="${alertId}"
                style="border-left: 3px solid ${this.getPriorityColor(alert.priority)}"
                ${locationAttrs}
              >
                <div class="risk-alert-header">
                  <span class="risk-alert-type">${this.getTypeEmoji(alert.type)}</span>
                  <span class="risk-alert-priority">${this.getPriorityEmoji(alert.priority)}</span>
                  <span class="risk-alert-title">${escapeHtml(alert.title)}</span>
                  ${hasLocation ? '<span class="risk-location-icon">↗</span>' : ''}
                </div>

                <div class="risk-alert-summary">${escapeHtml(alert.summary)}</div>

                <div class="risk-alert-time">
                  ${this.formatTime(alert.timestamp)}
                </div>

                ${analysisButton}
              </div>
            `;
    }).join('')}
        </div>
      </div>
    `;
  }

  private formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return t('components.strategicRisk.time.justNow');
    if (minutes < 60) return t('components.strategicRisk.time.minutesAgo', { count: String(minutes) });
    if (hours < 24) return t('components.strategicRisk.time.hoursAgo', { count: String(hours) });
    return date.toLocaleDateString();
  }

  private formatOverviewTimestamp(): string {
    return this.overview?.timestamp ? this.overview.timestamp.toLocaleTimeString() : '&mdash;';
  }

  private render(): void {
    this.freshnessSummary = dataFreshness.getSummary();

    try {
      if (!this.overview) {
        this.showLoading();
        return;
      }

      this.setTrustedContent(trustedHtml(this.renderFullData(), "legacy direct innerHTML migration"));
      this.attachEventListeners();
    } catch (e: unknown) {
      console.error('[StrategicRiskPanel] Render error:', e);
      this.showError(t('common.failedRiskOverview'), () => this.refresh());
    }
  }

  private attachEventListeners(): void {
    // Refresh button
    const refreshBtn = this.content.querySelector('.risk-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refresh());
    }

    // Enable source buttons
    const enableBtns = this.content.querySelectorAll('.risk-source-enable');
    enableBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const panelId = (e.target as HTMLElement).dataset.panel;
        if (panelId) {
          this.emitEnablePanel(panelId);
        }
      });
    });

    // Action buttons
    const actionBtns = this.content.querySelectorAll('.risk-action-btn');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).dataset.action;
        if (action === 'enable-core') {
          this.emitEnablePanels(['protests', 'intel', 'live-news']);
        } else if (action === 'enable-all') {
          this.emitEnablePanels(['protests', 'intel', 'live-news', 'military', 'shipping']);
        }
      });
    });

    // Clickable risk items (convergence zones)
    const clickableRisks = this.content.querySelectorAll('.risk-item-clickable');
    clickableRisks.forEach(item => {
      item.addEventListener('click', () => {
        const lat = parseFloat((item as HTMLElement).dataset.lat || '0');
        const lon = parseFloat((item as HTMLElement).dataset.lon || '0');
        if (this.onLocationClick && !Number.isNaN(lat) && !Number.isNaN(lon)) {
          this.onLocationClick(lat, lon);
        }
      });
    });

    // Add strategic alerts to Analysis Center.
    const analysisBtns =
      this.content.querySelectorAll(
        '.risk-alert-analysis-btn'
      );

    analysisBtns.forEach(
      (button) => {
        button.addEventListener(
          'click',
          (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (
              !this.canAddAlertToAnalysis()
            ) {
              return;
            }

            const alertId =
              (
                button as
                  HTMLElement
              ).dataset.alertId;

            if (!alertId) {
              return;
            }

            const alert =
              this.alerts.find(
                (item) =>
                  item.id ===
                  alertId
              );

            if (!alert) {
              return;
            }

            this.addAlertToAnalysis(
              alert
            );
          }
        );
      }
    );

    // Clickable alerts with location
    const clickableAlerts = this.content.querySelectorAll('.risk-alert-clickable');
    clickableAlerts.forEach(alert => {
      alert.addEventListener('click', () => {
        const lat = parseFloat((alert as HTMLElement).dataset.lat || '0');
        const lon = parseFloat((alert as HTMLElement).dataset.lon || '0');
        if (this.onLocationClick && !Number.isNaN(lat) && !Number.isNaN(lon)) {
          this.onLocationClick(lat, lon);
        }
      });
    });
  }

  private emitEnablePanel(panelId: string): void {
    window.dispatchEvent(new CustomEvent('enable-panel', { detail: { panelId } }));
  }

  private emitEnablePanels(panelIds: string[]): void {
    panelIds.forEach(id => this.emitEnablePanel(id));
  }

  public destroy(): void {
    if (this.boundOnBreaking) {
      document.removeEventListener('wm:breaking-news', this.boundOnBreaking);
      this.boundOnBreaking = null;
    }
    if (this.breakingExpiryTimer) {
      clearTimeout(this.breakingExpiryTimer);
      this.breakingExpiryTimer = null;
    }
    if (this.unsubscribeFreshness) {
      this.unsubscribeFreshness();
    }
    super.destroy();
  }

  public getOverview(): StrategicRiskOverview | null {
    return this.overview;
  }

  public getAlerts(): UnifiedAlert[] {
    return this.alerts;
  }

  public setLocationClickHandler(handler: (lat: number, lon: number) => void): void {
    this.onLocationClick = handler;
  }
}
