#!/bin/bash

# Stop any currently running containers
docker stop tic-tac-toe-backend tic-tac-toe-frontend

# Remove stopped containers
docker rm tic-tac-toe-backend tic-tac-toe-frontend

# Build Docker images
docker build -t tic-tac-toe-backend ../backend
docker build -t tic-tac-toe-frontend ../frontend

# Run the containers
docker run -d -p 3000:3000 --name tic-tac-toe-backend tic-tac-toe-backend
docker run -d -p 8080:80 --name tic-tac-toe-frontend tic-tac-toe-frontend

echo "Tic-Tac-Toe application is now running."
echo "Access the frontend at http://localhost"


