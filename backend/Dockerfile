FROM node:20-bullseye

RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY requirements.txt ./requirements.txt
RUN if [ -f requirements.txt ]; then pip3 install -r requirements.txt; fi

COPY . .

EXPOSE 4000
EXPOSE 8000

CMD bash -c "node index.js & uvicorn transcribe_api:app --host 0.0.0.0 --port 8000"