export type StationRecord = {
    Id: number;
    SynopNo: string;
    StationName: string;
    Province: string;
    Municipality: string;
    Latitude: string;
    Longitude: string;
    StationCategory: string | null;
    StationDesc: string | null;
};

export type StationInfo = {
    lat: number;
    lng: number;
    name: string;
    province: string;
    municipality: string;
    synopNo: string;
};

/**
 * Find a station in the StationRegister by SynopNo.
 * SynopNo comparison is done as trimmed strings to handle leading zeros.
 */
export function lookupStation(
    stations: StationRecord[],
    synopNo: string,
): StationInfo | null {
    const match = stations.find(
        (s) => s.SynopNo.trim() === synopNo.trim(),
    );
    if (!match) return null;
    return {
        lat: parseFloat(match.Latitude),
        lng: parseFloat(match.Longitude),
        name: match.StationName,
        province: match.Province,
        municipality: match.Municipality,
        synopNo: match.SynopNo,
    };
}

export type ForecastRecord = {
    SynopNo: string;
    ForecastDay: string;
    DayOfWeek: string;
    DateT: string;
    ForecastedTime: string;
    ForecastedWindDirectionDegrees: string;
    ForecastedWindSpeed: string;
    ForecastedWindDirectionShort: string;
    ForecastedWindDirectionLong: string;
    ForecastedTemperature: string;
    ForecastedWeatherDescription: string;
    ForecastedHumidity: string;
    ForecastedPrecipitationPercentage: string;
    [key: string]: string | number | null | undefined;
};

export type WindSlot = {
    speed: number;
    degrees: number;
    /** Eastward component (positive = east) */
    u: number;
    /** Northward component (positive = north) */
    v: number;
    directionShort: string;
    directionLong: string;
    time: string;
    date: string;
    dayOfWeek: string;
    temperature: string;
    weatherDescription: string;
    humidity: string;
};

/**
 * Convert meteorological wind direction (FROM bearing) + speed to U/V components.
 * Particles travel TO direction (degrees + 180).
 */
export function degreesToUV(
    degrees: number,
    speed: number,
): { u: number; v: number } {
    const toBearing = ((degrees + 180) % 360) * (Math.PI / 180);
    return {
        u: Math.sin(toBearing) * speed,
        v: Math.cos(toBearing) * speed,
    };
}

/** Deduplicate records by date+time, build wind slots. */
export function parseWindSlots(data: ForecastRecord[]): WindSlot[] {
    const seen = new Set<string>();
    const slots: WindSlot[] = [];

    for (const r of data) {
        const key = `${r.DateT}|${r.ForecastedTime}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const degrees = parseFloat(r.ForecastedWindDirectionDegrees) || 0;
        const speed = parseFloat(r.ForecastedWindSpeed) || 0;

        slots.push({
            speed,
            degrees,
            ...degreesToUV(degrees, speed),
            directionShort: r.ForecastedWindDirectionShort,
            directionLong: r.ForecastedWindDirectionLong,
            time: r.ForecastedTime,
            date: r.DateT,
            dayOfWeek: r.DayOfWeek,
            temperature: r.ForecastedTemperature,
            weatherDescription: r.ForecastedWeatherDescription,
            humidity: r.ForecastedHumidity,
        });
    }

    return slots;
}

/**
 * Map wind speed (km/h) to an RGB triplet.
 * Calm = blue, moderate = green/yellow, strong = red.
 */
export function speedToRgb(speed: number, max = 20): [number, number, number] {
    const t = Math.min(speed / max, 1);
    if (t < 0.25) {
        const s = t / 0.25;
        return [0, Math.round(s * 180), 255];
    } else if (t < 0.5) {
        const s = (t - 0.25) / 0.25;
        return [0, 255, Math.round((1 - s) * 255)];
    } else if (t < 0.75) {
        const s = (t - 0.5) / 0.25;
        return [Math.round(s * 255), 255, 0];
    } else {
        const s = (t - 0.75) / 0.25;
        return [255, Math.round((1 - s) * 255), 0];
    }
}

// ── Multi-station wind field ──────────────────────────────────────────────────

export type StationWindData = {
    synopNo: string;
    name: string;
    province: string;
    lng: number;
    lat: number;
    /** Eastward wind component (averaged over day-1 slots) */
    u: number;
    /** Northward wind component (averaged over day-1 slots) */
    v: number;
    speed: number;
    degrees: number;
    directionShort: string;
    weatherDescription: string;
    temperature: string;
    temperatureNum: number;
    humidityNum: number;
    precipitationPct: number;
};

/**
 * Build per-station day-1 wind averages from forecast data.
 * Averages all day-1 time slots for each station and resolves coordinates
 * from the StationRegister. Stations with no coordinate match are skipped.
 */
export function buildDay1StationWinds(
    data: ForecastRecord[],
    stations: StationRecord[],
): StationWindData[] {
    const day1 = data.filter((r) => r.ForecastDay === "1");

    const byStation = new Map<string, ForecastRecord[]>();
    for (const r of day1) {
        const arr = byStation.get(r.SynopNo) ?? [];
        arr.push(r);
        byStation.set(r.SynopNo, arr);
    }

    const result: StationWindData[] = [];
    for (const [synopNo, records] of byStation) {
        const info = lookupStation(stations, synopNo);
        if (!info) continue;

        let uSum = 0, vSum = 0, tempSum = 0, humSum = 0, precipSum = 0;
        for (const r of records) {
            const deg = parseFloat(r.ForecastedWindDirectionDegrees) || 0;
            const spd = parseFloat(r.ForecastedWindSpeed) || 0;
            const { u, v } = degreesToUV(deg, spd);
            uSum += u;
            vSum += v;
            tempSum += parseFloat(r.ForecastedTemperature) || 0;
            humSum += parseFloat(r.ForecastedHumidity) || 0;
            precipSum += parseFloat(r.ForecastedPrecipitationPercentage) || 0;
        }
        const u = uSum / records.length;
        const v = vSum / records.length;
        const speed = Math.sqrt(u * u + v * v);
        const first = records[0];

        result.push({
            synopNo,
            name: info.name,
            province: info.province,
            lng: info.lng,
            lat: info.lat,
            u,
            v,
            speed,
            degrees: parseFloat(first.ForecastedWindDirectionDegrees) || 0,
            directionShort: first.ForecastedWindDirectionShort,
            weatherDescription: first.ForecastedWeatherDescription,
            temperature: first.ForecastedTemperature,
            temperatureNum: tempSum / records.length,
            humidityNum: humSum / records.length,
            precipitationPct: precipSum / records.length,
        });
    }

    return result;
}

/**
 * Inverse-distance-weighted wind at (lng, lat) from an array of station winds.
 * Used to populate the precomputed grid; not called per-frame.
 */
export function getWindAt(
    stationWinds: StationWindData[],
    lng: number,
    lat: number,
): { u: number; v: number; speed: number } {
    let wSum = 0, uSum = 0, vSum = 0;
    for (const s of stationWinds) {
        const dx = lng - s.lng;
        const dy = lat - s.lat;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < 1e-8) return { u: s.u, v: s.v, speed: s.speed };
        const w = 1 / dist2;
        wSum += w;
        uSum += w * s.u;
        vSum += w * s.v;
    }
    if (wSum === 0) return { u: 0, v: 0, speed: 0 };
    const u = uSum / wSum;
    const v = vSum / wSum;
    return { u, v, speed: Math.sqrt(u * u + v * v) };
}

// ── Precomputed wind grid for O(1) per-particle wind lookup ──────────────────

export const GRID_W = 100;
export const GRID_H = 80;
export const GRID_WEST = 16.0;
export const GRID_EAST = 34.0;
export const GRID_SOUTH = -35.0;
export const GRID_NORTH = -22.0;

/**
 * Bake IDW into a Float32Array grid [u, v, u, v, ...] covering
 * South Africa (16°E–34°E, 35°S–22°S) at 100×80 resolution.
 * Call once at startup; each particle then uses sampleWindGrid per frame.
 */
export function buildWindGrid(stationWinds: StationWindData[]): Float32Array {
    const grid = new Float32Array(GRID_W * GRID_H * 2);
    for (let gy = 0; gy < GRID_H; gy++) {
        for (let gx = 0; gx < GRID_W; gx++) {
            const lng = GRID_WEST + (gx / (GRID_W - 1)) * (GRID_EAST - GRID_WEST);
            const lat = GRID_NORTH - (gy / (GRID_H - 1)) * (GRID_NORTH - GRID_SOUTH);
            const w = getWindAt(stationWinds, lng, lat);
            grid[(gy * GRID_W + gx) * 2] = w.u;
            grid[(gy * GRID_W + gx) * 2 + 1] = w.v;
        }
    }
    return grid;
}

/**
 * Bilinear sample from the precomputed wind grid.
 * Clamps coordinates to grid bounds (handles out-of-area particles gracefully).
 */
export function sampleWindGrid(
    grid: Float32Array,
    lng: number,
    lat: number,
): { u: number; v: number; speed: number } {
    const gx = Math.max(0, Math.min(GRID_W - 1,
        ((lng - GRID_WEST) / (GRID_EAST - GRID_WEST)) * (GRID_W - 1)));
    const gy = Math.max(0, Math.min(GRID_H - 1,
        ((GRID_NORTH - lat) / (GRID_NORTH - GRID_SOUTH)) * (GRID_H - 1)));

    const x0 = Math.min(GRID_W - 2, Math.floor(gx));
    const y0 = Math.min(GRID_H - 2, Math.floor(gy));
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const fx = gx - x0;
    const fy = gy - y0;

    const i00 = (y0 * GRID_W + x0) * 2;
    const i10 = (y0 * GRID_W + x1) * 2;
    const i01 = (y1 * GRID_W + x0) * 2;
    const i11 = (y1 * GRID_W + x1) * 2;

    const u =
        (1 - fx) * (1 - fy) * grid[i00] +
        fx * (1 - fy) * grid[i10] +
        (1 - fx) * fy * grid[i01] +
        fx * fy * grid[i11];
    const v =
        (1 - fx) * (1 - fy) * grid[i00 + 1] +
        fx * (1 - fy) * grid[i10 + 1] +
        (1 - fx) * fy * grid[i01 + 1] +
        fx * fy * grid[i11 + 1];

    return { u, v, speed: Math.sqrt(u * u + v * v) };
}

/**
 * Bake IDW of any scalar field into a Float32Array grid covering South Africa.
 */
export function buildScalarGrid(
    stationWinds: StationWindData[],
    getValue: (s: StationWindData) => number,
): Float32Array {
    const grid = new Float32Array(GRID_W * GRID_H);
    for (let gy = 0; gy < GRID_H; gy++) {
        for (let gx = 0; gx < GRID_W; gx++) {
            const lng = GRID_WEST + (gx / (GRID_W - 1)) * (GRID_EAST - GRID_WEST);
            const lat = GRID_NORTH - (gy / (GRID_H - 1)) * (GRID_NORTH - GRID_SOUTH);
            let wSum = 0, vSum = 0;
            for (const s of stationWinds) {
                const dx = lng - s.lng;
                const dy = lat - s.lat;
                const dist2 = dx * dx + dy * dy;
                if (dist2 < 1e-8) { wSum = 1e16; vSum = getValue(s) * 1e16; break; }
                const w = 1 / dist2;
                wSum += w;
                vSum += w * getValue(s);
            }
            grid[gy * GRID_W + gx] = wSum > 0 ? vSum / wSum : 0;
        }
    }
    return grid;
}

/** Bilinear sample from a precomputed scalar grid. */
export function sampleScalarGrid(
    grid: Float32Array,
    lng: number,
    lat: number,
): number {
    const gx = Math.max(0, Math.min(GRID_W - 1,
        ((lng - GRID_WEST) / (GRID_EAST - GRID_WEST)) * (GRID_W - 1)));
    const gy = Math.max(0, Math.min(GRID_H - 1,
        ((GRID_NORTH - lat) / (GRID_NORTH - GRID_SOUTH)) * (GRID_H - 1)));
    const x0 = Math.min(GRID_W - 2, Math.floor(gx));
    const y0 = Math.min(GRID_H - 2, Math.floor(gy));
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const fx = gx - x0;
    const fy = gy - y0;
    return (
        (1 - fx) * (1 - fy) * grid[y0 * GRID_W + x0] +
        fx * (1 - fy) * grid[y0 * GRID_W + x1] +
        (1 - fx) * fy * grid[y1 * GRID_W + x0] +
        fx * fy * grid[y1 * GRID_W + x1]
    );
}
