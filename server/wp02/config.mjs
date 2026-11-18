import {openSync,closeSync,fstatSync,readFileSync,constants} from 'node:fs';
import {parseEnv} from 'node:util';

export function readWp02Config({file,approvedMode}) {
  const reject=()=>{throw new Error('WP02_MAIL_CONFIG_REJECTED');};
  if(approvedMode!=='capture')reject();
  const fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW);
  let env;
  try {
    const stat=fstatSync(fd);
    if(!stat.isFile()||(stat.mode&0o777)!==0o600||stat.uid!==process.getuid()||stat.size>16384)reject();
    const raw=readFileSync(fd,'utf8'),keys=[...raw.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map(m=>m[1]);
    if(new Set(keys).size!==keys.length)reject();
    env=parseEnv(raw);
  } finally {closeSync(fd);}
  if(env.WP02_MAIL_MODE!=='capture'||env.WP02_PUBLIC_BASE_URL!=='http://127.0.0.1:19501'||
    env.WP02_CAPTURE_SMTP_HOST!=='127.0.0.1'||env.WP02_CAPTURE_INBOX_HOST!=='127.0.0.1'||
    env.WP02_CAPTURE_SMTP_PORT!=='19506'||env.WP02_CAPTURE_INBOX_PORT!=='19507'||env.WP02_CAPTURE_FROM!=='researchhub@example.test')reject();
  // SMTP_* may already contain user credentials. They never leave this parser
  // or select a transport: external connection/verify/send requires new approval.
  return Object.freeze({mode:'capture',baseUrl:env.WP02_PUBLIC_BASE_URL,from:env.WP02_CAPTURE_FROM,
    smtpHost:'127.0.0.1',smtpPort:19506,inboxHost:'127.0.0.1',inboxPort:19507});
}
