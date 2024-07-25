import React, { useState, useEffect } from "react";
import logo from "../../assets/logo.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHome, faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
  Input,
  Box,
  Image,
  Flex,
  Text,
  VStack,
  FormControl,
  FormLabel,
  Grid,
  useDisclosure,
} from "@chakra-ui/react";
import "./homePage.css";
import {
  getAllDeliveryPoints,
  deleteDeliveryPoint,
  addDeliveryPoint,
  getDeliveryRoute,
  deleteAllDeliveryPoints,
} from "../../apiClient/apiClient";
function App() {
  const [gridSize, setGridSize] = useState(5);
  const [start, setStart] = useState(null);
  const [route, setRoute] = useState([]);
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState({ x: "", y: "" });
  const [newSpeedLimit, setNewSpeedLimit] = useState("");
  const [deleteLocation, setDeleteLocation] = useState({ x: "", y: "" });
  const [error, setError] = useState("");
  const [startLocationError, setStartLocationError] = useState();
  const [routeDetails, setRouteDetails] = useState({
    visitOrder: [],
    totalTime: 0,
    totalDistance: 0,
  });
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

  const deleteAllLocationHandler = async () => {
    try {
      await deleteAllDeliveryPoints();
      setLocations([]);
      onClose();
    } catch (error) {
      console.error("Error deleting all delivery points:", error);
    }
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validStart = validateStartLocation();
    if (validStart) {
      await calculateRoute();
    }
  };

  const handleGridSizeChange = (e) => {
    const value = parseInt(e.target.value);
    if (value > 20) {
      setError("Grid size cannot exceed 20");
      setGridSize(5);
    } else {
      setError("");
      setGridSize(value);
    }
  };

  const validateStartLocation = () => {
    if (start) {
      const startX = parseFloat(start.x);
      const startY = parseFloat(start.y);
      const isValid = locations.some(
        (loc) => loc.x === startX && loc.y === startY
      );
      if (!isValid) {
        setStartLocationError(
          "Start location must be one of the location options"
        );
        setStart(null);
        return false;
      } else {
        setStartLocationError("");
        return true;
      }
    }
  };

  const renderCell = (x, y) => {
    const isStart = start && start.x == x && start.y == y;
    const isLocation = locations.some((loc) => loc.x === x && loc.y === y);
    const isRoute = route.some((point) => point.x === x && point.y === y);

    let className = "cell";
    if (isStart) className += " start";
    if (isLocation) className += " location";
    if (isRoute) className += " route";

    return (
      <div key={`${x}-${y}`} className={className}>
        {isStart && <FontAwesomeIcon icon={faHome} />}
        {isLocation && !isStart && <FontAwesomeIcon icon={faMapMarkerAlt} />}
        {isRoute && <Box className="route" />}
      </div>
    );
  };

  const calculateRoute = async () => {
    if (start) {
      try {
        const response = await getDeliveryRoute(start.x, start.y);
        setRouteDetails({
          visitOrder: response.visit_order,
          totalTime: response.total_time,
          totalDistance: response.total_distance,
        });
        const routePoints = response.visit_order.map((point) => ({
          x: parseFloat(point.split(", ")[0]),
          y: parseFloat(point.split(", ")[1]),
        }));
        setRoute(routePoints);
      } catch (error) {
        console.error("Error calculating route:", error);
      }
    } else {
      setStartLocationError("Start location is required.");
    }
  };

  return (
    <Box className="page-container">
      <Flex
        as="header"
        className="nav-bar"
        justifyContent="flex-start"
        alignItems="center"
      >
        <Image src={logo} alt="logo" h="8vh" />
      </Flex>
      <Flex as="main" className="content-container">
        <Flex
          as="section"
          className="side-panel"
          justifyContent="space-between"
        >
          <Text
            className="title-container"
            bg="#174824"
            color="white"
            w="30vw"
            fontSize="1.5rem"
            fontWeight="bold"
            p={2}
          >
            Calculate my Route:
          </Text>
          <form onSubmit={handleSubmit}>
            <Flex flexDir="column">
              <FormControl className="input-container" width="25vw">
                <FormLabel>Grid Size: </FormLabel>
                <Input
                  className="input"
                  width="8vw"
                  type="number"
                  value={gridSize}
                  onChange={handleGridSizeChange}
                  placeholder="Grid Size"
                />
              </FormControl>
              {error && <Text color="red">{error}</Text>}
            </Flex>
            <Flex flexDir="column">
              <FormControl className="input-container" width="25vw">
                <FormLabel>Start Location (x, y): </FormLabel>
                <Input
                  className="input"
                  width="5vw"
                  type="number"
                  value={start?.x || ""}
                  onChange={(e) =>
                    setStart({ x: e.target.value, y: start?.y || "" })
                  }
                  placeholder="x"
                  max={gridSize}
                />
                <Text> ; </Text>
                <Input
                  className="input"
                  width="5vw"
                  type="number"
                  value={start?.y || ""}
                  onChange={(e) =>
                    setStart({ x: start?.x || "", y: e.target.value })
                  }
                  placeholder="y"
                  max={gridSize}
                />
              </FormControl>
              {startLocationError && (
                <Text color="red">{startLocationError}</Text>
              )}
            </Flex>
            <Flex
              className="button-container"
              justifyContent="flex-end"
              gap={2}
            >
              <Button
                className="button"
                type="submit"
                bg="#6b9676"
                color="white"
                _hover={{ bg: "#174824" }}
              >
                Find Route
              </Button>
            </Flex>
          </form>

          <Text
            className="title-container"
            bg="#174824"
            color="white"
            w="30vw"
            fontSize="1.5rem"
            fontWeight="bold"
            p={2}
          >
            Add new drop off location:
          </Text>
          <VStack as="section" className="panel-section" spacing={4}>
            <form onSubmit={addLocationHandler}>
              <FormControl className="input-container" width="25vw">
                <FormLabel>New Location (x, y): </FormLabel>
                <Input
                  className="input"
                  width="5vw"
                  type="number"
                  value={newLocation.x}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, x: e.target.value })
                  }
                  placeholder="x"
                  max={gridSize}
                />
                <Text> ; </Text>
                <Input
                  className="input"
                  width="5vw"
                  type="number"
                  value={newLocation.y}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, y: e.target.value })
                  }
                  placeholder="y"
                  max={gridSize}
                />
              </FormControl>
              <FormControl className="input-container" width="25vw">
                <FormLabel>Add Speed Limit (km/h): </FormLabel>
                <Input
                  className="input"
                  width="8vw"
                  type="number"
                  value={newSpeedLimit}
                  onChange={(e) => setNewSpeedLimit(e.target.value)}
                  placeholder="km/h"
                  max={120}
                />
              </FormControl>
              <Flex
                className="button-container"
                justifyContent="flex-end"
                gap={2}
              >
                <Button
                  className="button"
                  type="submit"
                  bg="#6b9676"
                  color="white"
                  _hover={{ bg: "#174824" }}
                >
                  Add New Location
                </Button>
              </Flex>
            </form>
          </VStack>
          <Text
            className="title-container"
            bg="#174824"
            color="white"
            w="30vw"
            fontSize="1.5rem"
            fontWeight="bold"
            p={2}
          >
            Delete drop off location:
          </Text>
          <VStack as="section" className="panel-section" spacing={4}>
            <FormControl className="input-container" width="25vw">
              <FormLabel>Location (x, y): </FormLabel>
              <Input
                className="input"
                width="5vw"
                type="number"
                value={deleteLocation.x}
                onChange={(e) =>
                  setDeleteLocation({ ...deleteLocation, x: e.target.value })
                }
                placeholder="x"
                max={gridSize}
              />
              <Text> ; </Text>
              <Input
                className="input"
                width="5vw"
                type="number"
                value={deleteLocation.y}
                onChange={(e) =>
                  setDeleteLocation({ ...deleteLocation, y: e.target.value })
                }
                placeholder="y"
                max={gridSize}
              />
            </FormControl>
            <Flex
              className="button-container"
              justifyContent="flex-end"
              gap={2}
            >
              <Button
                className="button--dark"
                bg="rgb(180, 0, 0)"
                color="white"
                width="fit-content"
                _hover={{ bg: "rgb(112, 0, 0)" }}
                onClick={onOpen}
              >
                Delete All Locations
              </Button>
              <Button
                className="button"
                bg="#6b9676"
                color="white"
                _hover={{ bg: "#174824" }}
                onClick={deleteLocationHandler}
              >
                Delete Location
              </Button>
              <AlertDialog
                isOpen={isOpen}
                leastDestructiveRef={cancelRef}
                onClose={onClose}
              >
                <AlertDialogOverlay>
                  <AlertDialogContent>
                    <AlertDialogHeader fontSize="lg" fontWeight="bold">
                      Delete All Locations
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
            </Flex>
          </VStack>
        </Flex>
        <Flex
          as="section"
          className="map-container"
          flexDir="column"
          justifyContent="space-between"
          gap="4vh"
        >
          <Grid
            className="grid"
            templateColumns={`repeat(${gridSize}, 1fr)`}
            templateRows={`repeat(${gridSize}, 1fr)`}
            gap={2}
            p={6}
            bg="white"
            boxShadow="0px 4px 6px #545454"
          >
            {Array.from({ length: gridSize }).map((_, x) =>
              Array.from({ length: gridSize }).map((_, y) => renderCell(x, y))
            )}
          </Grid>
          <Flex flexDir="row" justify="space-between" gap="5vw">
            <Text
              className="title-container"
              bg="#174824"
              color="white"
              w="15vw"
              height="100%"
              fontSize="1.5rem"
              fontWeight="bold"
              p={2}
            >
              Your Route:
            </Text>
            <Flex flexDir="column" gap="0.5rem">
              <Flex className="input-container">
                <Text>Total Distance:</Text>
                <Text>{routeDetails.totalDistance.toFixed(2)} km</Text>
              </Flex>
              <Flex className="input-container">
                <Text>Total Time:</Text>
                <Text>{routeDetails.totalTime.toFixed(2)} hours</Text>
              </Flex>
              <Flex className="input-container">
                <Text>Route:</Text>
                <Text>{routeDetails.visitOrder.join(" -> ")}</Text>
              </Flex>
            </Flex>
          </Flex>
        </Flex>
      </Flex>
    </Box>
  );
}

export default App;
