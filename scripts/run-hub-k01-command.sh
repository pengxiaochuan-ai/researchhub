#!/usr/bin/env bash
set -Eeuo pipefail
[[ -n "${ALIBABA_CLOUD_ACCESS_KEY_ID:-}" && -n "${ALIBABA_CLOUD_ACCESS_KEY_SECRET:-}" ]]
[[ "${ALIYUN_ECS_INSTANCE_ID:-}" =~ ^i-[A-Za-z0-9]+$ ]]
[[ "${HUB_K01_ACTION:-}" == stage || "${HUB_K01_ACTION:-}" == activate || "${HUB_K01_ACTION:-}" == inspect ]]
export ALIBABA_CLOUD_IGNORE_PROFILE=TRUE
region=cn-hangzhou
task_dir="$(mktemp -d)"
trap 'rm -rf -- "${task_dir}"' EXIT
curl -fsSL --connect-timeout 15 --max-time 90 https://github.com/aliyun/aliyun-cli/releases/download/v3.3.18/aliyun-cli-linux-3.3.18-amd64.tgz -o "${task_dir}/cli.tgz"
printf '%s  %s\n' 0823286604dbd8beb8d65dd0694d23c913e7c5d5a02b20a3593a4f8a6517f1d4 "${task_dir}/cli.tgz" | sha256sum -c -
tar -xzf "${task_dir}/cli.tgz" -C "${task_dir}" aliyun
python3 - > "${task_dir}/payload" <<'PY'
import os,json,pathlib,base64,zlib
values={k:os.environ.get(k,'') for k in ('HUB_K01_INPUT','HUB_K01_CHECKPOINT_SHA')};action=os.environ['HUB_K01_ACTION'];assert action in ('stage','activate','inspect')
source=base64.b64encode(zlib.compress(pathlib.Path('scripts/hub-k01-runtime.py').read_bytes(),9)).decode()
script="python3 - "+action+" <<'HUB_K01'\nimport os,base64,zlib\nos.environ.update("+repr(values)+")\nexec(compile(zlib.decompress(base64.b64decode("+repr(source)+")), '<hub-k01>', 'exec'))\nHUB_K01\n"
encoded=base64.b64encode(script.encode()).decode();assert len(encoded)<24000
print(encoded,end='')
PY
"${task_dir}/aliyun" ecs RunCommand --RegionId "${region}" --Type RunShellScript --ContentEncoding Base64 --CommandContent "$(cat "${task_dir}/payload")" --InstanceId.1 "${ALIYUN_ECS_INSTANCE_ID}" --Username root --Timeout 300 --TerminationMode ProcessTree --RepeatMode Once --KeepCommand false --ClientToken "hub-k01-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}" --Name hub-k01-extension > "${task_dir}/invocation.json"
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
