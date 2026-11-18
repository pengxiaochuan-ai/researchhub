// Isolated browser fixture. No service or credential configuration is used.
import React from 'react';import{createRoot}from'react-dom/client';import RealAiWorkspace from'../../pages/shared/RealAiWorkspace.jsx';import'../../src/design-tokens.css';import'../../pages/ai01/src/style.css';
createRoot(document.getElementById('root')).render(<RealAiWorkspace/>);
