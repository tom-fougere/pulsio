const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs');
const express=require('express');
const {WebSocketServer}=require('ws');

const app=express();
const server=http.createServer(app);
const wss=new WebSocketServer({server});
const sessions=new Map();
const dataPath=process.env.PULSIO_DATA_FILE?path.resolve(process.env.PULSIO_DATA_FILE):path.join(__dirname,'sessions.json');
function saveSessions(){const rows=[...sessions.values()].map(({timer,...s})=>({...s,participants:[...s.participants.entries()]}));fs.writeFileSync(dataPath,JSON.stringify(rows,null,2))}
try{for(const row of JSON.parse(fs.readFileSync(dataPath,'utf8'))){row.participants=new Map(row.participants||[]);row.timer=null;row.questionDeadlineAt=row.questionDeadlineAt||null;sessions.set(row.id,row);scheduleTimedQuestion(row,true)}}catch{}
app.use(express.json({limit:'256kb'}));
app.use(express.static(__dirname));

function publicState(session){
  const votes=session.votes.filter(v=>v.questionIndex===session.currentQuestion);
  return {id:session.id,title:session.title,questions:session.questions,askName:session.askName,currentQuestion:session.currentQuestion,active:session.active,advanceMode:session.advanceMode,delaySeconds:session.delaySeconds,questionDeadlineAt:session.questionDeadlineAt,votes:votes.map(v=>({name:v.name,answer:v.answer,at:v.at})),participantCount:session.participants.size};
}
function emitState(session){const state=publicState(session);for(const client of wss.clients){if(client.readyState===1&&client.sessionId===session.id){const payload=client.role==='host'?state:{...state,votes:[]};client.send(JSON.stringify({type:'state',state:payload}))}}}
function findSession(id,res){const session=sessions.get(id);if(!session){res.status(404).json({error:'Sondage introuvable ou terminé.'});return null}return session}

app.post('/api/sessions',(req,res)=>{
  const {title,questions,askName,advanceMode,delaySeconds}=req.body||{};
  if(typeof title!=='string'||!title.trim()||!Array.isArray(questions)||!questions.length)return res.status(400).json({error:'Ajoutez un nom et au moins une question.'});
  const valid=questions.every(q=>q&&typeof q.text==='string'&&q.text.trim()&&['unique','multiple','slider','number'].includes(q.type)&&(q.type==='unique'||q.type==='multiple'?Array.isArray(q.choices)&&q.choices.length>=2:true));
  if(!valid)return res.status(400).json({error:'Vérifiez les questions et leurs choix.'});
  const id=crypto.randomBytes(5).toString('hex').toUpperCase();
  const hostKey=crypto.randomBytes(24).toString('base64url');
  const session={id,hostKey,title:title.trim(),questions:questions.map(q=>({text:q.text.trim(),type:q.type,choices:q.choices||[]})),askName:!!askName,advanceMode:advanceMode==='timed'?'timed':'manual',delaySeconds:Math.max(5,Math.min(600,Number(delaySeconds)||30)),currentQuestion:0,active:true,votes:[],participants:new Map(),questionDeadlineAt:null,timer:null};
  sessions.set(id,session);
  scheduleTimedQuestion(session);
  saveSessions();
  res.status(201).json({...publicState(session),hostKey});
});
app.get('/api/sessions/:id',(req,res)=>{const s=findSession(req.params.id.toUpperCase(),res);if(!s)return;if(req.get('authorization')!==`Bearer ${s.hostKey}`)return res.status(403).json({error:'Accès animateur requis.'});res.json(publicState(s))});
app.get('/api/sessions/:id/status',(req,res)=>{const s=findSession(req.params.id.toUpperCase(),res);if(!s)return;const deviceId=String(req.query.device||'');res.json({state:{...publicState(s),votes:[]},hasVoted:s.votes.some(v=>v.deviceId===deviceId&&v.questionIndex===s.currentQuestion),name:s.participants.get(deviceId)||''})});
app.get('/api/sessions/:id/results',(req,res)=>{const s=findSession(req.params.id.toUpperCase(),res);if(!s)return;if(req.get('authorization')!==`Bearer ${s.hostKey}`)return res.status(403).json({error:'Accès animateur requis.'});res.json({id:s.id,title:s.title,askName:s.askName,questions:s.questions,votes:s.votes.map(({questionIndex,answer,name,at})=>({questionIndex,answer,name,at}))})});
app.post('/api/sessions/:id/votes',(req,res)=>{
  const s=findSession(req.params.id.toUpperCase(),res);if(!s)return;
  const {deviceId,name,answer,questionIndex}=req.body||{};const q=s.questions[s.currentQuestion];
  if(!s.active)return res.status(409).json({error:'Le sondage est terminé.'});
  if(questionIndex!==s.currentQuestion)return res.status(409).json({error:'La question a changé. Affichez la nouvelle question avant de répondre.'});
  if(typeof deviceId!=='string'||deviceId.length>100)return res.status(400).json({error:'Identifiant appareil invalide.'});
  if(s.askName&&(!name||!String(name).trim()))return res.status(400).json({error:'Votre nom est requis.'});
  if(s.votes.some(v=>v.deviceId===deviceId&&v.questionIndex===s.currentQuestion))return res.status(409).json({error:'Votre réponse a déjà été enregistrée.'});
  if((q.type==='unique'&&!q.choices.includes(answer))||(q.type==='multiple'&&(!Array.isArray(answer)||!answer.length||answer.some(x=>!q.choices.includes(x))))||(q.type==='number'&&(!Number.isInteger(Number(answer))))||(q.type==='slider'&&(!Number.isFinite(Number(answer))||Number(answer)<0||Number(answer)>100)))return res.status(400).json({error:'Réponse invalide.'});
  if(!s.participants.has(deviceId))s.participants.set(deviceId,s.askName?String(name).trim():'');
  s.votes.push({deviceId,name:s.askName?String(name).trim():null,questionIndex:s.currentQuestion,answer,at:Date.now()});saveSessions();emitState(s);res.status(201).json({ok:true});
});
function scheduleTimedQuestion(s,preserveDeadline=false){if(s.timer)clearTimeout(s.timer);s.timer=null;if(!s.active||s.advanceMode!=='timed') {s.questionDeadlineAt=null;return}if(!preserveDeadline||!s.questionDeadlineAt)s.questionDeadlineAt=Date.now()+s.delaySeconds*1000;const wait=Math.max(0,s.questionDeadlineAt-Date.now());s.timer=setTimeout(()=>advance(s),wait)}
function advance(s){if(!s.active)return;if(s.currentQuestion<s.questions.length-1){s.currentQuestion++;scheduleTimedQuestion(s);saveSessions();emitState(s)}else{s.active=false;s.questionDeadlineAt=null;if(s.timer)clearTimeout(s.timer);s.timer=null;saveSessions();emitState(s)}}
app.post('/api/sessions/:id/next',(req,res)=>{const s=findSession(req.params.id.toUpperCase(),res);if(!s)return;if(req.get('authorization')!==`Bearer ${s.hostKey}`)return res.status(403).json({error:'Accès animateur requis.'});if(s.advanceMode!=='manual')return res.status(409).json({error:'Le passage est automatique.'});advance(s);res.json(publicState(s))});
app.post('/api/sessions/:id/end',(req,res)=>{const s=findSession(req.params.id.toUpperCase(),res);if(!s)return;if(req.get('authorization')!==`Bearer ${s.hostKey}`)return res.status(403).json({error:'Accès animateur requis.'});s.active=false;s.questionDeadlineAt=null;if(s.timer)clearTimeout(s.timer);s.timer=null;saveSessions();emitState(s);res.json({ok:true})});
wss.on('connection',(socket,request)=>{const url=new URL(request.url,'http://localhost');const id=(url.searchParams.get('session')||'').toUpperCase();const s=sessions.get(id);if(!s){socket.close(1008,'Session introuvable');return}socket.sessionId=id;socket.role=url.searchParams.get('role')||'participant';if(socket.role==='host'&&url.searchParams.get('key')!==s.hostKey){socket.close(1008,'Accès animateur requis');return}const state=publicState(s);socket.send(JSON.stringify({type:'state',state:socket.role==='host'?state:{...state,votes:[]}}))});
const port=Number(process.env.PORT)||3000;
server.listen(port,'0.0.0.0',()=>console.log(`Pulsio est disponible sur http://localhost:${port}`));
