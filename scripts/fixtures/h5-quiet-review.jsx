import React from 'react';
import {createRoot} from 'react-dom/client';
import useQuestionnaireH5 from '../../pages/shared/useQuestionnaireH5.js';

function Probe(){
 const session=useQuestionnaireH5('z'.repeat(43));
 window.__h5Review=session;
 window.__h5ReviewState={status:session.view?.status??null,answers:session.answers,busy:session.busy,verified:session.verified,error:session.error,pending:session.pending,notice:session.notice,dirty:session.dirty};
 return <pre>{JSON.stringify(window.__h5ReviewState,null,2)}</pre>;
}
createRoot(document.getElementById('root')).render(<Probe/>);
