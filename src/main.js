document.documentElement.dataset.bloStatus='ready';
const list=document.querySelector('#priority-list');
list.innerHTML='<li class="empty">Sin tareas pendientes.</li>';
const form=document.querySelector('#afrodita-form');
const input=document.querySelector('#afrodita-input');
const output=document.querySelector('#afrodita-answer');
form.addEventListener('submit',e=>{e.preventDefault();const text=input.value.trim();if(!text)return;output.textContent='BLO está operativo. La conexión completa de Afrodita se está desplegando.';input.value='';});
const ptt=document.querySelector('#ptt');
ptt.addEventListener('click',()=>{output.textContent='El control por voz se activará con el módulo Afrodita.';});
