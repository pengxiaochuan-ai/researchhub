import React from 'react';
import {Button} from './Components.jsx';
import {FULL_STUDY_SOURCE_MESSAGE} from '../../src/full-study-ui-session.js';
export default function FullStudySourceRecovery({sourceError,pending=false,disabled,onPreview}){return <>{sourceError&&<p className="ep-error" role="alert">{FULL_STUDY_SOURCE_MESSAGE}</p>}{sourceError&&pending&&<p>将先归档保留旧未决标记，再仅预览最新来源。</p>}<Button disabled={disabled} onClick={onPreview}>{sourceError?'预览最新来源':'核对快照来源'}</Button></>;}
