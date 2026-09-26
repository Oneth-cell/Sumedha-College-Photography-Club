'use client';
import {useState} from 'react';
import {Heart,MessageCircle,Star,Send} from 'lucide-react';
import VideoPlayer from './VideoPlayer';

type Item={id:number;kind:'image'|'video';title:string;description:string;media_url:string;poster_url?:string|null;author:string;likes:number;rating:number|null;rating_count:number;comment_count:number;q1080?:string|null;q720?:string|null;q480?:string|null;weekly_best:number;comments?:any[]};
export default function GalleryCard({item,index=0}:{item:Item;index?:number}){
 const [likes,setLikes]=useState(Number(item.likes||0));const [liked,setLiked]=useState(false);const [rating,setRating]=useState<number|null>(null);const [avg,setAvg]=useState<number|null>(item.rating);const [openComments,setOpenComments]=useState(false);const [comments,setComments]=useState<any[]>(item.comments||[]);const [text,setText]=useState('');const [err,setErr]=useState('');
 async function like(){const r=await fetch('/api/gallery/like',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mediaId:item.id})});const d=await r.json();if(r.status===401){setErr('Please sign in to like this work.');return;}if(r.ok){setLiked(d.liked);setLikes(d.likes)}}
 async function rate(n:number){const r=await fetch('/api/gallery/rating',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mediaId:item.id,rating:n})});const d=await r.json();if(r.status===401){setErr('Please sign in to rate this work.');return;}if(r.ok){setRating(n);setAvg(d.rating)}}
 async function loadComments(){setOpenComments(v=>!v);if(!openComments && !comments.length){const r=await fetch(`/api/gallery/comments?mediaId=${item.id}`);const d=await r.json();if(r.ok)setComments(d.comments||[])}}
 async function comment(e:React.FormEvent){e.preventDefault();if(!text.trim())return;const r=await fetch('/api/gallery/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mediaId:item.id,body:text.trim()})});const d=await r.json();if(r.status===401){setErr('Please sign in to comment.');return;}if(r.ok){setComments(c=>[d.comment,...c]);setText('');setOpenComments(true)}}
 const variants={...(item.q1080?{'1080p':item.q1080}:{}),...(item.q720?{'720p':item.q720}:{}),...(item.q480?{'480p':item.q480}:{})};
 return <article className={`media-card ${index===0?'featured':''} reveal revealed`} style={{transitionDelay:`${index*.05}s`}}>
   {item.kind==='video'?<VideoPlayer src={item.media_url} poster={item.poster_url||undefined} variants={variants}/>:<img className="media-image" src={item.media_url} alt={item.title}/>} 
   <div className="media-overlay"><div className="media-title">{item.title}</div><div className="media-author">BY {String(item.author).toUpperCase()}{item.weekly_best? ' · WEEKLY BEST':''}</div>
    <div className="media-actions"><button className={`ghost-btn ${liked?'active':''}`} onClick={like}><Heart size={12} fill={liked?'currentColor':'none'}/> {likes}</button><button className="ghost-btn" onClick={loadComments}><MessageCircle size={12}/> {item.comment_count}</button><div className="stars">★★★★★</div><span style={{fontSize:9,color:'#aaa'}}>{avg??'—'}</span><div className="rating-picker">{[1,2,3,4,5].map(n=><button key={n} className={n<=(rating||0)?'on':''} onClick={()=>rate(n)} title={`Rate ${n}`}>★</button>)}</div></div>
    {openComments&&<div className="comments"><div style={{maxHeight:150,overflow:'auto'}}>{comments.map(c=><div className="comment-row" key={c.id}><div><b style={{fontSize:9}}>{c.author}</b><div style={{fontSize:10,color:'#c9c3b8',lineHeight:1.45}}>{c.body}</div><small>{new Date(c.createdAt).toLocaleString()}</small></div></div>)}{!comments.length&&<div style={{fontSize:9,color:'#66635e'}}>No comments yet.</div>}</div><form className="comment-form" onSubmit={comment}><input className="input" value={text} onChange={e=>setText(e.target.value)} placeholder="Write a comment..."/><button className="ghost-btn" type="submit"><Send size={11}/></button></form></div>}
    {err&&<div style={{fontSize:9,color:'#e0a1a1',marginTop:7}}>{err}</div>}
   </div>
 </article>
}
