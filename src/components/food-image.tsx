import { useState, type ImgHTMLAttributes } from "react";
import { assetUrl } from "@/lib/client";
export function PublicImage({src,alt,priority,fill,style,...props}:Omit<ImgHTMLAttributes<HTMLImageElement>,"src"|"alt">&{src:string;alt:string;priority?:boolean;fill?:boolean}){
  const [failed,setFailed]=useState(false);
  return <img {...props} src={assetUrl(failed?'/images/chicken-inasal.webp':src)} alt={failed?`Illustrative meal image for ${alt}`:alt} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':undefined} decoding="async" style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}:{}),...style}} onError={()=>setFailed(true)}/>;
}
