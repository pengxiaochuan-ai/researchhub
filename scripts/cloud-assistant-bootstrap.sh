#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

RELEASE_TAG="${RESEARCHHUB_RELEASE_TAG:?missing RESEARCHHUB_RELEASE_TAG}"
OSS_RELEASE_PREFIX="${RESEARCHHUB_OSS_RELEASE_PREFIX:?missing RESEARCHHUB_OSS_RELEASE_PREFIX}"
OPS_DIR="/srv/researchhub/ops"
RELEASE_ENV_FILE="${OPS_DIR}/.env.release"
PREFIX="${OSS_RELEASE_PREFIX}/${RELEASE_TAG}"

if [[ "$(id -u)" != "0" ]]; then
  echo "ERROR: Cloud Assistant bootstrap must run as root"
  exit 1
fi
if [[ ! "${RELEASE_TAG}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]]; then
  echo "ERROR: invalid release tag"
  exit 2
fi
if [[ ! "${OSS_RELEASE_PREFIX}" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$ ]] \
  || [[ "${OSS_RELEASE_PREFIX}" == *".."* ]]; then
  echo "ERROR: invalid OSS release prefix"
  exit 2
fi

mkdir -p "${OPS_DIR}" "${OPS_DIR}/logs" "${OPS_DIR}/releases"

install_python_runtime() {
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y python3 python3-pip
  elif command -v yum >/dev/null 2>&1; then
    yum install -y python3 python3-pip
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-pip
  else
    echo "ERROR: no supported package manager found"
    return 1
  fi
}

if ! command -v python3 >/dev/null 2>&1 || ! python3 -m pip --version >/dev/null 2>&1; then
  echo "=== Installing Python runtime ==="
  install_python_runtime
fi
if ! python3 -c 'import oss2' >/dev/null 2>&1; then
  echo "=== Installing OSS transfer dependency ==="
  python3 -m pip install -q 'oss2>=2.18.0,<3'
fi

if [[ ! -f "${RELEASE_ENV_FILE}" ]]; then
  echo "ERROR: missing ${RELEASE_ENV_FILE}; provision it before the first deployment"
  exit 1
fi
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

STAGING_DIR="$(mktemp -d "${OPS_DIR}/cloud-assistant.XXXXXX")"
trap 'rm -rf -- "${STAGING_DIR}"' EXIT

echo "=== Downloading checksummed researchhub control files: ${PREFIX} ==="
python3 - "${PREFIX}" "${STAGING_DIR}" <<'PY'
from __future__ import print_function

import os
import sys

import oss2


prefix = sys.argv[1].strip("/")
target_dir = sys.argv[2]
endpoint = os.environ["OSS_ENDPOINT"].strip()
endpoint = endpoint.replace("https://", "").replace("http://", "").rstrip("/")
auth = oss2.Auth(os.environ["OSS_ACCESS_KEY"], os.environ["OSS_SECRET_KEY"])
bucket = oss2.Bucket(auth, "https://{0}".format(endpoint), os.environ["OSS_BUCKET"])

for name in (
    "SHA256SUMS",
    "cloud-assistant-bootstrap.sh",
    "ecs-release.sh",
    "oss-release-transfer.py",
):
    key = "{0}/{1}".format(prefix, name)
    destination = os.path.join(target_dir, name)
    print("download oss://{0}/{1}".format(bucket.bucket_name, key))
    bucket.get_object_to_file(key, destination)
PY

(
  cd "${STAGING_DIR}"
  sha256sum -c SHA256SUMS
)

install -m 0750 "${STAGING_DIR}/cloud-assistant-bootstrap.sh" "${OPS_DIR}/cloud-assistant-bootstrap.sh"
install -m 0750 "${STAGING_DIR}/ecs-release.sh" "${OPS_DIR}/ecs-release.sh"
install -m 0750 "${STAGING_DIR}/oss-release-transfer.py" "${OPS_DIR}/oss-release-transfer.py"

echo "=== Starting researchhub ${RESEARCHHUB_RELEASE_MODE} through Cloud Assistant ==="
exec "${OPS_DIR}/ecs-release.sh"
