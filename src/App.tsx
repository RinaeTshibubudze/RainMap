import "./App.css";
import MapComponent from "./components/MapComponent";

function App() {
  return (
    <>
      <MapComponent center={[-30.5, 24.5]} zoom={5.5} />
    </>
  );
}

export default App;
