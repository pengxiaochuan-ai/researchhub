export const historyActionAllowed=(method,path)=>method==='PATCH'&&/^\/sessions\/[A-Za-z0-9_-]{1,160}\/history-action$/.test(path);
