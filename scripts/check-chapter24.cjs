const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/24-attention-and-transformers-explained/';
const style='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-24');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/23-nlp-tokenization-and-language-modeling/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:23,complete:true,bookmark:'1-start-with-the-language-task'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-23-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 24'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.equal(await page.locator('.katex-error').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.screenshot({path:path.join(out,'desktop.png')});for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style});
  await page.getByRole('button',{name:'Search Chapter 24'}).click();await page.locator('#search-input').fill('permutation equivariant');await page.locator('.search-item[href="#6-supply-information-about-position"]:visible').click();assert.equal(await page.locator('.optional-depth').nth(2).getAttribute('open'),'');await page.locator('.optional-depth').nth(2).locator('summary').click();
  const lab=page.locator('.attention-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.attention-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  const {explore}=await import('../src/lib/attention.mjs'),f=x=>x.toFixed(4),vec=x=>'['+x.map(f).join(', ')+']',pct=x=>(100*x).toFixed(2)+'%';
  function compare(a,b){if(typeof b==='number')assert.ok(Math.abs(a-b)<1e-10);else if(Array.isArray(b)){assert.equal(a.length,b.length);b.forEach((v,i)=>compare(a[i],v));}else if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const key of Object.keys(b))compare(a[key],b[key]);}else assert.equal(a,b);}
  async function report(expected){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download calculation report'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-24-attention-report.json');const file=path.join(out,d.suggestedFilename());await d.saveAs(file);compare(JSON.parse(await fs.readFile(file,'utf8')),expected);}
  await lab.screenshot({path:path.join(out,'attention.png'),style});await lab.locator('.att-combine summary').click();
  for(const ending of ['fun','slow'])for(const positions of ['none','sinusoidal'])for(const causal of [true,false]){
   await page.locator('#att-ending').selectOption(ending);await page.locator('#att-positions').selectOption(positions);await page.locator('#att-causal').setChecked(causal);const r=explore(ending,positions,causal);
   for(const head of [0,1]){
    await page.locator('#att-head').selectOption(String(head));const h=r.heads[head];
    for(let i=0;i<4;i++)for(let j=0;j<4;j++){
     const cell=lab.locator(`[data-att-cell="${i}-${j}"]`);assert.equal(await cell.innerText(),causal&&j>i?'Blocked':pct(h.weights[i][j]));await cell.click();assert.equal(await cell.getAttribute('aria-pressed'),'true');assert.equal(await lab.locator('.att-matrix button[aria-pressed="true"]').count(),1);
     for(const [key,expected] of [['q',vec(h.Q[i])],['k',vec(h.K[j])],['dot',f(h.raw[i][j])],['scaled',f(h.scaled[i][j])],['masked',h.masked[i][j]===null?'−∞ (blocked)':f(h.masked[i][j])],['weight',pct(h.weights[i][j])],['output',vec(h.outputs[i])],['concat',vec(r.concatenated[i])],['projected',vec(r.projected[i])],['residual',vec(r.residual[i])]])assert.equal(await lab.locator(`[data-att="${key}"]`).innerText(),expected);
    }
   }
   await report(r);
  }
  const first=lab.locator('[data-att-cell="0-0"]');await first.focus();await page.keyboard.press('Enter');assert.equal(await first.getAttribute('aria-pressed'),'true');
  await lab.locator('.att-vectors summary').click();assert.equal(await lab.locator('.att-vectors tbody tr').count(),4);assert.match(await lab.locator('.att-vectors pre').innerText(),/Wq/);await lab.locator('.att-vectors summary').click();
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'dark.png'),style});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await lab.getByRole('button',{name:'Reset experiment'}).click();assert.equal(await page.locator('#att-ending').inputValue(),'fun');assert.equal(await page.locator('#att-positions').inputValue(),'none');assert.equal(await page.locator('#att-head').inputValue(),'0');assert.equal(await page.locator('#att-causal').isChecked(),true);assert.equal(await lab.locator('[data-att-cell="2-1"]').getAttribute('aria-pressed'),'true');
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [0,1,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the attention workbook ZIP','chapter-24-attention.zip'],['Download PDF','ai-handbook-chapter-24.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 24 complete'}).click();const bookmark='10-explore-the-attention-calculations';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-24-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-23-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.attention-lab')?.closest('astro-island')?.hasAttribute('ssr'));await lab.screenshot({path:path.join(out,'mobile-attention.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#att-positions').selectOption('sinusoidal');await lab.locator('[data-att-cell="0-3"]').click();assert.equal(await lab.locator('[data-att="weight"]').innerText(),'0.00%');await lab.locator('.att-combine summary').click();await lab.locator('.att-vectors summary').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),4);assert.equal(await page.locator('#att-ending').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/1.5816/);
  assert.deepEqual(errors,[]);const result={passed:true,headings:12,diagrams:3,optionalNotes:6,configurations:8,headViews:16,cellSelections:256,checks:['attention matrices and weighted outputs','masking and projection traces','keyboard cell selection','calculation reports','quiz search downloads','progress isolation and curriculum','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
