#!/usr/bin/env bash
set -Eeuo pipefail
[[ -n "${ALIBABA_CLOUD_ACCESS_KEY_ID:-}" && -n "${ALIBABA_CLOUD_ACCESS_KEY_SECRET:-}" ]]
[[ "${ALIYUN_ECS_INSTANCE_ID:-}" =~ ^i-[A-Za-z0-9]+$ ]]
[[ "${HUB_RUNTIME_TAG:-}" =~ ^hub-runtime-[a-f0-9]{8}-[0-9]+$ ]]
[[ "${HUB_RUNTIME_CONTROL_SHA256:-}" =~ ^[a-f0-9]{64}$ ]]
[[ "${HUB_RUNTIME_ACTION:-}" == activate || "${HUB_RUNTIME_ACTION:-}" == verify || "${HUB_RUNTIME_ACTION:-}" == activate-front ]]
export ALIBABA_CLOUD_IGNORE_PROFILE=TRUE
region=cn-hangzhou
task_dir="$(mktemp -d)"
trap 'rm -rf -- "${task_dir}"' EXIT
curl -fsSL --connect-timeout 15 --max-time 90 https://github.com/aliyun/aliyun-cli/releases/download/v3.3.18/aliyun-cli-linux-3.3.18-amd64.tgz -o "${task_dir}/cli.tgz"
printf '%s  %s\n' 0823286604dbd8beb8d65dd0694d23c913e7c5d5a02b20a3593a4f8a6517f1d4 "${task_dir}/cli.tgz" | sha256sum -c -
tar -xzf "${task_dir}/cli.tgz" -C "${task_dir}" aliyun
python3 - > "${task_dir}/payload" <<'PY'
import os,json,pathlib,base64
values={k:os.environ[k] for k in ('HUB_RUNTIME_TAG','HUB_RUNTIME_CONTROL_SHA256','HUB_RUNTIME_ACTION')}
source=pathlib.Path('scripts/hub-runtime-bootstrap.py').read_text()
script="python3 - <<'HUB_RUNTIME_BOOTSTRAP'\nimport os\nos.environ.update("+repr(values)+")\n"+source+"\nHUB_RUNTIME_BOOTSTRAP\n"
encoded=base64.b64encode(script.encode()).decode();assert len(encoded)<24000
print(encoded,end='')
PY
"${task_dir}/aliyun" ecs RunCommand --RegionId "${region}" --Type RunShellScript --ContentEncoding Base64 --CommandContent "$(cat "${task_dir}/payload")" --InstanceId.1 "${ALIYUN_ECS_INSTANCE_ID}" --Username root --Timeout 900 --TerminationMode ProcessTree --RepeatMode Once --KeepCommand false --ClientToken "hub-runtime-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}" --Name hub-isolated-runtime > "${task_dir}/invocation.json"
invocation="$(jq -er .InvokeId "${task_dir}/invocation.json")"
for attempt in $(seq 1 200); do
  "${task_dir}/aliyun" ecs DescribeInvocationResults --RegionId "${region}" --InvokeId "${invocation}" --InstanceId "${ALIYUN_ECS_INSTANCE_ID}" --ContentEncoding Base64 > "${task_dir}/result.json"
  status="$(jq -r '.Invocation.InvocationResults.InvocationResult[0].InvocationStatus // "Pending"' "${task_dir}/result.json")"
  case "${status}" in
    Success|Failed|Error|Timeout|Stopped|Terminated|Cancelled|Invalid)
      jq -r '.Invocation.InvocationResults.InvocationResult[0].Output // ""' "${task_dir}/result.json" | base64 --decode
      test "${status}" = Success
      test "$(jq -r '.Invocation.InvocationResults.InvocationResult[0].ExitCode' "${task_dir}/result.json")" = 0
      exit 0 ;;
  esac
  sleep 5
done
printf 'HUB_RUNTIME_INVOCATION_STATE_MUST_BE_RECHECKED\n' >&2
exit 1
