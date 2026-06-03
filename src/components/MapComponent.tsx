import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { WindLayer } from "./WindLayer";
import { WeatherHeatmap } from "./WeatherHeatmap";
import { LayerControl, type LayerType } from "./LayerControl";
import {
  buildDay1StationWinds,
  type StationRecord,
  type ForecastRecord,
} from "../utils/windUtils";

// Fix default marker icons broken by webpack/vite bundling
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface MapComponentProps {
  center?: [number, number];
  zoom?: number;
  height?: string;
  stations?: StationRecord[];
  forecasts?: ForecastRecord[];
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

export default function MapComponent({
  center = [-30.5, 24.5],
  zoom = 5.5,
  height = "100vh",
  stations,
  forecasts,
}: MapComponentProps) {
  const [activeLayer, setActiveLayer] = useState<LayerType>("wind");

  const stationWinds = useMemo(() => {
    if (!stations || !forecasts) return [];
    return buildDay1StationWinds(forecasts, stations);
  }, [stations, forecasts]);

  return (
    <div style={{ position: "relative", height }}>
      <MapContainer center={center} zoom={zoom} style={{ height: "100%" }}>
        {activeLayer === "wind" ? (
          <TileLayer
            key="dark"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
        ) : (
          <TileLayer
            key="light"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        <InvalidateSize />
        {stationWinds.length > 0 && activeLayer === "wind" && (
          <WindLayer stationWinds={stationWinds} />
        )}
        {stationWinds.length > 0 && activeLayer !== "wind" && (
          <WeatherHeatmap stationWinds={stationWinds} field={activeLayer} />
        )}
      </MapContainer>
      <LayerControl activeLayer={activeLayer} onChange={setActiveLayer} />
    </div>
  );
}
