# --- 1) Compila el front (React + Vite) ---
FROM node:22-slim AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client ./
RUN npm run build

# --- 2) Core (Express + Prisma) que además sirve el front compilado ---
FROM node:22-slim
WORKDIR /app/server
ENV NODE_ENV=production
COPY server ./
RUN npm ci
COPY --from=client /app/client/dist /app/client/dist
EXPOSE 3001
# Al iniciar: aplica las migraciones, carga el menú (seed) y arranca el Core.
CMD ["npm", "start"]
