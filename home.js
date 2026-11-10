const titleField=document.getElementById('surveyTitle');
function readDraft(){try{return JSON.parse(PulsioStorage.get('pulsioDraft','pulseDraft')||'null')}catch{return null}}
const draft=readDraft();if(draft?.title)titleField.value=draft.title;
document.getElementById('startForm').addEventListener('submit',event=>{event.preventDefault();PulsioStorage.set('pulsioDraft',JSON.stringify({title:titleField.value.trim(),questions:[],askName:false,advanceMode:'manual',delaySeconds:30}));location.href='questions.html'});
const list=document.getElementById('surveyList');const saved=readDraft();if(saved?.title){list.innerHTML=`<a class="survey-item draft-link" href="questions.html"><span class="survey-emoji yellow">✳</span><span class="survey-name"><strong></strong><small>Brouillon · ${saved.questions?.length||0} question(s)</small></span><span class="row-more">→</span></a>`;list.querySelector('strong').textContent=saved.title}
