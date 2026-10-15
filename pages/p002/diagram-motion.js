// Decorative motion never changes the persistent, user-controlled description.
export function setupDiagramMotion(){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const network=document.querySelector('.network-canvas');
  // Endpoints follow the seven existing spokes in the original 894 × 640 crop.
  const spokes=[[[440,221],[440,141]],[[550,282],[609,246]],[[563,382],[612,399]],[[497,450],[549,530]],[[385,450],[337,528]],[[319,382],[274,398]],[[333,282],[286,251]]];
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 894 640');
  svg.setAttribute('preserveAspectRatio','none');
  svg.setAttribute('aria-hidden','true');
  svg.classList.add('network-motion');
  svg.innerHTML='<circle class="network-response" cx="440" cy="349" r="99"/>'+spokes.map(([a,b],index)=>'<g class="network-spoke" data-index="'+index+'"><path class="network-link" d="M'+a.join(' ')+' L'+b.join(' ')+'" pathLength="100"/><path class="network-pulse" d="M'+a.join(' ')+' L'+b.join(' ')+'" pathLength="100"/></g>').join('');
  network.querySelector('.hotspot-layer').before(svg);
  const controllers=[create(document.querySelector('.hero-wheel'),'wheel'),create(network,'network')];
  function create(canvas,type){
    const buttons=[...canvas.querySelectorAll('.diagram-hotspot')];
    const lines=[...canvas.querySelectorAll('.network-spoke')];
    lines.forEach((line,index)=>line.style.setProperty('--spoke-order',index));
    const state={canvas,type,buttons,lines,visible:false,elapsed:0,held:false,resumeAt:0,auto:-1};
    buttons.forEach((button,index)=>{
      button.style.setProperty('--node-order',index);
      const hold=()=>{
        state.held=true;canvas.classList.add('motion-held');
        buttons.forEach(item=>item.classList.toggle('interaction-active',item===button));
        lines.forEach((line,i)=>line.classList.toggle('interaction-active',i===index));
      };
      button.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')hold();});
      button.addEventListener('pointerleave',()=>queueMicrotask(release));
      button.addEventListener('focus',hold);
      button.addEventListener('click',()=>{hold();release();});
    });
    function release(){
      // Retain the emphasis while a pointer or keyboard focus is still on a node.
      if(buttons.some(button=>button.matches(':hover,:focus-visible')))return;
      state.held=false;state.resumeAt=performance.now()+1000;
    }
    canvas.addEventListener('pointerleave',release);
    canvas.addEventListener('focusout',()=>queueMicrotask(release));
    return state;
  }
  let frame=0,last=0;
  function clearInteraction(state){
    state.canvas.classList.remove('motion-held');
    [...state.buttons,...state.lines].forEach(item=>item.classList.remove('interaction-active'));
  }
  function tick(now){
    const delta=last?Math.min(now-last,100):0;last=now;
    controllers.forEach(state=>{
      if(!state.visible)return;
      if(state.held||now<state.resumeAt)return;
      clearInteraction(state);
      state.elapsed+=delta;
      // Wheel begins at the rightmost orbit point, moving clockwise.
      const index=state.type==='wheel'?[1,2,3,4,5,0][Math.floor((state.elapsed%14000)/14000*6)]:Math.floor(state.elapsed/1000)%7;
      if(state.auto!==index){
        state.auto=index;
        [...state.buttons,...state.lines].forEach(item=>item.classList.remove('auto-active'));
        state.buttons[index].classList.add('auto-active');
        if(state.lines[index])state.lines[index].classList.add('auto-active');
      }
    });
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    cancelAnimationFrame(frame);frame=0;last=0;
    const allowed=!reduced.matches&&!document.hidden;
    controllers.forEach(state=>state.canvas.classList.toggle('motion-off',!allowed||!state.visible));
    if(allowed&&controllers.some(state=>state.visible))frame=requestAnimationFrame(tick);
  }
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      const state=controllers.find(item=>item.canvas===entry.target);
      state.visible=entry.isIntersecting;
      if(state.visible&&!reduced.matches)state.canvas.classList.add('motion-entered');
    });
    sync();
  },{threshold:0});
  controllers.forEach(state=>observer.observe(state.canvas));
  reduced.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
}
