const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/33-mcp-and-multi-agent-systems/';
const style='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-33');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/32-building-ai-agents/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:32,complete:true,bookmark:'1-what-makes-a-system-an-agent'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-32-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 33'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.equal(await page.locator('.katex-error').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.screenshot({path:path.join(out,'desktop.png')});for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style});
  await page.getByRole('button',{name:'Search Chapter 33'}).click();await page.locator('#search-input').fill('interoperability');await page.locator('.search-item[href="#2-understand-the-host-client-and-server"]:visible').click();assert.equal(await page.locator('.optional-depth').nth(0).getAttribute('open'),'');await page.locator('.optional-depth').nth(0).locator('summary').click();
  const lab=page.locator('.coordination-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.coordination-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  const {runCoordination,data,defaults,protocolTranscript}=await import('../src/lib/coordination.mjs');
  await page.locator('#coord-scenario').selectOption('missing');await page.locator('#coord-scenario').selectOption('normal');
  assert.equal(await lab.locator('[data-coord="status"]').innerText(),'verified');assert.equal(await lab.locator('[data-coord="elapsed"]').innerText(),'6');
  await lab.screenshot({path:path.join(out,'coordination.png'),style});
  await lab.getByText('Inspect specialist reports',{exact:true}).click();assert.deepEqual(JSON.parse(await lab.locator('details').nth(0).locator('pre').innerText()),runCoordination().reports);await lab.getByText('Inspect specialist reports',{exact:true}).click();
  await lab.getByText('Inspect a separate MCP message example',{exact:true}).click();assert.deepEqual(JSON.parse(await lab.locator('details').nth(1).locator('pre').innerText()),protocolTranscript());await lab.getByText('Inspect a separate MCP message example',{exact:true}).click();
  const cases=[...data.scenarios.flatMap(s=>[true,false].map(validate=>({...defaults,scenario:s.id,validate}))),{...defaults,schedule:'sequential'},{...defaults,pattern:'handoff'},{...defaults,budget:1},{...defaults,budget:2}];
  for(const config of cases){
   for(const key of ['scenario','pattern','schedule','budget'])await page.locator('#coord-'+key).selectOption(String(config[key]));
   await page.locator('#coord-validate').setChecked(config.validate);const expected=runCoordination(config);
   for(const [key,value]of Object.entries({status:expected.status,owner:expected.owner,answer:expected.answer,jobs:expected.jobCount,elapsed:expected.elapsed,work:expected.workUnits}))assert.equal(await lab.locator('[data-coord="'+key+'"]').innerText(),String(value));
   const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download coordination report'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-33-coordination-report.json');const file=path.join(out,d.suggestedFilename());await d.saveAs(file);assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),expected);
  }
  await lab.getByRole('button',{name:'Reset experiment'}).click();assert.equal(await page.locator('#coord-budget').inputValue(),'3');assert.equal(await lab.locator('[data-coord="status"]').innerText(),'verified');
  await page.locator('#coord-validate').focus();await page.keyboard.press('Space');assert.equal(await lab.locator('[data-coord="status"]').innerText(),'accepted_unchecked');await page.keyboard.press('Space');
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'dark.png'),style});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [0,1,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the coordination workbook ZIP','chapter-33-coordination.zip'],['Download PDF','ai-handbook-chapter-33.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 33 complete'}).click();const bookmark='10-experiment-with-coordination';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-33-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-32-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.coordination-lab')?.closest('astro-island')?.hasAttribute('ssr'));await page.locator('#coord-scenario').selectOption('missing');await page.locator('#coord-scenario').selectOption('normal');await lab.screenshot({path:path.join(out,'mobile-coordination.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),4);assert.equal(await page.locator('#coord-scenario').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/6 time units; 8 work units/);
  assert.deepEqual(errors,[]);const result={passed:true,headings:12,diagrams:3,optionalNotes:6,coordinationConfigurations:14,checks:['ownership, schedules, evidence gates, budgets and JSON reports','keyboard controls','quiz search downloads','progress isolation and curriculum','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
