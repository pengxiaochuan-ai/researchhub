// Observe the visible frame/section, never a negatively positioned source sheet.
const pending=new Map();
let observer;
export function whenSectionNear(frame,load){
 queueMicrotask(()=>{
  const section=frame.closest?.('section')??frame;
  if(section.id==='home'||typeof IntersectionObserver==='undefined'){load();return;}
  if(!observer)observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const jobs=pending.get(entry.target)??[];pending.delete(entry.target);observer.unobserve(entry.target);jobs.forEach(fn=>fn());}},{rootMargin:'240px'});
  const jobs=pending.get(section)??[];jobs.push(load);pending.set(section,jobs);observer.observe(section);
 });
}
