import React from 'react';
import PublicActivity from './PublicActivity.jsx';

export default function HubSourceCatalog({hubKey='lingshu-xinyu'}){
 return <article className="hub-card real-hub-publications" data-scroll-preview><header><h2>领域动态</h2><a href="/pages/e01/">研究论文</a></header><PublicActivity hubKey={hubKey} limit={6}/></article>;
}
