import React from 'react';
import AccountPortalHeader from './AccountPortalHeader.jsx';
import './public-pages.css';
import './public-ui-standard.css';
import '../../src/lingshu-brand.css';

const STANDARD_PUBLIC_PAGES = ['p003','p004','p005','p007','p008','p009','p010','p011'];

export default function PublicLayout({children,page}){return <div className="ls-public" data-public-page={page} data-public-ui={STANDARD_PUBLIC_PAGES.includes(page)?'standard':undefined}>{['p003','p004','p005','p007','p008','p009','p011'].includes(page)?<AccountPortalHeader page={page}/>:<header className="ls-public-header"><a href="/pages/p002/#home" className="ls-public-brand"><span className="lingshu-brand-icon"><img src="/pages/p002/assets/reference-1.png" alt="灵枢心域标识"/></span><span className="lingshu-brand-copy"><b>灵枢心域</b><small>针灸防治情志病学术科研平台</small></span></a><nav aria-label="公共门户导航"><a href="/pages/p002/">平台介绍</a><a href="/pages/p007/">学术发起</a><a href="/pages/p008/">帮助中心</a><a href="/pages/p003/">登录</a></nav></header>}<main>{children}</main><footer>针灸防治情志病领域的学术科研共同体 · AI Assistant，Human Accountable</footer></div>;}
