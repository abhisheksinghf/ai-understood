const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/37-classical-symbolic-and-probabilistic-ai/';
const style='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-37');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/36-deploying-and-operating-ai-applications/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:36,complete:true,bookmark:'1-deploy-a-service-not-just-a-model-call'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-36-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 37'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.equal(await page.locator('.katex-error').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.screenshot({path:path.join(out,'desktop.png')});for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style});
  await page.getByRole('button',{name:'Search Chapter 37'}).click();await page.locator('#search-input').fill('open-world');await page.locator('.search-item[href="#2-represent-facts-and-draw-logical-conclusions"]:visible').click();assert.equal(await page.locator('.optional-depth').nth(0).getAttribute('open'),'');await page.locator('.optional-depth').nth(0).locator('summary').click();
  const lab=page.locator('.reasoning-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.reasoning-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  const {evaluate,choices}=await import('../src/lib/reasoning.mjs');
  const labels={recommend:'Recommend',abstain:'Skip for now',no_feasible_movie:'No feasible movie'};
  await page.locator('#reason-evidence').selectOption('unknown');await page.locator('#reason-evidence').selectOption('liked');
  assert.equal(await lab.locator('[data-reason="posterior"]').innerText(),'80.00%');
  await lab.screenshot({path:path.join(out,'reasoning.png'),style});
  await lab.getByText('Inspect the probability model and search traces',{exact:true}).click();
  const inspected=JSON.parse(await lab.locator('.reasoning-inspector pre').innerText());assert.deepEqual(inspected.searches,evaluate().searches);
  await lab.getByText('Inspect the probability model and search traces',{exact:true}).click();
  const cases=[];for(const minutes of choices.minutes)for(const offline of choices.offline)for(const evidence of choices.evidence)for(const prior of choices.prior)for(const penalty of choices.penalty)cases.push({minutes,offline,evidence,prior,penalty});
  for(const config of cases){
   for(const key of Object.keys(choices))await page.locator('#reason-'+key).selectOption(String(config[key]));
   const expected=evaluate(config),chosen=expected.rows.find(m=>m.id===expected.chosen);
   for(const [key,value]of Object.entries({posterior:(expected.posterior*100).toFixed(2)+'%',eligible:expected.eligible+'/4',utility:expected.bestUtility.toFixed(3),decision:labels[expected.decision]+(chosen?': '+chosen.title:'')}))assert.equal(await lab.locator('[data-reason="'+key+'"]').innerText(),value);
   assert.equal(await lab.locator('.reasoning-table tbody tr').count(),4);
   const cells=await lab.locator('.reasoning-table tbody tr').evaluateAll(rows=>rows.map(row=>[row.children[1].textContent,row.children[2].textContent,row.children[3].textContent]));
   assert.deepEqual(cells,expected.rows.map(m=>[m.eligible?'Eligible':m.reasons.join('; '),(m.enjoyment*100).toFixed(2)+'%',m.utility.toFixed(3)+(m.id===expected.chosen?' · selected':'')]));
   if(config.minutes===100&&config.prior===50&&config.penalty===4){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download reasoning report'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-37-reasoning-report.json');const file=path.join(out,d.suggestedFilename());await d.saveAs(file);assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),expected);}
  }
  await lab.getByRole('button',{name:'Reset experiment'}).click();assert.equal(await page.locator('#reason-minutes').inputValue(),'100');assert.equal(await lab.locator('[data-reason="posterior"]').innerText(),'80.00%');
  await page.locator('#reason-evidence').focus();await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');assert.equal(await lab.locator('[data-reason="posterior"]').innerText(),'50.00%');await lab.getByRole('button',{name:'Reset experiment'}).click();
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'dark.png'),style});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [0,1,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the reasoning workbook ZIP','chapter-37-reasoning.zip'],['Download PDF','ai-handbook-chapter-37.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 37 complete'}).click();const bookmark='10-experiment-with-the-movie-reasoning-lab';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-37-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-36-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.reasoning-lab')?.closest('astro-island')?.hasAttribute('ssr'));await page.locator('#reason-evidence').selectOption('unknown');await page.locator('#reason-evidence').selectOption('liked');await lab.screenshot({path:path.join(out,'mobile-reasoning.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),4);assert.equal(await page.locator('#reason-evidence').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/3\.02/);
  assert.deepEqual(errors,[]);const result={passed:true,headings:12,diagrams:3,optionalNotes:6,reasoningConfigurations:cases.length,checks:['eligibility, posterior beliefs, expected utility, abstention, search traces and JSON reports','keyboard controls','quiz search downloads','progress isolation and curriculum','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
