import React from 'react';
import {createRoot} from 'react-dom/client';
import {WorkflowPage} from './WorkflowPages.jsx';
import '../../src/page-linking.js';
createRoot(document.getElementById('root')).render(<WorkflowPage/>);
