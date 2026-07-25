# frontend/Dockerfile
FROM node:20-slim

WORKDIR /app

# Enable pnpm
RUN corepack enable pnpm

# Copy package files first (for better layer caching)
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy the rest of the application
COPY . .

# Expose Next.js default port
EXPOSE 3000

# Run in development mode (hot reload works with volume mount)
CMD ["pnpm", "run", "dev"]