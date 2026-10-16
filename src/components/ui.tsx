"use client";
import { useEffect, useRef, useId, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { LoaderCircle, X } from "lucide-react";
export function Button({children,variant="primary",className="",...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:"primary"|"secondary"|"ghost"|"danger"}){return <button className={`button ${variant!=="primary"?`button-${variant}`:""} ${className}`} {...props}>{children}</button>;}
export function Input(props:InputHTMLAttributes<HTMLInputElement>){return <input {...props} className={`input ${props.className||""}`}/>;}
export function Select(props:SelectHTMLAttributes<HTMLSelectElement>){return <select {...props} className={`select ${props.className||""}`}/>;}
export function Field({label,htmlFor,children,hint}:{label:string;htmlFor?:string;children:ReactNode;hint?:string}){return <div className="field"><label htmlFor={htmlFor}>{label}</label>{children}{hint&&<small>{hint}</small>}</div>;}
export function Card({children,className=""}:{children:ReactNode;className?:string}){return <div className={`card ${className}`}>{children}</div>;}
export function Notice({children,type="notice"}:{children:ReactNode;type?:"error"|"success"|"notice"}){return <div role={type==="error"?"alert":"status"} className={type}>{children}</div>;}
export function Spinner({label="Loading…"}:{label?:string}){return <span role="status" style={{display:"inline-flex",alignItems:"center",gap:8}}><LoaderCircle className="spinner" size={18}/>{label}</span>;}
export function PageHeading({title,description,eyebrow,children}:{title:string;description?:string;eyebrow?:string;children?:ReactNode}){return <div className="page-heading">{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description&&<p>{description}</p>}{children}</div>;}
export function EmptyState({title,description,children}:{title:string;description?:string;children?:ReactNode}){return <div className="empty-state"><h2>{title}</h2>{description&&<p>{description}</p>}{children}</div>;}
export function Modal({open,onClose,title,children,drawer=false}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;drawer?:boolean}){
  const ref=useRef<HTMLDialogElement>(null);const label=useId();
  useEffect(()=>{const dialog=ref.current;if(!dialog)return;const previous=document.activeElement as HTMLElement|null;if(open&&!dialog.open)dialog.showModal();if(!open&&dialog.open)dialog.close();return ()=>{if(open){dialog.close();previous?.focus();}};},[open]);
  return <dialog ref={ref} className={`app-dialog ${drawer?"drawer":""}`} aria-labelledby={label} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}><div className="dialog-header"><h2 id={label}>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div><div className="dialog-body">{children}</div></dialog>;
}
