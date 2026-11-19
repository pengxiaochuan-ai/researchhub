export function runtimeBodyKind(method,path,type){
 if(!['POST','PUT','PATCH','DELETE'].includes(method))return'none';
 if(/^application\/json(?:\s*;.*)?$/i.test(type??''))return'json';
 const pathname=String(path).split('?')[0];
 if(method==='POST'&&['/api/knowledge/docs/import','/api/research-assets/uploads'].includes(pathname)&&/^multipart\/form-data\s*;\s*boundary=.{1,200}$/i.test(type??''))return'multipart';
 return'rejected';
}
