# Stage 1: Build environment
FROM node:20.12.2-alpine AS builder

# Install PNPM globally with a specific version
RUN npm install -g pnpm@8.15.7

# Set the working directory in the Docker image
WORKDIR /app

# Copy package.json and pnpm-lock.yaml first for better caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of your app's source code
COPY . .

# Build your app
RUN pnpm run build

# Stage 2: Runtime environment
FROM node:20.12.2-alpine AS runtime

# Copy only the built executable and set permissions
COPY --from=builder /app/dist/bin/index.js /usr/local/bin/github-actions-runner
RUN chmod +x /usr/local/bin/github-actions-runner

ENTRYPOINT ["/bin/sh"]
