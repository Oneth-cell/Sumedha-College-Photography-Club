'use client';
import {useState} from 'react';
export default function Tour({type,title,steps,onComplete}:{type:'register'|'lms';title:string;steps:string[];onComplete?:()=>void}){
 const [show,setShow]=useState(true);const [index,setIndex]=useState(0);if(!show)return null;
 function finish(){setShow(false);onComplete?.()}
 return <div className="tour-backdrop"><div className="tour-card"><div className="tour-top"><span className="kicker">{type==='register'?'WELCOME':'FIRST TIME IN YOUR LMS'}</span><button className="icon-btn" onClick={finish}>×</button></div><div className="tour-num">0{index+1}</div><h3>{title}</h3><p>{steps[index]}</p><div className="tour-dots">{steps.map((_,i)=><span key={i} className={i===index?'on':''}/>)}</div><div className="tour-actions">{index>0&&<button className="btn" onClick={()=>setIndex(i=>i-1)}>Back</button>}{index<steps.length-1?<button className="btn primary" onClick={()=>setIndex(i=>i+1)}>Next</button>:<button className="btn primary" onClick={finish}>Start using it</button>}</div></div></div>
}
