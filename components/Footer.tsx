'use client';
import {useEffect,useState} from 'react';
import {ArrowRight} from 'lucide-react';
export default function Footer(){const [email,setEmail]=useState('');const [msg,setMsg]=useState('');const [settings,setSettings]=useState<any>({});useEffect(()=>{fetch('/api/settings/public').then(r=>r.json()).then(setSettings).catch(()=>{})},[]);
 async function submit(e:React.FormEvent){e.preventDefault();const r=await fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const d=await r.json();setMsg(r.ok?'Subscribed ✓':d.error||'Could not subscribe');if(r.ok)setEmail('')}
 return <footer className="site-footer"><div className="container footer-grid">
  <div><img src="/logo-white.png" className="footer-logo" alt="Sumedha College Photography Club"/><p>Capture. Create. Collaborate.<br/>A digital home for the Sumedha College Photography Club.</p><small>{settings.copyright_text||"© 2026 Oneth Wickramaraachchi. All rights reserved."}</small></div>
  <div><span className="kicker">Social channels</span><div className="social-grid"><a className="social-pill" href={settings.instagram_url||"https://instagram.com/"} target="_blank">Instagram ↗</a><a className="social-pill" href={settings.facebook_url||"https://facebook.com/"} target="_blank">Facebook ↗</a><a className="social-pill" href={settings.youtube_url||"https://youtube.com/"} target="_blank">YouTube ↗</a><a className="social-pill" href={settings.tiktok_url||"https://tiktok.com/"} target="_blank">TikTok ↗</a></div></div>
  <div><span className="kicker">Club updates</span><p>Meeting alerts, events and Weekly Best updates.</p><form className="email-box" onSubmit={submit}><input className="input" type="email" required placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)}/><button className="btn primary" type="submit"><ArrowRight size={15}/></button></form>{msg&&<small>{msg}</small>}</div>
 </div></footer>}
