# 1. Base Image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package.json yarn.lock ./

# Install dependencies (ใช้ --frozen-lockfile เพื่อความชัวร์ว่า version ตรงกับ yarn.lock)
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build Next.js app
RUN yarn build

# --- Production Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production

# Copy necessary files from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/yarn.lock ./yarn.lock
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Expose port 3000
EXPOSE 3000

# Start command
CMD ["yarn", "start"]