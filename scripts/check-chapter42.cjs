const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/42-capstone-build-an-evaluated-movie-knowledge-assistant/';
const style='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-42');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/41-ai-research-agi-and-keeping-your-knowledge-current/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:41,complete:true,bookmark:'1-turn-a-headline-into-a-testable-claim'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-41-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 42'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.equal(await page.locator('.katex-error').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.screenshot({path:path.join(out,'desktop.png')});for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style});
  await page.getByRole('button',{name:'Search Chapter 42'}).click();await page.locator('#search-input').fill('valid citation');await page.locator('.search-item[href="#6-add-an-llm-at-a-controlled-boundary"]:visible').click();assert.equal(await page.locator('.optional-depth').nth(3).getAttribute('open'),'');await page.locator('.optional-depth').nth(3).locator('summary').click();
  const lab=page.locator('.capstone-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.capstone-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  const {evaluate,run,data}=await import('../src/lib/capstone.mjs');
  const cases=[];for(const constraints of [true,false])for(const aliases of [true,false])for(const tool of ['online','timeout'])cases.push({constraints,aliases,tool});
  for(const config of cases){
   await page.locator('#cap-constraints').selectOption(String(config.constraints));await page.locator('#cap-aliases').selectOption(String(config.aliases));await page.locator('#cap-tool').selectOption(config.tool);
   const expected=evaluate(config);
   assert.equal(await lab.locator('[data-cap="passed"]').innerText(),expected.passed+'/8');assert.equal(await lab.locator('[data-cap="violations"]').innerText(),String(expected.violations));assert.equal(await lab.locator('[data-cap="gate"]').innerText(),expected.gate);
   await lab.getByRole('button',{name:'Request trace',exact:true}).click();
   for(const c of data.cases){
    await page.locator('#cap-case').selectOption(c.id);const r=run(c.request,config);
    assert.equal(await lab.locator('[data-cap="status"]').innerText(),r.status);assert.equal(await lab.locator('[data-cap="answer"]').innerText(),r.answer);assert.equal(await lab.locator('[data-cap="sources"]').innerText(),'Sources: '+(r.sources.length?r.sources.join(', '):'none'));
    assert.deepEqual(JSON.parse(await lab.locator('.cap-request').innerText()),c.request);assert.deepEqual(await lab.locator('.cap-trace li').allTextContents(),r.trace);
    assert.equal(await lab.getByRole('region',{name:'Candidate scores and eligibility'}).locator('tbody tr').count(),r.candidates.length);
    if(r.candidates.length)assert.deepEqual(await lab.getByRole('region',{name:'Candidate scores and eligibility'}).locator('tbody tr').evaluateAll(rows=>rows.map(row=>[row.children[1].textContent,row.children[2].textContent,row.children[3].firstChild.textContent])),r.candidates.map(c=>[String(c.minutes),String(c.score),c.eligible?'Yes':'No']));
   }
   await lab.getByRole('button',{name:'Evaluation cases',exact:true}).click();assert.deepEqual(await lab.getByRole('region',{name:'Eight development case results'}).locator('tbody tr').evaluateAll(rows=>rows.map(r=>r.getAttribute('data-pass'))),expected.rows.map(r=>String(r.passed)));
   await lab.getByRole('button',{name:'Release decision',exact:true}).click();assert.equal(await lab.locator('[data-cap="tools"]').innerText(),expected.toolFailures===0?'Pass':'Fail');assert.equal(await lab.locator('[data-cap="quality"]').innerText(),expected.passed===8?'Pass':'Fail');assert.equal(await lab.locator('[data-cap="integrity"]').innerText(),expected.violations===0&&expected.evidenceFailures===0?'Pass':'Fail');
   if(config.constraints&&config.aliases){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download capstone report'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-42-capstone-report.json');const file=path.join(out,d.suggestedFilename());await d.saveAs(file);assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),expected);}
  }
  await lab.getByRole('button',{name:'Reset experiment'}).click();assert.equal(await page.locator('#cap-constraints').inputValue(),'true');assert.equal(await page.locator('#cap-case').inputValue(),'C1');
  for(const name of ['Request trace','Evaluation cases','Release decision']){await lab.getByRole('button',{name,exact:true}).click();await lab.screenshot({path:path.join(out,name.toLowerCase().replaceAll(' ','-')+'.png'),style});}
  await page.locator('#cap-aliases').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await lab.locator('[data-cap="passed"]').innerText(),'7/8');await lab.getByRole('button',{name:'Reset experiment'}).click();
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'dark.png'),style});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [0,1,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the capstone workbook ZIP','chapter-42-capstone.zip'],['Download PDF','ai-handbook-chapter-42.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 42 complete'}).click();const bookmark='10-experiment-with-the-capstone-lab';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-42-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-41-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.capstone-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const name of ['Request trace','Evaluation cases','Release decision']){await lab.getByRole('button',{name,exact:true}).click();await lab.screenshot({path:path.join(out,'mobile-'+name.toLowerCase().replaceAll(' ','-')+'.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),4);assert.equal(await page.locator('#cap-tool').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/8\/8/);
  assert.deepEqual(errors,[]);const result={passed:true,headings:12,diagrams:3,optionalNotes:6,capstoneConfigurations:cases.length,requestTraces:cases.length*8,checks:['request validation, retrieval, evidence, eight-case evaluation, gate controls and JSON reports','keyboard controls','quiz search downloads','progress isolation and curriculum','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
