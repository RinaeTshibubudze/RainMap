import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import {
  buildScalarGrid,
  GRID_W,
  GRID_H,
  GRID_WEST,
  GRID_EAST,
  GRID_NORTH,
  GRID_SOUTH,
  type StationWindData,
} from "../utils/windUtils";

export type WeatherField = "temperature" | "humidity" | "precipitation";

function valueToRgba(
  value: number,
  field: WeatherField,
): [number, number, number, number] {
  if (field === "temperature") {
    // 0–40°C: blue → cyan → green → yellow → red
    const t = Math.max(0, Math.min(1, value / 40));
    let r = 0,
      g = 0,
      b = 0;
    if (t < 0.25) {
      const s = t / 0.25;
      r = 0;
      g = Math.round(s * 255);
      b = 255;
    } else if (t < 0.5) {
      const s = (t - 0.25) / 0.25;
      r = 0;
      g = 255;
      b = Math.round((1 - s) * 255);
    } else if (t < 0.75) {
      const s = (t - 0.5) / 0.25;
      r = Math.round(s * 255);
      g = 255;
      b = 0;
    } else {
      const s = (t - 0.75) / 0.25;
      r = 255;
      g = Math.round((1 - s) * 255);
      b = 0;
    }
    return [r, g, b, 165];
  } else if (field === "humidity") {
    // 0–100%: white-ish → deep blue
    const t = Math.max(0, Math.min(1, value / 100));
    return [
      Math.round((1 - t) * 200),
      Math.round((1 - t) * 220 + t * 100),
      255,
      Math.round(t * 185),
    ];
  } else {
    // precipitation 0–100%: transparent → indigo
    const t = Math.max(0, Math.min(1, value / 100));
    return [
      Math.round((1 - t) * 120),
      Math.round((1 - t) * 170 + t * 80),
      255,
      Math.round(t * 210),
    ];
  }
}

function getFieldValue(s: StationWindData, field: WeatherField): number {
  if (field === "temperature") return s.temperatureNum;
  if (field === "humidity") return s.humidityNum;
  return s.precipitationPct;
}

function markerColor(s: StationWindData, field: WeatherField): string {
  const [r, g, b] = valueToRgba(getFieldValue(s, field), field);
  return `rgb(${r},${g},${b})`;
}

function popupHtml(s: StationWindData, field: WeatherField): string {
  const value = getFieldValue(s, field);
  const label =
    field === "temperature"
      ? `Temperature: ${value.toFixed(1)}°C`
      : field === "humidity"
        ? `Humidity: ${value.toFixed(0)}%`
        : `Precipitation: ${value.toFixed(0)}%`;
  return (
    `<b>${s.name}</b><br/>` +
    `Province: ${s.province}<br/>` +
    `${label}<br/>` +
    `Condition: ${s.weatherDescription}`
  );
}

interface WeatherHeatmapProps {
  stationWinds: StationWindData[];
  field: WeatherField;
}

export function WeatherHeatmap({ stationWinds, field }: WeatherHeatmapProps) {
  const map = useMap();

  useEffect(() => {
    if (stationWinds.length === 0) return;

    // Build IDW scalar grid
    const grid = buildScalarGrid(stationWinds, (s) => getFieldValue(s, field));

    // Render to offscreen canvas → ImageOverlay
    const offscreen = document.createElement("canvas");
    offscreen.width = GRID_W;
    offscreen.height = GRID_H;
    const ctx = offscreen.getContext("2d")!;
    const imgData = ctx.createImageData(GRID_W, GRID_H);

    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const val = grid[gy * GRID_W + gx];
        const [r, g, b, a] = valueToRgba(val, field);
        const i = (gy * GRID_W + gx) * 4;
        imgData.data[i] = r;
        imgData.data[i + 1] = g;
        imgData.data[i + 2] = b;
        imgData.data[i + 3] = a;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const bounds = L.latLngBounds(
      [GRID_SOUTH, GRID_WEST],
      [GRID_NORTH, GRID_EAST],
    );
    const overlay = L.imageOverlay(offscreen.toDataURL(), bounds, {
      opacity: 1,
      interactive: false,
    });
    overlay.addTo(map);

    // Station markers colored by field value
    const markers: L.CircleMarker[] = [];
    for (const sw of stationWinds) {
      const color = markerColor(sw, field);
      const marker = L.circleMarker([sw.lat, sw.lng], {
        radius: 5,
        color: "#ffffff",
        fillColor: color,
        fillOpacity: 0.95,
        weight: 1,
      }).addTo(map);
      marker.bindPopup(popupHtml(sw, field));
      markers.push(marker);
    }

    return () => {
      overlay.remove();
      markers.forEach((m) => m.remove());
    };
  }, [map, stationWinds, field]);

  return null;
}
