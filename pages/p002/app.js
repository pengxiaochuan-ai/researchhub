import {goToPage} from '../../src/platform-navigation.js';
import {mountAcademicActivities} from '../../src/portal-academic-activities.js';
import './academic-activities.css';
mountAcademicActivities(document.querySelector('[data-academic-activities]'));
import {stages,roles,wheel,network,assets,engines} from './content.js?v=2.1';
import {setupDiagramMotion} from './diagram-motion.js?v=1.8.1';
import {loadCropImage} from './crop-image.js';
const $=selector=>document.querySelector(selector);
// Precision windows reuse the actual supplied illustration assets; no page rasterization.
function crop(source,x,y,width,height,alt='',className='') {
  const box=document.createElement('span');
  box.className='source-crop '+className;
  box.style.aspectRatio=width+'/'+height;
  box.style.setProperty('--crop-ratio',width/height);
  box.style.setProperty('--photo-ratio',width+'/'+height);
  const image=new Image();
  image.alt=alt;
  image.style.cssText='width:'+1586/width*100+'%;left:'+(-x/width*100)+'%;top:'+(-y/height*100)+'%';
  box.append(image);
  let status;
  if(className==='audience-photo') {
    status=document.createElement('span');
    status.className='crop-status';
    status.setAttribute('aria-hidden','true');
    box.append(status);
  }
  loadCropImage(image,box,'assets/reference-'+source+'.png',status);
  return box;
}
document.querySelectorAll('[data-crop]').forEach(element=>{const values=element.dataset.crop.split(',').map(Number);element.append(crop(...values,element.dataset.alt||''));});
function selectIn(container,selected){container.querySelectorAll('[aria-pressed]').forEach(item=>{const active=item===selected;item.classList.toggle('selected',active);item.setAttribute('aria-pressed',String(active));});}
function hotspots(container,items,detail){
  items.forEach(([title,description,left,top,width,height],index)=>{
    const button=document.createElement('button');
    button.className='diagram-hotspot';
    button.style.cssText='left:'+left+'%;top:'+top+'%;width:'+width+'%;height:'+height+'%';
    button.setAttribute('aria-label',title);
    button.setAttribute('aria-controls',detail.id);
    button.setAttribute('aria-pressed','false');
    button.dataset.node=title;
    const activate=()=>{
      if(detail.dataset.node===title)return;
      selectIn(container,button);
      detail.querySelector('strong').textContent=title;
      detail.querySelector('p').textContent=description;
      detail.dataset.node=title;
      detail.getAnimations().forEach(animation=>animation.cancel());
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
        detail.animate([{opacity:.65},{opacity:1}],{duration:180});
      }
    };
    button.addEventListener('mouseenter',activate);
    button.addEventListener('focus',activate);
    button.addEventListener('click',activate);
    container.append(button);
    if(index===0)activate();
  });
}
hotspots($('#wheel-hotspots'),wheel,$('#wheel-detail'));hotspots($('#network-hotspots'),network,$('#network-description'));
setupDiagramMotion();
const support=[['多学科交叉',806,824,44,47],['临床与科研结合',975,824,43,47],['开放共享',1185,824,42,47],['推动学科发展',1345,824,43,47]];
support.forEach(([title,...rect])=>{const item=document.createElement('span');item.append(crop(1,...rect),document.createTextNode(title));$('#support-values').append(item);});
stages.forEach(([title,description,art],index)=>{
  const button=document.createElement('button');
  button.className='process-card';button.type='button';
  button.setAttribute('aria-pressed',String(index===3));
  button.innerHTML='<span class="step-num">0'+(index+1)+'</span><h3>'+title+'</h3><p>'+description+'</p>';
  button.querySelector('h3').before(crop(2,...art,'','process-art'));
  const activate=()=>selectIn($('#process-cards'),button);
  button.addEventListener('click',activate);button.addEventListener('mouseenter',activate);button.addEventListener('focus',activate);
  $('#process-cards').append(button);if(index===3)button.classList.add('selected');
});
const tools=[['证据检索',546,858,38,43],['方案梳理',714,858,40,43],['数据分析',883,858,40,43],['结果解读',1052,858,42,43]];
tools.forEach(([title,...rect])=>{const item=document.createElement('div');item.append(crop(2,...rect));const text=document.createElement('strong');text.textContent=title;item.append(text);$('#ai-tools').append(item);});
assets.forEach(([title,art,tags,description],index)=>{const card=document.createElement('article');card.className='asset-card';card.innerHTML='<div class="asset-heading"><span class="step-num">0'+(index+1)+'</span><h3>'+title+'</h3></div><div class="asset-art"></div><div class="tags">'+tags.map(tag=>'<span>'+tag+'</span>').join('')+'</div><p>'+description+'</p>';card.querySelector('.asset-art').append(crop(3,...art,title));if(index<2){const arrow=document.createElement('span');arrow.className='asset-arrow';arrow.textContent='→';arrow.setAttribute('aria-hidden','true');card.append(arrow);}$('#asset-cards').append(card);});
const community=[['汇聚研究者与机构','连接专家、团队与机构，构建开放多元的学术网络。',73,580,71,68],['沉淀领域知识与证据','系统整合文献、数据与实践经验，形成可持续积累的科研资产。',390,580,70,68],['推动研究协作与成果共享','促进跨机构、跨学科合作，加速成果转化与应用。',73,711,71,67],['持续发现研究机会','基于知识与数据挖掘，发现前沿问题，激发新的研究方向。',390,711,70,67]];
community.forEach(([title,description,...rect])=>{const item=document.createElement('article');item.append(crop(4,...rect));const text=document.createElement('div');text.innerHTML='<h3>'+title+'</h3><p>'+description+'</p>';item.append(text);$('#community-values').append(item);});
engines.forEach(([title,art,description,items,tone],index)=>{const card=document.createElement('article');card.className='engine '+tone;const artFrame=document.createElement('div');artFrame.className='engine-art-frame';artFrame.append(crop(5,...art,title,'engine-art'));card.append(artFrame);const body=document.createElement('div');body.className='engine-body';body.innerHTML='<div class="engine-heading"><span class="step-num">0'+(index+1)+'</span><div><h3>'+title+'</h3><p>'+description+'</p></div></div><ul>'+items.map((item,j)=>'<li><span class="engine-icon" data-icon="'+j+'"></span>'+item+'</li>').join('')+'</ul>';const x=[104,607,1091][index];const y=[728,791,855];body.querySelectorAll('.engine-icon').forEach((icon,j)=>icon.append(crop(5,x,y[j],54,54)));card.append(body);$('#engine-cards').append(card);});
const benefits=[['循证导向','以证据驱动研究',886,203,51,48],['协同研究','连接多方资源',1114,203,57,48],['开放共享','促进知识交流',1346,203,58,48]];
benefits.forEach(([title,description,...rect])=>{const item=document.createElement('div');item.append(crop(6,...rect));const text=document.createElement('span');text.innerHTML='<strong>'+title+'</strong><small>'+description+'</small>';item.append(text);$('#audience-benefits').append(item);});
roles.forEach(([title,description,art],index)=>{const button=document.createElement('button');button.className='audience-card'+(index===0?' selected':'');button.setAttribute('aria-pressed',String(index===0));button.append(crop(6,...art,'','audience-photo'));const copy=document.createElement('div');copy.className='audience-copy';copy.innerHTML='<h3>'+title+'</h3><p>'+description+'</p>';button.append(copy);button.addEventListener('click',()=>{selectIn($('#audience-cards'),button);$('#role-join').textContent='免费注册，探索'+(title.includes(' / ')?'机构研究':title)+'方向 →';});$('#audience-cards').append(button);});
const join=[['专业可信','基于领域证据<br>和学术共识',799,273,122,118],['高效智能','AI 助力<br>科研全流程',1000,273,118,118],['开放协作','连接研究者与机构，<br>共建共享，持续积累',1208,273,124,118]];
join.forEach(([title,description,...rect])=>{const item=document.createElement('article'),art=document.createElement('div');art.className='join-icon-frame';art.append(crop(7,...rect));item.append(art);item.insertAdjacentHTML('beforeend','<h3>'+title+'</h3><p>'+description+'</p>');$('#join-values').append(item);});
const menu=$('.menu-toggle'),nav=$('#nav');menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);});nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');}));document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){const restore=nav.contains(document.activeElement);nav.classList.remove('open');menu.setAttribute('aria-expanded','false');if(restore)menu.focus();}});
if('IntersectionObserver' in window){
  const sections=[...document.querySelectorAll('.section')];
  const routes={home:'#home',process:'#process',assets:'#process',growth:'#process',community:'#community',audience:'#audience',join:'#join'};
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      entry.target.classList.toggle('in-view',entry.isIntersecting);
      if(entry.isIntersecting)entry.target.classList.add('entered');
    });
    const visible=sections.map(section=>{
      const box=section.getBoundingClientRect();
      return {id:section.id,height:Math.max(0,Math.min(box.bottom,innerHeight)-Math.max(box.top,0))};
    }).sort((a,b)=>b.height-a.height)[0];
    nav.querySelectorAll('a').forEach(link=>link.classList.toggle('active',link.hash===routes[visible.id]));
  },{threshold:[0,.12,.5,.88,1]});
  sections.forEach(section=>observer.observe(section));
}
document.querySelectorAll('[data-join]').forEach(button=>button.addEventListener('click',()=>goToPage('p004')));
$('[data-info="login"]').addEventListener('click',()=>goToPage('p003'));
