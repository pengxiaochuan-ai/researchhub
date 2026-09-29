import React from 'react';
import { createRoot } from 'react-dom/client';
import { HubCreate } from '../../shared/HubCreate.jsx';

createRoot(document.getElementById('root')).render(<HubCreate step={3} />);
