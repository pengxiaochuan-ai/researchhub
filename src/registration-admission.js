import {ADMISSION_PAGE} from './admission-session.js';
export function registrationEntryTarget(user,state,{verificationLink=false}={}){
 if(verificationLink||!user)return null;
 if(state?.accountId!==user.accountId||!['pending','needs_information','approved','rejected','unregistered'].includes(state.status))throw Error('当前账号的加入状态无法核对，请重试。');
 return state.status==='approved'?'/pages/p01/':ADMISSION_PAGE;
}
export function uncertainRegistration(error){
 return ['WP02_NETWORK','WP02_INVALID_RESPONSE'].includes(error?.code)||error?.code==='WP02_UNAVAILABLE'&&(!Number.isInteger(error.status)||error.status>=500);
}
