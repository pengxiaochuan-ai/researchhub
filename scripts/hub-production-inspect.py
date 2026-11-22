import subprocess

def container(service):
    ids = subprocess.check_output(['docker','ps','-q','--filter','label=com.docker.compose.project=researchhub-backend','--filter','label=com.docker.compose.service='+service],universal_newlines=True).splitlines()
    assert len(ids)==1
    return ids[0]

node = r"""
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readResearchRuntimeConfig } from './server/research-runtime/config.mjs';
import { runtimeDependencies } from './server/research-runtime/dependencies.mjs';
import { bindRuntimeTransactions, withDeploymentTransaction } from './server/database/transactions.mjs';
let prisma;
try {
  const config = readResearchRuntimeConfig(process.env);
  const tenantId = 'rh-kb-local-b0e2af9d-tenant';
  assert(config.identity.database === 'researchhub' && config.identity.tenantId === tenantId);
  const { load } = runtimeDependencies(config.core);
  prisma = new (load('prisma/prisma.service','PrismaService'))();
  await prisma.app.$connect();
  await prisma.elevated.$connect();
  const env = bindRuntimeTransactions({prisma,expected:config.identity});
  const source = await withDeploymentTransaction(env,'direct',async tx => {
    const task = await tx.knowledgeImportTask.findFirstOrThrow({
      where:{id:'cmwrffrc90003s307g7a50hbu',tenantId,status:'failed'},
      select:{sourceFile:{select:{storageKey:true,sha256:true,size:true,filename:true}}}
    });
    return task.sourceFile;
  },{readOnly:true});
  const size = Number(source.size);
  assert(source.sha256 === '733d37edf8b6de15fcf8b35ce70cc094293a2eae11ce4e8ec14582728e9e800e' && Number.isSafeInteger(size) && size > 0 && size <= 50*1024*1024);
  const storage = new (load('storage/storage.service','StorageService'))();
  storage.logger.log = () => {};
  storage.logger.warn = () => {};
  storage.onModuleInit();
  assert(await storage.probeAvailable());
  const data = await storage.getBuffer(source.storageKey,size);
  assert(data.length === size && createHash('sha256').update(data).digest('hex') === source.sha256);
  process.stdout.write(data);
} catch (error) {
  console.error('PDF_SOURCE_READ_FAILED',error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await prisma?.app?.$disconnect();
  await prisma?.elevated?.$disconnect();
}
"""
profile = 'DELTAS={\'parser.py\': (\'04432514dfdf313b0d327627a92b49e93f892e589277dd96d2aa2b9a8e04a84a\', [(4, 4, \'import asyncio\\n\'), (5, 5, \'import json\\n\'), (9, 9, \'import sys\\n\'), (28, 28, \'PDF_PAGE_BATCH_SIZE = 12\\n\'), (62, 62, \'_pdf_range_lock = asyncio.Lock()\\n\'), (83, 83, \'                cpu_threads=2,\\n                enable_mkldnn=False,\\n                rec_batch_num=2,\\n                cls_batch_num=2,\\n\'), (840, 841, \'def extract_pdf(data: bytes, *, start_page: int | None = None) -> tuple[str, int, bool, list[str]]:\\n\'), (848, 848, \'        start = 0 if start_page is None else start_page - 1\\n        stop = page_count if start_page is None else min(start + PDF_PAGE_BATCH_SIZE, page_count)\\n        if not 0 <= start < stop:\\n            raise HTTPException(422, "PDF 起始页超出范围")\\n\'), (849, 850, \'            for index in range(start, stop):\\n                page = document[index]\\n\'), (865, 866, \'    if start_page is None and not re.sub(r"\\\\s", "", meaningful):\\n\'), (933, 933, \'\\n\\ndef parse_pdf_range(data: bytes, start: int) -> dict[str, object]:\\n    markdown, page_count, used_ocr, warnings = extract_pdf(data, start_page=start)\\n    metadata = pdf_literature_metadata(data, markdown) if start == 1 else {}\\n    return {\\n        **metadata,\\n        "contentMd": markdown,\\n        "pageCount": page_count,\\n        "startPage": start,\\n        "endPage": min(start + PDF_PAGE_BATCH_SIZE - 1, page_count),\\n        "usedOcr": used_ocr,\\n        "warnings": warnings,\\n    }\\n\\n\\n@app.post("/extract/pdf-range")\\nasync def extract_pdf_range(start: int, file: UploadFile = File(...)):\\n    if Path(file.filename or "").suffix.lower() != ".pdf":\\n        raise HTTPException(415, "仅支持 PDF 分页解析")\\n    if start < 1 or start > MAX_PAGES:\\n        raise HTTPException(422, "PDF 起始页超出范围")\\n    async with _pdf_range_lock:\\n        data = await file.read(MAX_BYTES + 1)\\n        if not data or len(data) > MAX_BYTES:\\n            raise HTTPException(413, "文献文件为空或超过解析上限")\\n        # Native OCR allocations are released when the page-range process exits.\\n        process = await asyncio.create_subprocess_exec(\\n            sys.executable, str(Path(__file__).with_name("run.py")), "pdf-range", "--start", str(start),\\n            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,\\n        )\\n        try:\\n            output, _ = await asyncio.wait_for(process.communicate(data), timeout=240)\\n        except TimeoutError as error:\\n            raise HTTPException(504, "当前 PDF 页段解析超时") from error\\n        finally:\\n            if process.returncode is None:\\n                try:\\n                    process.kill()\\n                except ProcessLookupError:\\n                    pass\\n                await process.wait()\\n        if process.returncode != 0:\\n            raise HTTPException(422, "当前 PDF 页段无法解析")\\n        result = json.loads(output)\\n        if "error" in result:\\n            raise HTTPException(result["status"], result["error"])\\n        return result\\n\')]), \'run.py\': (\'9060c750df5ffd3911fd11e16cd9a0abac657484a81d8e6401259f5e857a1448\', [(6, 6, \'import sys\\n\'), (12, 13, "    cli.add_argument(\'service\', choices=[\'parser\', \'embedding\', \'pdf-range\'])\\n"), (14, 15, "    cli.add_argument(\'--port\', type=int)\\n    cli.add_argument(\'--start\', type=int)\\n"), (24, 25, "    module_name = \'parser\' if args.service == \'pdf-range\' else args.service\\n    source = Path(__file__).with_name(module_name + \'.py\')\\n"), (28, 28, "    if args.service == \'pdf-range\':\\n        from contextlib import redirect_stdout\\n        with redirect_stdout(sys.stderr):\\n            data = sys.stdin.buffer.read(service.MAX_BYTES + 1)\\n            try:\\n                result = service.parse_pdf_range(data, args.start)\\n            except service.HTTPException as error:\\n                result = {\'status\': error.status_code, \'error\': error.detail}\\n        print(json.dumps(result, ensure_ascii=False))\\n        return\\n    if args.port is None:\\n        cli.error(\'--port is required\')\\n")])}\n\nimport hashlib,json,resource,subprocess,sys,tempfile,time\nfrom pathlib import Path\ndata=sys.stdin.buffer.read(50*1024*1024+1)\nassert hashlib.sha256(data).hexdigest() == \'733d37edf8b6de15fcf8b35ce70cc094293a2eae11ce4e8ec14582728e9e800e\'\nwith tempfile.TemporaryDirectory(prefix=\'hub-pdf-range-probe-\') as folder:\n for name,(digest,edits) in DELTAS.items():\n  original=Path(name).read_bytes()\n  assert hashlib.sha256(original).hexdigest()==digest\n  lines=original.decode().splitlines(True)\n  for start,end,change in reversed(edits): lines[start:end]=[change]\n  Path(folder,name).write_text(\'\'.join(lines))\n start=time.monotonic()\n result=subprocess.run([sys.executable,str(Path(folder,\'run.py\')),\'pdf-range\',\'--start\',\'45\'],input=data,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=120,check=True)\n payload=json.loads(result.stdout)\n assert payload[\'startPage\']==45 and payload[\'endPage\']==56 and payload[\'pageCount\']==452 and payload[\'usedOcr\']\n markdown=payload[\'contentMd\']\n for page in range(45,57): assert (\'## 第 %s 页\'%page) in markdown\n print(json.dumps({\'startPage\':45,\'endPage\':56,\'pageCount\':452,\'elapsedMs\':round((time.monotonic()-start)*1000),\'ocr\':True,\'chars\':len(markdown),\'childPeakKiB\':resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss}))\n'
reader = subprocess.Popen(['docker','exec',container('researchhub-api'),'node','--input-type=module','-e',node],stdout=subprocess.PIPE)
try:
    result = subprocess.run(['docker','exec','-i',container('researchhub-doc-parser'),'python','-c',profile],stdin=reader.stdout,stdout=subprocess.PIPE,check=True,timeout=130)
    assert reader.wait(timeout=10)==0
    print(result.stdout.decode())
finally:
    if reader.poll() is None:
        reader.kill()
