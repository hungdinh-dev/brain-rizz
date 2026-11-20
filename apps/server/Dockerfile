# Build từ thư mục GỐC của repo:
#   docker build -f apps/server/Dockerfile -t brain-rizz-server .
# Render (render.yaml) và Fly (fly.toml) đều build theo cách này.

# 1) Build: cài đủ dependency (kể cả dev) của server + shared, gộp server thành dist/index.js.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@brain-rizz/server..."
RUN pnpm --filter @brain-rizz/server build

# 2) Dependency production của server, cài THEO LOCKFILE (shared đã được gộp vào bundle nên
#    không cần). Không dùng `pnpm deploy --legacy`: bản legacy bỏ qua lockfile, giải lại phiên
#    bản từ registry và gọi `git ls-remote` cho uWebSockets.js (dependency GitHub của Colyseus) —
#    ảnh alpine không có git nên build lỗi, và phiên bản có thể lệch với lúc test.
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --prod --filter "@brain-rizz/server"

# 3) Runtime: giữ nguyên bố cục thư mục của pnpm (apps/server/node_modules là symlink tương đối
#    vào node_modules/.pnpm ở gốc) để Node tìm thấy thư viện.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /repo/apps/server/package.json ./apps/server/package.json
COPY --from=build /repo/apps/server/dist ./apps/server/dist
WORKDIR /app/apps/server
USER node
EXPOSE 2567
CMD ["node", "dist/index.js"]
