const titleField=document.getElementById('surveyTitle');
function readDraft(){try{return JSON.parse(localStorage.getItem('pulseDraft')||'null')}catch{return null}}
const draft=readDraft();if(draft?.title)titleField.value=draft.title;
document.getElementById('startForm').addEventListener('submit',event=>{event.preventDefault();const old=readDraft()||{};localStorage.setItem('pulseDraft',JSON.stringify({...old,title:titleField.value.trim()}));location.href='questions.html'});
const list=document.getElementById('surveyList');const saved=readDraft();if(saved?.title){list.innerHTML=`<a class="survey-item draft-link" href="questions.html"><span class="survey-emoji yellow">✳</span><span class="survey-name"><strong></strong><small>Brouillon · ${saved.questions?.length||0} question(s)</small></span><span class="row-more">→</span></a>`;list.querySelector('strong').textContent=saved.title}
