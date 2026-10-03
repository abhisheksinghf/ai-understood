const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/38-reinforcement-learning-and-robotics/';
const style='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-38');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/37-classical-symbolic-and-probabilistic-ai/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:37,complete:true,bookmark:'1-ai-includes-more-than-learned-predictions'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-37-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 38'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.equal(await page.locator('.katex-error').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.screenshot({path:path.join(out,'desktop.png')});for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style});
  await page.getByRole('button',{name:'Search Chapter 38'}).click();await page.locator('#search-input').fill('belief state');await page.locator('.search-item[href="#2-describe-the-environment-as-a-decision-process"]:visible').click();assert.equal(await page.locator('.optional-depth').nth(0).getAttribute('open'),'');await page.locator('.optional-depth').nth(0).locator('summary').click();
  const lab=page.locator('.reinforcement-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.reinforcement-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  const {evaluate,choices}=await import('../src/lib/reinforcement.mjs');
  await page.locator('#rl-epsilon').selectOption('0');await page.locator('#rl-epsilon').selectOption('0.3');
  assert.equal(await lab.locator('[data-rl="discounted"]').innerText(),'4.400');
  await lab.screenshot({path:path.join(out,'reinforcement.png'),style});
  await lab.getByText('Inspect the first twelve learning updates',{exact:true}).click();
  const inspected=JSON.parse(await lab.locator('.reinforcement-inspector pre').innerText());assert.deepEqual(inspected,evaluate().updates);
  await lab.getByText('Inspect the first twelve learning updates',{exact:true}).click();
  const cases=[];for(const objective of choices.objective)for(const epsilon of choices.epsilon)for(const gamma of choices.gamma)for(const alpha of choices.alpha)for(const episodes of choices.episodes)for(const seed of choices.seed)cases.push({objective,epsilon,gamma,alpha,episodes,seed});
  for(const config of cases){
   for(const key of Object.keys(choices))await page.locator('#rl-'+key).selectOption(String(config[key]));
   const expected=evaluate(config);
   for(const [key,value]of Object.entries({discounted:expected.greedy.discounted.toFixed(3),satisfaction:expected.greedy.satisfaction,training:expected.trainingMean.toFixed(3),gap:expected.gap.toFixed(3),total:expected.greedy.total,path:expected.greedy.trace.map(a=>a.label).join(' → '),steps:expected.steps,explorations:expected.exploratorySteps,status:expected.gap===0?'Matches a best route in this model.':'Has not found a best route for this objective.'}))assert.equal(await lab.locator('[data-rl="'+key+'"]').innerText(),String(value));
   assert.equal(await lab.locator('.reinforcement-table tbody tr').count(),4);
   const cells=await lab.locator('.reinforcement-table tbody tr').evaluateAll(rows=>rows.map(row=>[row.children[1].textContent,row.children[2].textContent,row.children[3].textContent]));
   assert.deepEqual(cells,expected.rows.map(a=>[a.q.toFixed(3),String(a.visits),a.optimalQ.toFixed(3)]));
   assert.equal(await lab.locator('.rl-curve circle').count(),config.episodes/20);
   const points=expected.curve.map((p,i)=>`${(42+i*638/(expected.curve.length-1)).toFixed(3)},${(166-p.mean*22).toFixed(3)}`).join(' ');assert.equal(await lab.locator('.rl-curve polyline').getAttribute('points'),points);
   if(config.gamma===.9&&config.alpha===.5&&config.episodes===200&&config.seed===7){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download reinforcement report'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-38-reinforcement-report.json');const file=path.join(out,d.suggestedFilename());await d.saveAs(file);assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),expected);}
  }
  await lab.getByRole('button',{name:'Reset experiment'}).click();assert.equal(await page.locator('#rl-episodes').inputValue(),'200');assert.equal(await lab.locator('[data-rl="discounted"]').innerText(),'4.400');
  await page.locator('#rl-objective').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await lab.locator('[data-rl="discounted"]').innerText(),'4.000');await lab.getByRole('button',{name:'Reset experiment'}).click();
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'dark.png'),style});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [0,1,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the reinforcement workbook ZIP','chapter-38-reinforcement.zip'],['Download PDF','ai-handbook-chapter-38.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 38 complete'}).click();const bookmark='10-experiment-with-the-reinforcement-learning-lab';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-38-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-37-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.reinforcement-lab')?.closest('astro-island')?.hasAttribute('ssr'));await page.locator('#rl-epsilon').selectOption('0');await page.locator('#rl-epsilon').selectOption('0.3');await lab.screenshot({path:path.join(out,'mobile-reinforcement.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),4);assert.equal(await page.locator('#rl-epsilon').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/3\.175/);
  assert.deepEqual(errors,[]);const result={passed:true,headings:12,diagrams:3,optionalNotes:6,reinforcementConfigurations:cases.length,checks:['learned Q values, visits, returns, training curves, reward objectives and JSON reports','keyboard controls','quiz search downloads','progress isolation and curriculum','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
