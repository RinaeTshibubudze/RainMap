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

const SOUTH = -35;
const NORTH = -22;
const WEST = 10;
const EAST = 39;

const NUM_PARTICLES = 8000;
const MAX_AGE = 120;
const SPEED_SCALE = 0.18;

type Particle = { lng: number; lat: number; age: number; maxAge: number };

function randomParticle(): Particle {
  return {
    lng: WEST + Math.random() * (EAST - WEST),
    lat: SOUTH + Math.random() * (NORTH - SOUTH),
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
    const particles: Particle[] = Array.from(
      { length: NUM_PARTICLES },
      randomParticle,
    );
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
        // Fade trails toward transparent (not toward black)
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0,0,0,0.05)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "source-over";

        for (const p of particles) {
          p.age++;
          if (p.age > p.maxAge) {
            Object.assign(p, randomParticle());
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
            newLng < WEST ||
            newLng > EAST ||
            newLat < SOUTH ||
            newLat > NORTH
          ) {
            Object.assign(p, randomParticle());
            continue;
          }

          const pt1 = map.latLngToContainerPoint([p.lat, p.lng]);
          const pt2 = map.latLngToContainerPoint([newLat, newLng]);

          const [r, g, b] = speedToRgb(wind.speed);
          const alpha = 0.75 + 0.25 * (1 - p.age / p.maxAge);

          // Glow: wide soft layer beneath
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.3})`;
          ctx.lineWidth = 6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();

          // Sharp bright core
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 2.5;
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
