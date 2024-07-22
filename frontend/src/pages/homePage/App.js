import React, { useState } from "react";
import "./App.css";

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
		//simulate finding a route with fake data covering all drop-off points
		//just marks all the points for now will connect them
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
		<div className="App">
			<header className="App-header">
				<h1>Route Planner</h1>
			</header>
			<form onSubmit={handleSubmit}>
				<label>
					Grid Size:
					<input
						type="number"
						value={gridSize}
						onChange={(e) => setGridSize(parseInt(e.target.value))}
						placeholder="Grid Size"
					/>
				</label>
				<label>
					Start Location (x, y):
					<input
						type="number"
						value={start?.x || ""}
						onChange={(e) =>
							setStart({ x: parseInt(e.target.value), y: start?.y || "" })
						}
						placeholder="x"
					/>
					<input
						type="number"
						value={start?.y || ""}
						onChange={(e) =>
							setStart({ x: start?.x || "", y: parseInt(e.target.value) })
						}
						placeholder="y"
					/>
				</label>
				<button type="submit">Find Route</button>
			</form>
			<div>
				<label>
					New Location (x, y):
					<input
						type="number"
						value={newLocation.x}
						onChange={(e) =>
							setNewLocation({ ...newLocation, x: e.target.value })
						}
						placeholder="x"
					/>
					<input
						type="number"
						value={newLocation.y}
						onChange={(e) =>
							setNewLocation({ ...newLocation, y: e.target.value })
						}
						placeholder="y"
					/>
				</label>
				<button onClick={addLocation}>Add Location</button>
			</div>
			<div
				className="grid"
				style={{
					gridTemplateColumns: `repeat(${gridSize}, 50px)`,
					gridTemplateRows: `repeat(${gridSize}, 50px)`,
				}}
			>
				{Array.from({ length: gridSize }).map((_, x) =>
					Array.from({ length: gridSize }).map((_, y) => renderCell(x, y))
				)}
			</div>
		</div>
	);
}

export default App;
