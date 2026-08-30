import type {
    ServerContext,
    TrackAircraftRequest,
    TrackAircraftResponse,
    PositionSample,
} from '../../../../src/generated/server/worldmonitor/aviation/v1/service_server';
import { getRelayBaseUrl, getRelayHeaders } from './_shared';
import { cachedFetchJson } from '../../../_shared/redis';
import { isOpenSkyProvider, requiresRedistributableProviders } from '../../../_shared/provider-redistribution';

// 120s. This TTL was originally sized for the anonymous OpenSky tier's ~10 req/min
// ceiling; that tier was removed in #6222, so the binding constraint is now the shared
// authenticated credit pool the relay draws on — a shorter TTL multiplies bbox misses
// straight into it. Revisit only alongside that budget, not on its own.
const CACHE_TTL = 120;
// Callsign searches hit the relay's in-memory index (5min TTL); cache positive hits 60s,
// negative hits 10s so a retry after panning into view returns fresh data quickly.
const CALLSIGN_CACHE_TTL = 60;
const CALLSIGN_NEGATIVE_TTL = 10;
const BBOX_RELAY_TIMEOUT_MS = 6_000;

// Local-development recovery path. Production remains relay-only.
const DIRECT_OPENSKY_TIMEOUT_MS = 7_000;
const DIRECT_OPENSKY_BASE_URL = 'https://opensky-network.org/api';

function isDegenerateBbox(req: TrackAircraftRequest): boolean {
    return req.swLat === req.neLat && req.swLon === req.neLon;
}

interface OpenSkyResponse {
    states?: unknown[][];
}

interface WingbitsRelayResponse {
    positions?: PositionSample[];
    source?: string;
}

function parseOpenSkyStates(states: unknown[][]): PositionSample[] {
    const now = Date.now();
    return states
        .filter(s => Array.isArray(s) && s[5] != null && s[6] != null)
        .map((s): PositionSample => ({
            icao24: String(s[0] ?? ''),
            callsign: String(s[1] ?? '').trim(),
            lat: Number(s[6]),
            lon: Number(s[5]),
            altitudeM: Number(s[7] ?? 0),
            groundSpeedKts: Number(s[9] ?? 0) * 1.944,
            trackDeg: Number(s[10] ?? 0),
            verticalRate: Number(s[11] ?? 0),
            onGround: Boolean(s[8]),
            source: 'POSITION_SOURCE_OPENSKY',
            observedAt: Number(s[4] ?? (now / 1000)) * 1000,
        }));
}



function isLocalRequest(request: Request): boolean {
    try {
        const url = new URL(request.url);
        return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
        return false;
    }
}

function canUseDirectOpenSkyFallback(request: Request): boolean {
    // Never enable anonymous direct access on production/serverless deployments.
    // Also require an actual localhost request so a non-production public server
    // cannot accidentally activate this development-only path.
    const isProduction = process.env.NODE_ENV === 'production';
    const isVercel = Boolean(process.env.VERCEL);

    return !isProduction && !isVercel && isLocalRequest(request);
}

function buildDirectOpenSkyUrl(req: TrackAircraftRequest): string | null {
    const params = new URLSearchParams();

    if (req.icao24) {
        params.set('icao24', req.icao24);
    }

    if (!isDegenerateBbox(req)) {
        params.set('lamin', String(req.swLat));
        params.set('lomin', String(req.swLon));
        params.set('lamax', String(req.neLat));
        params.set('lomax', String(req.neLon));
    }

    // OpenSky states/all does not support callsign-only lookup.
    // Avoid an accidental world-wide request.
    if ([...params.keys()].length === 0) {
        return null;
    }

    return `${DIRECT_OPENSKY_BASE_URL}/states/all?${params.toString()}`;
}

async function fetchDirectOpenSky(
    req: TrackAircraftRequest,
    allowDirect: boolean,
): Promise<PositionSample[]> {
    if (!allowDirect) {
        return [];
    }

    const url = buildDirectOpenSkyUrl(req);
    if (!url) {
        return [];
    }

    try {
        const resp = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Rasadyar-Padafand-Local-Development/1.0',
            },
            signal: AbortSignal.timeout(DIRECT_OPENSKY_TIMEOUT_MS),
        });

        if (!resp.ok) {
            console.warn(`[Aviation] Direct local OpenSky fallback returned HTTP ${resp.status}`);
            return [];
        }

        const data = await resp.json() as OpenSkyResponse;
        const positions = parseOpenSkyStates(data.states ?? []);

        if (positions.length > 0) {
            console.info(`[Aviation] Direct local OpenSky fallback returned ${positions.length} aircraft`);
        }

        return positions;
    } catch (err) {
        console.warn(`[Aviation] Direct local OpenSky fallback failed: ${err instanceof Error ? err.message : err}`);
        return [];
    }
}


// There is deliberately no anonymous OpenSky path here in production. The unauthenticated tier
// is 400 credits/day PER IP, and these handlers run on Vercel's shared egress —
// the quota is consumed by every other tenant on the same address, so the call
// essentially always 429s while still costing a full 6s timeout on the very
// request that was already failing over. Removing it also returns that 6s to
// the response budget below (#6222).

function buildCacheKey(req: TrackAircraftRequest): string {
    if (req.icao24) return `aviation:track:icao:${req.icao24}:v2`;
    if (req.callsign) return `aviation:track:callsign:${req.callsign.toUpperCase()}:v2`;
    if (!isDegenerateBbox(req)) {
        return `aviation:track:bbox:${Math.floor(req.swLat)}:${Math.floor(req.swLon)}:${Math.ceil(req.neLat)}:${Math.ceil(req.neLon)}:v2`;
    }
    return 'aviation:track:all:v2';
}

// Response-level source values (TrackAircraftResponse.source):
//   'opensky'           — data from OpenSky via relay
//   'wingbits'          — data from Wingbits via relay
//   'none'              — all real sources returned empty or failed; positions = []
export async function trackAircraft(
    ctx: ServerContext,
    req: TrackAircraftRequest,
): Promise<TrackAircraftResponse> {
    const localDirectAllowed = canUseDirectOpenSkyFallback(ctx.request);

    // A localhost developer request is rendered only on the user's workstation;
    // it is not a redistributed provider response. Production, previews,
    // Vercel, and non-local hosts keep the original redistribution policy.
    const redistributableOnly = localDirectAllowed
        ? false
        : requiresRedistributableProviders(ctx.request);

    const cacheKey = `${buildCacheKey(req)}${redistributableOnly ? ':redistributable' : ''}${localDirectAllowed ? ':local-direct' : ''}`;

    if (localDirectAllowed) {
        console.info(
            `[Aviation] Local aircraft tracking enabled for bbox `
            + `${req.swLat},${req.swLon} → ${req.neLat},${req.neLon}`,
        );
    }

    let result: { positions: PositionSample[]; source: string } | null = null;
    try {
        const positiveTtl = req.callsign ? CALLSIGN_CACHE_TTL : CACHE_TTL;
        const negativeTtl = req.callsign ? CALLSIGN_NEGATIVE_TTL : CACHE_TTL;
        result = await cachedFetchJson<{ positions: PositionSample[]; source: string }>(
            cacheKey, positiveTtl, async () => {
                const relayBase = getRelayBaseUrl();
                const isCallsignOnly = !!req.callsign && !req.icao24 && isDegenerateBbox(req);

                // For callsign-only searches, try Wingbits first — commercial flights like UAE20
                // are Wingbits-exclusive and not visible in OpenSky. Trying OpenSky first wastes
                // time and may return an early hit with no callsign match.
                if (isCallsignOnly && relayBase) {
                    try {
                        const wbUrl = `${relayBase}/wingbits/track?callsign=${encodeURIComponent(req.callsign)}`;
                        const wbResp = await fetch(wbUrl, {
                            headers: getRelayHeaders({}),
                            signal: AbortSignal.timeout(20_000),
                        });
                        if (wbResp.ok) {
                            const wbData = await wbResp.json() as WingbitsRelayResponse;
                            if (wbData.positions && wbData.positions.length > 0) {
                                return { positions: wbData.positions, source: 'wingbits' };
                            }
                        }
                    } catch (err) {
                        console.warn(`[Aviation] Wingbits callsign relay failed: ${err instanceof Error ? err.message : err}`);
                    }
                }

                // Wingbits is the normal bbox source. A successful response — including an
                // empty one — is authoritative for that viewport, so do not also debit the
                // shared authenticated OpenSky account. OpenSky is recovery-only when the
                // Wingbits request itself fails.
                //
                // Skip a degenerate (zero-span) bbox. The generated GET decoder coerces
                // absent query params to 0 rather than leaving them null, so an icao24-only
                // request would otherwise issue a real authenticated bbox relay call for
                // `lamin=0&lomin=0&lamax=0&lomax=0` before reaching its own 8s tier.
                if (!isCallsignOnly && !isDegenerateBbox(req)) {
                    if (relayBase) {
                        const wbUrl = `${relayBase}/wingbits/track?lamin=${req.swLat}&lomin=${req.swLon}&lamax=${req.neLat}&lomax=${req.neLon}`;

                        try {
                            const wbResp = await fetch(wbUrl, {
                                headers: getRelayHeaders({}),
                                signal: AbortSignal.timeout(BBOX_RELAY_TIMEOUT_MS),
                            });

                            if (wbResp.ok) {
                                const wbData = await wbResp.json() as WingbitsRelayResponse;
                                const wbPositions = wbData.positions ?? [];

                                if (wbPositions.length > 0) {
                                    return { positions: wbPositions, source: 'wingbits' };
                                }

                                // Preserve production behavior: an empty successful
                                // Wingbits viewport remains authoritative.
                                if (!localDirectAllowed) {
                                    return { positions: [], source: 'wingbits' };
                                }

                                // In local development, sparse/empty Wingbits coverage
                                // can fall back to the workstation's own OpenSky allowance.
                                if (!redistributableOnly) {
                                    const directPositions = await fetchDirectOpenSky(req, localDirectAllowed);

                                    if (directPositions.length > 0) {
                                        return { positions: directPositions, source: 'opensky' };
                                    }
                                }

                                return { positions: [], source: 'wingbits' };
                            }
                        } catch (err) {
                            console.warn(`[Aviation] Wingbits bbox relay failed: ${err instanceof Error ? err.message : err}`);
                        }

                        // Authenticated relay recovery remains unchanged.
                        if (!redistributableOnly) {
                            try {
                                const osUrl = `${relayBase}/opensky/states/all?lamin=${req.swLat}&lomin=${req.swLon}&lamax=${req.neLat}&lomax=${req.neLon}`;
                                const osResp = await fetch(osUrl, {
                                    headers: getRelayHeaders({}),
                                    signal: AbortSignal.timeout(BBOX_RELAY_TIMEOUT_MS),
                                });

                                if (osResp.ok) {
                                    const osData = await osResp.json() as OpenSkyResponse;
                                    const osPositions = parseOpenSkyStates(osData.states ?? []);

                                    if (osPositions.length > 0) {
                                        return { positions: osPositions, source: 'opensky' };
                                    }
                                }
                            } catch (err) {
                                console.warn(`[Aviation] OpenSky bbox relay failed: ${err instanceof Error ? err.message : err}`);
                            }
                        }
                    }

                    // Normal local setup has no relay configured. Use a bounded
                    // direct OpenSky request only on the developer workstation.
                    if (!redistributableOnly) {
                        const directPositions = await fetchDirectOpenSky(req, localDirectAllowed);

                        if (directPositions.length > 0) {
                            return { positions: directPositions, source: 'opensky' };
                        }
                    }
                }

                // For icao24-only queries, try the OpenSky relay
                if (!redistributableOnly && !isCallsignOnly && req.icao24) {
                    if (relayBase) {
                        try {
                            const osUrl = `${relayBase}/opensky/states/all?icao24=${req.icao24}`;
                            const resp = await fetch(osUrl, {
                                headers: getRelayHeaders({}),
                                signal: AbortSignal.timeout(8_000),
                            });

                            if (resp.ok) {
                                const data = await resp.json() as OpenSkyResponse;
                                const positions = parseOpenSkyStates(data.states ?? []);

                                if (positions.length > 0) {
                                    return { positions, source: 'opensky' };
                                }
                            }
                        } catch (err) {
                            console.warn(`[Aviation] Relay icao24 failed: ${err instanceof Error ? err.message : err}`);
                        }
                    }

                    const directPositions = await fetchDirectOpenSky(req, localDirectAllowed);

                    if (directPositions.length > 0) {
                        return { positions: directPositions, source: 'opensky' };
                    }
                }

                return null; // negative-cached briefly
            }, negativeTtl,
        );
    } catch {
        /* Redis unavailable — fall through to simulated */
    }

    if (result) {
        let positions = result.positions;
        let source = result.source;
        if (redistributableOnly) {
            positions = positions.filter((position) => position.source !== 'POSITION_SOURCE_OPENSKY');
            if (isOpenSkyProvider(source)) {
                positions = [];
                source = 'none';
            }
        }
        if (req.icao24) positions = positions.filter(p => p.icao24 === req.icao24);
        if (req.callsign) positions = positions.filter(p => p.callsign.includes(req.callsign.toUpperCase()));
        return { positions, source, updatedAt: Date.now() };
    }

    return { positions: [], source: 'none', updatedAt: Date.now() };
}
