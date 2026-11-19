import React from 'react';
import {createRoot} from 'react-dom/client';
import PublicLayout from '../shared/PublicLayout.jsx';
import PublicAcademic from '../shared/PublicAcademic.jsx';

createRoot(document.getElementById('root')).render(<PublicLayout page="p011"><PublicAcademic/></PublicLayout>);
