FROM node:20-bookworm-slim

# Install FFmpeg for video/audio transcoding on Raspberry Pi (ARM64 / ARMv7)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files for dependency caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production || npm install --production

# Copy backend source files
COPY . .

# Create volume mount directories
RUN mkdir -p downloads uploads

EXPOSE 3002

ENV PORT=3002
ENV NODE_ENV=production

CMD ["node", "server.js"]
