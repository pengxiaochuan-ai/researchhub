import {readInvitationLocation} from './invitation-location.js';
export const isRealMembersPage=(pageId,configured,demoMode)=>pageId==='s11'&&Boolean(configured)&&!demoMode;
export function isGovernanceInvitationEntry(search=''){
 if(!new URLSearchParams(search).size)return true;
 try{return Boolean(readInvitationLocation(search)?.overview);}catch{return false;}
}
export function memberInvitationHeader(base,pageId,configured,demoMode){if(!isRealMembersPage(pageId,configured,demoMode))return base;return{...base,title:'Study成员与邀请',crumbs:[['我的工作台','p01'],['Study成员与邀请']],description:'先核对当前账号与真实研究授权，再管理成员邀请。',meta:'新账号不自动加入私有Study；仅目标研究最小授权，不开放共享、审批、锁库、发布或导出。',nav:undefined,actions:[],tags:[]};}
