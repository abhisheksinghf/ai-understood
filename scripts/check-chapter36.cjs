const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/36-deploying-and-operating-ai-applications/';
const style='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-36');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/35-ai-security-and-responsible-use/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:35,complete:true,bookmark:'1-start-with-what-you-need-to-protect'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-35-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 36'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.equal(await page.locator('.katex-error').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.screenshot({path:path.join(out,'desktop.png')});for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style});
  await page.getByRole('button',{name:'Search Chapter 36'}).click();await page.locator('#search-input').fill('obsolete');await page.locator('.search-item[href="#2-version-everything-that-can-change-behavior"]:visible').click();assert.equal(await page.locator('.optional-depth').nth(0).getAttribute('open'),'');await page.locator('.optional-depth').nth(0).locator('summary').click();
  const lab=page.locator('.operations-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.operations-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  const {evaluate}=await import('../src/lib/operations.mjs');
  const labels={rolled_back:'Rolled back',review_needed:'Review needed',baseline_only:'Baseline only',observe_more:'Keep observing'};
  await page.locator('#ops-scenario').selectOption('healthy');await page.locator('#ops-scenario').selectOption('bad_release');
  assert.equal(await lab.locator('[data-ops="good"]').innerText(),'19/20');
  await lab.screenshot({path:path.join(out,'operations.png'),style});
  await lab.getByText('Inspect one request and its attempts',{exact:true}).click();await page.locator('#ops-record').selectOption('R01');const inspected=JSON.parse(await lab.locator('.operations-inspector pre').innerText());assert.equal(inspected.status,200);assert.equal(inspected.quality,false);assert.equal(inspected.version,'candidate');await lab.getByText('Inspect one request and its attempts',{exact:true}).click();
  const cases=[];for(const scenario of ['healthy','bad_release','provider_fault'])for(const share of [0,20,60,100])for(const retries of [0,1])for(const deadline of [1200,2400])for(const rollback of ['automatic','observe'])cases.push({scenario,share,retries,deadline,rollback});
  for(const config of cases){
   for(const key of ['scenario','share','retries','deadline','rollback'])await page.locator('#ops-'+key).selectOption(String(config[key]));
   const expected=evaluate(config),t=expected.totals;
   for(const [key,value]of Object.entries({good:t.good+'/'+t.n,http:t.httpOk+'/'+t.n,candidate:t.candidate,attempts:t.attempts,cost:t.costUnits,p95:t.p95+' ms',decision:labels[expected.decision],budget:expected.budgetRemaining,slo:expected.sloMet?'SLO met':'SLO missed'}))assert.equal(await lab.locator('[data-ops="'+key+'"]').innerText(),String(value));
   assert.equal(await lab.locator('.operations-table tbody tr').count(),4);
   const cells=await lab.locator('.operations-table tbody tr').evaluateAll(rows=>rows.map(row=>row.children[2].textContent));assert.deepEqual(cells,expected.windows.map(w=>w.good+'/5'));
   if(config.share===20&&config.retries===1&&config.deadline===2400){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download operations report'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-36-operations-report.json');const file=path.join(out,d.suggestedFilename());await d.saveAs(file);assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),expected);}
  }
  await lab.getByRole('button',{name:'Reset experiment'}).click();assert.equal(await page.locator('#ops-share').inputValue(),'20');assert.equal(await lab.locator('[data-ops="good"]').innerText(),'19/20');
  await page.locator('#ops-scenario').focus();await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');assert.equal(await lab.locator('[data-ops="good"]').innerText(),'20/20');await lab.getByRole('button',{name:'Reset experiment'}).click();
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'dark.png'),style});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [0,1,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the operations workbook ZIP','chapter-36-operations.zip'],['Download PDF','ai-handbook-chapter-36.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 36 complete'}).click();const bookmark='10-experiment-with-the-release-simulator';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-36-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-35-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.operations-lab')?.closest('astro-island')?.hasAttribute('ssr'));await page.locator('#ops-scenario').selectOption('healthy');await page.locator('#ops-scenario').selectOption('bad_release');await lab.screenshot({path:path.join(out,'mobile-operations.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),3);assert.equal(await page.locator('#ops-scenario').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/19\/20/);
  assert.deepEqual(errors,[]);const result={passed:true,headings:12,diagrams:3,optionalNotes:6,operationsConfigurations:cases.length,checks:['rollout windows, deadlines, retries, SLOs, rollback routing and JSON reports','keyboard controls','quiz search downloads','progress isolation and curriculum','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
