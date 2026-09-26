'use client';
import {useEffect,useRef} from 'react';
export default function Reveal({children,delay=0,className=''}:{children:React.ReactNode;delay?:number;className?:string}){
 const ref=useRef<HTMLDivElement>(null);useEffect(()=>{const el=ref.current;if(!el)return;const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){(e.target as HTMLElement).classList.add('revealed');io.unobserve(e.target)}})},{threshold:.12});io.observe(el);return()=>io.disconnect()},[]);
 return <div ref={ref} className={`reveal ${className}`} style={{transitionDelay:`${delay}s`}}>{children}</div>
}
