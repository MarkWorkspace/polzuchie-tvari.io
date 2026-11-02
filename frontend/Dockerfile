# syntax=docker/dockerfile:1.7
# ROLE: Сборка и запуск фронтенда (Vite) в Docker. Образ запускает nginx non-root.
FROM node@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Digest-pinned base image keeps the runtime reproducible.
FROM nginx@sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# The stock nginx.conf declares `user nginx;` and `pid /run/nginx.pid;`. An
# unprivileged master ignores the user directive (with a warning) and cannot
# write /run, so drop both. The pid is supplied via -g below; the /run symlink
# lets a bare `nginx -t` validate the config through the writable /tmp target.
RUN sed -e '/^user /d' -e '/^pid /d' /etc/nginx/nginx.conf > /tmp/nginx.conf.new \
    && cat /tmp/nginx.conf.new > /etc/nginx/nginx.conf \
    && rm /tmp/nginx.conf.new \
    && ln -sf /tmp/nginx.pid /run/nginx.pid \
    && chown -h nginx:nginx /run/nginx.pid

# nginx master runs as the unprivileged nginx user, so every path it writes
# (temp bodies, caches, pid) must be owned by that user.
RUN mkdir -p /tmp/nginx/client_body /tmp/nginx/proxy /tmp/nginx/fastcgi \
        /tmp/nginx/uwsgi /tmp/nginx/scgi \
    && chown -R nginx:nginx /tmp/nginx /var/cache/nginx /usr/share/nginx/html

USER nginx

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

# `pid /tmp/nginx.pid` is a main-context directive, so it is passed via -g.
CMD ["nginx", "-g", "daemon off; pid /tmp/nginx.pid;"]
