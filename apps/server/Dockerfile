# Build từ thư mục GỐC của repo:
#   docker build -f apps/server/Dockerfile -t brain-rizz-server .

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@brain-rizz/server..."
RUN pnpm --filter @brain-rizz/server build
# Tách riêng server + dependency production (shared đã được gộp vào bundle).
RUN pnpm --filter @brain-rizz/server deploy --legacy --prod /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/server/dist ./dist
USER node
EXPOSE 2567
CMD ["node", "dist/index.js"]
