import {createHash,createHmac} from 'node:crypto';
import {syntheticEmail} from './mailer.mjs';
export const fault=(code,message,status=400)=>Object.assign(new Error(message),{code,status});
export function strictInput(value,keys){if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw fault('WP02_INVALID_FIELDS','请求字段不符合约定。');return value;}
export function normalizeEmail(value){if(typeof value!=='string')throw fault('WP02_INVALID_EMAIL','请填写合成邮箱。');const email=value.trim().toLowerCase();if(!syntheticEmail(email))throw fault('WP02_INVALID_EMAIL','本机捕获仅接受 example.test 或 example.org 合成邮箱。');return email;}
export function validatePassword(value){if(typeof value!=='string'||[...value].length<12||[...value].length>64||Buffer.byteLength(value)>72)throw fault('WP02_INVALID_PASSWORD','密码须为12–64字符，UTF-8不超过72字节。');return value;}
export function requestKey(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(value))throw fault('WP02_INVALID_REQUEST_KEY','请求标识无效，请刷新页面。');return value;}
export function tokenHash(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))throw fault('WP02_INVALID_TOKEN','链接无效或已失效，请重新申请。');return createHash('sha256').update(value).digest('hex');}
export const digest=(secret,...values)=>createHmac('sha256',secret).update(JSON.stringify(values)).digest('hex');
export function displayName(value){if(typeof value!=='string'||!value.trim()||[...value.trim()].length>40)throw fault('WP02_INVALID_NAME','展示名称须为1–40字符。');return value.trim();}
