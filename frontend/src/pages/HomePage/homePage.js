import React, { useState, useEffect } from "react";
import logo from "../../assets/logo.png";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
  useDisclosure,
} from "@chakra-ui/react";
import "./homePage.css";
import {
  getAllDeliveryPoints,
  deleteDeliveryPoint,
  addDeliveryPoint,
} from "../../apiClient/apiClient";
function App() {
  const [gridSize, setGridSize] = useState(5);
  const [start, setStart] = useState(null);
  const [route, setRoute] = useState([]);
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState({ x: "", y: "" });
  const [newSpeedLimit, setNewSpeedLimit] = useState("");
  const [deleteLocation, setDeleteLocation] = useState({ x: "", y: "" });

  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef();

  useEffect(() => {
    getAllDeliveryPoints()
      .then((points) => setLocations(points))
      .catch((error) =>
        console.error("Error fetching delivery points:", error)
      );
  }, []);

  const addLocationHandler = async (event) => {
    event.preventDefault();
    const { x, y } = newLocation;
    const speed_limit = newSpeedLimit;
    if (x !== "" && y !== "" && speed_limit !== "") {
      try {
        await addDeliveryPoint({
          x: parseFloat(x),
          y: parseFloat(y),
          speed_limit: parseFloat(speed_limit),
        });
        setLocations([
          ...locations,
          {
            x: parseFloat(x),
            y: parseFloat(y),
            speed_limit: parseFloat(speed_limit),
          },
        ]);
        setNewLocation({ x: "", y: "" });
        setNewSpeedLimit("");
      } catch (error) {
        console.error("Error adding delivery point:", error);
      }
    }
  };
  const deleteLocationHandler = async () => {
    const { x, y } = deleteLocation;
    if (x !== "" && y !== "") {
      try {
        await deleteDeliveryPoint(x, y);
        setLocations(
          locations.filter(
            (loc) => loc.x !== parseInt(x) || loc.y !== parseInt(y)
          )
        );
        setDeleteLocation({ x: "", y: "" });
      } catch (error) {
        console.error("Error deleting delivery point:", error);
      }
    }
  };

  const deleteAllLocationHandler = () => {
    //call endpoint
    onClose();
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
            <form onSubmit={addLocationHandler}>
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
              <section className="input-container">
                <label>Add Speed Limit (km/h): </label>
                <input
                  className="input"
                  value={newSpeedLimit}
                  onChange={(e) => setNewSpeedLimit(e.target.value)}
                  placeholder="km/h"
                  controlled
                />
              </section>
              <section className="button-container">
                <button className="button" type="submit">
                  Add New Location
                </button>
              </section>
            </form>
          </section>
          <label className="title-container">Delete drop off location:</label>
          <section className="panel-section">
            <section className="input-container">
              <label>Location (x, y): </label>
              <input
                className="input"
                type="number"
                value={deleteLocation.x}
                onChange={(e) =>
                  setDeleteLocation({ ...deleteLocation, x: e.target.value })
                }
                placeholder="x"
              />
              <label> ; </label>
              <input
                className="input"
                type="number"
                value={deleteLocation.y}
                onChange={(e) =>
                  setDeleteLocation({ ...deleteLocation, y: e.target.value })
                }
                placeholder="y"
              />
            </section>
            <section className="button-container">
              <button className="button--dark" onClick={onOpen}>
                Delete ALL Locations
              </button>
              <button className="button" onClick={deleteLocationHandler}>
                Delete Location
              </button>
              <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef}>
                <AlertDialogOverlay>
                  <AlertDialogContent>
                    <AlertDialogHeader fontSize="lg" fontWeight="bold">
                      Delete Customer
                    </AlertDialogHeader>

                    <AlertDialogBody>
                      Are you sure? You can't undo this action afterwards.
                    </AlertDialogBody>

                    <AlertDialogFooter>
                      <Button ref={cancelRef} onClick={onClose}>
                        Cancel
                      </Button>
                      <Button
                        colorScheme="red"
                        onClick={deleteAllLocationHandler}
                        ml={3}
                      >
                        Delete
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialogOverlay>
              </AlertDialog>
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
