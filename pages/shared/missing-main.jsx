import React from 'react';
import { createRoot } from 'react-dom/client';
import { S02, S03, S04, S05, S06 } from './StudyPages.jsx';
import { A01, A02, G01, G02, O01, O02, Q01 } from './BusinessPages.jsx';
import './missing-pages.css';
import './layout-overrides.css';
import './g02.css';
import './layout-practice.css';
import '../../src/page-linking.js';

const pages = { s02: S02, s03: S03, s04: S04, s05: S05, s06: S06, q01: Q01, g01: G01, g02: G02, o01: O01, o02: O02, a01: A01, a02: A02 };
const pageId = window.location.pathname.match(/\/pages\/([^/]+)/)?.[1] ?? 'q01';
const Page = pages[pageId] ?? Q01;

document.documentElement.dataset.page = pageId;

createRoot(document.getElementById('root')).render(<Page/>);
