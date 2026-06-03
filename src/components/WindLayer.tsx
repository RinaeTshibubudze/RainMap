import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import {
  buildWindGrid,
  sampleWindGrid,
  speedToRgb,
  type StationWindData,
} from "../utils/windUtils";

interface WindLayerProps {
  stationWinds: StationWindData[];
}

const NUM_PARTICLES = 5000;
const MAX_AGE = 60;
const SPEED_SCALE = 0.06;

type Particle = { lng: number; lat: number; age: number; maxAge: number };

function randomParticle(
  west: number,
  east: number,
  south: number,
  north: number,
): Particle {
  return {
    lng: west + Math.random() * (east - west),
    lat: south + Math.random() * (north - south),
    age: Math.floor(Math.random() * MAX_AGE),
    maxAge: 40 + Math.floor(Math.random() * MAX_AGE),
  };
}

export function WindLayer({ stationWinds }: WindLayerProps) {
  const map = useMap();
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (stationWinds.length === 0) return;
    const grid = buildWindGrid(stationWinds);

    // ── Canvas overlay ────────────────────────────────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:400;";
    map.getContainer().appendChild(canvas);

    const setSize = () => {
      const s = map.getSize();
      canvas.width = s.x;
      canvas.height = s.y;
    };
    setSize();
    map.on("resize", setSize);

    // ── Particle animation ────────────────────────────────────────────────────
    const getBounds = () => {
      const b = map.getBounds();
      return {
        west: b.getWest(),
        east: b.getEast(),
        south: b.getSouth(),
        north: b.getNorth(),
      };
    };

    const particles: Particle[] = Array.from({ length: NUM_PARTICLES }, () => {
      const b = getBounds();
      return randomParticle(b.west, b.east, b.south, b.north);
    });
    const ctx = canvas.getContext("2d")!;

    let isPanning = false;
    const onMoveStart = () => {
      isPanning = true;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    const onMoveEnd = () => {
      isPanning = false;
    };
    map.on("movestart", onMoveStart);
    map.on("moveend", onMoveEnd);

    const animate = () => {
      if (!isPanning) {
        const { west, east, south, north } = getBounds();
        // Fade trails toward transparent (not toward black)
        // Slower fade = more trail accumulation, especially when zoomed out
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0,0,0,0.07)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "source-over";

        // Line width scales up at lower zoom so trails stay visible when zoomed out
        const zoom = map.getZoom();
        const lineWidth = Math.max(1.5, 8 - zoom);

        for (const p of particles) {
          p.age++;
          if (p.age > p.maxAge) {
            Object.assign(p, randomParticle(west, east, south, north));
            continue;
          }

          const wind = sampleWindGrid(grid, p.lng, p.lat);
          if (wind.speed < 0.01) {
            p.age = p.maxAge;
            continue;
          }

          // Advance particle position (u = eastward, v = northward, km/h)
          const cosLat = Math.cos((p.lat * Math.PI) / 180);
          const newLng = p.lng + (wind.u * SPEED_SCALE) / (111 * cosLat);
          const newLat = p.lat + (wind.v * SPEED_SCALE) / 111;

          if (
            newLng < west ||
            newLng > east ||
            newLat < south ||
            newLat > north
          ) {
            Object.assign(p, randomParticle(west, east, south, north));
            continue;
          }

          const pt1 = map.latLngToContainerPoint([p.lat, p.lng]);
          const pt2 = map.latLngToContainerPoint([newLat, newLng]);

          const [r, g, b] = speedToRgb(wind.speed);
          const alpha = 0.75 + 0.25 * (1 - p.age / p.maxAge);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();

          p.lng = newLng;
          p.lat = newLat;
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      map.off("resize", setSize);
      map.off("movestart", onMoveStart);
      map.off("moveend", onMoveEnd);
      canvas.remove();
    };
  }, [map, stationWinds]);

  return null;
}
