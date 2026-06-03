import type { WeatherField } from "./WeatherHeatmap";

export type LayerType = "wind" | WeatherField;

interface LayerControlProps {
  activeLayer: LayerType;
  onChange: (layer: LayerType) => void;
}

const LAYERS: { id: LayerType; label: string }[] = [
  { id: "wind", label: "💨  Wind" },
  { id: "temperature", label: "🌡  Temperature" },
  { id: "precipitation", label: "🌧  Precipitation" },
  { id: "humidity", label: "💧  Humidity" },
];

interface LegendBarProps {
  title: string;
  stops: string[];
  labels: string[];
}

function LegendBar({ title, stops, labels }: LegendBarProps) {
  return (
    <div
      style={{
        padding: "8px 14px",
        background: "rgba(15,15,20,0.78)",
        borderRadius: 8,
        color: "#fff",
        backdropFilter: "blur(6px)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ fontSize: 11, marginBottom: 5, opacity: 0.75 }}>
        {title}
      </div>
      <div
        style={{
          height: 12,
          borderRadius: 6,
          background: `linear-gradient(to right, ${stops.join(", ")})`,
          marginBottom: 5,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          opacity: 0.85,
        }}
      >
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

const LEGENDS: Record<
  LayerType,
  { title: string; stops: string[]; labels: string[] }
> = {
  wind: {
    title: "Wind Speed",
    stops: ["#0000ff", "#00b4ff", "#00ff00", "#ffff00", "#ff0000"],
    labels: ["0", "5", "10", "15", "20+ km/h"],
  },
  temperature: {
    title: "Temperature (°C)",
    stops: ["#0000ff", "#00ffff", "#00ff00", "#ffff00", "#ff0000"],
    labels: ["0°", "10°", "20°", "30°", "40°C"],
  },
  humidity: {
    title: "Humidity (%)",
    stops: ["rgba(200,220,255,0.15)", "#6eb4ff", "#005ec2"],
    labels: ["0%", "50%", "100%"],
  },
  precipitation: {
    title: "Precipitation Probability (%)",
    stops: ["rgba(200,215,255,0.15)", "#4499ff", "#001a80"],
    labels: ["0%", "50%", "100%"],
  },
};

export function LayerControl({ activeLayer, onChange }: LayerControlProps) {
  const legend = LEGENDS[activeLayer];

  return (
    <>
      {/* Layer toggle buttons — top-right */}
      <div
        style={{
          position: "absolute",
          top: 80,
          right: 12,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        {LAYERS.map((layer) => (
          <button
            key={layer.id}
            onClick={() => onChange(layer.id)}
            style={{
              padding: "9px 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              background:
                activeLayer === layer.id ? "#1a73e8" : "rgba(20,20,28,0.82)",
              color: "#fff",
              backdropFilter: "blur(5px)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
              transition: "background 0.18s",
              textAlign: "left",
              minWidth: 148,
              letterSpacing: 0.2,
            }}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {/* Color legend — bottom-center */}
      <div
        style={{
          position: "absolute",
          bottom: 36,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          minWidth: 300,
          maxWidth: "80vw",
        }}
      >
        <LegendBar
          title={legend.title}
          stops={legend.stops}
          labels={legend.labels}
        />
      </div>
    </>
  );
}
