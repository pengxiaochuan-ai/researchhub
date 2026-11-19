ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS dependencies
RUN node -e "if (process.versions.node.split('.')[0] !== '22') process.exit(1)"
ARG DEBIAN_MIRROR=http://deb.debian.org
RUN sed -i "s#http://deb.debian.org#${DEBIAN_MIRROR}#g" /etc/apt/sources.list.d/debian.sources \
 && apt-get -o Acquire::Retries=1 -o Acquire::http::Timeout=20 update \
 && apt-get -o Acquire::Retries=1 -o Acquire::http::Timeout=20 install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/researchhub/core
COPY core/package.json core/package-lock.json ./
COPY core/vendor ./vendor
COPY core/prisma ./prisma
RUN npm ci --ignore-scripts --no-audit --no-fund \
 && DATABASE_URL=postgresql://unused@localhost/unused DIRECT_URL=postgresql://unused@localhost/unused node node_modules/prisma/build/index.js generate --schema prisma/schema.prisma

FROM ${NODE_IMAGE}
ARG DEBIAN_MIRROR=http://deb.debian.org
RUN sed -i "s#http://deb.debian.org#${DEBIAN_MIRROR}#g" /etc/apt/sources.list.d/debian.sources \
 && apt-get -o Acquire::Retries=1 -o Acquire::http::Timeout=20 update \
 && apt-get -o Acquire::Retries=1 -o Acquire::http::Timeout=20 install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ARG HUB_SOURCE_SHA
LABEL org.opencontainers.image.revision=${HUB_SOURCE_SHA}
WORKDIR /opt/researchhub
COPY --from=dependencies --chown=node:node /opt/researchhub/core ./core
COPY --chown=node:node core ./core
COPY --chown=node:node hub ./hub
COPY --chown=node:node release.json ./release.json
RUN ln -s /opt/researchhub/core/node_modules /opt/researchhub/hub/node_modules
ARG CORE_MANIFEST_SHA256
ENV NODE_ENV=production HUB_REQUIRE_PRIVATE_CORE=true HUB_CORE_DIR=/opt/researchhub/core HUB_CORE_MANIFEST_SHA256=${CORE_MANIFEST_SHA256}
WORKDIR /opt/researchhub/hub
USER node
EXPOSE 19612
CMD ["node","server/research-runtime/start.mjs"]
