import db from './db';

export function getSetting(key:string, fallback=''){const row=db.prepare('SELECT value FROM settings WHERE key=?').get(key) as any;return row?.value ?? fallback;}
export function getSettings(){return db.prepare('SELECT key,value FROM settings ORDER BY key').all();}
export function getPublicMedia(limit=12){
 return db.prepare(`SELECT m.*,u.full_name as author,
 (SELECT COUNT(*) FROM media_likes l WHERE l.media_id=m.id) likes,
 (SELECT ROUND(AVG(r.rating),1) FROM media_ratings r WHERE r.media_id=m.id) rating,
 (SELECT COUNT(*) FROM media_ratings r WHERE r.media_id=m.id) rating_count,
 (SELECT COUNT(*) FROM media_comments c WHERE c.media_id=m.id AND c.status='visible') comment_count,
 (SELECT media_url FROM media_variants v WHERE v.media_id=m.id AND v.quality='1080p' LIMIT 1) q1080,
 (SELECT media_url FROM media_variants v WHERE v.media_id=m.id AND v.quality='720p' LIMIT 1) q720,
 (SELECT media_url FROM media_variants v WHERE v.media_id=m.id AND v.quality='480p' LIMIT 1) q480
 FROM media_items m JOIN users u ON u.id=m.user_id
 WHERE m.status='approved' ORDER BY m.weekly_best DESC,m.created_at DESC LIMIT ?`).all(limit);
}
export function getMediaComments(mediaId:number){return db.prepare(`SELECT c.id,c.body,c.created_at as createdAt,u.full_name as author,u.pfp_url as pfp FROM media_comments c JOIN users u ON u.id=c.user_id WHERE c.media_id=? AND c.status='visible' ORDER BY c.created_at DESC`).all(mediaId);}
export function getHomeData(){
 const weekly=db.prepare(`SELECT m.*,u.full_name as author,(SELECT ROUND(AVG(r.rating),1) FROM media_ratings r WHERE r.media_id=m.id) rating,(SELECT COUNT(*) FROM media_likes l WHERE l.media_id=m.id) likes,(SELECT COUNT(*) FROM media_comments c WHERE c.media_id=m.id AND c.status='visible') comment_count FROM media_items m JOIN users u ON u.id=m.user_id WHERE m.status='approved' AND m.weekly_best=1 ORDER BY m.created_at DESC LIMIT 6`).all();
 const nextMeeting=db.prepare(`SELECT id,title,start_time as startTime,zoom_url as zoomUrl,agenda FROM meetings WHERE datetime(start_time)>=datetime('now') ORDER BY datetime(start_time) ASC LIMIT 1`).get();
 const events=db.prepare(`SELECT id,title,event_date as date,location,description,trailer_url as trailerUrl,aftermovie_url as aftermovieUrl,album_url as albumUrl,cover_url as coverUrl FROM events ORDER BY event_date DESC LIMIT 3`).all();
 const announcements=db.prepare('SELECT id,title,body,created_at as createdAt FROM announcements WHERE active=1 ORDER BY created_at DESC LIMIT 3').all();
 return {weeklyBest:weekly,nextMeeting,events,announcements};
}
export function getBoard(){return db.prepare(`SELECT * FROM board_roster WHERE active=1 ORDER BY display_order ASC`).all();}
