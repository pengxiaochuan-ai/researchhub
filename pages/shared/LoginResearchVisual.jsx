import React,{useState} from 'react';
import './login-research-visual.css';

const nodes=[[688,44],[1148,270],[1140,900],[688,1110],[245,900],[240,270]];
export default function LoginResearchVisual(){
 const [failed,setFailed]=useState(false);
 return <section className="ls-auth-story ls-login-story">
  <h1>连接研究方向，<br/>积累可信证据</h1>
  <p>从研究证据到科研成果，让每次研究形成可延续的积累。</p>
  <div className="ls-login-wheel">
   <img src="/pages/p002/assets/hero-wheel-transparent.png" width="1360" height="1156" alt="灵枢心域科研循环：研究证据、研究机会、研究设计、研究执行、研究成果与科研资产" onError={()=>setFailed(true)} hidden={failed}/>
   {!failed&&<svg viewBox="0 0 1360 1156" aria-hidden="true" focusable="false">
    <defs><mask id="login-wheel-label-mask"><rect width="1360" height="1156" fill="white"/><g fill="black"><rect x="400" y="86" width="510" height="172" rx="80"/><rect x="882" y="326" width="465" height="175" rx="80"/><rect x="874" y="676" width="475" height="172" rx="80"/><rect x="407" y="907" width="570" height="170" rx="80"/><rect x="6" y="673" width="490" height="175" rx="80"/><rect x="33" y="324" width="480" height="175" rx="80"/></g></mask></defs>
    <g mask="url(#login-wheel-label-mask)"><ellipse className="ls-login-orbit" cx="688" cy="578" rx="530" ry="515" pathLength="100" fill="none" stroke="#68b9ff" strokeWidth="5" strokeLinecap="round" strokeDasharray="9 91"/>
     {nodes.map(([cx,cy],i)=><circle className="ls-login-node" key={i} cx={cx} cy={cy} r="10" fill={i%2?'#7433ff':'#245bdb'} style={{animationDelay:(-i*.6)+'s'}}/>)}
    </g>
   </svg>}
   {failed&&<p role="status" className="ls-login-image-error">科研图示暂未加载，请刷新重试。</p>}
  </div>
 </section>;
}
