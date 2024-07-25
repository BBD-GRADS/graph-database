import React, { useState } from "react";
import logo from "../../assets/logo.png";
import "./homePage.css";

function App() {
  const [gridSize, setGridSize] = useState(5);
  const [start, setStart] = useState(null);
  const [route, setRoute] = useState([]);
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState({ x: "", y: "" });

  const addLocation = () => {
    const { x, y } = newLocation;
    if (x !== "" && y !== "") {
      setLocations([...locations, { x: parseInt(x), y: parseInt(y) }]);
      setNewLocation({ x: "", y: "" });
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    // simulate finding a route with fake data covering all drop-off points
    // will add lines instead of just highlighting the route when backend returns optimal route
    if (start) {
      const routePoints = [start, ...locations];
      setRoute(routePoints);
    }
  };

  const renderCell = (x, y) => {
    const isStart = start && start.x === x && start.y === y;
    const isLocation = locations.some((loc) => loc.x === x && loc.y === y);
    const isRoute = route.some((point) => point.x === x && point.y === y);

    let className = "cell";
    if (isStart) className += " start";
    if (isLocation) className += " location";
    if (isRoute) className += " route";

    return (
      <div key={`${x}-${y}`} className={className}>
        {isStart && "S"}
        {isLocation && "L"}
        {isRoute && "R"}
      </div>
    );
  };

  return (
    <div className="page-container">
      <header className="nav-bar">
        <div className="header-container">
          <img src={logo} alt="logo" />
        </div>
      </header>
      <main className="content-container">
        <section className="side-panel">
          <label className="title-container">Calculate my Route:</label>
          <form onSubmit={handleSubmit}>
            <section className="input-container">
              <label>Grid Size: </label>
              <input
                className="input"
                type="number"
                value={gridSize}
                onChange={(e) => setGridSize(parseInt(e.target.value))}
                placeholder="Grid Size"
              />
            </section>
            <section className="input-container">
              <label>Start Location (x, y): </label>
              <input
                className="input"
                type="number"
                value={start?.x || ""}
                onChange={(e) =>
                  setStart({ x: parseInt(e.target.value), y: start?.y || "" })
                }
                placeholder="x"
              />
              <label> ; </label>
              <input
                className="input"
                type="number"
                value={start?.y || ""}
                onChange={(e) =>
                  setStart({ x: start?.x || "", y: parseInt(e.target.value) })
                }
                placeholder="y"
              />
            </section>
            <section className="button-container">
              <button className="button" type="submit">
                Find Route
              </button>
            </section>
          </form>
          <label className="title-container">Add new drop off location:</label>
          <section className="panel-section">
            <section className="input-container">
              <label>New Location (x, y): </label>
              <input
                className="input"
                type="number"
                value={newLocation.x}
                onChange={(e) =>
                  setNewLocation({ ...newLocation, x: e.target.value })
                }
                placeholder="x"
              />
              <label> ; </label>
              <input
                className="input"
                type="number"
                value={newLocation.y}
                onChange={(e) =>
                  setNewLocation({ ...newLocation, y: e.target.value })
                }
                placeholder="y"
              />
            </section>
            <section className="button-container">
              <button className="button" onClick={addLocation}>
                Add Location
              </button>
            </section>
          </section>
        </section>
        <section className="map-container">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              gridTemplateRows: `repeat(${gridSize}, 1fr)`,
            }}
          >
            {Array.from({ length: gridSize }).map((_, x) =>
              Array.from({ length: gridSize }).map((_, y) => renderCell(x, y))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
