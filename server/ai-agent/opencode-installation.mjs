import{readFile,stat,realpath}from'node:fs/promises';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
const policy=JSON.parse(await readFile(new URL('../../deploy/opencode-runtime.json',import.meta.url),'utf8'));
let cached;
export async function hubOpenCodeBinary(){
 const platform=process.platform+'-'+process.arch,expected=policy.platforms[platform];if(!expected)throw Error('HUB_OPENCODE_PLATFORM_UNSUPPORTED');
 const configured=process.env.HUB_OPENCODE_BIN??fileURLToPath(new URL('../../.private/bin/opencode',import.meta.url)),path=await realpath(configured),info=await stat(path);
 if(!info.isFile()||!(info.mode&0o111))throw Error('HUB_OPENCODE_BINARY_UNAVAILABLE');
 const identity=[path,info.dev,info.ino,info.size,info.mtimeMs,info.ctimeMs].join(':');if(cached?.identity===identity)return cached.path;
 const digest=createHash('sha256').update(await readFile(path)).digest('hex');if(digest!==expected.binarySha256)throw Error('HUB_OPENCODE_BINARY_CHANGED');
 cached={identity,path};return path;
}
