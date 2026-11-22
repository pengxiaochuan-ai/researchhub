import json,subprocess
with open('/proc/meminfo') as f:
 m={l.split(':')[0]:int(l.split()[1]) for l in f if l.split(':')[0] in ('MemTotal','MemAvailable','SwapTotal','SwapFree')}
print(json.dumps({'memoryKiB':m,'containerMemory':subprocess.check_output(['docker','stats','--no-stream','--format','{{.Name}} {{.MemUsage}}'],universal_newlines=True).splitlines()}))
