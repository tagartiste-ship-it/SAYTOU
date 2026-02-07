FROM node:18-bullseye-slim

# Install dependencies for Puppeteer + Prisma (OpenSSL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    openssl \
    fonts-freefont-ttf \
  && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 3000

# Run migrations and start
CMD ["sh", "-c", "npm run start:render"]
