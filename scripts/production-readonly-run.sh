#!/usr/bin/env bash
set -Eeuo pipefail
test -n "${ALIBABA_CLOUD_ACCESS_KEY_ID:-}"
test -n "${ALIBABA_CLOUD_ACCESS_KEY_SECRET:-}"
[[ "${ALIYUN_ECS_INSTANCE_ID:-}" =~ ^i-[A-Za-z0-9]+$ ]]
[[ "${ALIYUN_REGION_ID:-}" =~ ^[a-z0-9-]+$ ]]
export ALIBABA_CLOUD_IGNORE_PROFILE=TRUE
task_dir="$(mktemp -d)"
trap 'rm -rf -- "${task_dir}"' EXIT
curl -fsSL --connect-timeout 15 --max-time 90 https://github.com/aliyun/aliyun-cli/releases/download/v3.3.18/aliyun-cli-linux-3.3.18-amd64.tgz -o "${task_dir}/cli.tgz"
printf '%s  %s\n' 0823286604dbd8beb8d65dd0694d23c913e7c5d5a02b20a3593a4f8a6517f1d4 "${task_dir}/cli.tgz" | sha256sum -c -
tar -xzf "${task_dir}/cli.tgz" -C "${task_dir}" aliyun
node --input-type=module > "${task_dir}/payload" <<'JS'
import{readFileSync}from'node:fs';import{catalogFingerprintSql}from'./deploy/migration-plan.mjs';
const m=JSON.parse(readFileSync('deploy/migrations/researchhub-production-equivalence-v1/manifest.json'));
const source=readFileSync('scripts/production-readonly-probe.py','utf8').replace('__FINGERPRINT_SQL_BASE64__',Buffer.from(catalogFingerprintSql(m.managedSchemas)).toString('base64'));
const command='python3 - <<\'HUB_READONLY_PY\'\n'+source+'\nHUB_READONLY_PY\n';
const encoded=Buffer.from(command).toString('base64');if(encoded.length>24000)throw Error('READONLY_PAYLOAD_TOO_LARGE');process.stdout.write(encoded);
JS
"${task_dir}/aliyun" ecs RunCommand --RegionId "${ALIYUN_REGION_ID}" --Type RunShellScript --ContentEncoding Base64 --CommandContent "$(cat "${task_dir}/payload")" --InstanceId.1 "${ALIYUN_ECS_INSTANCE_ID}" --Username root --Timeout 90 --TerminationMode ProcessTree --RepeatMode Once --KeepCommand false --ClientToken "hub-readonly-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}" --Name hub-readonly-preflight > "${task_dir}/invocation.json"
invocation="$(jq -er .InvokeId "${task_dir}/invocation.json")"
for attempt in $(seq 1 45); do
  "${task_dir}/aliyun" ecs DescribeInvocationResults --RegionId "${ALIYUN_REGION_ID}" --InvokeId "${invocation}" --InstanceId "${ALIYUN_ECS_INSTANCE_ID}" --ContentEncoding Base64 > "${task_dir}/result.json"
  status="$(jq -r '.Invocation.InvocationResults.InvocationResult[0].InvocationStatus // "Pending"' "${task_dir}/result.json")"
  case "${status}" in
    Success|Failed|Error|Timeout|Stopped|Terminated|Cancelled|Invalid)
      jq -r '.Invocation.InvocationResults.InvocationResult[0].Output // ""' "${task_dir}/result.json" | base64 --decode
      test "${status}" = Success
      test "$(jq -r '.Invocation.InvocationResults.InvocationResult[0].ExitCode' "${task_dir}/result.json")" = 0
      exit 0 ;;
  esac
  sleep 2
done
echo 'READONLY_INVOCATION_NOT_COMPLETED' >&2
exit 1
