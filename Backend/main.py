from flask import Flask, jsonify, request
from flask_cors import CORS
from neo4j import GraphDatabase, basic_auth
from dotenv import load_dotenv
import os
import atexit
import math

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}})

# Neo4j connection details from environment variables
uri = os.getenv("NEO4J_URI")
username = os.getenv("NEO4J_USERNAME")
password = os.getenv("NEO4J_PASSWORD")

# Create a Neo4j driver instance
driver = GraphDatabase.driver(uri, auth=basic_auth(username, password))


# Ensure the driver is closed on exit
@atexit.register
def close_driver():
    driver.close()


@app.route("/")
def home():
    return "Welcome to the graph database app!"


# Get all delivery points
@app.route('/delivery/points', methods=['GET'])
def get_delivery_points():
    def get_points(tx):
        query = "MATCH (p:DeliveryPoint) RETURN p"
        result = tx.run(query)
        return [record["p"] for record in result]

    with driver.session() as session:
        try:
            data = session.read_transaction(get_points)
            points = [{"x": record["x"], "y": record["y"]} for record in data]
            return jsonify(points)
        except Exception as e:
            return jsonify({"error": str(e)}), 500


# Get optimal delivery route
@app.route('/delivery/route', methods=['GET'])
def get_delivery_route():
    start_point_x = request.args.get('startPointX')

    if not start_point_x:
        return jsonify({"error": "Please provide startPointX"}), 400

    def find_path(tx, start_x, start_y):
        result = tx.run("""
            // Step 1: Start from DeliveryPoint 1 and get all other points
            MATCH (start:DeliveryPoint {DeliveryPointID: """, start_point_x, """})
            MATCH (other:DeliveryPoint)
            WHERE other <> start
            WITH start, collect(other) AS others

            UNWIND others AS other
            MATCH path = shortestPath((start)-[:ROUTE_TO*]-(other))
            WITH start, other, path,
            reduce(s = 0, r IN relationships(path) | s + (r.distance / r.speed_limit)) AS time
            ORDER BY time

            WITH start, collect({node: other, time: time}) AS orderedNodes

            WITH [start] + [node IN orderedNodes | node.node] AS fullPath

            UNWIND range(0, size(fullPath) - 2) AS i
            WITH fullPath, i, fullPath[i] AS current, fullPath[i+1] AS next

            MATCH (current)-[r:ROUTE_TO]->(next)
            WITH fullPath, collect({start: current, end: next, relationship: r,
            time: r.distance / r.speed_limit, distance: r.distance}) AS routes

            WITH routes,
            [node IN fullPath | node.DeliveryPointID] AS visitOrder,
            reduce(s = 0, route IN routes | s + route.time) AS totalTime,
            reduce(s = 0, route IN routes | s + route.distance) AS totalDistance
            RETURN [r IN routes | r.relationship] AS path,
            visitOrder,
            totalTime,
            totalDistance
            """, start_x=start_x, start_y=start_y)
        return list(result)

    with driver.session() as session:
        try:
            data = session.execute_read(
                find_path,
                float(start_point_x)
            )

            if data:
                for node in data:
                    print(node, "\n")
                return jsonify("Success")
            else:
                return jsonify({"error": "No path found between the specified delivery points"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500


@app.route('/delivery/routesingle', methods=['GET'])
def get_delivery_route_single():
    start_point = request.args.get('startPoint')
    end_point = request.args.get('endPoint')
    print("start point: " + start_point)
    print("end point: " + end_point)

    if not start_point or end_point:
        return jsonify({"error": "Please provide a start and end point"}), 400

    with driver.session() as session:
        result = session.run("""
            MATCH (start:DeliveryPoint {DeliveryPointID: """, start_point, """}), 
                  (end:DeliveryPoint {DeliveryPointID: """, end_point, """})
            CALL {
              WITH start, end
              MATCH path = allShortestPaths((start)-[:ROUTE_TO*]->(end))
              RETURN path
            }
            WITH path, reduce(totalTime = 0.0, rel in relationships(path) | totalTime + (rel.distance / rel.speed_limit)) AS totalTime
            RETURN path, totalTime
            ORDER BY totalTime ASC
        """)

        record = result.single()

        if record:
            path = record["path"]
            totalTime = record["totalTime"]
            nodes = [{"DeliveryPointID": node["DeliveryPointID"]} for node in path.nodes]
            response = {
                "route": nodes,
                "totalTime": totalTime
            }
            return jsonify(response)
        else:
            return jsonify({"error": "No path found between the specified delivery points"}), 404


# Add delivery point and create edges with distances and speed limits
@app.route('/delivery/point', methods=['POST'])
def post_delivery_point():
    content = request.json
    x = content.get("x")
    y = content.get("y")
    speed_limit = content.get("speed_limit")

    if x is None or y is None or speed_limit is None:
        return jsonify({"error": "x, y, and speed_limit must be provided"}), 400

    # Convert x, y, and speed_limit to appropriate types
    try:
        x = float(x)
        y = float(y)
        speed_limit = float(speed_limit)
    except ValueError:
        return jsonify({"error": "x, y, and speed_limit must be valid numbers"}), 400

    def create_point_and_edges(tx, x, y, speed_limit):
        # Check if point already exists
        existing_point_query = (
            "MATCH (p:DeliveryPoint {x: $x, y: $y}) RETURN p"
        )
        existing_point = tx.run(existing_point_query, x=x, y=y).single()
        if existing_point:
            return {"error": f"Delivery point with coordinates ({x}, {y}) already exists"}, 400

        # Create the new delivery point
        create_point_query = (
            "CREATE (p:DeliveryPoint {x: $x, y: $y}) "
            "RETURN p"
        )
        tx.run(create_point_query, x=x, y=y)

        # Find all existing delivery points
        existing_points_query = "MATCH (p:DeliveryPoint) RETURN p"
        existing_points = tx.run(existing_points_query)

        # Create edges between the new point and all existing points
        for record in existing_points:
            existing_point = record["p"]
            existing_x = existing_point["x"]
            existing_y = existing_point["y"]

            if existing_x != x or existing_y != y:
                distance = math.sqrt((x - existing_x) ** 2 + (y - existing_y) ** 2)
                create_edge_query = (
                    "MATCH (a:DeliveryPoint {x: $x1, y: $y1}), (b:DeliveryPoint {x: $x2, y: $y2}) "
                    "CREATE (a)-[:ROUTE_TO {distance: $distance, speed_limit: $speed_limit}]->(b)"
                )
                tx.run(create_edge_query, x1=x, y1=y, x2=existing_x, y2=existing_y, distance=distance, speed_limit=speed_limit)
                tx.run(create_edge_query, x1=existing_x, y1=existing_y, x2=x, y2=y, distance=distance, speed_limit=speed_limit)

    with driver.session() as session:
        try:
            result = session.write_transaction(create_point_and_edges, x, y, speed_limit)
            if isinstance(result, dict) and "error" in result:
                return jsonify(result), 400
            return jsonify({"message": f"Delivery point at ({x}, {y}) and its routes created successfully"}), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500


# Delete delivery point
@app.route('/delivery/point', methods=['DELETE'])
def delete_delivery_point():
    content = request.json
    x = content.get("x")
    y = content.get("y")

    if x is None or y is None:
        return jsonify({"error": "x and y must be provided"}), 400

    def delete_point(tx, x, y):
        query = "MATCH (p:DeliveryPoint {x: $x, y: $y}) DETACH DELETE p"
        tx.run(query, x=x, y=y)

    with driver.session() as session:
        try:
            session.write_transaction(delete_point, float(x), float(y))
            return jsonify({"message": f"Delivery point at ({x}, {y}) deleted successfully"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500


# Delete all delivery points
@app.route('/delivery/all-points', methods=['DELETE'])
def delete_all_delivery_points():
    def delete_all_points(tx):
        query = "MATCH (p:DeliveryPoint) DETACH DELETE p"
        tx.run(query)

    with driver.session() as session:
        try:
            session.write_transaction(delete_all_points)
            return jsonify({"message": "All delivery points and their routes deleted successfully"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
