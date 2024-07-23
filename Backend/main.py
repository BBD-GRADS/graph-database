from flask import Flask, jsonify, request
from neo4j import GraphDatabase, basic_auth
from dotenv import load_dotenv
import os
import atexit

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

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
                       "Longitude": record["Longitude"],
                       "Latitude": record["Latitude"]} for record in data]
            return jsonify(points)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

# Get optimal delivery route
@app.route('/delivery/route', methods=['GET'])
def get_delivery_route():
    start_point = request.args.get('startPoint')
    end_point = request.args.get('endPoint')

    if not start_point or not end_point:
        return jsonify({"error": "Please provide both startPoint and endPoint"}), 400

    def find_route(tx, start, end):
        query = (
            "MATCH (start:DeliveryPoint {DeliveryPointID: $start_id}), "
            "(end:DeliveryPoint {DeliveryPointID: $end_id}), "
            "path = shortestPath((start)-[:ROUTE_TO*]->(end)) "
            "RETURN path"
        )
        result = tx.run(query, start_id=start, end_id=end)
        path = result.single()["path"]
        return [node["DeliveryPointID"] for node in path.nodes]

    with driver.session() as session:
        try:
            route = session.read_transaction(find_route, start_point, end_point)
            return jsonify({"route": route})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

# Add delivery point
@app.route('/delivery/point', methods=['POST'])
def post_delivery_point():
    content = request.json
    delivery_point_id = content.get("DeliveryPointID")
    longitude = content.get("Longitude")
    latitude = content.get("Latitude")

    if not delivery_point_id or not longitude or not latitude:
        return jsonify({"error": "DeliveryPointID, Longitude, and Latitude must be provided"}), 400

    def create_point(tx, point_id, lon, lat):
        query = (
            "CREATE (p:DeliveryPoint {DeliveryPointID: $id, Longitude: $lon, Latitude: $lat}) "
            "RETURN p"
        )
        result = tx.run(query, id=point_id, lon=lon, lat=lat)
        return result.single()["p"]

    with driver.session() as session:
        try:
            point = session.write_transaction(create_point, delivery_point_id, longitude, latitude)
            return jsonify({"message": f"Delivery point '{delivery_point_id}' created successfully"}), 201
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

if __name__ == '__main__':
    app.run(debug=True)
