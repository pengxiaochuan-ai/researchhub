import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const server=await createServer({configFile:false,plugins:[react()],optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
after(()=>server.close());
test('the original report action is offered only for the permitted admin fixed source, not other reports or researchers',async()=>{
 const {default:View}=await server.ssrLoadModule('/pages/shared/ReportAssetRegistration.jsx');
 const user={tenantId:'rh-kb-local-b0e2af9d-tenant',accountId:'rh-kb-local-b0e2af9d-admin',authVersion:5,role:'tenant_admin'},report={artifactId:'rh-formal-report-adc609b3-0d50-4176-9e63-c5a6d5c390fe',versionNo:1,status:'released',contentHash:'668c2f336806db23e8aa19bbbb1823f18c8f1d4e7cb1d5c05ea7cb6fc52a8d2b'},studyId='rh-study-72203d59-4db8-4e74-9444-edff3b088b6d';
 const show=props=>renderToStaticMarkup(React.createElement(View,props));
 assert(show({user,studyId,report}).includes('登记为科研资产'));
 for(const props of [{user:null,studyId,report},{user:{...user,accountId:'rh-kb-local-b0e2af9d-owner',role:'researcher'},studyId,report},{user,studyId,report:{...report,status:'in_review'}},{user,studyId:'another',report}])assert(!show(props).includes('登记为科研资产'));
 assert(!show({user,studyId,report}).includes('创建云资源'));
});
