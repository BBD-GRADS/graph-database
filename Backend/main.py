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
            points = [{"DeliveryPointID": record["DeliveryPointID"],
                       "x": record["x"],
                       "y": record["y"]} for record in data]
            return jsonify(points)
        except Exception as e:
            return jsonify({"error": str(e)}), 500


# Get optimal delivery route
@app.route('/delivery/route', methods=['GET'])
def get_delivery_route():
    start_point = request.args.get('startPoint')

    def find_path(tx, start):
        print("start point: " + start)
        # TODO: remove hardcoded id
        result = tx.run("""
            // Step 1: Start from DeliveryPoint 1 and get all other points
            MATCH (start:DeliveryPoint {DeliveryPointID: 3})
            MATCH (other:DeliveryPoint)
            WHERE other <> start
            WITH start, collect(other) AS others
 
            // Step 2: Find shortest paths from start to all others, based on time
            UNWIND others AS other
            MATCH path = shortestPath((start)-[:ROUTE_TO*]-(other))
            WITH start, other, path, 
            reduce(s = 0, r IN relationships(path) | s + (r.distance / r.speed_limit)) AS time
            ORDER BY time
 
            // Step 3: Collect ordered nodes
            WITH start, collect({node: other, time: time}) AS orderedNodes
 
            // Step 4: Create full path including start node
            WITH [start] + [node IN orderedNodes | node.node] AS fullPath
 
            // Step 5: Create pairs of consecutive nodes
            UNWIND range(0, size(fullPath) - 2) AS i
            WITH fullPath, i, fullPath[i] AS current, fullPath[i+1] AS next
 
            // Step 6: Find direct route between consecutive nodes
            MATCH (current)-[r:ROUTE_TO]->(next)
            WITH fullPath, collect({start: current, end: next, relationship: r, 
            time: r.distance / r.speed_limit, distance: r.distance}) AS routes
 
            // Step 7: Calculate results
            WITH routes, 
            [node IN fullPath | node.DeliveryPointID] AS visitOrder,
            reduce(s = 0, route IN routes | s + route.time) AS totalTime,
            reduce(s = 0, route IN routes | s + route.distance) AS totalDistance
            RETURN [r IN routes | r.relationship] AS path,
            visitOrder,
            totalTime,
            totalDistance
            """)
        return list(result)

    with driver.session() as session:
        try:
            data = session.execute_read(
                find_path,
                start_point
            )

            if data:
                for node in data:
                    print(node)
                return jsonify("Success")
            else:
                return jsonify({"error": "No path found between the specified delivery points"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500


# Add delivery point and create edges with distances and speed limits
@app.route('/delivery/point', methods=['POST'])
def post_delivery_point():
    content = request.json
    delivery_point_id = content.get("DeliveryPointID")
    x = content.get("x")
    y = content.get("y")
    speed_limit = content.get("speed_limit")

    if not delivery_point_id or x is None or y is None or speed_limit is None:
        return jsonify({"error": "DeliveryPointID, x, y, and speed_limit must be provided"}), 400

    # Convert x, y, and speed_limit to appropriate types
    try:
        x = float(x)
        y = float(y)
        speed_limit = float(speed_limit)
    except ValueError:
        return jsonify({"error": "x, y, and speed_limit must be valid numbers"}), 400

    def create_point_and_edges(tx, point_id, x, y, speed_limit):
        # Create the new delivery point
        create_point_query = (
            "CREATE (p:DeliveryPoint {DeliveryPointID: $id, x: $x, y: $y}) "
            "RETURN p"
        )
        tx.run(create_point_query, id=point_id, x=x, y=y)

        # Find all existing delivery points
        existing_points_query = "MATCH (p:DeliveryPoint) RETURN p"
        existing_points = tx.run(existing_points_query)

        # Create edges between the new point and all existing points
        for record in existing_points:
            existing_point = record["p"]
            existing_point_id = existing_point["DeliveryPointID"]
            existing_x = existing_point["x"]
            existing_y = existing_point["y"]

            if existing_point_id != point_id:
                distance = math.sqrt((x - existing_x) ** 2 + (y - existing_y) ** 2)
                create_edge_query = (
                    "MATCH (a:DeliveryPoint {DeliveryPointID: $id1}), (b:DeliveryPoint {DeliveryPointID: $id2}) "
                    "CREATE (a)-[:ROUTE_TO {distance: $distance, speed_limit: $speed_limit}]->(b)"
                )
                tx.run(create_edge_query, id1=point_id, id2=existing_point_id, distance=distance,
                       speed_limit=speed_limit)
                tx.run(create_edge_query, id1=existing_point_id, id2=point_id, distance=distance,
                       speed_limit=speed_limit)

    with driver.session() as session:
        try:
            session.write_transaction(create_point_and_edges, delivery_point_id, x, y, speed_limit)
            return jsonify(
                {"message": f"Delivery point '{delivery_point_id}' and its routes created successfully"}), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500


# Delete delivery point
@app.route('/delivery/point', methods=['DELETE'])
def delete_delivery_point():
    content = request.json
    delivery_point_id = content.get("DeliveryPointID")

    if not delivery_point_id:
        return jsonify({"error": "DeliveryPointID must be provided"}), 400

    def delete_point(tx, point_id):
        query = "MATCH (p:DeliveryPoint {DeliveryPointID: $id}) DETACH DELETE p"
        tx.run(query, id=point_id)

    with driver.session() as session:
        try:
            session.write_transaction(delete_point, delivery_point_id)
            return jsonify({"message": f"Delivery point '{delivery_point_id}' deleted successfully"})
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
