const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/17-embeddings-and-vector-search/';
const screenshotStyle='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
function equal(a,b){if(typeof b==='number'){assert.ok(Math.abs(a-b)<1e-10);return;}if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(b))equal(a[k],b[k]);return;}assert.equal(a,b);}
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-17');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/16-information-retrieval-how-search-works/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:16,complete:true,bookmark:'1-start-with-an-information-need'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-16-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 17'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);
  assert.equal(await page.locator('.optional-depth').count(),5);assert.equal(await page.locator('.optional-depth[open]').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'false');
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  await page.screenshot({path:path.join(out,'desktop.png')});
  for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style:screenshotStyle});
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.getByRole('button',{name:'Search Chapter 17'}).click();await page.locator('#search-input').fill('pooling');await page.locator('.search-item:visible').filter({hasText:'2. Understand'}).click();
  const note=page.locator('.optional-depth').first();assert.equal(await note.getAttribute('open'),'');await note.locator('summary').click();
  const lab=page.locator('.vector-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.vector-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  const {experiment}=await import('../src/lib/vector-search.mjs');
  const movieIds=()=>lab.locator('.vector-results tbody tr').evaluateAll(rows=>rows.map(r=>r.dataset.movieId));
  const pct=x=>x===null?'Undefined':(100*x).toFixed(2)+'%';
  async function check(r){assert.deepEqual(await movieIds(),r.results.map(d=>d.id));assert.deepEqual(await lab.locator('[data-vector-value]').allTextContents(),r.results.map(d=>d.value.toFixed(4)));assert.equal(await lab.locator('[data-vector="neighbors"]').innerText(),pct(r.audit.neighbor_recall_at_k));assert.equal(await lab.locator('[data-vector="precision"]').innerText(),pct(r.evaluation.precision_at_k));assert.equal(await lab.locator('[data-vector="recall"]').innerText(),pct(r.evaluation.recall_at_k));}
  async function download(r,label){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download vector result'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-17-vector-result.json');const saved=path.join(out,label+'.json');await d.saveAs(saved);equal(JSON.parse(await fs.readFile(saved,'utf8')),r);}
  await check(experiment());await lab.screenshot({path:path.join(out,'vectors.png'),style:screenshotStyle});await download(experiment(),'default');
  assert.equal(await lab.locator('svg circle').count(),8);
  for(const q of ['space','funny','quiet'])for(const metric of ['cosine','dot','euclidean'])for(const normalization of ['raw','unit']){
   await page.locator('#vector-query').selectOption(q);await page.locator('#vector-metric').selectOption(metric);await page.locator('#vector-normalization').selectOption(normalization);await check(experiment(q,metric,normalization));
  }
  await lab.getByRole('button',{name:'Reset vector search'}).click();await page.locator('#vector-metric').selectOption('dot');await page.locator('#vector-mode').selectOption('probe1');assert.equal(await page.locator('#vector-metric').inputValue(),'cosine');assert.equal(await page.locator('#vector-metric').isDisabled(),true);await check(experiment('space','cosine','raw','probe1'));await download(experiment('space','cosine','raw','probe1'),'one-cell');
  for(const mode of ['probe1','probe2','probe3'])for(const limit of ['all','under120']){await page.locator('#vector-mode').selectOption(mode);await page.locator('#vector-limit').selectOption(limit);await check(experiment('space','cosine','raw',mode,limit));}
  await page.locator('#vector-k').selectOption('5');await check(experiment('space','cosine','raw','probe3','under120',5));
  await lab.locator('.vector-cells summary').click();assert.equal(await lab.locator('.vector-cells tbody tr').count(),3);assert.match(await lab.locator('[data-vector="reference"]').innerText(),/M004, M008, M003/);await lab.locator('.vector-cells summary').click();
  await lab.locator('.vector-values summary').click();assert.equal(await lab.locator('.vector-source').count(),8);await lab.locator('.vector-values summary').click();
  await lab.getByRole('button',{name:'Reset vector search'}).click();await page.locator('#vector-query').selectOption('funny');await page.locator('#vector-k').selectOption('1');assert.equal(await lab.locator('[data-vector="precision"]').innerText(),'0.00%');assert.match(await lab.locator('[data-vector="bm25"]').innerText(),/Moonlight Map/);await download(experiment('funny','cosine','raw','exact','all',1),'funny');
  await lab.getByRole('button',{name:'Reset vector search'}).click();await page.locator('#vector-normalization').selectOption('unit');await lab.locator('.training-figure').screenshot({path:path.join(out,'normalized-plot.png'),style:screenshotStyle});await lab.getByRole('button',{name:'Reset vector search'}).click();
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'vectors-dark.png'),style:screenshotStyle});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [1,0,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the vector search workbook ZIP','chapter-17-vector-search.zip'],['Download PDF','ai-handbook-chapter-17.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 17 complete'}).click();const bookmark='9-explore-the-vector-search';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-17-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-16-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.screenshot({path:path.join(out,'mobile-lab.png'),style:screenshotStyle});await lab.locator('.vector-cells summary').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#vector-mode').selectOption('probe1');assert.equal(await lab.locator('[data-vector="neighbors"]').innerText(),'66.67%');
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),4);assert.equal(await page.locator('#vector-query').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/0.9939/);await page.emulateMedia({media:'screen'});await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
  assert.deepEqual(errors,[]);const report={passed:true,headings:12,diagrams:3,optionalNotes:5,checks:['three metrics and unit normalization','partial cell search and exact reference','relevance and neighbor recall','BM25 baseline and JSON downloads','source vectors and plot','quiz and reader search','downloads and progress isolation','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
