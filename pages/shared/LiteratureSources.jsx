import React from 'react';
import {literatureSourceLinks} from '../../src/literature-source-links.js';
export default function LiteratureSources({evidence}){
 return <>{literatureSourceLinks(evidence).map(source=><p key={source.id}>{source.href?<a href={source.href} target={source.external?'_blank':undefined} rel={source.external?'noopener noreferrer':undefined}>{source.title}</a>:<span>{source.title}</span>} · {source.label}</p>)}</>;
}
