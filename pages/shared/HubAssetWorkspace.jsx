import React from 'react';
import {useDirectoryIdentity} from './DirectoryState.jsx';
import HubAssetCatalog from './HubAssetCatalog.jsx';
import GovernanceSectionHeader from './GovernanceSectionHeader.jsx';
import {governanceBackHref} from '../../src/governance-overview.js';

export default function HubAssetWorkspace({view='catalog',...props}){
 const identity=useDirectoryIdentity();
 const status=identity.checking?'正在核对当前账号…':identity.unavailable?'身份暂时无法核对，请检查连接后重试。':!identity.user.authenticated?'请登录获准的Hub成员账号查看科研成果。':null;
 const content=status?<div><p role="status">{status}</p>{!identity.checking&&!identity.unavailable&&!identity.user.authenticated&&<a href={'/pages/p003/?'+new URLSearchParams({returnTo:location.pathname+location.search})}>前往登录</a>}</div>:<HubAssetCatalog {...props} view={view} hideHeading={view==='review'} identityKey={identity.identityKey}/>;
 if(view==='author')return content;
 if(view==='review')return <section className="governance-workspace"><GovernanceSectionHeader title="成果纳入审核" description="核对作者提交的固定成果与来源依据。" backHref={governanceBackHref(location.search)}/>{content}</section>;
 return <main className="platform-main real-hub"><div className="content"><a href="/pages/h01/?hubKey=lingshu-xinyu">返回领域概况</a>{content}</div></main>;
}
