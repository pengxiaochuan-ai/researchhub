import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom',logLevel:'error'});
after(()=>server.close());
const {Shell}=await server.ssrLoadModule('/pages/shared/Shell.jsx');
const render=stableSlots=>renderToStaticMarkup(React.createElement(Shell,{active:'科研资产',hero:{title:'知识资料'},stableSlots},React.createElement('p',null,'既有业务区域')));
test('K01 stable shell leaves empty React-owned containers for imperative navigation',()=>{
 const markup=render(true);
 assert.match(markup,/<div data-platform-header-slot="true" data-platform-react-slot="true"><\/div>/);
 assert.match(markup,/<div data-platform-sidebar-slot="true" data-platform-react-slot="true"><\/div>/);
 assert(!markup.includes('class="platform-side"'));
 assert(markup.includes('既有业务区域'));
});
test('other Shell consumers keep their existing legacy navigation by default',()=>{
 const markup=render(undefined);
 assert(markup.includes('class="platform-side"'));
 assert(!markup.includes('data-platform-react-slot'));
});
