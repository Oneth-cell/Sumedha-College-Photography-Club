'use client';
import {useEffect,useState} from 'react';
import {Upload,MessageCircle,LogOut,Camera,Send,ShieldCheck} from 'lucide-react';
import MeetingCountdown from '@/components/MeetingCountdown';
import Tour from '@/components/Tour';

export default function LmsClient({user,tasks,meetings,submissions,announcements}:{user:any;tasks:any[];meetings:any[];submissions:any[];announcements:any[]}){
 const [tour,setTour]=useState(!user.lms_tour_seen);
 const [tab,setTab]=useState('dashboard');
 const [localTasks,setLocalTasks]=useState(tasks);
 const [profile,setProfile]=useState(user);
 const [msg,setMsg]=useState('');
 const [chatOpen,setChatOpen]=useState(false);
 const [messages,setMessages]=useState<any[]>([]);
 const [chatText,setChatText]=useState('');
 const [file,setFile]=useState<File|null>(null);
 const [desc,setDesc]=useState('');
 const [taskId,setTaskId]=useState('');
 const [uploadBusy,setUploadBusy]=useState(false);
 const [pfp,setPfp]=useState<string|null>(user.pfp_url);
 const [profileSaving,setProfileSaving]=useState(false);
 const nextMeeting=meetings[0];
 const progress=localTasks.length?Math.round(localTasks.filter(t=>t.done).length/localTasks.length*100):0;
 useEffect(()=>{if(chatOpen)loadChat()},[chatOpen]);
 async function completeTour(){setTour(false);await fetch('/api/onboarding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tour:'lms'})})}
 async function toggle(id:number,done:boolean){const r=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({taskId:id,done})});if(r.ok)setLocalTasks(ts=>ts.map(t=>t.id===id?{...t,done:done?1:0}:t))}
 async function upload(){
  if(!file || !desc.trim()){
    setMsg('Choose a ZIP and add a description.');
    return;
  }

  const MAX_ZIP_BYTES = 5 * 1024 * 1024 * 1024;

  if(file.size > MAX_ZIP_BYTES){
    setMsg('ZIP exceeds the 5 GB maximum.');
    return;
  }

  setUploadBusy(true);

  try{
    setMsg('Preparing secure upload?');

    const pRes = await fetch('/api/uploads/presign',{
      method:'POST',
      headers:{
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        filename:file.name,
        contentType:file.type || 'application/zip',
        folder:'submissions'
      })
    });

    const p = await pRes.json();

    if(!pRes.ok || !p.uploadUrl){
      throw new Error(
        p.error || 'Could not prepare the upload.'
      );
    }

    setMsg('Uploading ZIP directly to cloud storage?');

    const uploadRes = await fetch(
      p.uploadUrl,
      {
        method:'PUT',
        headers:{
          'Content-Type':
            file.type || 'application/zip'
        },
        body:file
      }
    );

    if(!uploadRes.ok){
      throw new Error('Cloud upload failed.');
    }

    setMsg(
      'Upload complete. Validating ZIP and creating submission?'
    );

    const processRes = await fetch(
      '/api/submissions/process',
      {
        method:'POST',
        headers:{
          'Content-Type':'application/json'
        },
        body:JSON.stringify({
          key:p.key,
          description:desc.trim(),
          taskId:taskId ? Number(taskId) : null
        })
      }
    );

    const d = await processRes.json();

    if(!processRes.ok){
      throw new Error(
        d.error || 'Submission processing failed.'
      );
    }

    setMsg(
      `Submission received. ${d.filesCount || 0} media files are pending admin review.`
    );

    setFile(null);
    setDesc('');
    setTaskId('');

    const el =
      document.getElementById(
        'submission-file'
      ) as HTMLInputElement | null;

    if(el){
      el.value = '';
    }

  }catch(e:any){
    setMsg(
      e?.message || 'Upload failed.'
    );
  }finally{
    setUploadBusy(false);
  }
} async function loadChat(){const r=await fetch('/api/chat');if(r.ok){const d=await r.json();setMessages(d.messages||[])}}
 async function sendChat(e:React.FormEvent){e.preventDefault();if(!chatText.trim())return;const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:chatText.trim()})});const d=await r.json();if(r.ok){setMessages(m=>[...m,d.message]);setChatText('')}}
 async function logout(){await fetch('/api/auth/logout',{method:'POST'});location.href='/' }
 function pickPfp(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024){setMsg('Profile picture must be JPG, PNG or WEBP and 5 MB or less.');return}setPfp(URL.createObjectURL(f));setProfile((p:any)=>({...p,pfp_file:f}))}
 async function saveProfile(){setProfileSaving(true);const fd=new FormData();fd.append('surname',profile.surname);fd.append('grade',profile.grade);fd.append('className',profile.class_name);fd.append('parentPhone',profile.parent_phone);fd.append('address',profile.address);if(profile.pfp_file)fd.append('pfp',profile.pfp_file);const r=await fetch('/api/profile',{method:'POST',body:fd});const d=await r.json();setProfileSaving(false);setMsg(r.ok?'Profile updated ✓':d.error||'Could not update profile');if(r.ok){setProfile((p:any)=>({...p,pfp_url:d.pfpUrl||p.pfp_url,pfp_file:undefined}));setPfp(d.pfpUrl||pfp)}}
 return <main className="page"><div className="container">
  <div className="section-head"><div><div className="kicker">Student LMS</div><h2>Welcome back,<br/>{user.full_name}.</h2></div><div style={{display:'flex',gap:7}}><button className="btn" onClick={()=>setChatOpen(true)}><MessageCircle size={14}/> Contact Admin</button><button className="btn" onClick={logout}><LogOut size={14}/> Sign out</button></div></div>
  <div className="grid-4"><div className="stat-box"><strong>{progress}%</strong><span>Task progress</span></div><div className="stat-box"><strong>{localTasks.filter(t=>t.done).length}/{localTasks.length}</strong><span>Tasks complete</span></div><div className="stat-box"><strong>{user.membership_type==='board'?'Board':'Member'}</strong><span>{user.board_position||'Club status'}</span></div><div className="stat-box"><strong>{submissions.length}</strong><span>Your submissions</span></div></div>
  <div className="section" style={{paddingBottom:30}}>
   <div className="crm-tabs"><button className={`tab ${tab==='dashboard'?'active':''}`} onClick={()=>setTab('dashboard')}>Dashboard</button><button className={`tab ${tab==='work'?'active':''}`} onClick={()=>setTab('work')}>Daily Work</button><button className={`tab ${tab==='upload'?'active':''}`} onClick={()=>setTab('upload')}>Upload Work</button><button className={`tab ${tab==='profile'?'active':''}`} onClick={()=>setTab('profile')}>My Profile</button><button className={`tab ${tab==='announcements'?'active':''}`} onClick={()=>setTab('announcements')}>Announcements</button></div>
   {tab==='dashboard'&&<DashboardView nextMeeting={nextMeeting} progress={progress}/>} 
   {tab==='work'&&<WorkView tasks={localTasks} toggle={toggle}/>} 
   {tab==='upload'&&<UploadView tasks={localTasks} taskId={taskId} setTaskId={setTaskId} desc={desc} setDesc={setDesc} file={file} setFile={setFile} upload={upload} uploadBusy={uploadBusy} msg={msg}/>} 
   {tab==='profile'&&<ProfileView user={user} profile={profile} setProfile={setProfile} pfp={pfp} pickPfp={pickPfp} saveProfile={saveProfile} profileSaving={profileSaving}/>} 
   {tab==='announcements'&&<div className="card card-pad"><div className="kicker">Club communication</div><h2 style={{margin:'7px 0 20px'}}>Announcements.</h2>{announcements.map(a=><div className="announcement-row" key={a.id}><div><strong style={{fontSize:11}}>{a.title}</strong><p className="soft" style={{fontSize:10,margin:'4px 0 0'}}>{a.body}</p></div><span style={{fontSize:8,color:'#666'}}>{new Date(a.createdAt).toLocaleDateString()}</span></div>)}</div>}
  </div>
  <div className="card card-pad" style={{marginTop:15}}><div className="kicker">Recent submissions</div><h3>My delivery history.</h3>{submissions.map(s=><div className="submission-row" key={s.id}><div><strong style={{fontSize:10}}>{s.task_title||'General submission'}</strong><div className="soft" style={{fontSize:9,marginTop:3}}>{s.description}</div></div><span className={`status ${s.status}`}>{s.status}</span></div>)}{!submissions.length&&<p className="soft" style={{fontSize:10}}>No submissions yet.</p>}</div>
 </div>{tour&&<Tour type="lms" title="Your LMS in 3 steps" steps={['Dashboard shows your next private meeting, countdown and direct Zoom room. Meetings are visible only after approval and login.','Daily Work contains tasks created by admins. Each task can require photos, videos or both, and you can mark completed work.','Upload Work is the delivery room: ZIP only, max 5 GB, photos under 50 MB, videos up to 4 GB, and every submission needs a description. My Profile lets you update basic details and your picture.']} onComplete={completeTour}/>}<Chat open={chatOpen} close={()=>setChatOpen(false)} openChat={()=>setChatOpen(true)} messages={messages} text={chatText} setText={setChatText} send={sendChat}/></main>
}
function DashboardView({nextMeeting,progress}:{nextMeeting:any;progress:number}){return <div className="dashboard-grid"><div className="card card-pad"><span className="kicker">Next private meeting</span>{nextMeeting?<><h3 style={{fontSize:29,margin:'10px 0 6px'}}>{nextMeeting.title}</h3><p className="soft" style={{fontSize:11}}>{nextMeeting.agenda}</p><div style={{marginTop:15}}><MeetingCountdown startTime={nextMeeting.startTime}/><div style={{fontSize:9,color:'#6c6862',margin:'4px 0 10px'}}>{new Date(nextMeeting.startTime).toLocaleString()}</div><a className="btn primary" href={nextMeeting.zoomUrl} target="_blank">Join Zoom ↗</a></div></>:<div className="notice" style={{marginTop:15}}>No meeting has been published yet.</div>}</div><div className="card card-pad"><span className="kicker">Your learning rhythm</span><h3 style={{fontSize:27,margin:'10px 0'}}>Keep the streak alive.</h3><p className="soft" style={{fontSize:11}}>Finish tasks, submit your assigned work and keep your profile current.</p><div style={{marginTop:18,height:8,borderRadius:99,background:'#202020',overflow:'hidden'}}><div style={{height:'100%',width:`${progress}%`,background:'linear-gradient(90deg,#d6b76b,#eed18c)'}}/></div><div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#777',marginTop:6}}><span>Weekly progress</span><span>{progress}%</span></div></div></div>}
function WorkView({tasks,toggle}:{tasks:any[];toggle:(id:number,done:boolean)=>void}){return <div className="card card-pad"><div className="section-head" style={{marginBottom:14}}><div><div className="kicker">Admin-assigned</div><h2>Daily work.</h2></div><span className="soft" style={{fontSize:10}}>{tasks.length} tasks</span></div>{tasks.map(t=><div className="task-row" key={t.id}><div style={{display:'flex',gap:10,alignItems:'center'}}><input type="checkbox" className="check-box" checked={!!t.done} onChange={e=>toggle(t.id,e.target.checked)}/><div><strong style={{fontSize:11}}>{t.title}</strong><div className="soft" style={{fontSize:9,marginTop:3}}>{t.description}</div><div style={{fontSize:8,color:'#666',marginTop:4}}>Due: {t.due_date||'No deadline'} · Upload: {t.upload_type.toUpperCase()}</div></div></div><span className={`status ${t.done?'approved':'pending'}`}>{t.done?'Done':'Open'}</span></div>)}</div>}
function UploadView({tasks,taskId,setTaskId,desc,setDesc,file,setFile,upload,uploadBusy,msg}:{tasks:any[];taskId:string;setTaskId:(v:string)=>void;desc:string;setDesc:(v:string)=>void;file:File|null;setFile:(v:File|null)=>void;upload:()=>void;uploadBusy:boolean;msg:string}){return <div className="grid-2"><div className="card card-pad"><div className="kicker">Submission rules</div><h3 style={{fontSize:30,margin:'8px 0'}}>One ZIP. One description.</h3><p className="soft" style={{fontSize:11,lineHeight:1.7}}>Every assigned upload is a ZIP submission. Maximum ZIP size is <b>5 GB</b>. Each photo must be under <b>50 MB</b>. Each video must be <b>4 GB or less</b>. A description is required for every submission.</p><div className="approval" style={{marginTop:15}}>The server checks file types, ZIP safety, per-file size limits and task media type before accepting the submission.</div></div><div className="card card-pad"><span className="kicker">Upload work</span><form className="form" onSubmit={e=>{e.preventDefault();upload()}}><div className="field"><label>Task</label><select className="input" value={taskId} onChange={e=>setTaskId(e.target.value)}><option value="">General / no task</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.title} · {t.upload_type}</option>)}</select></div><div className="field"><label>Description *</label><textarea className="input" required value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Describe what you captured, edited or delivered..."/></div><div className="field"><label>ZIP file *</label><input id="submission-file" className="input" type="file" accept=".zip,application/zip" onChange={e=>setFile(e.target.files?.[0]||null)} required/><small className="soft">Maximum 5 GB · {file?`${(file.size/1024/1024).toFixed(1)} MB selected`:''}</small></div><button className="btn primary" disabled={uploadBusy}><Upload size={14}/>{uploadBusy?'Uploading…':'Submit for admin review'}</button>{msg&&<div className="notice">{msg}</div>}</form></div></div>}
function ProfileView({user,profile,setProfile,pfp,pickPfp,saveProfile,profileSaving}:{user:any;profile:any;setProfile:any;pfp:string|null;pickPfp:any;saveProfile:()=>void;profileSaving:boolean}){return <div className="profile-grid"><div className="card card-pad"><div className="profile-identity"><div className="profile-photo-wrap"><div className="profile-photo">{pfp?<img src={pfp} alt="Profile"/>:<Camera size={22}/>}</div><button className="camera-btn" onClick={()=>document.getElementById('pfp-input')?.click()}>✎</button><input id="pfp-input" type="file" accept="image/jpeg,image/png,image/webp" style={{display:'none'}} onChange={pickPfp}/></div><div><div style={{fontSize:18,fontWeight:750}}>{user.full_name}</div><div className="soft" style={{fontSize:9,marginTop:4}}>{user.membership_type==='board'?'Board':'Member'} · {user.board_position||'General Member'}</div><span className="profile-tag"><ShieldCheck size={10}/> Admin verified</span></div></div><div className="profile-stats"><div className="pstat"><b>{user.grade}</b><small>Grade</small></div><div className="pstat"><b>{user.class_name}</b><small>Class</small></div><div className="pstat"><b>{user.email}</b><small>Email</small></div><div className="pstat"><b>Editable</b><small>Basic details</small></div></div></div><div className="card card-pad"><span className="kicker">Editable basic details</span><h3>Edit profile.</h3><div className="form-grid" style={{marginTop:17}}><div className="field"><label>Surname</label><input className="input" value={profile.surname} onChange={e=>setProfile({...profile,surname:e.target.value})}/></div><div className="field"><label>Grade</label><select className="input" value={profile.grade} onChange={e=>setProfile({...profile,grade:e.target.value})}>{Array.from({length:8},(_,i)=><option key={i}>Grade {i+6}</option>)}</select></div><div className="field"><label>Class</label><input className="input" value={profile.class_name} onChange={e=>setProfile({...profile,class_name:e.target.value})}/></div><div className="field"><label>Parent / guardian phone</label><input className="input" value={profile.parent_phone} onChange={e=>setProfile({...profile,parent_phone:e.target.value})}/></div><div className="field full"><label>Address</label><textarea className="input" value={profile.address} onChange={e=>setProfile({...profile,address:e.target.value})}/></div><div className="field"><label>Email</label><input className="input" value={profile.email} readOnly/></div><div className="field"><label>Membership</label><input className="input" value={user.membership_type==='board'?`Board · ${user.board_position}`:'Member'} readOnly/></div></div><div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}><button className="btn primary" disabled={profileSaving} onClick={saveProfile}>{profileSaving?'Saving…':'Save profile'}</button></div></div></div>}
function Chat({open,close,openChat,messages,text,setText,send}:{open:boolean;close:()=>void;openChat:()=>void;messages:any[];text:string;setText:(s:string)=>void;send:(e:React.FormEvent)=>void}){
 if(!open){
  return <button className="chat-fab" onClick={openChat} title="Contact Admin"><MessageCircle size={20}/></button>;
 }
 return <div className="chat-drawer">
  <div className="chat-head">
   <div><b style={{fontSize:11}}>Contact Admin</b><div style={{fontSize:8,color:'#666'}}>Club support chat</div></div>
   <button className="icon-btn" onClick={close}>×</button>
  </div>
  <div className="chat-body">
   {messages.map(m=><div className={m.sender_role==='student'?'chat-msg me':'chat-msg'} key={m.id}>{m.message}<div style={{fontSize:7,opacity:.6,marginTop:3}}>{new Date(m.createdAt).toLocaleString()}</div></div>)}
   {!messages.length&&<div style={{color:'#666',fontSize:9}}>Send a message to the club admin.</div>}
  </div>
  <form className="chat-input" onSubmit={send}>
   <input className="input" value={text} onChange={e=>setText(e.target.value)} placeholder="Type your message..."/>
   <button className="btn primary" type="submit"><Send size={13}/></button>
  </form>
 </div>;
}
