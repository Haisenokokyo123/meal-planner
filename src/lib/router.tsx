import { forwardRef, useEffect, useMemo, type AnchorHTMLAttributes, type ReactNode } from "react";
import { Link as RouterLink, useLocation, useNavigate, useParams as routerParams } from "react-router-dom";

export const Link = forwardRef<HTMLAnchorElement, Omit<AnchorHTMLAttributes<HTMLAnchorElement>,"href">&{href:string;children?:ReactNode;prefetch?:boolean;replace?:boolean}>(function Link({href,children,prefetch:_prefetch,replace,...props},ref){
  if (/^(https?:|mailto:|tel:)/.test(href)) return <a href={href} ref={ref} {...props}>{children}</a>;
  return <RouterLink to={href} ref={ref} replace={replace} {...props}>{children}</RouterLink>;
});
export default Link;
export function useRouter(){const navigate=useNavigate();return useMemo(()=>({push:(path:string)=>navigate(path),replace:(path:string)=>navigate(path,{replace:true}),back:()=>navigate(-1),refresh:()=>window.location.reload()}),[navigate]);}
export function usePathname(){return useLocation().pathname;}
export function useSearchParams(){return new URLSearchParams(useLocation().search);}
export function useParams<T extends Record<string,unknown> = Record<string,string>>():T{const params=routerParams();return {...params,...(params["*"]!==undefined?{section:params["*"].split("/").filter(Boolean)}:{})} as unknown as T;}
export function ScrollToTop(){const {pathname}=useLocation();useEffect(()=>{window.scrollTo({top:0,behavior:"instant"});},[pathname]);return null;}
