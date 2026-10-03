const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/27-choosing-between-prompting-rag-tools-and-fine-tuning/';
const style='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-27');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/26-efficient-and-advanced-llm-systems/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:26,complete:true,bookmark:'1-decide-what-efficient-means'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-26-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 27'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.equal(await page.locator('.katex-error').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.screenshot({path:path.join(out,'desktop.png')});for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style});
  await page.getByRole('button',{name:'Search Chapter 27'}).click();await page.locator('#search-input').fill('diagnostic substitutions');await page.locator('.search-item[href="#8-evaluate-the-change-against-the-actual-failure"]:visible').click();assert.equal(await page.locator('.optional-depth').nth(3).getAttribute('open'),'');await page.locator('.optional-depth').nth(3).locator('summary').click();
  const lab=page.locator('.adaptation-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.adaptation-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  await lab.getByRole('button',{name:'2 · Test your design'}).click();await page.locator('#design-rag').waitFor({state:'visible'});await lab.getByRole('button',{name:'1 · Diagnose the request'}).click();await page.locator('#adapt-knowledge').waitFor({state:'visible'});
  const {data,plan,assess,designKeys,configFlags}=await import('../src/lib/adaptation.mjs');
  async function report(config,design){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download decision report'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-27-adaptation-report.json');const file=path.join(out,d.suggestedFilename());await d.saveAs(file);assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),{plan:plan(config),assessment:assess(config,design)});}
  await lab.screenshot({path:path.join(out,'diagnosis.png'),style});
  for(const s of data.scenarios){
   await lab.getByRole('button',{name:'1 · Diagnose the request'}).click();await page.locator('#adapt-scenario').selectOption(s.id);const p=plan(s.config);
   assert.equal(await lab.locator('[data-adapt="methods"]').innerText(),p.methods.map(k=>data.methods[k]).join(' + '));assert.equal(await lab.locator('[data-adapt="readiness"]').innerText(),p.fineTuning.status);
   await lab.getByRole('button',{name:'2 · Test your design'}).click();
   for(const choices of [[],['fineTune'],['rag','readTool','writeTool'],designKeys]){
    const design=Object.fromEntries(designKeys.map(k=>[k,choices.includes(k)]));for(const k of designKeys)await page.locator('#design-'+k).setChecked(design[k]);const result=assess(s.config,design);
    assert.equal(await lab.locator('[data-adapt="verdict"]').innerText(),result.verdict);assert.equal(await lab.locator('[data-adapt="missing"]').innerText(),result.missing.length?result.missing.map(k=>data.methods[k]).join(', '):'None');
    for(const r of result.requirements)assert.equal(await lab.locator('[data-role="'+r.id+'"]').innerText(),r.covered?'Yes':'Missing');await report(s.config,design);
   }
   await lab.getByRole('button',{name:'Use suggested design'}).click();for(const k of designKeys)assert.equal(await page.locator('#design-'+k).isChecked(),p.suggestedDesign[k]);
  }
  await lab.screenshot({path:path.join(out,'design.png'),style});
  await lab.getByRole('button',{name:'1 · Diagnose the request'}).click();
  for(const key of ['baselineTested','examplesReady','evalReady']){
   await page.locator('#adapt-scenario').selectOption('hybrid');await page.locator('#adapt-'+key).uncheck();assert.equal(await page.locator('#adapt-scenario').inputValue(),'custom');const config={...data.scenarios[5].config,[key]:false};assert.equal(await lab.locator('[data-adapt="readiness"]').innerText(),plan(config).fineTuning.status);await report(config,Object.fromEntries(designKeys.map(k=>[k,false])));
  }
  await page.locator('#adapt-knowledge').selectOption('provided');await page.locator('#adapt-writeAction').uncheck();await page.locator('#adapt-behaviorGap').focus();await page.keyboard.press('Space');assert.equal(await lab.locator('[data-adapt="readiness"]').innerText(),'Not indicated');
  await lab.getByText('Inspect the decision rules and assumptions',{exact:true}).click();assert.match(await lab.innerText(),/fresh, authoritative index/);
  await lab.getByRole('button',{name:'Reset experiment'}).click();assert.equal(await page.locator('#adapt-scenario').inputValue(),'hybrid');for(const k of configFlags)assert.equal(await page.locator('#adapt-'+k).isChecked(),true);
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'dark.png'),style});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [0,1,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the adaptation workbook ZIP','chapter-27-adaptation.zip'],['Download PDF','ai-handbook-chapter-27.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 27 complete'}).click();const bookmark='10-explore-the-choices-and-practice-the-diagnosis';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-27-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-26-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.adaptation-lab')?.closest('astro-island')?.hasAttribute('ssr'));await lab.getByRole('button',{name:'2 · Test your design'}).click();await page.locator('#design-rag').waitFor({state:'visible'});await lab.getByRole('button',{name:'1 · Diagnose the request'}).click();await lab.screenshot({path:path.join(out,'mobile-diagnosis.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await lab.getByRole('button',{name:'2 · Test your design'}).click();await lab.getByRole('button',{name:'Use suggested design'}).click();await lab.screenshot({path:path.join(out,'mobile-design.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),3);assert.equal(await page.locator('#adapt-scenario').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/Inputs and actions covered/);
  assert.deepEqual(errors,[]);const result={passed:true,headings:12,diagrams:3,optionalNotes:6,scenarios:6,designCases:24,readinessBoundaries:3,checks:['decision reports','keyboard controls','quiz search downloads','progress isolation and curriculum','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
