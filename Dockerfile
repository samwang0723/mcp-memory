# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including dev dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Remove husky prepare script and install production dependencies
RUN npm pkg delete scripts.prepare && \
    npm ci --omit=dev

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy configuration files
COPY --from=builder /app/paths.js ./paths.js
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy .env file if it exists
# COPY --from=builder /app/.env ./.env

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["node", "-r", "tsconfig-paths/register", "-r", "./paths.js", "dist/index.js"] 