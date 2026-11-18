import React from 'react';
import {Button} from './Components.jsx';
import './governance-section-header.css';

export default function GovernanceSectionHeader({title,description,headingRef,backHref='/pages/g02/',backLabel='返回治理总览',onBack,disabled=false}){
 return <header className="governance-section-header">
  <div className="governance-section-heading"><h2 ref={headingRef} tabIndex={headingRef?-1:undefined}>{title}</h2>{description&&<p>{description}</p>}</div>
  {onBack?<Button className="governance-section-back" disabled={disabled} onClick={onBack}>{backLabel}</Button>:<a className="governance-section-back" href={backHref}>{backLabel}</a>}
 </header>;
}
