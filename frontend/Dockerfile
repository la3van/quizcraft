FROM node:20

WORKDIR /app/frontend

# Install dependencies
COPY frontend/package*.json ./
COPY frontend/package-lock.json ./
RUN npm ci

# Copy frontend sources
COPY frontend/ ./

ENV HOST 0.0.0.0
EXPOSE 5173

# Start Vite dev server bound to all interfaces
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
