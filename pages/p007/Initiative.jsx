import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, BookOpen, Layers3, Lightbulb, MessageCircle, Search, UsersRound, UserRound} from 'lucide-react';
import {publicAcademicHref} from '../../src/academic-content-route.js';
import collaborationNarrow from './assets/researchers-collaboration.webp';
import collaborationWide from './assets/researchers-collaboration-wide.webp';
import researchBooks from './assets/research-books.webp';
import './initiative.css';

const activitiesHref=publicAcademicHref({type:'event'});

export default function Initiative(){
  const root=useRef(null);
  const [reduced,setReduced]=useState(false);
  const [visible,setVisible]=useState(true);
  const [inView,setInView]=useState(true);
  useEffect(()=>{
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference=()=>setReduced(preference.matches);
    const syncVisibility=()=>setVisible(document.visibilityState==='visible');
    syncPreference();syncVisibility();
    preference.addEventListener('change',syncPreference);
    document.addEventListener('visibilitychange',syncVisibility);
    let observer;
    if('IntersectionObserver' in window){
      observer=new IntersectionObserver(entries=>{
        for(const entry of entries){
          if(entry.target.hasAttribute('data-initiative-hero'))setInView(entry.isIntersecting);
          else if(entry.isIntersecting){entry.target.setAttribute('data-revealed','true');observer.unobserve(entry.target);}
        }
      },{threshold:0.12});
      root.current.querySelectorAll('[data-initiative-hero],[data-initiative-reveal]').forEach(element=>observer.observe(element));
    }
    return ()=>{observer?.disconnect();preference.removeEventListener('change',syncPreference);document.removeEventListener('visibilitychange',syncVisibility);};
  },[]);
  const motion=!reduced&&visible&&inView;
  return <div className="ls-initiative" ref={root} data-motion={motion?'on':'off'}>
    <section className="initiative-hero" data-initiative-hero aria-labelledby="initiative-title">
      <figure className="initiative-scene">
        <picture><source media="(max-width:1024px)" srcSet={collaborationNarrow}/><img src={collaborationWide} alt="两位研究者围绕书本与研究笔记交流的场景" width="2172" height="724" fetchpriority="high"/></picture>
        <div className="initiative-scene-label initiative-scene-question">临床中的问题</div>
        <div className="initiative-scene-label initiative-scene-ideas">交流中的新思路</div>
      </figure>
      <div className="initiative-container initiative-hero-inner">
        <div className="initiative-hero-copy">
          <p className="initiative-kicker">研究者共创</p>
          <h1 id="initiative-title">让你的研究积累，<br/>连接更广阔的学术同行。</h1>
          <p className="initiative-intro">在针灸防治情志病领域，一起查找证据、交流问题、完善研究，让每一次探索留下可延续的成果。</p>
          <div className="initiative-actions">
            <a className="ls-primary initiative-join" href="/pages/p004/">加入灵枢心域 <ArrowRight aria-hidden="true"/></a>
            <a className="initiative-text-link" href="#initiative-participate">了解参与方式 <ArrowRight aria-hidden="true"/></a>
          </div>
        </div>
      </div>
    </section>

    <section className="initiative-container initiative-benefits" aria-labelledby="initiative-benefits-title" data-initiative-reveal>
      <h2 id="initiative-benefits-title">你可以从这里开始</h2>
      <div className="initiative-benefit-grid">
        <article className="initiative-evidence">
          <div className="initiative-benefit-heading"><span className="initiative-icon"><Search aria-hidden="true"/></span><h3>查找领域证据</h3></div>
          <p>梳理针灸防治情志病的研究进展与文献依据，为你的研究问题寻找参考。</p>
          <img src={researchBooks} alt="" width="1536" height="1024" loading="lazy"/>
        </article>
        <div className="initiative-benefit-pair">
          <article><span className="initiative-icon"><Lightbulb aria-hidden="true"/></span><div><h3>完善研究思路</h3><p>从临床观察与已有证据中凝练问题，在交流中拓展思路，逐步完善研究设计。</p></div></article>
          <article><span className="initiative-icon"><Layers3 aria-hidden="true"/></span><div><h3>积累可复用成果</h3><p>整理文献、研究框架与方法，让自己的研究积累可回看、可延续，经授权后共享复用。</p></div></article>
        </div>
      </div>
    </section>

    <section id="initiative-participate" className="initiative-container initiative-participate" aria-labelledby="initiative-participate-title" data-initiative-reveal>
      <h2 id="initiative-participate-title">共同参与，逐步共建</h2>
      <div className="initiative-participation-grid">
        <article><span className="initiative-icon"><UserRound aria-hidden="true"/></span><div><h3>个人研究者</h3><p>从自己的研究方向与问题出发，查找证据、整理思路，积累研究成果。</p><a href="/pages/p003/">进入我的工作台 <ArrowRight aria-hidden="true"/></a></div></article>
        <article><span className="initiative-icon"><UsersRound aria-hidden="true"/></span><div><h3>科研团队</h3><p>了解领域内的团队与研究者，寻找共同关注的问题与研究方向。</p><a href="/pages/t01/">浏览公开团队 <ArrowRight aria-hidden="true"/></a></div></article>
        <article><span className="initiative-icon"><MessageCircle aria-hidden="true"/></span><div><h3>学术交流</h3><p>关注领域活动与学术动态，让一次交流成为继续探索的起点。</p><a href={activitiesHref}>查看学术活动 <ArrowRight aria-hidden="true"/></a></div></article>
      </div>
    </section>

    <section className="initiative-background" aria-labelledby="initiative-background-title">
      <div className="initiative-container initiative-background-grid">
        <div><h2 id="initiative-background-title">以临床问题为起点，<br/>共建领域科研共同体</h2><p>领域研究需要连接临床实践与研究证据。灵枢心域汇聚针灸防治情志病领域的研究者、团队与机构，共同组织可验证的问题，持续积累可复用的知识与科研资产。</p></div>
        <div className="initiative-support"><BookOpen aria-hidden="true"/><h3>项目支持</h3><p>国家中医药多学科交叉创新团队项目</p><p className="initiative-note">项目支持不等同于运营或合作关系；发起机构与专家以公开确认信息为准。</p><p className="initiative-note">机构合作暂未开放申请。<a href="/pages/p008/">查看参与说明</a></p></div>
      </div>
    </section>
  </div>;
}
