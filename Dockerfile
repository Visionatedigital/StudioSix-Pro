# Build stage
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
ENV NODE_ENV=production
ENV GENERATE_SOURCEMAP=false
RUN npm run build

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application and server
COPY --from=builder /app/build ./build
COPY server.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S studiosix -u 1001

# Change ownership of the app directory
RUN chown -R studiosix:nodejs /app
USER studiosix

# Expose port 8080
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the application
CMD ["node", "server.js"]
