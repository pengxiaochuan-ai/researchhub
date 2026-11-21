import{readFile,mkdir,writeFile,mkdtemp,rm,chmod}from'node:fs/promises';import{createHash}from'node:crypto';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{fileURLToPath}from'node:url';import{execFileSync}from'node:child_process';
export async function installHubOpenCode(target,{fetchImpl=fetch,policy}={}){
 policy??=JSON.parse(await readFile(new URL('./opencode-runtime.json',import.meta.url),'utf8'));
 const pin=policy.platforms['linux-x64'];if(!pin?.tarball?.startsWith('https://registry.npmjs.org/opencode-linux-x64-baseline/-/')||!/^[a-f0-9]{64}$/.test(pin.binarySha256))throw Error('HUB_OPENCODE_INSTALL_POLICY');
 const response=await fetchImpl(pin.tarball,{redirect:'error',signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('HUB_OPENCODE_DOWNLOAD_FAILED');const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>100*1024*1024||createHash('sha512').update(bytes).digest('base64')!==pin.archiveSha512)throw Error('HUB_OPENCODE_ARCHIVE_CHANGED');
 const directory=await mkdtemp(join(tmpdir(),'hub-opencode-install-'));try{
  const archive=join(directory,'binary.tgz');await writeFile(archive,bytes,{mode:0o600});const names=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n').sort();if(JSON.stringify(names)!==JSON.stringify(['package/bin/opencode','package/package.json']))throw Error('HUB_OPENCODE_ARCHIVE_INVENTORY');
  execFileSync('tar',['-xzf',archive,'-C',directory,'--','package/bin/opencode','package/package.json']);const binary=await readFile(join(directory,'package/bin/opencode')),pkg=JSON.parse(await readFile(join(directory,'package/package.json'),'utf8'));if(pkg.version!==policy.version||createHash('sha256').update(binary).digest('hex')!==pin.binarySha256)throw Error('HUB_OPENCODE_BINARY_CHANGED');
  await mkdir(target,{recursive:true,mode:0o755});const path=join(target,'opencode');await writeFile(path,binary,{mode:0o755,flag:'wx'});await chmod(path,0o755);return{version:policy.version,sha256:pin.binarySha256};
 }finally{await rm(directory,{recursive:true,force:true})}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await installHubOpenCode(process.argv[2])));
