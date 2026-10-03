const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/18-building-a-rag-system-step-by-step/';
const screenshotStyle='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
function equal(a,b){if(typeof b==='number'){assert.ok(Math.abs(a-b)<1e-10);return;}if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(b))equal(a[k],b[k]);return;}assert.equal(a,b);}
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-18');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/17-embeddings-and-vector-search/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:17,complete:true,bookmark:'1-a-vector-is-a-representation-not-a-verdict'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-17-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 18'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);
  assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'false');
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  await page.screenshot({path:path.join(out,'desktop.png')});
  for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style:screenshotStyle});
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.getByRole('button',{name:'Search Chapter 18'}).click();await page.locator('#search-input').fill('revisions');await page.locator('.search-item:visible').filter({hasText:'3. Ingest'}).click();
  const note=page.locator('.optional-depth').first();assert.equal(await note.getAttribute('open'),'');await note.locator('summary').click();
  const lab=page.locator('.rag-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.rag-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  const {experiment}=await import('../src/lib/rag-pipeline.mjs');
  async function check(r){assert.deepEqual(await lab.locator('.rag-ranking tbody tr').evaluateAll(rows=>rows.map(x=>x.dataset.chunkId)),r.candidates.map(x=>x.id));assert.deepEqual(await lab.locator('[data-rag-score]').allTextContents(),r.candidates.map(c=>c.score.toFixed(4)));assert.equal(await lab.locator('[data-rag="status"]').innerText(),r.validation.status);assert.equal(await lab.locator('[data-rag="units"]').innerText(),r.context.used+'/'+r.context.budget);assert.equal(await lab.locator('[data-rag="chunks"]').innerText(),String(r.chunks.length));assert.equal(await lab.locator('[data-rag="context"]').innerText(),String(r.context.selected.length));assert.deepEqual(await lab.locator('.rag-evidence blockquote').allTextContents(),r.validation.evidence.map(e=>e.quote));}
  async function download(r,label){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download RAG trace'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-18-rag-trace.json');const saved=path.join(out,label+'.json');await d.saveAs(saved);equal(JSON.parse(await fs.readFile(saved,'utf8')),r);}
  await check(experiment());await lab.screenshot({path:path.join(out,'rag.png'),style:screenshotStyle});await download(experiment(),'default');
  await lab.getByRole('link',{name:'View M004:r1:card'}).click();assert.equal(await page.locator('#rag-context').getAttribute('open'),'');assert.equal(await lab.locator('.rag-source').count(),2);await page.locator('#rag-context summary').click();
  for(const q of ['plot','runtime','streaming','space'])for(const c of ['card','section'])for(const k of [1,3,5])for(const b of [0,20,50,120]){
   await page.locator('#rag-query').selectOption(q);await page.locator('#rag-chunking').selectOption(c);await page.locator('#rag-k').selectOption(String(k));await page.locator('#rag-budget').selectOption(String(b));await check(experiment(q,c,k,b));
  }
  await lab.getByRole('button',{name:'Reset RAG explorer'}).click();await page.locator('#rag-chunking').selectOption('section');await page.locator('#rag-k').selectOption('1');await check(experiment('plot','section',1));await download(experiment('plot','section',1),'missing-plot');
  await page.locator('#rag-k').selectOption('3');await page.locator('#rag-budget').selectOption('20');await check(experiment('plot','section',3,20));await page.locator('#rag-budget').selectOption('50');await check(experiment('plot','section',3,50));
  await lab.getByRole('button',{name:'Reset RAG explorer'}).click();await page.locator('#rag-query').selectOption('space');await page.locator('#rag-limit').selectOption('under120');await check(experiment('space','card',3,120,'under120'));
  for(const fault of ['bad_id','bad_quote']){await page.locator('#rag-fault').selectOption(fault);await check(experiment('space','card',3,120,'under120',fault));}
  await download(experiment('space','card',3,120,'under120','bad_quote'),'bad-quote');
  await lab.locator('.rag-prompt summary').click();assert.match(await lab.locator('.rag-prompt').innerText(),/Available on StreamBox/);await lab.locator('.rag-prompt summary').click();
  await lab.getByRole('button',{name:'Reset RAG explorer'}).click();await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'rag-dark.png'),style:screenshotStyle});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [1,0,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the RAG workbook ZIP','chapter-18-rag.zip'],['Download PDF','ai-handbook-chapter-18.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 18 complete'}).click();const bookmark='9-explore-the-complete-evidence-path';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-18-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-17-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.screenshot({path:path.join(out,'mobile-lab.png'),style:screenshotStyle});await lab.locator('.rag-prompt summary').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#rag-fault').selectOption('bad_quote');assert.equal(await lab.locator('[data-rag="status"]').innerText(),'blocked');
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),4);assert.equal(await page.locator('#rag-query').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/M004:r1:card/);await page.emulateMedia({media:'screen'});await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
  assert.deepEqual(errors,[]);const report={passed:true,headings:12,diagrams:3,optionalNotes:6,checks:['chunk boundaries and BM25 rankings','context packing and abstention','citation and quote failures','trace downloads and evidence links','quiz and reader search','progress isolation','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
