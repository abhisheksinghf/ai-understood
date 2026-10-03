const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/25-how-llms-are-trained-and-generate-text/';
const style='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-25');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/24-attention-and-transformers-explained/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:24,complete:true,bookmark:'1-give-each-position-access-to-useful-context'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-24-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 25'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.equal(await page.locator('.katex-error').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.screenshot({path:path.join(out,'desktop.png')});for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style});
  await page.getByRole('button',{name:'Search Chapter 25'}).click();await page.locator('#search-input').fill('training–generation gap');await page.locator('.search-item[href="#9-choose-tokens-stop-and-evaluate-the-answer"]:visible').click();assert.equal(await page.locator('.optional-depth').nth(4).getAttribute('open'),'');await page.locator('.optional-depth').nth(4).locator('summary').click();

  const lab=page.locator('.lifecycle-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.lifecycle-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  const {train,generate}=await import('../src/lib/llm-lifecycle.mjs'),f=x=>x.toFixed(4),pct=x=>(100*x).toFixed(2)+'%';
  function compare(a,b){if(typeof b==='number')assert.ok(Math.abs(a-b)<1e-9);else if(Array.isArray(b)){assert.equal(a.length,b.length);b.forEach((v,i)=>compare(a[i],v));}else if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const key of Object.keys(b))compare(a[key],b[key]);}else assert.equal(a,b);}
  async function report(expected){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download calculation report'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-25-lifecycle-report.json');const file=path.join(out,d.suggestedFilename());await d.saveAs(file);compare(JSON.parse(await fs.readFile(file,'utf8')),expected);}
  await lab.screenshot({path:path.join(out,'training.png'),style});
  for(const mask of ['reply','all'])for(const steps of [0,20,80]){
   await page.locator('#life-mask').selectOption(mask);await page.locator('#life-steps').selectOption(String(steps));const r=train(mask,steps);
   assert.equal(await lab.locator('[data-life="targets"]').innerText(),String(r.sft_targets));
   for(const stage of r.stages){assert.equal(await lab.locator(`[data-life="prose-${stage.name}"]`).innerText(),f(stage.pretrain_loss));assert.equal(await lab.locator(`[data-life="reply-${stage.name}"]`).innerText(),f(stage.reply_loss));}
   for(const [i,row] of r.demonstration.entries())assert.equal(await lab.locator(`[data-life-mask="${i}"]`).innerText(),row.selected?'Yes':'No');
   await report({training:r,checkpoint:'adapted',generation:generate(r.checkpoints.adapted)});
  }
  await lab.locator('.life-data summary').click();assert.match(await lab.locator('.life-data pre').innerText(),/Moonlight Map/);await lab.locator('.life-data summary').click();
  await lab.getByRole('button',{name:'Reset experiment'}).click();assert.equal(await page.locator('#life-mask').inputValue(),'reply');assert.equal(await page.locator('#life-steps').inputValue(),'80');
  const r=train();await lab.getByRole('button',{name:'2 · Generate from a checkpoint'}).click();
  assert.equal(await lab.getByRole('button',{name:'2 · Generate from a checkpoint'}).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#life-mask').isVisible(),false);
  await lab.screenshot({path:path.join(out,'generation.png'),style});
  async function verifyGeneration(g){
   assert.equal(await lab.locator('[data-life="text"]').innerText(),g.text||'(empty reply)');assert.equal(await lab.locator('[data-life="prefix"]').innerText(),g.prefix.join(' '));assert.equal(await lab.locator('[data-life="tokens"]').innerText(),g.tokens.join(' → '));assert.equal(await lab.locator('[data-life="stop"]').innerText(),g.stop);
   for(const [i,row] of g.trace.entries()){
    await lab.locator('.life-replay button').nth(i).click();assert.equal(await lab.locator('.life-replay [aria-pressed="true"]').count(),1);
    for(const [key,value] of [['context',row.context],['chosen',row.token],['base',pct(row.base[row.id])],['probability',pct(row.probabilities[row.id])],['draw',row.draw===null?'None · greedy':row.draw.toFixed(8)]])assert.equal(await lab.locator(`[data-life="${key}"]`).innerText(),value);
   }
  }
  for(const checkpoint of ['initial','pretrained','adapted'])for(const prompt of ['comedy','drama','prose'])for(const method of ['greedy','sample']){
   await page.locator('#life-checkpoint').selectOption(checkpoint);await page.locator('#life-prompt').selectOption(prompt);await page.locator('#life-method').selectOption(method);const g=generate(r.checkpoints[checkpoint],prompt,method);
   await verifyGeneration(g);await report({training:r,checkpoint,generation:g});
  }
  await page.locator('#life-prompt').selectOption('comedy');
  for(const temperature of [.75,1.5])for(const limit of [1,4,8]){await page.locator('#life-temperature').selectOption(String(temperature));await page.locator('#life-limit').selectOption(String(limit));await verifyGeneration(generate(r.checkpoints.adapted,'comedy','sample',temperature,limit));}
  await lab.getByRole('button',{name:'1 · Train and compare'}).focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#life-mask').isVisible(),true);
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'dark.png'),style});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await lab.getByRole('button',{name:'Reset experiment'}).click();assert.equal(await page.locator('#life-mask').inputValue(),'reply');assert.equal(await page.locator('#life-steps').inputValue(),'80');
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [0,1,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the training lifecycle workbook ZIP','chapter-25-lifecycle.zip'],['Download PDF','ai-handbook-chapter-25.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 25 complete'}).click();const bookmark='10-train-freeze-and-inspect-the-result';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-25-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-24-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.lifecycle-lab')?.closest('astro-island')?.hasAttribute('ssr'));await lab.screenshot({path:path.join(out,'mobile-training.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);

  await lab.getByRole('button',{name:'2 · Generate from a checkpoint'}).click();await page.locator('#life-method').selectOption('sample');await page.locator('#life-temperature').selectOption('1.5');await lab.screenshot({path:path.join(out,'mobile-generation.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),3);assert.equal(await page.locator('#life-method').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/0.0364/);
  assert.deepEqual(errors,[]);const result={passed:true,headings:12,diagrams:3,optionalNotes:6,trainingConfigurations:6,generationConfigurations:24,checks:['checkpoint losses and target masks','frozen generation and token replay','all report downloads','keyboard controls','quiz search downloads','progress isolation and curriculum','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
