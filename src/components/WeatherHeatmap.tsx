import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import {
  buildScalarGrid,
  GRID_W,
  GRID_H,
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

interface WeatherHeatmapProps {
  stationWinds: StationWindData[];
  field: WeatherField;
}

export function WeatherHeatmap({ stationWinds, field }: WeatherHeatmapProps) {
  const map = useMap();

  useEffect(() => {
    if (stationWinds.length === 0) return;

    let overlay: L.ImageOverlay | null = null;

    const render = () => {
      // Get live viewport bounds
      const b = map.getBounds();
      const bounds = {
        west: b.getWest(),
        east: b.getEast(),
        south: b.getSouth(),
        north: b.getNorth(),
      };

      // Build IDW scalar grid over current viewport
      const grid = buildScalarGrid(
        stationWinds,
        (s) => getFieldValue(s, field),
        bounds,
      );

      // Render to offscreen canvas
      const offscreen = document.createElement("canvas");
      offscreen.width = GRID_W;
      offscreen.height = GRID_H;
      const ctx = offscreen.getContext("2d")!;
      const imgData = ctx.createImageData(GRID_W, GRID_H);
      for (let gy = 0; gy < GRID_H; gy++) {
        for (let gx = 0; gx < GRID_W; gx++) {
          const val = grid[gy * GRID_W + gx];
          const [r, g, bv, a] = valueToRgba(val, field);
          const i = (gy * GRID_W + gx) * 4;
          imgData.data[i] = r;
          imgData.data[i + 1] = g;
          imgData.data[i + 2] = bv;
          imgData.data[i + 3] = a;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const lBounds = L.latLngBounds(
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      );

      if (overlay) {
        overlay.remove();
      }
      overlay = L.imageOverlay(offscreen.toDataURL(), lBounds, {
        opacity: 1,
        interactive: false,
      });
      overlay.addTo(map);
    };

    render();
    map.on("moveend", render);
    map.on("zoomend", render);

    return () => {
      map.off("moveend", render);
      map.off("zoomend", render);
      overlay?.remove();
    };
  }, [map, stationWinds, field]);

  return null;
}
