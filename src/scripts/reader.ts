const $ = <T extends HTMLElement>(id:string)=>document.getElementById(id) as T|null;
const toast=$('toast');
let toastTimer:number;
function notify(message:string){if(!toast)return;toast.textContent=message;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>toast.classList.remove('visible'),4500);}
const chapterNumber=Number(document.body.dataset.chapter)||1;
// Retain the original key and accept legacy Chapter 1 backups.
const key=chapterNumber===1?'ai-handbook-progress-v1':`ai-handbook-progress-chapter-${chapterNumber}-v1`;
type Progress={version:1;chapter?:number;complete:boolean;bookmark:string|null};
const blank:Progress={version:1,chapter:chapterNumber,complete:false,bookmark:null};
// Keep saved progress and old links valid after the example's heading changed.
const legacyMovieHeading='9-real-world-walkthrough-an-incident-report-assistant';
const movieHeading='9-real-world-walkthrough-a-movie-recommendation-assistant';
function migrateBookmark(value:unknown):unknown {
  if(chapterNumber===1&&value&&typeof value==='object'&&'bookmark' in value&&value.bookmark===legacyMovieHeading)return {...value,bookmark:movieHeading};
  return value;
}
function migrateLegacyHash(){if(chapterNumber===1&&location.hash==='#'+legacyMovieHeading){history.replaceState(null,'','#'+movieHeading);requestAnimationFrame(()=>document.getElementById(movieHeading)?.scrollIntoView());}}
migrateLegacyHash();
window.addEventListener('hashchange',migrateLegacyHash);
function valid(x:unknown):x is Progress {if(!x||typeof x!=='object')return false;const p=x as Progress;return p.version===1&&(p.chapter===chapterNumber||(p.chapter===undefined&&chapterNumber===1))&&typeof p.complete==='boolean'&&(p.bookmark===null||(typeof p.bookmark==='string'&&!!document.getElementById(p.bookmark)&&!!document.querySelector(`.page-toc a[data-section="${CSS.escape(p.bookmark)}"]`)));}
let progress:Progress={...blank};
try{const value=localStorage.getItem(key);if(value){const parsed=migrateBookmark(JSON.parse(value));if(valid(parsed))progress={...parsed,chapter:chapterNumber};}}catch{}
function save(){try{localStorage.setItem(key,JSON.stringify(progress));return true;}catch{notify('Your browser could not save progress. Export a backup to keep it.');return false;}}
function updateProgress(){const button=$('complete-chapter');if(button){button.textContent=progress.complete?`✓ Chapter ${chapterNumber} complete · undo`:`Mark Chapter ${chapterNumber} complete`;button.setAttribute('aria-pressed',String(progress.complete));}const resume=$<HTMLAnchorElement>('resume-place');if(resume){resume.hidden=!progress.bookmark;if(progress.bookmark)resume.href=`#${progress.bookmark}`;}}
updateProgress();
$('complete-chapter')?.addEventListener('click',()=>{progress.complete=!progress.complete;const saved=save();updateProgress();if(saved)notify(progress.complete?`Chapter ${chapterNumber} marked complete.`:'Chapter completion cleared.');});
const themeButton=$('theme-toggle');
function updateThemeLabel(){themeButton?.setAttribute('aria-label',document.documentElement.dataset.theme==='dark'?'Switch to light theme':'Switch to dark theme');}
updateThemeLabel();
themeButton?.addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('ai-handbook-theme',theme);}catch{}updateThemeLabel();});
const sidebar=$('book-sidebar');
const menu=$('menu-toggle');
menu?.addEventListener('click',()=>{const open=sidebar?.classList.toggle('is-open');menu.setAttribute('aria-expanded',String(!!open));menu.setAttribute('aria-label',open?'Close handbook navigation':'Open handbook navigation');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(dialog?.open){e.preventDefault();dialog.close();}sidebar?.classList.remove('is-open');menu?.setAttribute('aria-expanded','false');menu?.setAttribute('aria-label','Open handbook navigation');}});
$('print-chapter')?.addEventListener('click',()=>window.print());
let openDetails:HTMLDetailsElement[]=[];
window.addEventListener('beforeprint',()=>{openDetails=Array.from(document.querySelectorAll<HTMLDetailsElement>('.chapter-content details:not([open])'));openDetails.forEach(d=>d.open=true);});
window.addEventListener('afterprint',()=>openDetails.forEach(d=>d.open=false));
const tocLinks=Array.from(document.querySelectorAll<HTMLAnchorElement>('.page-toc [data-section]'));
const sections=tocLinks.map(a=>document.getElementById(a.dataset.section!)).filter((x):x is HTMLElement=>!!x);
let active=sections[0]?.id||'';
function onScroll(){const end=document.querySelector('.chapter-content');if(end){const start=end.getBoundingClientRect().top+scrollY;const bottom=end.getBoundingClientRect().bottom+scrollY-innerHeight;const percent=Math.max(0,Math.min(100,100*(scrollY-start)/Math.max(1,bottom-start)));const bar=$('scroll-bar');if(bar)bar.style.width=`${percent}%`;}
  const toolsBottom=document.querySelector('.reader-tools')?.getBoundingClientRect().bottom||120;
  const cutoff=Math.max(145,Math.min(innerHeight/2,toolsBottom+25));
  for(const section of sections){if(section.getBoundingClientRect().top<=cutoff)active=section.id;}
  if(sections[0]&&sections[0].getBoundingClientRect().top>cutoff)active=sections[0].id;
  tocLinks.forEach(a=>{const selected=a.dataset.section===active;a.classList.toggle('current',selected);if(selected)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
}
let ticking=false;window.addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(()=>{onScroll();ticking=false;});ticking=true;}},{passive:true});onScroll();
document.querySelector('.reader-options')?.addEventListener('toggle',onScroll);
$('save-place')?.addEventListener('click',()=>{onScroll();progress.bookmark=active;const saved=save();updateProgress();if(saved)notify('Section bookmarked in this browser.');});
$('export-progress')?.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(progress,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`ai-handbook-chapter-${String(chapterNumber).padStart(2,'0')}-progress.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$<HTMLInputElement>('import-progress')?.addEventListener('change',async e=>{const input=e.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{if(file.size>10000)throw new Error('File is too large');const candidate:unknown=migrateBookmark(JSON.parse(await file.text()));if(!valid(candidate))throw new Error('Invalid progress file');progress={version:1,chapter:chapterNumber,complete:candidate.complete,bookmark:candidate.bookmark};const saved=save();updateProgress();if(saved)notify('Progress imported.');}catch{notify('This is not a valid handbook progress backup for this chapter. Your existing progress was kept.');}finally{input.value='';}});
const dialog=$<HTMLDialogElement>('search-dialog');
const search=$<HTMLInputElement>('search-input');
const searchItems=Array.from(document.querySelectorAll<HTMLAnchorElement>('.search-item'));
function openSearch(){dialog?.showModal();search?.focus();}
$('open-search')?.addEventListener('click',openSearch);
$('close-search')?.addEventListener('click',()=>dialog?.close());
dialog?.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&dialog){e.preventDefault();openSearch();}});
search?.addEventListener('input',()=>{const terms=search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);let count=0;searchItems.forEach(item=>{const match=terms.every(t=>(item.dataset.search||'').includes(t));item.hidden=!match;if(match)count++;});const status=$('search-status');if(status)status.textContent=count?`${count} matching section${count===1?'':'s'}`:'No matching sections. Try a different term.';});
searchItems.forEach(item=>item.addEventListener('click',()=>{
  dialog?.close();const section=document.getElementById(item.hash.slice(1));
  const terms=(search?.value||'').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if(section&&terms.length){
    let sibling=section.nextElementSibling;
    while(sibling&&sibling.tagName!=='H2'){
      const details=[...(sibling instanceof HTMLDetailsElement?[sibling]:[]),...sibling.querySelectorAll<HTMLDetailsElement>('details')];
      details.forEach(detail=>{if(terms.every(term=>(detail.textContent||'').toLowerCase().includes(term))){detail.open=true;let parent=detail.parentElement?.closest('details');while(parent){parent.open=true;parent=parent.parentElement?.closest('details');}}});
      sibling=sibling.nextElementSibling;
    }
  }
  section?.setAttribute('tabindex','-1');section?.focus({preventScroll:true});
}));
