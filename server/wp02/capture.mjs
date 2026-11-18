import {createServer as tcpServer} from 'node:net';
import {createServer as httpServer} from 'node:http';
import {mkdirSync,lstatSync,readFileSync,writeFileSync,readdirSync,openSync,closeSync,fstatSync,ftruncateSync,constants} from 'node:fs';
import {join} from 'node:path';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {syntheticEmail} from './mailer.mjs';

const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function privateWrite(path,data){const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_NOFOLLOW,0o600);try{const s=fstatSync(fd);if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o777)!==0o600)throw new Error('WP02_PRIVATE_FILE_REJECTED');ftruncateSync(fd);writeFileSync(fd,JSON.stringify(data));}finally{closeSync(fd);}}
export async function startCapture(config,{dir,now=Date.now}) {
  if(config.mode!=='capture'||config.smtpHost!=='127.0.0.1'||config.inboxHost!=='127.0.0.1')throw new Error('WP02_CAPTURE_SCOPE_REJECTED');
  mkdirSync(dir,{recursive:true,mode:0o700});const stat=lstatSync(dir);
  if(!stat.isDirectory()||stat.isSymbolicLink()||stat.uid!==process.getuid()||(stat.mode&0o777)!==0o700)throw new Error('WP02_CAPTURE_DIRECTORY_REJECTED');
  const messages=new Map(),sockets=new Set();let bootstrap=randomBytes(32).toString('base64url'),cookie=randomBytes(32).toString('base64url');
  const credentialsPath=join(dir,'inbox-credentials.json');
  for(const file of readdirSync(dir).filter(f=>/^[A-Za-z0-9-]{8,100}\.json$/.test(f)&&f!=='inbox-credentials.json').slice(-1000)){
    const p=join(dir,file),s=lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o777)!==0o600)throw new Error('WP02_MESSAGE_FILE_REJECTED');
    const m=JSON.parse(readFileSync(p,'utf8'));messages.set(m.id,m);
  }
  const smtp=tcpServer(socket=>{
    sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});socket.setTimeout(10000,()=>socket.destroy());
    socket.write('220 WP02 loopback capture\r\n');let buffer='',inData=false,lines=[],size=0,from=null,to=null,done=false;
    const reject=()=>socket.end('550 WP02 message rejected\r\n');
    socket.on('data',chunk=>{
      buffer+=chunk.toString('utf8');if(Buffer.byteLength(buffer)>65536)return reject();
      while(buffer.includes('\r\n')){
        const end=buffer.indexOf('\r\n'),line=buffer.slice(0,end);buffer=buffer.slice(end+2);
        if(inData){
          size+=Buffer.byteLength(line)+2;if(size>65536)return reject();
          if(line!=='.'){lines.push(line.replace(/^\.\./,'.'));continue;}
          inData=false;done=true;
          try{
            const raw=lines.join('\r\n'),split=raw.indexOf('\r\n\r\n'),headers=raw.slice(0,split).replace(/\r\n[ \t]+/g,' ');
            const field=name=>headers.match(new RegExp('^'+name+': (.+)$','mi'))?.[1]?.trim();
            const id=field('X-WP02-ID'),expiresAt=Number(field('X-WP02-Expires'));
            if(split<0||!id||!/^[A-Za-z0-9-]{8,100}$/.test(id)||messages.has(id)||messages.size>=1000||!Number.isFinite(expiresAt)||expiresAt<=now()||expiresAt>now()+73*3600000)throw new Error('invalid');
            const encoded=raw.slice(split+4),encoding=field('Content-Transfer-Encoding');
            const text=encoding==='base64'?Buffer.from(encoded.replace(/\s/g,''),'base64').toString('utf8'):encoded;
            const m={id,to,expiresAt,purpose:field('X-WP02-Purpose')??'capture',capturedAt:new Date().toISOString(),digest:createHash('sha256').update(raw).digest('hex'),text};
            writeFileSync(join(dir,id+'.json'),JSON.stringify(m),{mode:0o600,flag:'wx'});messages.set(id,m);socket.write('250 captured '+id+'\r\n');
          }catch{return reject();}continue;
        }
        if(/^(EHLO|HELO) /i.test(line))socket.write('250 WP02\r\n');
        else if(/^MAIL FROM:</i.test(line)&&!done&&!from){from=line.match(/^MAIL FROM:<([^>]+)>$/i)?.[1];if(from!=='researchhub@example.test')return reject();socket.write('250 sender ok\r\n');}
        else if(/^RCPT TO:</i.test(line)&&from&&!to&&!done){to=line.match(/^RCPT TO:<([^>]+)>$/i)?.[1];if(!syntheticEmail(to))return reject();socket.write('250 recipient ok\r\n');}
        else if(line==='DATA'&&from&&to&&!done){inData=true;socket.write('354 end with dot\r\n');}
        else if(line==='QUIT')socket.end('221 bye\r\n');
        else if(line==='NOOP')socket.write('250 ok\r\n');
        else return reject();
      }
    });
  });smtp.maxConnections=20;
  let inboxPort;
  const inbox=httpServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    const send=(status,value,type='application/json; charset=utf-8')=>{res.statusCode=status;res.setHeader('Content-Type',type);res.end(type.startsWith('application/json')?JSON.stringify(value):value);};
    const origin='http://127.0.0.1:'+inboxPort;
    if(req.headers.host!=='127.0.0.1:'+inboxPort||(req.headers.origin&&req.headers.origin!==origin))return send(403,{code:'INBOX_FORBIDDEN'});
    try {
      if(req.method==='POST'&&req.url==='/session'){
        if(req.headers.origin!==origin)return send(403,{code:'INBOX_FORBIDDEN'});
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1024)return send(413,{code:'TOO_LARGE'});}
        const input=req.headers['content-type']?.startsWith('application/json')?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw));
        if(!bootstrap||!equal(input.bootstrap,bootstrap))return send(403,{code:'INBOX_FORBIDDEN'});
        bootstrap=null;res.setHeader('Set-Cookie','wp02_inbox='+cookie+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400');
        if(req.headers['content-type']?.startsWith('application/json'))return send(200,{ok:true});
        res.writeHead(303,{Location:'/'});return res.end();
      }
      const authenticated=(req.headers.cookie??'').split(';').some(part=>equal(part.trim(),'wp02_inbox='+cookie));
      if(!authenticated){if(req.method==='GET'&&req.url==='/')return send(200,'<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><h1>本机私有合成收件箱</h1><p>填写私有凭证文件中的启动口令，验证后仅本机访问。</p><form method="post" action="/session"><label>启动口令 <input type="password" name="bootstrap" autocomplete="off" required></label><button>解锁本机收件箱</button></form></html>','text/html; charset=utf-8');return send(401,{code:'INBOX_UNAUTHENTICATED'});}
      const publicList=[...messages.values()].reverse().slice(0,100).map(({text,...m})=>({...m,expired:m.expiresAt<=now()}));
      if(req.method==='GET'&&req.url==='/messages')return send(200,{items:publicList});
      const match=req.url?.match(/^\/messages\/([A-Za-z0-9-]{8,100})$/),m=match&&messages.get(match[1]);
      if(req.method==='GET'&&m){if(m.expiresAt<=now())return send(410,{code:'INBOX_MESSAGE_EXPIRED'});return send(200,{...m});}
      if(req.method==='GET'&&req.url==='/')return send(200,'<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><h1>本机合成邮件（无外发）</h1><p>邮件正文含一次性凭证，请勿截图、录屏或复制进聊天。</p><ul>'+publicList.map(m=>'<li><a href="/view/'+escape(m.id)+'">'+escape(m.to)+' · '+escape(m.purpose)+' · '+escape(m.capturedAt)+(m.expired?'（已过期）':'')+'</a></li>').join('')+'</ul></html>','text/html; charset=utf-8');
      const view=req.url?.match(/^\/view\/([A-Za-z0-9-]{8,100})$/),v=view&&messages.get(view[1]);
      if(req.method==='GET'&&v){if(v.expiresAt<=now())return send(410,{code:'INBOX_MESSAGE_EXPIRED'});const href=v.text.match(/http:\/\/127\.0\.0\.1:19501\/pages\/(p004|p005|p010)\/#(verify|reset|invite)=[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/)?.[0];return send(200,'<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><h1>合成邮件</h1><pre>'+escape(v.text)+'</pre>'+(href?'<a rel="noreferrer" href="'+escape(href)+'">打开确认页面（不会自动确认）</a>':'')+'<p><a href="/">返回收件箱</a></p></html>','text/html; charset=utf-8');}
      return send(404,{code:'INBOX_NOT_FOUND'});
    }catch{return send(400,{code:'INBOX_INVALID_REQUEST'});}
  });
  const listen=(server,port)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  try{await listen(smtp,config.smtpPort);await listen(inbox,config.inboxPort);inboxPort=inbox.address().port;privateWrite(credentialsPath,{bootstrap,url:'http://127.0.0.1:'+inboxPort+'/',notice:'仅本机，无外发。口令一次兑换，不上传。'});}catch(e){smtp.close();inbox.close();throw e;}
  return {sendPort:smtp.address().port,inboxPort,credentialsPath,
    receipt(id){const m=messages.get(id);return m?{id:m.id,to:m.to,expiresAt:m.expiresAt,digest:m.digest}:null;},
    async close(){for(const s of sockets)s.destroy();inbox.closeAllConnections();await Promise.all([smtp,inbox].map(s=>new Promise(resolve=>s.close(resolve))));}};
}
