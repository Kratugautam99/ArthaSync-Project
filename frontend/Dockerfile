# frontend/Dockerfile
FROM node:20-slim

WORKDIR /app

# Copy package files first (for better layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose Next.js default port
EXPOSE 3000

# Run in development mode (hot reload works with volume mount)
CMD ["npm", "run", "dev"]