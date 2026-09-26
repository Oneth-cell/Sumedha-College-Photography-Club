import {NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/auth';
import db from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

async function removePublicUpload(url?: string | null) {
  if (!url || !url.startsWith('/uploads/')) return;
  const root = path.resolve(process.cwd(), 'public', 'uploads');
  const target = path.resolve(process.cwd(), 'public', url.replace(/^\/+/, ''));
  if (target !== root && !target.startsWith(root + path.sep)) return;
  await fs.rm(target, {force:true}).catch(()=>{});
}

export async function GET(){
  try {
    await requireAdmin();
    const submissions=db.prepare(`SELECT s.id,s.description,s.zip_size as zipSize,s.status,s.created_at as createdAt,u.full_name as student,t.title as taskTitle,t.upload_type as uploadType FROM submissions s JOIN users u ON u.id=s.user_id LEFT JOIN tasks t ON t.id=s.task_id WHERE s.status='pending' ORDER BY s.created_at DESC`).all() as any[];
    const files=db.prepare(`SELECT m.id,m.submission_id as submissionId,m.kind,m.title,m.description,m.media_url as mediaUrl,m.poster_url as posterUrl,m.status,m.weekly_best as weeklyBest,u.full_name as author FROM media_items m JOIN users u ON u.id=m.user_id ORDER BY m.created_at DESC LIMIT 500`).all() as any[];
    return NextResponse.json({submissions,files});
  } catch {
    return NextResponse.json({error:'Unauthorized'},{status:401});
  }
}

export async function POST(req:Request){
  try {
    const admin=await requireAdmin();
    const {action,submissionId,mediaId,weeklyBest}=await req.json();

    if(action==='approve_submission'||action==='reject_submission'){
      const status=action==='approve_submission'?'approved':'rejected';
      db.prepare('UPDATE submissions SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').run(status,admin.userId,Number(submissionId));
      db.prepare('UPDATE media_items SET status=? WHERE submission_id=?').run(status,Number(submissionId));
      db.prepare('INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,?)').run(admin.userId,`submission_${status}`,'submission',Number(submissionId));
      return NextResponse.json({ok:true});
    }

    if(action==='delete_media'){
      const id=Number(mediaId);
      const media=db.prepare('SELECT * FROM media_items WHERE id=?').get(id) as any;
      if(!media) return NextResponse.json({error:'Media not found.'},{status:404});
      const variants=db.prepare('SELECT media_url FROM media_variants WHERE media_id=?').all(id) as Array<{media_url:string}>;
      const submissionIdValue=media.submission_id as number | null;
      db.prepare('DELETE FROM media_items WHERE id=?').run(id);
      for (const v of variants) await removePublicUpload(v.media_url);
      await removePublicUpload(media.media_url);
      await removePublicUpload(media.poster_url);
      db.prepare('INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)').run(admin.userId,'media_delete','media',id,JSON.stringify({title:media.title}));
      if (submissionIdValue) {
        const remaining=db.prepare('SELECT COUNT(*) as count FROM media_items WHERE submission_id=?').get(submissionIdValue) as {count:number};
        if (remaining.count===0) {
          const sub=db.prepare('SELECT zip_path FROM submissions WHERE id=?').get(submissionIdValue) as {zip_path:string} | undefined;
          db.prepare('DELETE FROM submissions WHERE id=?').run(submissionIdValue);
          if (sub) await removePublicUpload(sub.zip_path);
          const mediaDir=path.join(process.cwd(),'public','uploads','media',String(submissionIdValue));
          await fs.rm(mediaDir,{recursive:true,force:true}).catch(()=>{});
        }
      }
      return NextResponse.json({ok:true});
    }

    if(action==='media_status'){
      const status=weeklyBest===true?'approved':(String(weeklyBest)==='reject'?'rejected':'approved');
      db.prepare('UPDATE media_items SET status=?,weekly_best=? WHERE id=?').run(status,weeklyBest===true?1:0,Number(mediaId));
      return NextResponse.json({ok:true});
    }

    if(action==='weekly_best'){
      const id=Number(mediaId);
      const media=db.prepare('SELECT id,status FROM media_items WHERE id=?').get(id) as any;
      if(!media) return NextResponse.json({error:'Media not found.'},{status:404});
      if(weeklyBest){
        db.prepare('UPDATE media_items SET weekly_best=0 WHERE weekly_best=1').run();
      }
      db.prepare('UPDATE media_items SET weekly_best=? WHERE id=?').run(weeklyBest?1:0,id);
      db.prepare('INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)').run(admin.userId,weeklyBest?'weekly_best_set':'weekly_best_removed','media',id,'');
      return NextResponse.json({ok:true});
    }

    return NextResponse.json({error:'Unknown action.'},{status:400});
  } catch(e:any) {
    return NextResponse.json({error:e?.message||'Unauthorized'},{status:401});
  }
}
