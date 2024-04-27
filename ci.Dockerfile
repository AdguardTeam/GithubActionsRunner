# This Dockerfile is used to build the GitHub Actions Runner image used in the CI pipeline.
# It doesn't has the ENTRYPOINT instruction, so it can't be used to run the image as a container.
# The ENTRYPOINT instruction is added in the Dockerfile in the root of the project.

# Stage 1: Build environment
FROM node:20.12.2-bookworm-slim AS builder

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
FROM node:20.12.2-bookworm-slim AS runtime

# Copy only the built executable and set permissions
COPY --from=builder /app/dist/bin/index.js /usr/local/bin/github-actions-runner
RUN chmod +x /usr/local/bin/github-actions-runner
