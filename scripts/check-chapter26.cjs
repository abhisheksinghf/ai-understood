const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/26-efficient-and-advanced-llm-systems/';
const style='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
(async()=>{
 const out=path.resolve(__dirname,'../tmp/qa/chapter-26');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/25-how-llms-are-trained-and-generate-text/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:25,complete:true,bookmark:'1-separate-training-from-using-the-model'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-25-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 26'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.equal(await page.locator('.katex-error').count(),0);
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash)),[]);
  assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
  await page.screenshot({path:path.join(out,'desktop.png')});for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style});
  await page.getByRole('button',{name:'Search Chapter 26'}).click();await page.locator('#search-input').fill('sliding windows');await page.locator('.search-item[href="#3-reduce-cache-cost-with-the-right-architecture"]:visible').click();assert.equal(await page.locator('.optional-depth').nth(1).getAttribute('open'),'');await page.locator('.optional-depth').nth(1).locator('summary').click();


  const lab=page.locator('.efficiency-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.efficiency-lab')?.closest('astro-island')?.hasAttribute('ssr'));
  const {memory,compression}=await import('../src/lib/llm-efficiency.mjs'),f=x=>x.toFixed(4),signed=x=>(x>=0?'+':'')+f(x);
  function compare(a,b){if(typeof b==='number')assert.ok(Math.abs(a-b)<1e-9);else if(Array.isArray(b)){assert.equal(a.length,b.length);b.forEach((v,i)=>compare(a[i],v));}else if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const key of Object.keys(b))compare(a[key],b[key]);}else assert.equal(a,b);}
  async function report(expected){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download calculation report'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-26-efficiency-report.json');const file=path.join(out,d.suggestedFilename());await d.saveAs(file);compare(JSON.parse(await fs.readFile(file,'utf8')),expected);}
  await lab.getByRole('button',{name:'2 · Inspect quantization'}).click();await page.locator('#eff-preset').waitFor({state:'visible'});await lab.getByRole('button',{name:'1 · Plan memory'}).click();await page.locator('#eff-weight').waitFor({state:'visible'});
  await lab.screenshot({path:path.join(out,'memory.png'),style});
  await lab.locator('.eff-formula summary').click();
  const memoryCases=[[16,8,16,1,4096,16],[16,32,16,1,4096,16],[16,1,16,1,4096,16],[4,8,16,1,4096,16],[4,8,8,4,8192,8],[8,32,16,8,8192,24],[16,8,16,4,8192,16],[8,1,8,8,1024,8]];
  for(const args of memoryCases){
   for(const [i,id] of ['weight','heads','cache','batch','tokens','budget'].entries())await page.locator('#eff-'+id).selectOption(String(args[i]));const r=memory(...args);
   for(const [key,expected] of [['total',f(r.gib.total)+' GiB'],['weights',f(r.gib.weights)],['cache',f(r.gib.cache)],['headroom',signed(r.gib.headroom)+' GiB'],['capacity',String(r.maxSequences)],['status',r.withinEstimate?'Within estimate':'Over budget'],['cache-bytes',r.cacheBytes.toLocaleString('en-US')]])assert.equal(await lab.locator(`[data-eff="${key}"]`).innerText(),expected);
   await report({memory:r,compression:compression()});
  }
  await lab.locator('.eff-formula summary').click();await lab.getByRole('button',{name:'Reset experiment'}).click();
  for(const [id,value] of [['weight','16'],['heads','8'],['cache','16'],['batch','1'],['tokens','4096'],['budget','16']])assert.equal(await page.locator('#eff-'+id).inputValue(),value);
  await lab.getByRole('button',{name:'2 · Inspect quantization'}).click();assert.equal(await page.locator('#eff-weight').isVisible(),false);assert.equal(await lab.getByRole('button',{name:'2 · Inspect quantization'}).getAttribute('aria-pressed'),'true');
  await lab.screenshot({path:path.join(out,'quantization.png'),style});
  for(const preset of ['balanced','outlier'])for(const bits of [4,8])for(const grouping of ['tensor','pairs']){
   await page.locator('#eff-preset').selectOption(preset);await page.locator('#eff-quant').selectOption(String(bits));await page.locator('#eff-group').selectOption(grouping);const q=compression(preset,bits,grouping);
   for(const [key,value] of [['mae',f(q.mae)],['max',f(q.maxError)],['original-score',f(q.originalScore)],['restored-score',f(q.restoredScore)],['score-change',signed(q.scoreChange)],['storage',`${q.payloadBytes} payload + ${q.scaleBytes} scale = ${q.totalBytes} bytes`]])assert.equal(await lab.locator(`[data-eff="${key}"]`).innerText(),value);
   for(const [i,row] of q.rows.entries()){
    assert.equal(await lab.locator(`[data-eff-code="${i}"]`).innerText(),String(row.code));await lab.getByRole('button',{name:`Inspect weight ${i+1}`,exact:true}).click();assert.equal(await lab.locator('.eff-wide button[aria-pressed="true"]').count(),1);
    for(const [key,value] of [['scale',f(row.scale)],['scaled',f(row.original/row.scale)],['code',String(row.code)],['restored',f(row.restored)]])assert.equal(await lab.locator(`[data-eff="${key}"]`).innerText(),value);
   }
   await report({memory:memory(),compression:q});
  }
  await lab.locator('.eff-score summary').click();assert.match(await lab.locator('.eff-score').innerText(),/0.2,0.6,0.1,0.3,0.8,1/);await lab.locator('.eff-score summary').click();
  await lab.getByRole('button',{name:'Inspect weight 1',exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await lab.getByRole('button',{name:'Inspect weight 1',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'dark.png'),style});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await lab.getByRole('button',{name:'Reset experiment'}).click();assert.equal(await page.locator('#eff-preset').inputValue(),'balanced');assert.equal(await page.locator('#eff-quant').inputValue(),'4');assert.equal(await page.locator('#eff-group').inputValue(),'tensor');assert.equal(await page.locator('#eff-weight').isVisible(),true);
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  for(const [i,a] of [0,1,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
  for(const [label,name] of [['Download the efficiency workbook ZIP','chapter-26-efficiency.zip'],['Download PDF','ai-handbook-chapter-26.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
  await page.getByRole('button',{name:'Mark Chapter 26 complete'}).click();const bookmark='10-explore-memory-and-rounding-error';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const box=await page.locator('#save-place').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const backup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await backup).suggestedFilename(),'ai-handbook-chapter-26-progress.json');await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-25-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.efficiency-lab')?.closest('astro-island')?.hasAttribute('ssr'));await lab.screenshot({path:path.join(out,'mobile-memory.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);


  await lab.getByRole('button',{name:'2 · Inspect quantization'}).click();await page.locator('#eff-preset').selectOption('outlier');await page.locator('#eff-group').selectOption('pairs');await lab.screenshot({path:path.join(out,'mobile-quantization.png'),style});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await lab.locator('.eff-score summary').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),7);assert.equal(await page.locator('#eff-preset').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/15.5385/);
  assert.deepEqual(errors,[]);const result={passed:true,headings:12,diagrams:3,optionalNotes:6,memoryConfigurations:8,quantizationConfigurations:8,weightSelections:48,checks:['memory and capacity breakdown','quantization codes reconstruction errors and metadata','calculation downloads','keyboard controls','quiz search downloads','progress isolation and curriculum','mobile dark and print'],errors};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
