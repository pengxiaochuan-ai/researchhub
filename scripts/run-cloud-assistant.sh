#!/usr/bin/env bash
set -Eeuo pipefail

ALIYUN_CLI_VERSION="3.3.18"
ALIYUN_CLI_SHA256="0823286604dbd8beb8d65dd0694d23c913e7c5d5a02b20a3593a4f8a6517f1d4"
ALIYUN_CLI_URL="https://github.com/aliyun/aliyun-cli/releases/download/v${ALIYUN_CLI_VERSION}/aliyun-cli-linux-${ALIYUN_CLI_VERSION}-amd64.tgz"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOOTSTRAP_FILE="${SCRIPT_DIR}/cloud-assistant-bootstrap.sh"
REGION_ID="${ALIYUN_REGION_ID:-${ALIBABA_CLOUD_REGION_ID:-}}"
INSTANCE_ID="${ALIYUN_ECS_INSTANCE_ID:-}"
MODE="${RESEARCHHUB_RELEASE_MODE:-}"
RELEASE_TAG="${RESEARCHHUB_RELEASE_TAG:-}"
IMAGE_REF="${RESEARCHHUB_IMAGE:-}"
OSS_RELEASE_PREFIX="${RESEARCHHUB_OSS_RELEASE_PREFIX:-}"
PUBLIC_PORT="${RESEARCHHUB_PORT:-8083}"
COMMAND_USERNAME="${ALIYUN_CLOUD_ASSISTANT_USERNAME:-root}"
COMMAND_TIMEOUT_SECONDS="${ALIYUN_CLOUD_ASSISTANT_TIMEOUT_SECONDS:-1800}"
POLL_INTERVAL_SECONDS=10
ALIYUN_BIN="${ALIYUN_CLI_BIN:-}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

validate_inputs() {
  test -n "${ALIBABA_CLOUD_ACCESS_KEY_ID:-}" || fail "missing ALIBABA_CLOUD_ACCESS_KEY_ID"
  test -n "${ALIBABA_CLOUD_ACCESS_KEY_SECRET:-}" || fail "missing ALIBABA_CLOUD_ACCESS_KEY_SECRET"
  [[ "${REGION_ID}" =~ ^[a-z0-9][a-z0-9-]{1,62}$ ]] || fail "invalid ALIYUN_REGION_ID"
  [[ "${INSTANCE_ID}" =~ ^i-[A-Za-z0-9]+$ ]] || fail "invalid ALIYUN_ECS_INSTANCE_ID"
  [[ "${MODE}" == "deploy" || "${MODE}" == "rollback" ]] || fail "RESEARCHHUB_RELEASE_MODE must be deploy or rollback"
  [[ "${RELEASE_TAG}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]] || fail "invalid RESEARCHHUB_RELEASE_TAG"
  [[ "${IMAGE_REF}" =~ ^[A-Za-z0-9][A-Za-z0-9./:_-]{1,255}$ ]] || fail "invalid RESEARCHHUB_IMAGE"
  [[ "${IMAGE_REF}" == *":${RELEASE_TAG}" ]] || fail "image tag must match RESEARCHHUB_RELEASE_TAG"
  [[ "${OSS_RELEASE_PREFIX}" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$ ]] || fail "invalid RESEARCHHUB_OSS_RELEASE_PREFIX"
  [[ "${OSS_RELEASE_PREFIX}" != *".."* ]] || fail "invalid RESEARCHHUB_OSS_RELEASE_PREFIX"
  [[ "${PUBLIC_PORT}" =~ ^[0-9]+$ ]] || fail "invalid RESEARCHHUB_PORT"
  (( PUBLIC_PORT >= 1024 && PUBLIC_PORT <= 65535 )) || fail "RESEARCHHUB_PORT must be between 1024 and 65535"
  [[ "${COMMAND_USERNAME}" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || fail "invalid Cloud Assistant username"
  [[ "${COMMAND_TIMEOUT_SECONDS}" =~ ^[0-9]+$ ]] || fail "invalid Cloud Assistant timeout"
  (( COMMAND_TIMEOUT_SECONDS >= 600 && COMMAND_TIMEOUT_SECONDS <= 5400 )) || fail "Cloud Assistant timeout must be between 600 and 5400 seconds"
  test -f "${BOOTSTRAP_FILE}" || fail "missing ${BOOTSTRAP_FILE}"
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

install_aliyun_cli() {
  if [[ -n "${ALIYUN_BIN}" ]]; then
    [[ -x "${ALIYUN_BIN}" ]] || fail "ALIYUN_CLI_BIN is not executable"
    "${ALIYUN_BIN}" version
    return
  fi

  local install_root="${RUNNER_TEMP:-/tmp}/aliyun-cli-${ALIYUN_CLI_VERSION}"
  local archive="${install_root}/aliyun-cli.tgz"
  mkdir -p "${install_root}"
  echo "=== Installing Alibaba Cloud CLI ${ALIYUN_CLI_VERSION} ==="
  curl -fsSL --retry 3 --connect-timeout 20 "${ALIYUN_CLI_URL}" -o "${archive}"
  [[ "$(sha256_file "${archive}")" == "${ALIYUN_CLI_SHA256}" ]] || fail "Alibaba Cloud CLI checksum mismatch"
  tar -xzf "${archive}" -C "${install_root}" aliyun
  chmod 0755 "${install_root}/aliyun"
  ALIYUN_BIN="${install_root}/aliyun"
  "${ALIYUN_BIN}" version
}

append_export() {
  printf 'export %s=%q\n' "$1" "$2"
}

build_command_content() {
  local output_file="$1"
  {
    echo '#!/usr/bin/env bash'
    append_export RESEARCHHUB_RELEASE_MODE "${MODE}"
    append_export RESEARCHHUB_RELEASE_TAG "${RELEASE_TAG}"
    append_export RESEARCHHUB_IMAGE "${IMAGE_REF}"
    append_export RESEARCHHUB_OSS_RELEASE_PREFIX "${OSS_RELEASE_PREFIX}"
    append_export RESEARCHHUB_PORT "${PUBLIC_PORT}"
    sed '1{/^#!\/usr\/bin\/env bash$/d;}' "${BOOTSTRAP_FILE}"
  } > "${output_file}"
}

print_result_output() {
  local result_json="$1"
  local encoded_output dropped error_code error_info
  encoded_output="$(jq -r '.Invocation.InvocationResults.InvocationResult[0].Output // ""' <<< "${result_json}")"
  dropped="$(jq -r '.Invocation.InvocationResults.InvocationResult[0].Dropped // 0' <<< "${result_json}")"
  error_code="$(jq -r '.Invocation.InvocationResults.InvocationResult[0].ErrorCode // ""' <<< "${result_json}")"
  error_info="$(jq -r '.Invocation.InvocationResults.InvocationResult[0].ErrorInfo // ""' <<< "${result_json}")"

  if [[ -n "${encoded_output}" ]]; then
    echo "=== Cloud Assistant output ==="
    printf '%s' "${encoded_output}" | base64 --decode || true
    echo
  fi
  [[ "${dropped}" == "0" ]] || echo "WARN: Cloud Assistant truncated ${dropped} output byte(s); inspect /srv/researchhub/ops/logs"
  [[ -z "${error_code}" ]] || echo "ERROR_CODE: ${error_code}"
  [[ -z "${error_info}" ]] || echo "ERROR_INFO: ${error_info}"
}

wait_for_invocation() {
  local invoke_id="$1"
  local max_attempts=$(( (COMMAND_TIMEOUT_SECONDS + 300) / POLL_INTERVAL_SECONDS ))
  local attempt result_json result_count invocation_status exit_code

  for (( attempt=1; attempt<=max_attempts; attempt++ )); do
    if ! result_json="$("${ALIYUN_BIN}" ecs DescribeInvocationResults --RegionId "${REGION_ID}" --InvokeId "${invoke_id}" --InstanceId "${INSTANCE_ID}" --ContentEncoding Base64)"; then
      echo "WARN: failed to query invocation result; retrying (${attempt}/${max_attempts})"
      sleep "${POLL_INTERVAL_SECONDS}"
      continue
    fi
    result_count="$(jq -r '.Invocation.InvocationResults.InvocationResult | length' <<< "${result_json}")"
    if [[ "${result_count}" == "0" ]]; then
      invocation_status="Pending"
    else
      invocation_status="$(jq -r '.Invocation.InvocationResults.InvocationResult[0].InvocationStatus' <<< "${result_json}")"
    fi
    echo "Cloud Assistant invocation ${invoke_id}: ${invocation_status} (${attempt}/${max_attempts})"
    case "${invocation_status}" in
      Success)
        exit_code="$(jq -r '.Invocation.InvocationResults.InvocationResult[0].ExitCode // -1' <<< "${result_json}")"
        print_result_output "${result_json}"
        [[ "${exit_code}" == "0" ]] || fail "command reported Success with exit code ${exit_code}"
        return 0
        ;;
      Failed|PartialFailed|Error|Timeout|Stopped|Cancelled|Terminated|Aborted|Invalid)
        print_result_output "${result_json}"
        fail "Cloud Assistant command failed with status ${invocation_status}"
        ;;
    esac
    sleep "${POLL_INTERVAL_SECONDS}"
  done
  fail "timed out waiting for Cloud Assistant invocation ${invoke_id}"
}

validate_inputs
require_command curl
require_command jq
require_command tar
require_command base64
install_aliyun_cli

export ALIBABA_CLOUD_REGION_ID="${REGION_ID}"
export ALIBABA_CLOUD_IGNORE_PROFILE=TRUE

echo "=== Checking Cloud Assistant Agent ==="
assistant_status_json=""
for api_attempt in 1 2 3; do
  if assistant_status_json="$("${ALIYUN_BIN}" ecs DescribeCloudAssistantStatus --RegionId "${REGION_ID}" --InstanceId.1 "${INSTANCE_ID}")"; then
    break
  fi
  echo "WARN: failed to query Cloud Assistant status; retrying (${api_attempt}/3)"
  sleep $((api_attempt * 5))
done
[[ -n "${assistant_status_json}" ]] || fail "unable to query Cloud Assistant Agent status"
jq -e '.InstanceCloudAssistantStatusSet.InstanceCloudAssistantStatus[0] | select(.CloudAssistantStatus == true or .CloudAssistantStatus == "true")' <<< "${assistant_status_json}" >/dev/null || fail "Cloud Assistant Agent is not online for ${INSTANCE_ID}"

command_file="$(mktemp "${RUNNER_TEMP:-/tmp}/researchhub-cloud-assistant.XXXXXX")"
trap 'rm -f -- "${command_file}"' EXIT
build_command_content "${command_file}"
command_content="$(base64 < "${command_file}" | tr -d '\r\n')"
(( ${#command_content} <= 24000 )) || fail "Cloud Assistant command exceeds the 24 KB RunCommand limit"

client_token_seed="${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-${MODE}-${RELEASE_TAG}"
client_token="researchhub-$(printf '%s' "${client_token_seed}" | sha256_file /dev/stdin | cut -c1-32)"

echo "=== Starting researchhub ${MODE}: ${RELEASE_TAG} ==="
run_response=""
for api_attempt in 1 2 3; do
  if run_response="$("${ALIYUN_BIN}" ecs RunCommand --RegionId "${REGION_ID}" --Type RunShellScript --ContentEncoding Base64 --CommandContent "${command_content}" --InstanceId.1 "${INSTANCE_ID}" --Username "${COMMAND_USERNAME}" --Timeout "${COMMAND_TIMEOUT_SECONDS}" --TerminationMode ProcessTree --RepeatMode Once --KeepCommand false --ClientToken "${client_token}" --Name "researchhub-${MODE}-${RELEASE_TAG}")"; then
    break
  fi
  echo "WARN: RunCommand failed; retrying with the same ClientToken (${api_attempt}/3)"
  sleep $((api_attempt * 5))
done
[[ -n "${run_response}" ]] || fail "RunCommand failed after three attempts"
invoke_id="$(jq -er '.InvokeId' <<< "${run_response}")"
echo "Cloud Assistant InvokeId=${invoke_id}"
wait_for_invocation "${invoke_id}"
