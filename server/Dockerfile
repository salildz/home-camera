FROM node:20-bullseye
WORKDIR /app

# Bağımlılıkları kopyala ve yükle
COPY package*.json ./
RUN npm install
RUN npm install -g nodemon

# FFmpeg'i yükle (video işleme için)
RUN apt-get update && apt-get install -y ffmpeg

# Kodu kopyala
COPY . .

# Docker host ağına erişim için
ENV HOST_IP=host.docker.internal

# Hot reload için nodemon kullan
CMD ["nodemon", "src/index.js"]