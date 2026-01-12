FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci --only=production && \
    npm install -g typescript ts-node

# Copy source code
COPY src ./src
COPY types ./types

# Build TypeScript
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "process.exit(0)"

# Run the bot
CMD ["npm", "run", "start:live"]