# Main application Dockerfile
FROM node:18-alpine

# Install system dependencies needed for native modules like tree-sitter
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose the web server port
EXPOSE 3001

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Default command (can be overridden)
CMD ["npm", "run", "start:web"]
