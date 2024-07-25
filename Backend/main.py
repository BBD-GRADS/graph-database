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
    start_x = request.args.get('startX')
    start_y = request.args.get('startY')

    if not start_x or not start_y:
        return jsonify({"error": "Please provide start point X and Y coords"}), 400

    def validate_point(tx, x, y):
        query = f"""
            MATCH (p:DeliveryPoint {{x: {x}, y: {y}}}) RETURN p
        """
        return tx.run(query).single()

    def find_path(tx, start_x, start_y):
        query = f"""
            MATCH (start:DeliveryPoint {{x: {start_x}, y: {start_y}}})
            MATCH (other:DeliveryPoint)
            WHERE other <> start
            WITH start, collect(other) AS others

            UNWIND others AS other
            MATCH path = shortestPath((start)-[:ROUTE_TO*]-(other))
            WITH start, other, path,
                 reduce(s = 0, r IN relationships(path) | s + (r.distance / r.speed_limit)) AS time
            ORDER BY time

            WITH start, collect({{node: other, time: time}}) AS orderedNodes

            WITH [start] + [node IN orderedNodes | node.node] AS fullPath

            UNWIND range(0, size(fullPath) - 2) AS i
            WITH fullPath, i, fullPath[i] AS current, fullPath[i+1] AS next

            MATCH (current)-[r:ROUTE_TO]->(next)
            WITH fullPath, collect({{start: current, end: next, relationship: r,
                                    time: r.distance / r.speed_limit, distance: r.distance}}) AS routes

            WITH routes,
                 [node IN fullPath | node.x + ', ' + node.y] AS visitOrder,
                 reduce(s = 0, route IN routes | s + route.time) AS totalTime,
                 reduce(s = 0, route IN routes | s + route.distance) AS totalDistance
            RETURN visitOrder,
                   totalTime,
                   totalDistance
        """
        result = tx.run(query)
        return list(result)

    with driver.session() as session:
        try:
            start_point = session.read_transaction(validate_point, float(start_x), float(start_y))

            if not start_point:
                return jsonify({"error": f"Start point ({start_x}, {start_y}) does not exist"}), 404

            data = session.execute_read(
                find_path,
                float(start_x),
                float(start_y)
            )

            if data:
                response = data[0]
                visit_order = response["visitOrder"]
                total_time = response["totalTime"]
                total_distance = response["totalDistance"]

                return jsonify({
                    "visit_order": visit_order,
                    "total_time": total_time,
                    "total_distance": total_distance
                })
            else:
                return jsonify({"error": "No path found from the specified delivery point"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500


@app.route('/delivery/routesingle', methods=['GET'])
def get_delivery_route_single():
    start_x = request.args.get('startX')
    start_y = request.args.get('startY')
    end_x = request.args.get('endX')
    end_y = request.args.get('endY')

    if not start_x or not start_y or not end_x or not end_y:
        return jsonify({"error": "Please provide a start and end point"}), 400

    def validate_point(tx, x, y):
        query = f"""
            MATCH (p:DeliveryPoint {{x: {x}, y: {y}}}) RETURN p
        """
        return tx.run(query).single()

    with driver.session() as session:
        try:
            start_point = session.read_transaction(validate_point, float(start_x), float(start_y))
            end_point = session.read_transaction(validate_point, float(end_x), float(end_y))

            if not start_point:
                return jsonify({"error": f"Start point ({start_x}, {start_y}) does not exist"}), 404
            if not end_point:
                return jsonify({"error": f"End point ({end_x}, {end_y}) does not exist"}), 404

            query = f"""
                MATCH (start:DeliveryPoint {{x: {start_x}, y: {start_y}}}),
                      (end:DeliveryPoint {{x: {end_x}, y: {end_y}}})
                CALL {{
                    WITH start, end
                    MATCH path = allShortestPaths((start)-[:ROUTE_TO*]->(end))
                    RETURN path
                }}
                WITH path, reduce(totalTime = 0.0, rel in relationships(path) | totalTime + (rel.distance / rel.speed_limit)) AS totalTime
                RETURN path, totalTime
                ORDER BY totalTime ASC
                LIMIT 1
            """

            result = session.run(query)
            record = result.single()

            if record:
                path = record["path"]
                total_time = record["totalTime"]
                nodes = [{"x": node["x"], "y": node["y"]} for node in path.nodes]
                response = {
                    "route": nodes,
                    "totalTime": total_time
                }
                return jsonify(response)
            else:
                return jsonify({"error": "No path found between the specified delivery points"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500


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
        existing_point_query = f"""
            MATCH (p:DeliveryPoint {{x: {x}, y: {y}}}) RETURN p
        """
        existing_point = tx.run(existing_point_query).single()
        if existing_point:
            return {"error": f"Delivery point with coordinates ({x}, {y}) already exists"}

        # Create the new delivery point
        create_point_query = f"""
            CREATE (p:DeliveryPoint {{x: {x}, y: {y}}})
            RETURN p
        """
        tx.run(create_point_query)

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
                create_edge_query = f"""
                    MATCH (a:DeliveryPoint {{x: {x}, y: {y}}}), (b:DeliveryPoint {{x: {existing_x}, y: {existing_y}}})
                    CREATE (a)-[:ROUTE_TO {{distance: {distance}, speed_limit: {speed_limit}}}]->(b)
                """
                tx.run(create_edge_query)
                tx.run(create_edge_query)

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
        # Check if point exists
        existing_point_query = f"""
            MATCH (p:DeliveryPoint {{x: {x}, y: {y}}}) RETURN p
        """
        existing_point = tx.run(existing_point_query).single()
        if not existing_point:
            return {"error": f"Delivery point with coordinates ({x}, {y}) does not exist"}

        # Delete the point
        delete_point_query = f"""
            MATCH (p:DeliveryPoint {{x: {x}, y: {y}}}) DETACH DELETE p
        """
        tx.run(delete_point_query)
        return {"message": f"Delivery point at ({x}, {y}) deleted successfully"}

    with driver.session() as session:
        try:
            result = session.write_transaction(delete_point, float(x), float(y))
            if isinstance(result, dict) and "error" in result:
                return jsonify(result), 404
            return jsonify(result), 200
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
