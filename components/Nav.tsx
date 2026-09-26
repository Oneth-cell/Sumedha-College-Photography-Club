'use client';
import Link from 'next/link';
import {Menu, X, LogIn, UserPlus, LayoutDashboard} from 'lucide-react';
import {useEffect,useState} from 'react';
export default function Nav(){
 const [open,setOpen]=useState(false); const [session,setSession]=useState<any>(null);
 useEffect(()=>{fetch('/api/me').then(r=>r.ok?r.json():null).then(setSession).catch(()=>{})},[]);
 const links=[['Gallery','/gallery'],['Events','/events'],['Board','/board']];
 return <header className="site-nav"><div className="container nav-inner">
  <Link href="/" className="logo-link"><img src="/logo-white.png" className="site-logo" alt="Sumedha College Photography Club"/></Link>
  <nav className={open?'nav-links mobile-open':'nav-links'}>{links.map(([t,h])=><Link key={h} href={h} onClick={()=>setOpen(false)}>{t}</Link>)}{session&&<Link href="/lms" onClick={()=>setOpen(false)}>LMS</Link>}{session?.role==='admin'&&<Link href="/admin" onClick={()=>setOpen(false)}>CRM</Link>}</nav>
  <div className="nav-actions">{session?<Link className="btn" href="/lms"><LayoutDashboard size={15}/>My LMS</Link>:<><Link className="btn" href="/login"><LogIn size={15}/>Student Login</Link><Link className="btn primary" href="/register"><UserPlus size={15}/>Join Club</Link></>}</div>
  <button className="mobile-menu" onClick={()=>setOpen(v=>!v)} aria-label="Menu">{open?<X/>:<Menu/>}</button>
 </div></header>
}
