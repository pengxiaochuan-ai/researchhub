import React from 'react';
import { createRoot } from 'react-dom/client';
import { HubHome } from '../../shared/HubHome.jsx';
import { RealHubDirectory } from '../../shared/RealHub.jsx';
import { isHubSourceRealMode } from '../../../src/hub-source-api.js';

createRoot(document.getElementById('root')).render(isHubSourceRealMode() ? <RealHubDirectory /> : <HubHome />);
