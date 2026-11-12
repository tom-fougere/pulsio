const draftKey='pulsioDraft';
const toastEl=document.getElementById('toast');
let toastTimer;
let sessionId='';
const poll=readDraft()||{title:'',questions:[],askName:false,advanceMode:'manual',delaySeconds:30};
poll.questions=Array.isArray(poll.questions)?poll.questions:[];
poll.askName=!!poll.askName;
poll.advanceMode=poll.advanceMode==='timed'?'timed':'manual';
poll.delaySeconds=Number(poll.delaySeconds)||30;

function readDraft(){try{return JSON.parse(PulsioStorage.get(draftKey,'pulseDraft')||'null')}catch{return null}}
function saveDraft(){PulsioStorage.set(draftKey,JSON.stringify(poll))}
function toast(text){toastEl.textContent=text;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),2800)}
function esc(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function addQuestion(){poll.questions.push({text:'',type:'unique',choices:['','']});renderQuestions();document.querySelector('.question-card-full:last-child .question-text')?.focus()}
function renderQuestions(){
  const list=document.getElementById('questionList');list.innerHTML='';
  poll.questions.forEach((q,index)=>{
    const card=document.createElement('article');card.className='question-card-full';
    card.innerHTML=`<div class="question-card-heading"><span class="question-number">${index+1}</span><input class="question-text" placeholder="Écrivez votre question…" value="${esc(q.text)}" aria-label="Question ${index+1}"><button class="remove-question" aria-label="Supprimer la question">×</button></div><label class="type-label">Type de réponse<select class="question-type"><option value="unique">Choix unique</option><option value="multiple">Choix multiple</option><option value="slider">Curseur</option><option value="number">Valeur entière</option></select></label><div class="choices-editor"></div>`;
    const qInput=card.querySelector('.question-text');qInput.addEventListener('input',()=>{q.text=qInput.value;saveDraft()});
    const type=card.querySelector('.question-type');type.value=q.type;
    type.addEventListener('change',()=>{q.type=type.value;if(q.type==='unique'||q.type==='multiple')q.choices=q.choices?.length>=2?q.choices:['',''];saveDraft();renderQuestions()});
    card.querySelector('.remove-question').addEventListener('click',()=>{poll.questions.splice(index,1);saveDraft();renderQuestions()});
    const choices=card.querySelector('.choices-editor');
    if(q.type==='unique'||q.type==='multiple'){
      choices.innerHTML='<div class="choices-title">Réponses possibles <small>(l’animateur les définit ici)</small></div>';
      q.choices=Array.isArray(q.choices)?q.choices:['',''];
      q.choices.forEach((choice,choiceIndex)=>{
        const row=document.createElement('div');row.className='choice-row';const bullet=document.createElement('span');bullet.className=`choice-bullet ${q.type==='multiple'?'square':''}`;
        const input=document.createElement('input');input.placeholder=`Réponse ${choiceIndex+1}`;input.value=choice;input.setAttribute('aria-label',`Réponse ${choiceIndex+1} de la question ${index+1}`);input.addEventListener('input',()=>{q.choices[choiceIndex]=input.value;saveDraft()});row.append(bullet,input);
        if(q.choices.length>2){const remove=document.createElement('button');remove.className='remove-choice';remove.textContent='×';remove.setAttribute('aria-label','Supprimer cette réponse');remove.addEventListener('click',()=>{q.choices.splice(choiceIndex,1);saveDraft();renderQuestions()});row.append(remove)}choices.append(row);
      });
      const add=document.createElement('button');add.className='add-choice';add.textContent='＋ Ajouter une réponse';add.addEventListener('click',()=>{q.choices.push('');saveDraft();renderQuestions();document.querySelector(`.question-card-full:nth-child(${index+1}) .choice-row:last-of-type input`)?.focus()});choices.append(add);
    }else choices.innerHTML=`<p class="type-hint">${q.type==='slider'?'Les participants répondront avec un curseur de 0 à 100.':'Les participants saisiront un nombre entier.'}</p>`;
    list.append(card);
  });
  if(!poll.questions.length)list.innerHTML='<div class="empty-questions">Ajoutez votre première question pour commencer.</div>';
}

document.getElementById('pageTitle').textContent=poll.title||'Préparez vos questions';
document.getElementById('askName').checked=poll.askName;
document.getElementById('askName').addEventListener('change',event=>{poll.askName=event.target.checked;saveDraft()});
document.getElementById('advanceMode').value=poll.advanceMode;
document.getElementById('delaySeconds').value=poll.delaySeconds;
document.getElementById('delayField').hidden=poll.advanceMode!=='timed';
document.getElementById('advanceMode').addEventListener('change',event=>{poll.advanceMode=event.target.value;document.getElementById('delayField').hidden=event.target.value!=='timed';saveDraft()});
document.getElementById('delaySeconds').addEventListener('input',event=>{poll.delaySeconds=Number(event.target.value);saveDraft()});
document.getElementById('addQuestion').addEventListener('click',addQuestion);
renderQuestions();if(!poll.questions.length)addQuestion();

async function api(path,options={}){const response=await fetch(path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'Erreur de connexion au serveur.');return body}
document.getElementById('launchBtn').addEventListener('click',async()=>{
  poll.title=readDraft()?.title||'';poll.askName=document.getElementById('askName').checked;poll.advanceMode=document.getElementById('advanceMode').value;poll.delaySeconds=Number(document.getElementById('delaySeconds').value)||30;
  if(!poll.title){toast('Donnez un nom au sondage avant de continuer.');return}
  const bad=poll.questions.findIndex(q=>!q.text.trim()||((q.type==='unique'||q.type==='multiple')&&(q.choices.length<2||q.choices.some(choice=>!choice.trim()))));
  if(bad>=0){toast(`Complétez la question ${bad+1} et ses réponses.`);document.querySelectorAll('.question-card-full')[bad]?.scrollIntoView({behavior:'smooth',block:'center'});return}
  try{const state=await api('/api/sessions',{method:'POST',body:JSON.stringify(poll)});PulsioStorage.setHost(`pulsioHost:${state.id}`,state.hostKey);location.href=`presentation.html?session=${encodeURIComponent(state.id)}`}
  catch(error){toast(`${error.message} Lancez le serveur avec npm start.`)}
});
