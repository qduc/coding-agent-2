# Docker Quick Start Guide

This project has been dockerized for easy development and deployment.

## Prerequisites

- Docker and Docker Compose installed on your system

## Production Deployment

Build and run the full stack application:

```bash
# Build and start all services
docker-compose up --build

# Run in detached mode (background)
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at:
- Frontend: http://localhost (port 80)
- Backend API: http://localhost:3001

## Development Mode

For development with hot reloading:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up --build

# Run in detached mode
docker-compose -f docker-compose.dev.yml up -d --build

# Stop development services
docker-compose -f docker-compose.dev.yml down
```

Development URLs:
- Frontend (Vite dev server): http://localhost:5173
- Backend API: http://localhost:3001

## Available Services

### Backend
- Built from the main Dockerfile
- Runs the Node.js web server and API
- Includes all CLI functionality
- Exposes port 3001

### Frontend
- Built using multi-stage Docker build
- React app built with Vite
- Served by Nginx in production
- Proxies API calls to backend service

## Docker Commands

```bash
# Build only (without starting)
docker-compose build

# Rebuild a specific service
docker-compose build backend
docker-compose build frontend

# View running containers
docker-compose ps

# Execute commands in running containers
docker-compose exec backend npm run test
docker-compose exec backend sh

# Clean up everything
docker-compose down --volumes --rmi all

# View service logs
docker-compose logs backend
docker-compose logs frontend
```

## Environment Variables

You can create a `.env` file in the project root to set environment variables:

```bash
NODE_ENV=production
PORT=3001
# Add your API keys and other configuration here
```

## Volumes

- `app_data`: Persistent storage for any file operations
- Development mode mounts source code for hot reloading

## Health Checks

Both services include health checks:
- Backend: Checks if the web server is responding
- Frontend: Checks if Nginx is serving content

## Troubleshooting

1. **Port conflicts**: If ports 80 or 3001 are in use, modify the ports in docker-compose.yml
2. **Build failures**: Try `docker-compose build --no-cache` to rebuild from scratch
3. **Permission issues**: The containers run as non-root users for security
4. **Memory issues**: Increase Docker's memory allocation if builds fail

## CLI Usage with Docker

To use the CLI functionality:

```bash
# Run CLI commands in the backend container
docker-compose exec backend npm run start -- "your command here"

# Or run a one-off container
docker run --rm -it coding-agent-backend npm run start -- "help"
```
