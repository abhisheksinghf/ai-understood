const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/28-fine-tuning-and-preference-learning/';
const style='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-28');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/27-choosing-between-prompting-rag-tools-and-fine-tuning/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:27,complete:true,bookmark:'1-diagnose-the-gap-before-choosing-a-method'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-27-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 28'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.equal(await page.locator('.katex-error').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.screenshot({path:path.join(out,'desktop.png')});for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style});
  await page.getByRole('button',{name:'Search Chapter 28'}).click();await page.locator('#search-input').fill('beta, relative likelihood');await page.locator('.search-item[href="#8-optimize-preferences-directly-with-dpo"]:visible').click();assert.equal(await page.locator('.optional-depth').nth(4).getAttribute('open'),'');await page.locator('.optional-depth').nth(4).locator('summary').click();
  const lab=page.locator('.tuning-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.tuning-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  await lab.getByRole('button',{name:'2 · Learn a preference'}).click();await page.locator('#tune-chosen').waitFor({state:'visible'});await lab.getByRole('button',{name:'1 · Inspect LoRA'}).click();await page.locator('#tune-rank').waitFor({state:'visible'});
  const {lora,preference}=await import('../src/lib/tuning.mjs'),f=x=>x.toFixed(4);
  function compare(a,b){if(typeof b==='number')assert.ok(Math.abs(a-b)<1e-10);else if(Array.isArray(b)){assert.equal(a.length,b.length);b.forEach((v,i)=>compare(a[i],v));}else if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const key of Object.keys(b))compare(a[key],b[key]);}else assert.equal(a,b);}
  async function report(l,p){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download training report'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-28-tuning-report.json');const file=path.join(out,d.suggestedFilename());await d.saveAs(file);compare(JSON.parse(await fs.readFile(file,'utf8')),{lora:l,preference:p});}
  await lab.screenshot({path:path.join(out,'lora.png'),style});
  for(const rank of [1,2])for(const alpha of [1,2,4])for(const stage of ['initial','adapted']){
   await page.locator('#tune-rank').selectOption(String(rank));await page.locator('#tune-alpha').selectOption(String(alpha));await page.locator('#tune-stage').selectOption(stage);const r=lora(rank,alpha,stage);
   assert.equal(await lab.locator('[data-tune="count"]').innerText(),r.trainableParameters+' trainable adapter parameters');assert.equal(await lab.locator('[data-tune="scale"]').innerText(),f(r.scale));
   for(const [i,row] of r.delta.entries())for(const [j,v] of row.entries())assert.equal(await lab.locator(`[data-delta="${i}-${j}"]`).innerText(),f(v));
   for(const [i,v] of r.output.entries())assert.equal(await lab.locator(`[data-output="${i}"]`).innerText(),f(v));await report(r,preference());
  }
  await lab.getByText('Inspect A, B, and the frozen base',{exact:true}).click();assert.match(await lab.locator('pre').innerText(),/"W0"/);await lab.getByText('Inspect A, B, and the frozen base',{exact:true}).click();await lab.getByRole('button',{name:'Reset experiment'}).click();
  await lab.getByRole('button',{name:'2 · Learn a preference'}).click();await lab.screenshot({path:path.join(out,'preference.png'),style});
  const configs=[[.5,.5,.5,0,'A'],[.5,.5,.5,1,'A'],[.5,.5,.5,10,'A'],[.5,.5,.5,40,'B'],[.2,1,1,40,'A'],[.8,.1,.1,10,'B'],[.8,1,.5,20,'A'],[.2,.5,1,1,'B']];
  for(const args of configs){const [reference,beta,rate,steps,chosen]=args;
   for(const [id,v] of [['reference',reference],['beta',beta],['rate',rate],['chosen',chosen]])await page.locator('#tune-'+id).selectOption(String(v));await page.locator('#tune-steps').focus();await page.keyboard.press('Home');for(let i=0;i<steps;i++)await page.keyboard.press('ArrowRight');
   const p=preference(...args),r=p.final;assert.equal(await page.locator('#tune-steps').inputValue(),String(steps));
   for(const [key,v] of [['probability',r.pA],['loss',r.loss],['pair-fit',r.pairFit],['kl',r.kl]])assert.equal(await lab.locator(`[data-tune="${key}"]`).innerText(),f(v));await report(lora(),p);
  }
  await lab.getByText('Trace the scalar update',{exact:true}).click();assert.equal(await lab.locator('[data-tune="theta"]').innerText(),f(preference(...configs.at(-1)).final.theta));
  await lab.getByRole('button',{name:'Take one step'}).click();assert.equal(await page.locator('#tune-steps').inputValue(),'2');
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'dark.png'),style});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await lab.getByRole('button',{name:'Reset experiment'}).click();assert.equal(await page.locator('#tune-rank').inputValue(),'1');assert.equal(await page.locator('#tune-alpha').inputValue(),'2');assert.equal(await page.locator('#tune-stage').inputValue(),'adapted');
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [0,1,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the fine-tuning workbook ZIP','chapter-28-tuning.zip'],['Download PDF','ai-handbook-chapter-28.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 28 complete'}).click();const bookmark='10-inspect-updates-and-try-the-experiments';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-28-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-27-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.tuning-lab')?.closest('astro-island')?.hasAttribute('ssr'));await lab.getByRole('button',{name:'2 · Learn a preference'}).click();await page.locator('#tune-chosen').waitFor({state:'visible'});await lab.getByRole('button',{name:'1 · Inspect LoRA'}).click();await lab.screenshot({path:path.join(out,'mobile-lora.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await lab.getByRole('button',{name:'2 · Learn a preference'}).click();await page.locator('#tune-chosen').selectOption('B');await lab.screenshot({path:path.join(out,'mobile-preference.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),2);assert.equal(await page.locator('#tune-chosen').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/0.5312/);
  assert.deepEqual(errors,[]);const result={passed:true,headings:12,diagrams:3,optionalNotes:6,loraConfigurations:12,preferenceConfigurations:8,checks:['matrix outputs and gradient reports','keyboard controls','quiz search downloads','progress isolation and curriculum','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
