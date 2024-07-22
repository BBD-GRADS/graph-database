from flask import Flask
import os

app = Flask(__name__)


# Get Neo4j credentials from environment variables
neo4j_uri = os.getenv("NEO4J_URI")
neo4j_username = os.getenv("NEO4J_USERNAME")
neo4j_password = os.getenv("NEO4J_PASSWORD")


@app.route("/")
def hello_world():
    return f"Connected to Neo4j at {neo4j_uri}"
