'use client';
import {useEffect,useState} from 'react';
export default function IntroLoader(){const [show,setShow]=useState(true);const [value,setValue]=useState(0);
 useEffect(()=>{const seen=sessionStorage.getItem('spc_intro_seen');if(seen){setShow(false);return;}let n=0;const t=setInterval(()=>{n=Math.min(100,n+5);setValue(n);if(n>=100){clearInterval(t);sessionStorage.setItem('spc_intro_seen','1');setTimeout(()=>setShow(false),500)}},55);return()=>clearInterval(t)},[]);
 if(!show)return null;return <div className="intro-loader"><div className="intro-inner"><div className="intro-line"></div><img src="/logo-white.png" alt="Sumedha College Photography Club" className="intro-logo"/><div className="intro-progress"><span style={{width:`${value}%`}}/></div><div className="intro-meta"><span>SUMEDHA COLLEGE</span><span>{String(value).padStart(3,'0')}</span></div></div></div>}
