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
profile = """
import hashlib,json,resource,sys,time,signal
import parser as parser_module
signal.alarm(70)
data=sys.stdin.buffer.read(50*1024*1024+1)
assert hashlib.sha256(data).hexdigest() == '733d37edf8b6de15fcf8b35ce70cc094293a2eae11ce4e8ec14582728e9e800e'
with parser_module.fitz.open(stream=data,filetype='pdf') as doc, parser_module.pdfplumber.open(__import__('io').BytesIO(data)) as plumber:
 print(json.dumps({'bytes':len(data),'pages':len(doc)}),flush=True)
 for number in (1,5,6,50,225,329,452):
  start=time.monotonic()
  text,ocr,warnings=parser_module._render_pdf_page(doc[number-1],plumber.pages[number-1],number)
  print(json.dumps({'page':number,'ocr':ocr,'chars':len(text),'elapsedMs':round((time.monotonic()-start)*1000),'peakRssKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}),flush=True)
  plumber.pages[number-1].close()
  parser_module.fitz.TOOLS.store_shrink(100)

"""
reader = subprocess.Popen(['docker','exec',container('researchhub-api'),'node','--input-type=module','-e',node],stdout=subprocess.PIPE)
try:
    result = subprocess.run(['docker','exec','-i',container('researchhub-doc-parser'),'python','-c',profile],stdin=reader.stdout,stdout=subprocess.PIPE,timeout=80)
    assert reader.wait(timeout=10)==0
    print(result.stdout.decode())
    assert result.returncode == 0
finally:
    if reader.poll() is None:
        reader.kill()
