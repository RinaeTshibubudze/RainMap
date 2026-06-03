import "./App.css";
import MapComponent from "./components/MapComponent";
import stationData from "./data/StationRegister.json";
import forecastData from "./data/DailyForecast.json";
import type { StationRecord, ForecastRecord } from "./utils/windUtils";

function App() {
  return (
    <MapComponent
      center={[-30.5, 24.5]}
      zoom={5.5}
      height="100dvh"
      stations={stationData as StationRecord[]}
      forecasts={forecastData as ForecastRecord[]}
    />
  );
}

export default App;
