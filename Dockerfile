# Multi-stage build: a Node stage compiles the React front-end into static
# files, then a slim Python stage runs the actual game. The final image only
# needs Python -- Node never ships in it -- which matches the project's own
# "zero pip installs, stdlib only" philosophy for the runtime half.

FROM node:20-alpine AS webbuild
WORKDIR /app/web
# Install deps from the lockfile before copying the rest of the source, so
# `npm ci` gets cached across builds that only touch source files.
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app

# Application code + the real World Cup dataset build_db.py reads from.
COPY build_db.py server.py ./
COPY data_wc/ ./data_wc/

# The compiled front-end from the first stage -- server.py serves this
# directory directly, no Node needed at runtime.
COPY --from=webbuild /app/web/dist ./web/dist

# Build the SQLite database at image-build time rather than on first
# request, so a fresh container starts up instantly with data already ready.
RUN python build_db.py

# Inside a container 0.0.0.0 is correct and safe: the platform (or a
# docker run -p mapping) controls what's actually reachable from outside,
# not this bind address.
ENV HOST=0.0.0.0
ENV PORT=8000
EXPOSE 8000

# The stdlib http.server has no external health-check convention, so give
# platforms that expect one one to poll during startup and afterwards.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)" || exit 1

CMD ["python", "server.py"]
