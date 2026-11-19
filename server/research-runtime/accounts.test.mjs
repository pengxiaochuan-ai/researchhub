import test from'node:test';import assert from'node:assert/strict';import{runtimeReaderRoleAllowed,runtimeCaptureSettings,disabledMailAccounts,disabledMailInvitations}from'./accounts.mjs';
test('runtime invitations never accept an editing, admin or foreign-scope reader role',()=>{
 const role={dataScope:'group',menuPermissions:['workbench','knowledge','artifacts'],buttonPermissions:['artifact.read']};assert(runtimeReaderRoleAllowed(role));
 for(const change of [{dataScope:'tenant'},{menuPermissions:['group_admin']},{buttonPermissions:['artifact.create']},{buttonPermissions:['*']},{menuPermissions:['*']}])assert.equal(runtimeReaderRoleAllowed({...role,...change}),false);
});
test('explicitly disabled mail rejects before challenge or invitation writes and retains profile actions',async()=>{
 let writes=0;const write=()=>{writes++;},readProfile=()=>({displayName:'Current user'}),updateProfile=()=>({saved:true});
 const accounts=disabledMailAccounts({requestRegistration:write,requestReset:write,confirmRegistration:write,confirmReset:write,readProfile,updateProfile});
 for(const key of ['requestRegistration','requestReset','confirmRegistration','confirmReset'])assert.throws(()=>accounts[key]({},{}),e=>e.status===503&&e.code==='HUB_MAIL_NOT_CONFIGURED');
 for(const fn of Object.values(disabledMailInvitations()))assert.throws(()=>fn({},{}),e=>e.status===503&&e.code==='HUB_MAIL_NOT_CONFIGURED');
 assert.equal(accounts.readProfile,readProfile);assert.equal(accounts.updateProfile,updateProfile);assert.equal(writes,0);
});
test('rehearsal mail accepts only explicit isolated loopback capture configuration',()=>{
 const env={HUB_MAIL_MODE:'capture',HUB_MAIL_DATA_DIR:'/tmp/rh-owned-mail',HUB_CAPTURE_SMTP_PORT:'19656',HUB_CAPTURE_INBOX_PORT:'19657'},origin='http://127.0.0.1:19611';assert.equal(runtimeCaptureSettings(env,origin).smtpPort,19656);
 for(const change of [{HUB_MAIL_MODE:'smtp'},{HUB_MAIL_DATA_DIR:'../mail'},{HUB_CAPTURE_SMTP_PORT:'19506'},{HUB_CAPTURE_INBOX_PORT:'19656'}])assert.throws(()=>runtimeCaptureSettings({...env,...change},origin));assert.throws(()=>runtimeCaptureSettings(env,'https://remote.example.org'));
});
