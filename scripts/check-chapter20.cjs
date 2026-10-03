const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/20-neural-networks-from-first-principles/';
const screenshotStyle='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-20');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/19-improving-and-evaluating-rag/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:19,complete:true,bookmark:'1-define-success-before-choosing-a-metric'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-19-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 20'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);
  assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);
  assert.equal(await page.locator('.katex-error').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  await page.screenshot({path:path.join(out,'desktop.png')});
  for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style:screenshotStyle});
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.getByRole('button',{name:'Search Chapter 20'}).click();await page.locator('#search-input').fill('broadcasting');await page.locator('.search-item:visible').filter({hasText:'4. Connect'}).click();
  assert.equal(await page.locator('.optional-depth').nth(1).getAttribute('open'),'');await page.locator('.optional-depth').nth(1).locator('summary').click();
  const lab=page.locator('.neural-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.neural-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  const {train}=await import('../src/lib/neural-network.mjs');
  async function check(r){assert.equal(await lab.locator('[data-nn="steps"]').innerText(),String(r.steps));assert.equal(await lab.locator('[data-nn="loss"]').innerText(),r.loss.toFixed(4));assert.equal(await lab.locator('[data-nn="accuracy"]').innerText(),(100*r.accuracy).toFixed(0)+'%');for(const m of r.rows)assert.equal(await lab.locator('[data-nn-prob="'+m.id+'"]').innerText(),m.p.toFixed(4));}
  async function download(r,label){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download training report'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-20-neural-network.json');const saved=path.join(out,label+'.json');await d.saveAs(saved);const actual=JSON.parse(await fs.readFile(saved,'utf8'));assert.equal(actual.architecture,r.architecture);assert.equal(actual.steps,r.steps);assert.ok(Math.abs(actual.loss-r.loss)<1e-12);assert.equal(actual.theta.length,r.theta.length);for(let i=0;i<r.theta.length;i++)assert.ok(Math.abs(actual.theta[i]-r.theta[i])<1e-9);}
  await check(train());await lab.screenshot({path:path.join(out,'network-initial.png'),style:screenshotStyle});
  await lab.locator('.nn-trace summary').click();assert.match(await lab.locator('[data-nn="hidden-sums"]').innerText(),/0.7000, -0.5000, 0.7500/);
  for(const id of ['N1','N2','N3','N4']){await page.locator('#nn-movie').selectOption(id);const f=train().rows.find(m=>m.id===id);assert.equal(await lab.locator('[data-nn="trace-output"]').innerText(),f.z.toFixed(4)+' / '+f.p.toFixed(4));}
  await page.locator('#nn-movie').selectOption('N1');await lab.locator('.nn-trace summary').click();await download(train(),'initial');
  await lab.getByRole('button',{name:'Train 1 step',exact:true}).click();await check(train('hidden',1));
  await lab.getByRole('button',{name:'Train 100 steps',exact:true}).click();await check(train('hidden',101));
  await lab.getByRole('button',{name:'Train to 2,000'}).click();await check(train('hidden',2000));assert.equal(await lab.getByRole('button',{name:'Train 1 step',exact:true}).isDisabled(),true);await download(train('hidden',2000),'trained');await lab.screenshot({path:path.join(out,'network-trained.png'),style:screenshotStyle});
  for(const a of ['linear','hidden'])for(const rate of [.1,.5,2]){await page.locator('#nn-architecture').selectOption(a);await page.locator('#nn-rate').selectOption(String(rate));await check(train(a,0,rate));await lab.getByRole('button',{name:'Train to 2,000'}).click();await check(train(a,2000,rate));}
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'network-dark.png'),style:screenshotStyle});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await lab.getByRole('button',{name:'Reset network'}).click();await check(train());assert.equal(await page.locator('#nn-rate').inputValue(),'0.5');assert.equal(await page.locator('#nn-architecture').inputValue(),'hidden');
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [0,1,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the neural network workbook ZIP','chapter-20-neural-networks.zip'],['Download PDF','ai-handbook-chapter-20.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 20 complete'}).click();const bookmark='9-train-and-inspect-the-tiny-network';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-20-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-19-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.screenshot({path:path.join(out,'mobile-lab.png'),style:screenshotStyle});await lab.locator('.nn-trace summary').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await lab.getByRole('button',{name:'Train to 2,000'}).click();await check(train('hidden',2000));
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),4);assert.equal(await page.locator('#nn-architecture').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/0.0027/);
  assert.deepEqual(errors,[]);const report={passed:true,headings:12,diagrams:3,optionalNotes:6,checks:['real training in both architectures at three rates','forward traces and gradient table','JSON and workbook downloads','quiz and search','progress isolation','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
