(()=>{"use strict";
const D=window.CROSSWORD_DATA,$=s=>document.querySelector(s),STORE="xiaoscanwordmi-preview-v4",S={layout:null,active:null,answers:{},cursor:0,timer:null};
const key=(r,c)=>r+","+c,norm=s=>String(s||"").toLocaleUpperCase("ru-RU").replace(/Ё/g,"Е").replace(/[^А-Я]/g,"");
function saved(){try{return JSON.parse(localStorage.getItem(STORE)||"{}")}catch(e){return {}}}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(S.answers))}catch(e){}}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");clearTimeout(S.timer);S.timer=setTimeout(()=>e.classList.remove("show"),1900)}
function svgPicture(type){if(type==="tower")return '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#e7edf0"/><circle cx="76" cy="19" r="9" fill="#f5d98b"/><path d="M48 16 L39 36 L45 36 L30 76 L42 76 L36 88 L64 88 L58 76 L70 76 L55 36 L61 36 Z" fill="#8a9c9e"/><path d="M48 16 L49 88 M39 46 L59 46 M35 63 L62 63 M32 77 L66 77" stroke="#f8f7f3" stroke-width="2"/><rect x="8" y="88" width="84" height="4" rx="2" fill="#b9c9c7"/></svg>';
return '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#f5e8cc"/><circle cx="78" cy="19" r="8" fill="#e8bd71"/><path d="M12 85 L42 48 L54 62 L67 39 L92 85 Z" fill="#c79a5e"/><path d="M42 48 L54 62 L67 39 L76 85 L25 85 Z" fill="#e1bb7c"/><path d="M50 59 L58 69 L49 69 Z" fill="#a87945"/><rect x="8" y="86" width="84" height="5" rx="2" fill="#b9a17a"/></svg>'}
function layoutFor(){
/* Сканворд 10×23: слова ставятся по горизонтали и вертикали, пересекаются
   только на совпадающих буквах. Картинка занимает блок 3×3. */
const ROWS=23,COLS=10,grid=new Map(),entries=[],blocked=new Set();
const inside=(r,c)=>r>=0&&r<ROWS&&c>=0&&c<COLS;
const put=(r,c,obj)=>grid.set(key(r,c),{r,c,...obj});
for(let r=0;r<3;r++)for(let c=0;c<3;c++)blocked.add(key(r,c));
put(0,0,{ch:"@",picture:"tower"});
const pool=D.entries.map((e,index)=>({...e,answer:norm(e.answer),_index:index}))
 .filter(e=>e.answer.length>=3&&e.answer.length<=9);
const imageEntry=pool.find(e=>e.image==="tower")||pool.find(e=>e.image==="pyramid");
const seed=imageEntry||{answer:"ЭЙФЕЛЬ",clue:"Знаменитая башня в Париже",image:"tower"};
function place(e,r,c,dir,isSeed=false){
 const dr=dir==="down"?1:0,dc=dir==="across"?1:0;
 const clueR=r-dr,clueC=c-dc;
 if(!inside(clueR,clueC))return null;
 if(!isSeed&&(grid.has(key(clueR,clueC))||blocked.has(key(clueR,clueC))))return null;
 let crossings=0;
 for(let i=0;i<e.answer.length;i++){
  const rr=r+dr*i,cc=c+dc*i,k=key(rr,cc);
  if(!inside(rr,cc)||blocked.has(k))return null;
  const existing=grid.get(k);
  if(existing&&existing.ch!==e.answer[i])return null;
  if(existing&&existing.ch===e.answer[i])crossings++;
  if(!existing){
   const sides=dir==="across"?[[rr-1,cc],[rr+1,cc]]:[[rr,cc-1],[rr,cc+1]];
   for(const [sr,sc] of sides){if(!inside(sr,sc))continue;const side=grid.get(key(sr,sc));if(side&&side.ch!=="@"&&!side.picture)return null}
  }
 }
 if(!isSeed&&crossings===0)return null;
 if(!isSeed){
  const before=grid.get(key(clueR,clueC));
  if(before&&before.ch!=="@")return null;
  if(blocked.has(key(clueR,clueC)))return null;
 }
 const cells=[];
 for(let i=0;i<e.answer.length;i++){const rr=r+dr*i,cc=c+dc*i,k=key(rr,cc);if(!grid.has(k))put(rr,cc,{ch:e.answer[i]});cells.push({r:rr,c:cc})}
 const entry={...e,dir,cells,clueR:isSeed?0:clueR,clueC:isSeed?0:clueC};
 if(isSeed){entry.image=seed.image||"tower";put(0,0,{ch:"@",picture:entry.image})}
 else put(clueR,clueC,{ch:"@",clue:true});
 entries.push(entry);return entry;
}
/* Картинка — самостоятельная загадка, слово начинается у её правого края. */
const seedAnswer=seed.answer.length<=6?seed.answer:"ЭЙФЕЛЬ";
const seedEntry={...seed,answer:seedAnswer,clue:"Узнай объект на картинке",image:seed.image||"tower"};
place(seedEntry,1,3,"across",true);
const used=new Set([seedEntry.answer]);
const candidates=pool.filter(e=>!e.image&&!used.has(e.answer)).sort((a,b)=>a.answer.length-b.answer.length);
let progress=true,passes=0;
while(progress&&passes++<8&&entries.length<46){
 progress=false;
 for(const e of candidates){
  if(used.has(e.answer)||entries.length>=46)continue;
  let best=null,bestScore=-1;
  for(const [cellKey,cell] of grid){
   if(cell.ch==="@"||cell.picture)continue;
   for(const dir of ["across","down"]){
    const dr=dir==="down"?1:0,dc=dir==="across"?1:0;
    for(let i=0;i<e.answer.length;i++){
     if(e.answer[i]!==cell.ch)continue;
     const sr=cell.r-dr*i,sc=cell.c-dc*i;
     const test=placeCheck(e,sr,sc,dir);
     if(test){const score=test.crossings*10-Math.abs(11-sr)-Math.abs(4-sc);if(score>bestScore){bestScore=score;best={r:sr,c:sc,dir}}}
    }
   }
  }
  if(best){place(e,best.r,best.c,best.dir);used.add(e.answer);progress=true}
 }
}
function placeCheck(e,r,c,dir){
 const dr=dir==="down"?1:0,dc=dir==="across"?1:0,cr=r-dr,cc=c-dc;
 if(!inside(cr,cc)||grid.has(key(cr,cc))||blocked.has(key(cr,cc)))return null;
 let crossings=0;
 for(let i=0;i<e.answer.length;i++){
  const rr=r+dr*i,cl=c+dc*i,k=key(rr,cl);
  if(!inside(rr,cl)||blocked.has(k))return null;
  const ex=grid.get(k);if(ex&&ex.ch!==e.answer[i])return null;if(ex)crossings++;
  if(!ex){const sides=dir==="across"?[[rr-1,cl],[rr+1,cl]]:[[rr,cl-1],[rr,cl+1]];
   for(const [sr,sc] of sides){const s=grid.get(key(sr,sc));if(s&&s.ch!=="@"&&!s.picture)return null}
  }
 }
 if(!crossings)return null;
 return {crossings};
}
/* Заполняем свободные участки только дополнительными пересекающимися словами;
   размеры сетки остаются фиксированными. */
return {grid,entries,rows:ROWS,cols:COLS};
}
function solved(e){return e.cells.every((c,i)=>S.answers[key(c.r,c.c)]===e.answer[i])}
function percent(){const cells=new Set();S.layout.entries.forEach(e=>e.cells.forEach(c=>cells.add(key(c.r,c.c))));let n=0;cells.forEach(k=>{if(S.answers[k])n++});return cells.size?Math.round(n/cells.size*100):0}
function draw(){const L=S.layout,b=$("#board"),clues=new Map(),letters=new Map();L.entries.forEach((e,i)=>{clues.set(key(e.clueR,e.clueC),{e,i});e.cells.forEach(c=>{if(!letters.has(key(c.r,c.c)))letters.set(key(c.r,c.c),[]);letters.get(key(c.r,c.c)).push(e)})});
const cell=window.innerWidth<=650?Math.max(34,Math.min(44,Math.floor((window.innerWidth-20)/L.cols))):Math.max(46,Math.min(64,Math.floor((window.innerWidth-40)/Math.min(L.cols,12))));document.documentElement.style.setProperty("--cell",cell+"px");b.style.setProperty("--cols",L.cols);b.style.setProperty("--rows",L.rows);let html="";
const skipped=new Set();for(let r=0;r<L.rows;r++)for(let c=0;c<L.cols;c++){const k=key(r,c);if(skipped.has(k))continue;const cl=clues.get(k),cd=L.grid.get(k),les=letters.get(k)||[];
if(cd&&cd.picture){const e=L.entries.find(x=>x.image===cd.picture);for(let rr=r;rr<r+3;rr++)for(let cc=c;cc<c+3;cc++)skipped.add(key(rr,cc));html+='<button class="cell clue picture '+(S.active===e?"selected ":"")+'" data-entry="'+L.entries.indexOf(e)+'" style="grid-column:span 3;grid-row:span 3" aria-label="Картинка-загадка: '+e.clue+'">'+svgPicture(cd.picture)+'<span class="arr">→</span></button>';continue}
if(cd&&cd.ch==="#"){html+='<div class="cell void"></div>';continue}
if(cl){const e=cl.e;html+='<button class="cell clue '+(S.active===e?"selected ":"")+'" data-entry="'+cl.i+'" aria-label="Вопрос: '+e.clue+'"><span class="clue-label">'+e.clue+'</span><span class="arr">'+(e.dir==="across"?"→":"↓")+'</span></button>'}
else if(cd&&cd.ch!=="@"){const active=S.active&&S.active.cells.some(x=>x.r===r&&x.c===c),isSolved=les.some(solved);html+='<button class="cell letter '+(active?"in-word ":"")+(S.active&&les.includes(S.active)?"selected ":"")+(isSolved?"correct":"")+'" data-cell="'+k+'">'+(S.answers[k]||"")+'</button>'}
else html+='<div class="cell void"></div>'}
b.innerHTML=html;$("#wordCount").textContent=L.entries.length+" слов · 1 картинка";$("#percent").textContent=percent()+"%";$("#status").textContent=S.active?(S.active.image?"Картинка-загадка: ":"Вопрос: ")+S.active.clue+" · "+S.active.answer.length+" букв":"Выбери вопрос на поле"}
function select(i){S.active=S.layout.entries[Number(i)]||null;S.cursor=S.active?Math.max(0,S.active.cells.findIndex((c,j)=>S.answers[key(c.r,c.c)]!==S.active.answer[j])):0;draw()}
function enter(ch){if(!S.active)return;const e=S.active;if(solved(e)){toast("Слово уже разгадано — выбери другой вопрос");return}let i=S.cursor;while(i<e.cells.length&&S.answers[key(e.cells[i].r,e.cells[i].c)]===e.answer[i])i++;if(i>=e.cells.length){toast("Это слово уже заполнено");return}const c=e.cells[i];S.answers[key(c.r,c.c)]=ch;S.cursor=i+1;while(S.cursor<e.cells.length&&S.answers[key(e.cells[S.cursor].r,e.cells[S.cursor].c)]===e.answer[S.cursor])S.cursor++;persist();draw();if(solved(e)){toast("Верно! Слово стало зелёным");$("#status").textContent="Верно: "+e.answer+" · выбери следующий вопрос сам"}}
function keyboard(k){if(/^[а-яё]$/i.test(k)){enter(norm(k)[0]);return}if(k==="Backspace"||k==="Delete"){if(!S.active)return;for(let i=S.active.cells.length-1;i>=0;i--){const c=S.active.cells[i];if(S.answers[key(c.r,c.c)]){delete S.answers[key(c.r,c.c)];S.cursor=i;persist();draw();return}}return}if(["ArrowRight","ArrowDown","ArrowLeft","ArrowUp"].includes(k)){const i=S.layout.entries.indexOf(S.active),d=(k==="ArrowRight"||k==="ArrowDown")?1:-1;select((i+d+S.layout.entries.length)%S.layout.entries.length)}}
$("#board").addEventListener("click",ev=>{const cl=ev.target.closest("[data-entry]");if(cl){select(cl.dataset.entry);return}const ce=ev.target.closest("[data-cell]");if(ce){const [r,c]=ce.dataset.cell.split(",").map(Number),es=S.layout.entries.filter(e=>e.cells.some(x=>x.r===r&&x.c===c));if(es.length){const i=es.indexOf(S.active);select(S.layout.entries.indexOf(es[(i+1)%es.length]))}}});
document.addEventListener("keydown",ev=>{if(ev.metaKey||ev.ctrlKey||ev.altKey||/INPUT|TEXTAREA/.test(ev.target.tagName))return;if(/^[а-яё]$/i.test(ev.key)||["Backspace","Delete","ArrowRight","ArrowLeft","ArrowUp","ArrowDown"].includes(ev.key)){ev.preventDefault();keyboard(ev.key)}});
$("#reset").addEventListener("click",()=>{S.answers={};persist();draw();toast("Поле очищено")});
$("#fullscreen").addEventListener("click",async()=>{try{if(!document.fullscreenElement){await document.documentElement.requestFullscreen();document.body.classList.add("fullscreen-mode")}else{await document.exitFullscreen();document.body.classList.remove("fullscreen-mode")}}catch(e){document.body.classList.toggle("fullscreen-mode")}});
document.addEventListener("fullscreenchange",()=>document.body.classList.toggle("fullscreen-mode",!!document.fullscreenElement));
const frame=$("#boardFrame");frame.addEventListener("wheel",ev=>{const dx=ev.shiftKey?ev.deltaY:ev.deltaX,dy=ev.shiftKey?0:ev.deltaY;const canX=frame.scrollWidth>frame.clientWidth,canY=frame.scrollHeight>frame.clientHeight;if((canX&&dx)||(canY&&dy)){ev.preventDefault();if(canX)frame.scrollLeft+=dx;if(canY)frame.scrollTop+=dy}},{passive:false});window.addEventListener("resize",()=>{if(S.layout)draw()});
S.layout=layoutFor();S.answers=saved();if(!Object.keys(S.answers).length){S.layout.entries.forEach(e=>e.cells.forEach((cell,i)=>{S.answers[key(cell.r,cell.c)]=e.answer[i]}));persist()}S.active=S.layout.entries[0]||null;draw();
})();