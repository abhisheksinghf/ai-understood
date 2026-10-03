const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/16-information-retrieval-how-search-works/';
const screenshotStyle='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
function equal(a,b){if(typeof b==='number'){assert.ok(Math.abs(a-b)<1e-10);return;}if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(b))equal(a[k],b[k]);return;}assert.equal(a,b);}
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-16');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/15-evaluating-and-improving-ml-models/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:15,complete:true,bookmark:'1-define-success-before-comparing-scores'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-15-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 16'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);
  assert.equal(await page.locator('.optional-depth').count(),5);assert.equal(await page.locator('.optional-depth[open]').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'false');
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  await page.screenshot({path:path.join(out,'desktop.png')});
  for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style:screenshotStyle});
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.getByRole('button',{name:'Search Chapter 16'}).click();await page.locator('#search-input').fill('lemmatization');await page.locator('.search-item:visible').filter({hasText:'2. Give'}).click();
  const note=page.locator('.optional-depth').first();assert.equal(await note.getAttribute('open'),'');await note.locator('summary').click();
  const lab=page.locator('.retrieval-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.retrieval-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  const {search}=await import('../src/lib/information-retrieval.mjs');
  const movieIds=()=>lab.locator('.retrieval-result').evaluateAll(rows=>rows.map(r=>r.dataset.movieId));
  assert.deepEqual(await movieIds(),['M008','M004','M005']);assert.equal(await lab.locator('[data-search-lab="precision"]').innerText(),'66.67%');
  await lab.screenshot({path:path.join(out,'search.png'),style:screenshotStyle});
  async function download(expected,label){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download search result'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-16-search-result.json');const file=path.join(out,label+'.json');await d.saveAs(file);equal(JSON.parse(await fs.readFile(file,'utf8')),expected);}
  for(const method of ['overlap','tfidf','bm25'])for(const mode of ['any','all'])for(const limit of ['all','under120']){
   await page.locator('#retrieval-method').selectOption(method);await page.locator('#retrieval-mode').selectOption(mode);await page.locator('#retrieval-limit').selectOption(limit);
   const r=search('space rescue',method,mode,limit);assert.deepEqual(await movieIds(),r.results.map(d=>d.id));
   assert.deepEqual(await lab.locator('.retrieval-score').allTextContents(),r.results.map(d=>d.score.toFixed(4)+' score'));
   if(mode==='any'&&limit==='all')await download(r,method+'-'+mode+'-'+limit);
  }
  await lab.getByRole('button',{name:'Reset search'}).click();await page.locator('#retrieval-k').selectOption('5');assert.equal(await lab.locator('.retrieval-result').count(),5);assert.equal(await lab.locator('[data-search-lab="precision"]').innerText(),'40.00%');
  await page.locator('#retrieval-mode').selectOption('all');assert.equal(await lab.locator('.retrieval-result').count(),2);assert.equal(await lab.locator('[data-search-lab="precision"]').innerText(),'40.00%');
  await lab.getByRole('button',{name:'Reset search'}).click();await lab.locator('.retrieval-index summary').click();assert.match(await lab.locator('.retrieval-index').innerText(),/M008 → 2 \[1, 9\]/);
  await lab.locator('.retrieval-score-detail summary').first().click();assert.equal(await lab.locator('.retrieval-score-detail').first().locator('tbody tr').count(),2);await lab.screenshot({path:path.join(out,'explanations.png'),style:screenshotStyle});await lab.locator('.retrieval-score-detail summary').first().click();await lab.locator('.retrieval-index summary').click();
  await lab.locator('.retrieval-tuning summary').click();await page.locator('#retrieval-k1').focus();await page.keyboard.press('Home');await page.locator('#retrieval-b').focus();await page.keyboard.press('End');await download(search('space rescue','bm25','any','all',3,0,1),'zero-k1');assert.deepEqual(await movieIds(),['M004','M008','M005']);
  await page.locator('#retrieval-method').selectOption('tfidf');assert.equal(await page.locator('#retrieval-k1').isDisabled(),true);await lab.locator('.retrieval-tuning summary').click();
  await lab.getByRole('button',{name:'Reset search'}).click();for(const q of ['funny adventure','quiet drama','hilarious quest']){await lab.getByRole('button',{name:q,exact:true}).click();assert.deepEqual(await movieIds(),search(q).results.map(d=>d.id));}
  assert.equal(await lab.locator('[data-search-lab="unjudged"]').isVisible(),true);assert.equal(await lab.locator('.retrieval-empty').isVisible(),true);
  await page.locator('#retrieval-query').fill('');assert.match(await lab.locator('.retrieval-empty').innerText(),/Enter a query/);await page.locator('#retrieval-query').fill('SPACE space, rescue!');await download(search('SPACE space, rescue!'),'duplicates');
  await page.locator('#retrieval-query').fill('<script>alert(1)</script>');assert.equal(await lab.locator('[data-search-lab="unjudged"]').isVisible(),true);assert.deepEqual(errors,[]);
  await lab.getByRole('button',{name:'Reset search'}).click();await lab.locator('.retrieval-catalog summary').click();assert.equal(await lab.locator('.retrieval-catalog-row').count(),8);await lab.locator('.retrieval-catalog summary').click();
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'search-dark.png'),style:screenshotStyle});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [1,0,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the movie search workbook ZIP','chapter-16-search.zip'],['Download PDF','ai-handbook-chapter-16.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 16 complete'}).click();const bookmark='9-explore-the-search-process';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-16-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-15-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.screenshot({path:path.join(out,'mobile-lab.png'),style:screenshotStyle});await lab.locator('.retrieval-score-detail summary').first().click();await lab.locator('.retrieval-index summary').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#retrieval-limit').selectOption('under120');assert.equal(await lab.locator('[data-search-lab="recall"]').innerText(),'100.00%');
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),3);assert.equal(await page.locator('#retrieval-query').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/2.1863/);await page.emulateMedia({media:'screen'});await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
  assert.deepEqual(errors,[]);const report={passed:true,headings:12,diagrams:3,optionalNotes:5,checks:['ranking and JSON parity','OR AND and runtime filtering','unknown and repeated query words','BM25 keyboard settings','metrics and short result lists','quiz and search','downloads and progress isolation','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
