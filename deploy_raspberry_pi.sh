#!/bin/bash

echo "=========================================="
echo "   VFlix Backend - Raspberry Pi Deploy   "
echo "=========================================="
echo ""

docker stop vflix-backend
docker rm vflix-backend

docker pull vignesh28593/vflix-backend:latest

mkdir -p downloads uploads

docker run -d \
  --name vflix-backend \
  --restart unless-stopped \
  -p 3002:3002 \
  -v $(pwd)/downloads:/app/downloads \
  -v $(pwd)/uploads:/app/uploads \
  vignesh28593/vflix-backend:latest

docker ps
