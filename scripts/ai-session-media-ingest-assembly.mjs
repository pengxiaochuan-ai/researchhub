// Registration is additive: configuration failures must not stop video archive/playback.
export async function assembleMediaRegistration({create,options,log=console.warn}){
 try{return{...await create(options),status:'available'};}
 catch{
  log('MEDIA_INGEST_REGISTRATION_UNAVAILABLE');
  return{Controllers:[],service:null,limitedReadInTx:undefined,status:'unavailable'};
 }
}
