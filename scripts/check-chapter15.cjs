const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
function numericEqual(actual,expected){
  if(typeof expected==='number'){assert.ok(Math.abs(actual-expected)<=1e-10,`${actual} != ${expected}`);return;}
  if(expected&&typeof expected==='object'){assert.deepEqual(Object.keys(actual),Object.keys(expected));for(const key of Object.keys(expected))numericEqual(actual[key],expected[key]);return;}
  assert.equal(actual,expected);
}
const base='http://127.0.0.1:4321',route='/chapters/15-evaluating-and-improving-ml-models/';
const screenshotStyle='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
(async()=>{
  const out=path.resolve(__dirname,'../tmp/qa/chapter-15');await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/chapters/14-unsupervised-learning-and-other-approaches/',{waitUntil:'networkidle'});
    const prior={version:1,chapter:14,complete:true,bookmark:'1-look-for-structure-without-supplied-outcome-labels'};
    await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-14-v1',JSON.stringify(p)),prior);
    await page.getByRole('link',{name:'Read Chapter 15'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);
    assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);
    assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
    assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'false');
    const missing=await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash));assert.deepEqual(missing,[]);
    await page.screenshot({path:path.join(out,'desktop.png')});
    for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style:screenshotStyle});
    assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
    await page.getByRole('button',{name:'Search Chapter 15'}).click();await page.locator('#search-input').fill('nested');await page.locator('.search-item:visible').filter({hasText:'2. Protect'}).click();
    const note=page.locator('.optional-depth').filter({has:page.locator('summary',{hasText:'cross-validation'})});assert.equal(await note.getAttribute('open'),'');await note.locator('summary').click();
    const lab=page.locator('.evaluation-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.evaluation-lab')?.closest('astro-island')?.hasAttribute('ssr'));
    const {experiment}=await import('../src/lib/model-evaluation.mjs');
    const pct=x=>x===null?'Undefined':(100*x).toFixed(2)+'%';
    assert.equal(await lab.locator('[data-eval="accuracy"]').innerText(),'83.33%');assert.equal(await lab.locator('[data-eval="precision"]').innerText(),'60.00%');assert.equal(await lab.locator('[data-eval="recall"]').innerText(),'100.00%');
    for(const [key,value] of Object.entries({tp:3,fp:2,tn:7,fn:0}))assert.equal(await lab.locator(`[data-eval="${key}"]`).innerText(),String(value));
    assert.equal(await lab.locator('svg polyline').getAttribute('fill'),'none');
    await lab.screenshot({path:path.join(out,'evaluation.png'),style:screenshotStyle});
    async function download(expected,label){const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download evaluation result'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-15-evaluation-result.json');const file=path.join(out,label+'.json');await d.saveAs(file);numericEqual(JSON.parse(await fs.readFile(file,'utf8')),expected);assert.equal(expected.final_test,undefined);}
    for(const candidate of ['a','b','baseline'])for(const slice of ['all','short','long']){
      await page.locator('#eval-candidate').selectOption(candidate);await page.locator('#eval-slice').selectOption(slice);const r=experiment(candidate,.5,slice);
      assert.equal(await lab.locator('[data-eval="accuracy"]').innerText(),pct(r.validation.accuracy));assert.equal(await lab.locator('[data-eval="precision"]').innerText(),pct(r.validation.precision));assert.equal(await lab.locator('[data-eval="recall"]').innerText(),pct(r.validation.recall));await download(r,candidate+'-'+slice);
    }
    await lab.getByRole('button',{name:'Reset evaluation'}).click();const auc=await lab.locator('[data-eval="auc"]').innerText(),loss=await lab.locator('[data-eval="loss"]').innerText(),curve=await lab.locator('svg polyline').getAttribute('points');
    await page.locator('#eval-threshold').focus();await page.keyboard.press('Home');for(let i=0;i<17;i++)await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#eval-threshold').inputValue(),'0.85');assert.equal(await lab.locator('[data-eval="precision"]').innerText(),'100.00%');assert.equal(await lab.locator('[data-eval="recall"]').innerText(),'33.33%');assert.equal(await lab.locator('[data-eval="auc"]').innerText(),auc);assert.equal(await lab.locator('[data-eval="loss"]').innerText(),loss);assert.equal(await lab.locator('svg polyline').getAttribute('points'),curve);await download(experiment('a',.85),'high-threshold');
    await page.locator('#eval-threshold').focus();await page.keyboard.press('End');assert.equal(await lab.locator('[data-eval="precision"]').innerText(),'Undefined');await page.keyboard.press('Home');assert.equal(await lab.locator('[data-eval="recall"]').innerText(),'100.00%');
    await lab.getByRole('button',{name:'Reset evaluation'}).click();await page.locator('#eval-cost').selectOption('unwanted');assert.match(await lab.locator('[data-eval="winner"]').innerText(),/Candidate B at threshold 0.70/);await lab.getByRole('button',{name:'Use selected policy'}).click();assert.equal(await page.locator('#eval-candidate').inputValue(),'b');assert.equal(await page.locator('#eval-threshold').inputValue(),'0.7');assert.equal(await lab.locator('[data-eval="cost"]').innerText(),'1');await download(experiment('b',.7,'all','unwanted'),'selected-unwanted');
    await lab.locator('.eval-comparison summary').click();assert.equal(await lab.locator('.eval-comparison tbody tr').count(),10);assert.equal(await lab.locator('.eval-comparison tbody tr').filter({hasText:'selected'}).count(),1);await lab.locator('.eval-comparison summary').click();
    await lab.locator('.eval-events summary').click();assert.equal(await lab.locator('.eval-events tbody tr').count(),12);await page.locator('#eval-slice').selectOption('short');assert.equal(await lab.locator('.eval-events tbody tr').count(),6);await lab.locator('.eval-events summary').click();
    await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'workbench-dark.png'),style:screenshotStyle});await page.getByRole('button',{name:'Switch to light theme'}).click();await lab.getByRole('button',{name:'Reset evaluation'}).click();
    await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
    await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
    for(const [i,a] of [1,0,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
    for(const [label,name] of [['Download the model evaluation workbook ZIP','chapter-15-model-evaluation.zip'],['Download PDF','ai-handbook-chapter-15.pdf']]){const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));}
    await page.getByRole('button',{name:'Mark Chapter 15 complete'}).click();
    const bookmark='9-explore-the-evaluation-workbench';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
    const b=await page.locator('#save-place').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
    await page.locator('.reader-tools summary').click();const waitBackup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await waitBackup).suggestedFilename(),'ai-handbook-chapter-15-progress.json');
    await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-14-v1'))),prior);
    await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
    await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});
    await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
    await lab.screenshot({path:path.join(out,'mobile-lab.png'),style:screenshotStyle});await page.locator('#eval-candidate').selectOption('baseline');assert.equal(await lab.locator('[data-eval="precision"]').innerText(),'Undefined');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),4);assert.equal(await page.locator('#eval-candidate').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/0.9259/);
    await page.emulateMedia({media:'screen'});await page.evaluate(()=>dispatchEvent(new Event('afterprint')));assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.deepEqual(errors,[]);
    const report={passed:true,headings:12,diagrams:3,optionalNotes:6,checks:['candidate and slice metrics','keyboard thresholds and undefined precision','ROC invariance','cost-sensitive validation selection','JSON download parity','quiz and search','PDF and workbook downloads','navigation and progress isolation','mobile and dark themes','fixed print comparison'],errors};
    await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
