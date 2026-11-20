import React,{useEffect,useRef}from'react';

function release(node){
 if(!node)return;
 try{node.pause();node.removeAttribute('src');node.load();}catch{}
}

export function OriginalAudio({src,label,autoPlay=false,onError}){
 const ref=useRef(null);
 useEffect(()=>{const node=ref.current;return()=>release(node);},[src]);
 return <audio key={src} ref={ref} src={src} controls autoPlay={autoPlay} preload="metadata" aria-label={label} onError={event=>{release(event?.currentTarget??ref.current);onError?.();}}/>;
}
