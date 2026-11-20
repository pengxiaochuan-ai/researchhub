import React from 'react';

export default class PublicPageBoundary extends React.Component {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){
  if(this.state.failed)return <section role="alert"><h2>页面暂时无法加载</h2><p>请检查网络连接后重新加载。</p><button type="button" className="ls-secondary" onClick={()=>window.location.reload()}>重新加载页面</button></section>;
  return this.props.children;
 }
}
