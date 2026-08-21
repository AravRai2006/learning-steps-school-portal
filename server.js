const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
loadEnv(path.join(ROOT, '.env'));
const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const CATEGORIES = ['blue', 'yellow', 'mint', 'coral', 'purple', 'pink'];
if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !SESSION_SECRET || SESSION_SECRET.length < 24) {
  console.error('Missing secure configuration. Copy .env.example to .env and set ADMIN_EMAIL, ADMIN_PASSWORD, and a SESSION_SECRET of at least 24 characters.');
  process.exit(1);
}

const db = new DatabaseSync(path.join(ROOT, 'data', 'portal.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
initializeDatabase();

const sessions = new Map();
const PUBLIC_DIR = path.join(ROOT, 'public');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['\"]|['\"]$/g, '');
  }
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, sort_order INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS timetable_entries (id INTEGER PRIMARY KEY, class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE, day TEXT NOT NULL, time TEXT NOT NULL, activity TEXT NOT NULL, description TEXT, icon TEXT, category TEXT NOT NULL DEFAULT 'blue', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS assignments (id INTEGER PRIMARY KEY, class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE, title TEXT NOT NULL, subject TEXT NOT NULL, instructions TEXT NOT NULL, assigned_date TEXT NOT NULL, due_date TEXT NOT NULL, attachment_url TEXT, important INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, important INTEGER NOT NULL DEFAULT 0, posted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS enquiries (id INTEGER PRIMARY KEY, parent_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, message TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable_entries(class_id, day, time);
    CREATE INDEX IF NOT EXISTS idx_assignment_class ON assignments(class_id, due_date);
  `);
  const user = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(ADMIN_EMAIL.toLowerCase());
  if (!user) db.prepare('INSERT INTO admin_users (email, password_hash) VALUES (?, ?)').run(ADMIN_EMAIL.toLowerCase(), hashPassword(ADMIN_PASSWORD));
  if (!db.prepare("SELECT value FROM app_meta WHERE key = 'demo_seeded'").get()) {
    seedDemoData();
    db.prepare("INSERT INTO app_meta (key, value) VALUES ('demo_seeded', 'true')").run();
  }
}

function seedDemoData() {
  const classNames = ['PG', 'Nursery', 'LKG', 'ULG', 'First Grade'];
  const addClass = db.prepare('INSERT OR IGNORE INTO classes (name, sort_order) VALUES (?, ?)');
  classNames.forEach((name, i) => addClass.run(name, i + 1));
  const classes = db.prepare('SELECT id, name FROM classes').all();
  const timetable = db.prepare('INSERT INTO timetable_entries (class_id, day, time, activity, description, icon, category) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const assignment = db.prepare('INSERT INTO assignments (class_id, title, subject, instructions, assigned_date, due_date, important) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const schedules = {
    PG: [['08:30','Welcome & free play','Gentle arrival and supervised sensory play','☀','blue'],['09:30','Rhymes & music','Songs, movement, and familiar rhythm','♫','yellow'],['10:30','Outdoor discovery','A short fresh-air exploration with teachers','☘','mint'],['11:30','Lunch & rest','Supported lunchtime routine and quiet rest','♥','coral']],
    Nursery: [['08:30','Circle time','Greetings, calendar, and sharing time','☀','blue'],['09:30','Phonics fun','Letter sounds through stories and play','Aa','yellow'],['10:30','Creative corner','Painting, clay, and imagination','✦','mint'],['11:30','Lunch break','A calm, supported meal time','♥','coral']],
    LKG: [['08:30','Morning meeting','Daily calendar and conversation','☀','blue'],['09:30','English','Phonics, writing, and vocabulary','Aa','yellow'],['10:30','Mathematics','Numbers through games and manipulatives','123','mint'],['11:30','Story garden','Read-aloud and discussion','✦','purple']],
    ULG: [['08:30','Assembly','Mindful start and daily news','☀','blue'],['09:30','English language','Reading, writing, and expression','Aa','yellow'],['10:30','Math lab','Patterns, counting, and problem solving','123','mint'],['11:30','EVS exploration','Our world and hands-on discovery','◎','coral']],
    'First Grade': [['08:30','Morning circle','Class check-in and daily plan','☀','blue'],['09:30','English','Reading workshop and grammar','Aa','yellow'],['10:30','Mathematics','Number sense and guided practice','123','mint'],['11:30','Science','Observe, question, and investigate','⚗','purple']]
  };
  for (const c of classes) {
    const daily = schedules[c.name];
    DAYS.forEach((day, dayIndex) => daily.forEach((item, index) => timetable.run(c.id, day, item[0], item[1], item[2], item[3], item[4])));
    assignment.run(c.id, `${c.name} learning adventure`, 'Class activity', `DEMO DATA: Please complete the age-appropriate activity sheet and share one thing your child enjoyed learning this week.`, '2026-08-18', '2026-08-21', c.name === 'First Grade' ? 1 : 0);
    assignment.run(c.id, 'Creative colours', 'Art', 'DEMO DATA: Draw a picture using three favourite colours and bring it to class.', '2026-08-19', '2026-08-23', 0);
  }
  const addAnnouncement = db.prepare('INSERT INTO announcements (title, content, important, posted_at) VALUES (?, ?, ?, ?)');
  addAnnouncement.run('Welcome to The Learning Steps portal', 'DEMO DATA: This portal will share classroom schedules, assignments, and school updates with families.', 1, '2026-08-17T09:00:00.000Z');
  addAnnouncement.run('Family learning week', 'DEMO DATA: Please look out for class-specific activities and notices from your child’s teacher.', 0, '2026-08-16T09:00:00.000Z');
}

function hashPassword(password) { const salt = crypto.randomBytes(16).toString('hex'); return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`; }
function verifyPassword(password, stored) { const [salt, expected] = stored.split(':'); if (!salt || !expected) return false; const actual = crypto.scryptSync(password, salt, 64).toString('hex'); return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex')); }
function sign(value) { return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url'); }
function cookieValue(req, name) { const all = Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('='))); const raw = all[name]; if (!raw) return null; const [id, signature] = raw.split('.'); return id && signature && crypto.timingSafeEqual(Buffer.from(sign(id)), Buffer.from(signature)) ? id : null; }
function currentAdmin(req) { const id = cookieValue(req, 'tls_session'); const session = id && sessions.get(id); if (!session || session.expires < Date.now()) { if (id) sessions.delete(id); return null; } return session; }
function setSession(res, email) { const id = crypto.randomBytes(32).toString('base64url'); sessions.set(id, { email, expires: Date.now() + 1000 * 60 * 60 * 8 }); res.setHeader('Set-Cookie', `tls_session=${id}.${sign(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`); }
function clearSession(res) { res.setHeader('Set-Cookie', 'tls_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); }
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); }
function error(res, status, message) { json(res, status, { error: message }); }
function readJson(req) { return new Promise((resolve, reject) => { let data=''; req.on('data', c => { data += c; if (data.length > 50_000) { reject(new Error('Request too large')); req.destroy(); } }); req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('Invalid JSON')); } }); req.on('error', reject); }); }
function clean(value, max = 5000) { return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001F\u007F]/g, '').slice(0, max) : ''; }
function id(value) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; }
function assertOrigin(req) { if (!['POST','PATCH','PUT','DELETE'].includes(req.method)) return true; const origin = req.headers.origin; const host = req.headers.host; return !origin || origin === `http://${host}` || origin === `https://${host}`; }
function requireAdmin(req, res) { if (!currentAdmin(req)) { error(res, 401, 'Admin sign-in required.'); return false; } if (!assertOrigin(req)) { error(res, 403, 'Request origin not allowed.'); return false; } return true; }
function classExists(classId) { return !!db.prepare('SELECT id FROM classes WHERE id = ?').get(classId); }
function validDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)); }
function toTimetable(row) { return { ...row, classId: row.class_id, className: row.class_name }; }
function toAssignment(row) { return { ...row, classId: row.class_id, className: row.class_name, important: Boolean(row.important) }; }

async function api(req, res, url) {
  const pathName = url.pathname;
  if (req.method === 'GET' && pathName === '/api/public/classes') return json(res, 200, db.prepare('SELECT id, name FROM classes ORDER BY sort_order').all());
  if (req.method === 'GET' && pathName === '/api/public/timetable') {
    const classId = id(url.searchParams.get('classId')); if (!classId || !classExists(classId)) return error(res, 400, 'Choose a valid class.');
    const rows = db.prepare('SELECT t.*, c.name class_name FROM timetable_entries t JOIN classes c ON c.id=t.class_id WHERE t.class_id=? ORDER BY CASE t.day WHEN \'Monday\' THEN 1 WHEN \'Tuesday\' THEN 2 WHEN \'Wednesday\' THEN 3 WHEN \'Thursday\' THEN 4 WHEN \'Friday\' THEN 5 END, t.time').all(classId).map(toTimetable); return json(res, 200, rows);
  }
  if (req.method === 'GET' && pathName === '/api/public/assignments') {
    const classId = id(url.searchParams.get('classId')); if (!classId || !classExists(classId)) return error(res, 400, 'Choose a valid class.');
    return json(res, 200, db.prepare('SELECT a.*, c.name class_name FROM assignments a JOIN classes c ON c.id=a.class_id WHERE a.class_id=? ORDER BY a.important DESC, a.due_date ASC').all(classId).map(toAssignment));
  }
  if (req.method === 'GET' && pathName === '/api/public/announcements') return json(res, 200, db.prepare('SELECT * FROM announcements ORDER BY important DESC, posted_at DESC').all().map(r => ({...r, important: Boolean(r.important)})));
  if (req.method === 'POST' && pathName === '/api/public/enquiries') {
    if (!assertOrigin(req)) return error(res, 403, 'Request origin not allowed.'); const body = await readJson(req); const parentName=clean(body.parentName,120), email=clean(body.email,160).toLowerCase(), phone=clean(body.phone,30), message=clean(body.message,2000);
    if (parentName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[0-9+()\-\s]{7,30}$/.test(phone) || message.length < 10) return error(res,400,'Please enter a valid name, email, phone number, and message (at least 10 characters).');
    db.prepare('INSERT INTO enquiries (parent_name,email,phone,message) VALUES (?,?,?,?)').run(parentName,email,phone,message); return json(res,201,{message:'Thank you. Your enquiry has been received.'});
  }
  if (req.method === 'POST' && pathName === '/api/admin/login') { const body=await readJson(req); const email=clean(body.email,160).toLowerCase(), password=String(body.password||''); const admin=db.prepare('SELECT * FROM admin_users WHERE email=?').get(email); if (!admin || !verifyPassword(password,admin.password_hash)) return error(res,401,'Incorrect email or password.'); setSession(res,admin.email); return json(res,200,{email:admin.email}); }
  if (req.method === 'POST' && pathName === '/api/admin/logout') { const sessionId = cookieValue(req, 'tls_session'); if (sessionId) sessions.delete(sessionId); clearSession(res); return json(res,200,{message:'Signed out.'}); }
  if (req.method === 'GET' && pathName === '/api/admin/me') { const admin=currentAdmin(req); return admin ? json(res,200,{email:admin.email}) : error(res,401,'Admin sign-in required.'); }
  if (req.method === 'POST' && pathName === '/api/admin/change-password') {
    if (!requireAdmin(req, res)) return;
    const body = await readJson(req); const currentPassword = String(body.currentPassword || ''); const newPassword = String(body.newPassword || '');
    if (newPassword.length < 12 || newPassword.length > 256) return error(res, 400, 'Use a new password between 12 and 256 characters.');
    const account = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(currentAdmin(req).email);
    if (!account || !verifyPassword(currentPassword, account.password_hash)) return error(res, 401, 'Your current password is incorrect.');
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), account.id);
    return json(res, 200, { message: 'Password updated. Your current session remains signed in.' });
  }
  if (!pathName.startsWith('/api/admin/')) return error(res,404,'Not found.');
  if (!requireAdmin(req,res)) return;
  if (req.method === 'GET' && pathName === '/api/admin/dashboard') {
    const count = table => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
    return json(res,200,{classes:count('classes'),timetable:count('timetable_entries'),assignments:count('assignments'),announcements:count('announcements'),unreadEnquiries:db.prepare('SELECT COUNT(*) AS count FROM enquiries WHERE is_read=0').get().count});
  }
  if (pathName === '/api/admin/timetables') return manageTimetables(req,res);
  if (pathName === '/api/admin/assignments') return manageAssignments(req,res);
  if (pathName === '/api/admin/announcements') return manageAnnouncements(req,res);
  if (pathName === '/api/admin/enquiries') return manageEnquiries(req,res);
  const match=pathName.match(/^\/api\/admin\/(timetables|assignments|announcements|enquiries)\/(\d+)$/); if (!match) return error(res,404,'Not found.');
  return manageItem(req,res,match[1],Number(match[2]));
}

async function manageTimetables(req,res) { if (req.method==='GET') return json(res,200,db.prepare('SELECT t.*,c.name class_name FROM timetable_entries t JOIN classes c ON c.id=t.class_id ORDER BY c.sort_order, t.day, t.time').all().map(toTimetable)); if (req.method!=='POST') return error(res,405,'Method not allowed.'); const b=await readJson(req); const values=validateTimetable(b); if (values.error) return error(res,400,values.error); const r=db.prepare('INSERT INTO timetable_entries (class_id,day,time,activity,description,icon,category) VALUES (?,?,?,?,?,?,?)').run(...values.data); return json(res,201,{id:Number(r.lastInsertRowid)}); }
function validateTimetable(b) { const classId=id(b.classId), day=clean(b.day,20), time=clean(b.time,5), activity=clean(b.activity,100), description=clean(b.description,500), icon=clean(b.icon,8), category=clean(b.category,20)||'blue'; if(!classId||!classExists(classId)||!DAYS.includes(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||activity.length<2||!CATEGORIES.includes(category)) return {error:'Please complete all timetable fields with valid values.'}; return {data:[classId,day,time,activity,description||null,icon||null,category]}; }
async function manageAssignments(req,res) { if (req.method==='GET') return json(res,200,db.prepare('SELECT a.*,c.name class_name FROM assignments a JOIN classes c ON c.id=a.class_id ORDER BY a.created_at DESC').all().map(toAssignment)); if(req.method!=='POST') return error(res,405,'Method not allowed.'); const b=await readJson(req), values=validateAssignment(b); if(values.error)return error(res,400,values.error); const r=db.prepare('INSERT INTO assignments (class_id,title,subject,instructions,assigned_date,due_date,important) VALUES (?,?,?,?,?,?,?)').run(...values.data); return json(res,201,{id:Number(r.lastInsertRowid)}); }
function validateAssignment(b) { const classId=id(b.classId), title=clean(b.title,140), subject=clean(b.subject,80), instructions=clean(b.instructions,2000), assigned=clean(b.assignedDate,10), due=clean(b.dueDate,10), important=Boolean(b.important)?1:0; if(!classId||!classExists(classId)||title.length<2||subject.length<2||instructions.length<5||!validDate(assigned)||!validDate(due)||due<assigned)return {error:'Please complete assignment details and use valid dates.'}; return {data:[classId,title,subject,instructions,assigned,due,important]}; }
async function manageAnnouncements(req,res) { if(req.method==='GET')return json(res,200,db.prepare('SELECT * FROM announcements ORDER BY posted_at DESC').all().map(r=>({...r,important:Boolean(r.important)}))); if(req.method!=='POST')return error(res,405,'Method not allowed.'); const b=await readJson(req),values=validateAnnouncement(b);if(values.error)return error(res,400,values.error);const r=db.prepare('INSERT INTO announcements (title,content,important,posted_at) VALUES (?,?,?,?)').run(...values.data);return json(res,201,{id:Number(r.lastInsertRowid)}); }
function validateAnnouncement(b) {const title=clean(b.title,160),content=clean(b.content,3000),important=Boolean(b.important)?1:0;if(title.length<2||content.length<5)return{error:'Title and announcement content are required.'};return{data:[title,content,important,new Date().toISOString()]};}
async function manageEnquiries(req,res) { if(req.method!=='GET')return error(res,405,'Method not allowed.');return json(res,200,db.prepare('SELECT * FROM enquiries ORDER BY is_read,created_at DESC').all().map(r=>({...r,is_read:Boolean(r.is_read)}))); }
async function manageItem(req,res,table,itemId) {
  const body=['PATCH','PUT'].includes(req.method)?await readJson(req):null;
  const remove = (tableName) => {
    const result = db.prepare(`DELETE FROM ${tableName} WHERE id=?`).run(itemId);
    return result.changes ? json(res,200,{message:'Deleted.'}) : error(res,404,'This record no longer exists.');
  };
  const update = (statement, values) => {
    const result = db.prepare(statement).run(...values,itemId);
    return result.changes ? json(res,200,{message:'Saved.'}) : error(res,404,'This record no longer exists.');
  };
  if(table==='timetables'){
    if(req.method==='DELETE') return remove('timetable_entries');
    if(req.method==='PATCH'){const v=validateTimetable(body);if(v.error)return error(res,400,v.error);return update('UPDATE timetable_entries SET class_id=?,day=?,time=?,activity=?,description=?,icon=?,category=? WHERE id=?',v.data);}
  }
  if(table==='assignments'){
    if(req.method==='DELETE') return remove('assignments');
    if(req.method==='PATCH'){const v=validateAssignment(body);if(v.error)return error(res,400,v.error);return update('UPDATE assignments SET class_id=?,title=?,subject=?,instructions=?,assigned_date=?,due_date=?,important=? WHERE id=?',v.data);}
  }
  if(table==='announcements'){
    if(req.method==='DELETE') return remove('announcements');
    if(req.method==='PATCH'){const v=validateAnnouncement(body);if(v.error)return error(res,400,v.error);return update('UPDATE announcements SET title=?,content=?,important=? WHERE id=?',v.data.slice(0,3));}
  }
  if(table==='enquiries'){
    if(req.method==='DELETE') return remove('enquiries');
    if(req.method==='PATCH') return update('UPDATE enquiries SET is_read=? WHERE id=?',[Boolean(body.isRead)?1:0]);
  }
  return error(res,405,'Method not allowed.');
}

function serveStatic(req,res,url) { let requested = url.pathname === '/' || url.pathname === '/admin' ? '/index.html' : url.pathname; requested=decodeURIComponent(requested); const file=path.resolve(PUBLIC_DIR, '.'+requested); if(!file.startsWith(PUBLIC_DIR)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return error(res,404,'Not found.'); const extension=path.extname(file); const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'}; const cacheControl=['.html','.css','.js'].includes(extension)?'no-cache':'public, max-age=86400';res.writeHead(200,{'Content-Type':types[extension]||'application/octet-stream','Cache-Control':cacheControl,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'"});fs.createReadStream(file).pipe(res); }

const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname.startsWith('/api/'))await api(req,res,url);else serveStatic(req,res,url);}catch(e){console.error(e);if(!res.headersSent)error(res,500,'Something went wrong. Please try again.');}});
server.listen(PORT,()=>console.log(`The Learning Steps portal is running at http://localhost:${PORT}`));
