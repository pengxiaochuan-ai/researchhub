export async function closeRuntimeResources({foundation,accounts,app,prisma}){
 let failed=false,appClosed=false;
 try{foundation?.stop();}catch{failed=true;}
 try{await accounts?.close();}catch{failed=true;}
 if(app){try{await app.close();appClosed=true;}catch{failed=true;}}
 if(!appClosed){try{await prisma?.onModuleDestroy?.();}catch{failed=true;}}
 if(failed)throw Error('RESEARCH_RUNTIME_SHUTDOWN_FAILED');
}
