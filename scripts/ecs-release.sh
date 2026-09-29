#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

MODE="${RESEARCHHUB_RELEASE_MODE:?missing RESEARCHHUB_RELEASE_MODE}"
RELEASE_TAG="${RESEARCHHUB_RELEASE_TAG:?missing RESEARCHHUB_RELEASE_TAG}"
IMAGE_REF="${RESEARCHHUB_IMAGE:?missing RESEARCHHUB_IMAGE}"
OSS_RELEASE_PREFIX="${RESEARCHHUB_OSS_RELEASE_PREFIX:?missing RESEARCHHUB_OSS_RELEASE_PREFIX}"
PUBLIC_PORT="${RESEARCHHUB_PORT:-8083}"

OPS_DIR="/srv/researchhub/ops"
APP_ENV_FILE="${OPS_DIR}/.env.prod"
RELEASE_ENV_FILE="${OPS_DIR}/.env.release"
COMPOSE_FILE="${OPS_DIR}/docker-compose.ecs.yml"
COMPOSE_NEXT="${COMPOSE_FILE}.next.${RELEASE_TAG}"
CURRENT_ENV="${OPS_DIR}/current.env"
CURRENT_ENV_NEXT="${CURRENT_ENV}.next.${RELEASE_TAG}"
PREVIOUS_ENV="${OPS_DIR}/previous.env"
PREVIOUS_COMPOSE="${OPS_DIR}/docker-compose.ecs.yml.previous"
WORK_DIR="${OPS_DIR}/releases/${RELEASE_TAG}"
TRANSFER_SCRIPT="${OPS_DIR}/oss-release-transfer.py"
LOG_DIR="${OPS_DIR}/logs"
LOG_FILE="${LOG_DIR}/${MODE}-${RELEASE_TAG}.log"
PREFIX="${OSS_RELEASE_PREFIX}/${RELEASE_TAG}"

validate_inputs() {
  [[ "${MODE}" == "deploy" || "${MODE}" == "rollback" ]]
  [[ "${RELEASE_TAG}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]]
  [[ "${IMAGE_REF}" =~ ^[A-Za-z0-9][A-Za-z0-9./:_-]{1,255}$ ]]
  [[ "${IMAGE_REF}" == *":${RELEASE_TAG}" ]]
  [[ "${OSS_RELEASE_PREFIX}" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$ ]]
  [[ "${OSS_RELEASE_PREFIX}" != *".."* ]]
  [[ "${PUBLIC_PORT}" =~ ^[0-9]+$ ]]
  (( PUBLIC_PORT >= 1024 && PUBLIC_PORT <= 65535 ))
}

validate_inputs || {
  echo "ERROR: invalid release input"
  exit 2
}

mkdir -p "${WORK_DIR}" "${LOG_DIR}"
exec > >(tee -a "${LOG_FILE}") 2>&1

exec 9>"${OPS_DIR}/release.lock"
if ! flock -n 9; then
  echo "ERROR: another researchhub release is already running"
  exit 75
fi

cleanup() {
  rm -f -- "${COMPOSE_NEXT}" "${CURRENT_ENV_NEXT}"
}
trap cleanup EXIT

for required_file in "${APP_ENV_FILE}" "${RELEASE_ENV_FILE}" "${TRANSFER_SCRIPT}"; do
  if [[ ! -f "${required_file}" ]]; then
    echo "ERROR: missing required file: ${required_file}"
    exit 1
  fi
done

set -a
source <(grep -E '^(S3_ENDPOINT|S3_ACCESS_KEY|S3_SECRET_KEY|S3_BUCKET)=' "${RELEASE_ENV_FILE}")
set +a
test -n "${S3_ENDPOINT:-}"
test -n "${S3_ACCESS_KEY:-}"
test -n "${S3_SECRET_KEY:-}"
test -n "${S3_BUCKET:-}"

export OSS_ACCESS_KEY="${S3_ACCESS_KEY}"
export OSS_SECRET_KEY="${S3_SECRET_KEY}"
export OSS_BUCKET="${S3_BUCKET}"
export OSS_ENDPOINT="${S3_ENDPOINT}"

download_object() {
  python3 "${TRANSFER_SCRIPT}" download --file "$2" --key "$1"
}

compose_with_env() {
  local env_file="$1"
  shift
  docker compose --project-name researchhub \
    --env-file "${env_file}" \
    -f "${COMPOSE_FILE}" "$@"
}

wait_for_health() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl -fsS --max-time 5 "http://127.0.0.1:${PUBLIC_PORT}/health" >/dev/null; then
      echo "OK: researchhub /health"
      return 0
    fi
    echo "Waiting for researchhub health (${attempt}/30)"
    sleep 5
  done
  return 1
}

restore_previous_release() {
  if [[ ! -f "${PREVIOUS_ENV}" || ! -f "${PREVIOUS_COMPOSE}" ]]; then
    echo "WARN: no previous researchhub release is available for automatic restore"
    return 1
  fi

  echo "=== Restoring previous researchhub release ==="
  cp -f "${PREVIOUS_COMPOSE}" "${COMPOSE_FILE}"
  cp -f "${PREVIOUS_ENV}" "${CURRENT_ENV}"
  compose_with_env "${CURRENT_ENV}" up -d --remove-orphans researchhub
  wait_for_health
}

activate_release() {
  local image_archive="${WORK_DIR}/researchhub.tar.gz"
  local artifact_checksums="${WORK_DIR}/ARTIFACTS.sha256"
  local compose_services

  echo "=== Downloading researchhub release ${RELEASE_TAG} from OSS ==="
  download_object "${PREFIX}/researchhub.tar.gz" "${image_archive}"
  download_object "${PREFIX}/docker-compose.ecs.yml" "${COMPOSE_NEXT}"
  download_object "${PREFIX}/ARTIFACTS.sha256" "${artifact_checksums}"

  (
    cd "${WORK_DIR}"
    cp "${COMPOSE_NEXT}" docker-compose.ecs.yml
    sha256sum -c ARTIFACTS.sha256
    rm -f docker-compose.ecs.yml
  )
  gzip -t "${image_archive}"
  gzip -dc "${image_archive}" | docker load
  docker image inspect "${IMAGE_REF}" >/dev/null

  compose_services="$(
    RESEARCHHUB_IMAGE="${IMAGE_REF}" RESEARCHHUB_PORT="${PUBLIC_PORT}" \
      docker compose --project-name researchhub \
      --env-file "${APP_ENV_FILE}" -f "${COMPOSE_NEXT}" config --services
  )"
  grep -Fxq researchhub <<< "${compose_services}" || {
    echo "ERROR: release Compose manifest is missing researchhub service"
    exit 1
  }

  printf 'RESEARCHHUB_IMAGE=%s\nRESEARCHHUB_PORT=%s\n' \
    "${IMAGE_REF}" "${PUBLIC_PORT}" > "${CURRENT_ENV_NEXT}"

  if [[ -f "${CURRENT_ENV}" && -f "${COMPOSE_FILE}" ]]; then
    cp -f "${CURRENT_ENV}" "${PREVIOUS_ENV}"
    cp -f "${COMPOSE_FILE}" "${PREVIOUS_COMPOSE}"
  fi
  mv -f "${COMPOSE_NEXT}" "${COMPOSE_FILE}"
  mv -f "${CURRENT_ENV_NEXT}" "${CURRENT_ENV}"

  echo "=== Activating researchhub release ==="
  if ! compose_with_env "${CURRENT_ENV}" up -d --remove-orphans researchhub \
    || ! wait_for_health; then
    echo "ERROR: researchhub release failed health verification"
    restore_previous_release || true
    exit 1
  fi

  compose_with_env "${CURRENT_ENV}" ps
  rm -rf -- "${WORK_DIR}"
  docker image prune -af --filter "until=168h" || true
  echo "=== Official-site ${MODE} complete: ${RELEASE_TAG} ==="
}

activate_release
