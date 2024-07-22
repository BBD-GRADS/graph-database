FROM python:3.7.7-alpine

RUN apk update
RUN pip install --no-cache-dir pipenv


# Copy the Pipfile and Pipfile.lock to the working directory
WORKDIR /usr/src/app
COPY Pipfile Pipfile.lock ./

RUN pipenv install --system --deploy

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Set the environment variable for Flask
ENV FLASK_APP=main.py

# Run the Flask application
CMD ["flask", "run", "--host=0.0.0.0"]