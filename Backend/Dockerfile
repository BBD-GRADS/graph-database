FROM python:3.7.7-alpine

RUN apk update
RUN pip install --no-cache-dir pipenv

WORKDIR /usr/src/app
COPY Pipfile Pipfile.lock bootstrap.sh main.py ./

RUN pipenv install --system --deploy

EXPOSE 5000
ENTRYPOINT ["/usr/src/app/bootstrap.sh"]