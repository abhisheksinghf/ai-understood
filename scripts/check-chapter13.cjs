const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
function numericEqual(actual,expected){
  if(typeof expected==='number'){assert.ok(Math.abs(actual-expected)<=1e-10,`${actual} != ${expected}`);return;}
  if(expected&&typeof expected==='object'){assert.deepEqual(Object.keys(actual),Object.keys(expected));for(const key of Object.keys(expected))numericEqual(actual[key],expected[key]);return;}
  assert.equal(actual,expected);
}
const base='http://127.0.0.1:4321',route='/chapters/13-supervised-learning-regression-and-classification/';
(async()=>{
  const out=path.resolve(__dirname,'../tmp/qa/chapter-13');await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/chapters/12-preparing-data-for-machine-learning/',{waitUntil:'networkidle'});
    const prior={version:1,chapter:12,complete:true,bookmark:'1-decide-what-one-row-means'};
    await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-12-v1',JSON.stringify(p)),prior);
    await page.getByRole('link',{name:'Read Chapter 13'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);
    assert.equal(await page.locator('.optional-depth').count(),7);assert.equal(await page.locator('.optional-depth[open]').count(),0);
    assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
    assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'false');
    const missing=await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash));assert.deepEqual(missing,[]);
    await page.screenshot({path:path.join(out,'desktop.png')});
    for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png')});
    assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
    await page.getByRole('button',{name:'Search Chapter 13'}).click();await page.locator('#search-input').fill('calibration');await page.locator('.search-item:visible').filter({hasText:'5. Fit a probability'}).click();
    const note=page.locator('.optional-depth').filter({has:page.locator('summary',{hasText:'calibration'})});assert.equal(await note.getAttribute('open'),'');await note.locator('summary').click();
    const lab=page.locator('.supervised-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.supervised-lab')?.closest('astro-island')?.hasAttribute('ssr'));
    const {experiment}=await import('../src/lib/supervised-learning.mjs');
    assert.equal(await lab.locator('[data-supervised="prediction"]').innerText(),'3.9286');assert.equal(await lab.locator('#supervised-threshold').count(),0);
    assert.equal(await lab.locator('svg circle').count(),6);await page.locator('#supervised-split').selectOption('validation');assert.equal(await lab.locator('svg circle').count(),3);assert.equal(await lab.locator('[data-supervised="loss"]').innerText(),'0.1878');
    assert.deepEqual(await page.locator('#supervised-split option').evaluateAll(xs=>xs.map(x=>x.value)),['train','validation']);
    await lab.screenshot({path:path.join(out,'regression.png'),style:'.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}'});
    for(const task of ['regression','classification'])for(const strength of [0,.1,1]){
      await page.locator('#supervised-task').selectOption(task);await page.locator('#supervised-strength').selectOption(String(strength));
      const expected=experiment(task,strength);assert.equal(await lab.locator('[data-supervised="prediction"]').innerText(),expected.query.prediction.toFixed(4));
      const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download model result'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-13-model-result.json');const file=path.join(out,task+'-'+strength+'.json');await d.saveAs(file);numericEqual(JSON.parse(await fs.readFile(file,'utf8')),expected);
    }
    await page.locator('#supervised-strength').selectOption('0');const oldWeight=await lab.locator('[data-supervised="weight"]').innerText();const oldLoss=await lab.locator('[data-supervised="loss"]').innerText();
    await page.locator('#supervised-threshold').focus();await page.keyboard.press('End');await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('#supervised-threshold').inputValue(),'0.9');assert.equal(await lab.locator('[data-supervised="decision"]').innerText(),'Thumbs-down');assert.equal(await lab.locator('[data-supervised="prediction"]').innerText(),'0.8202');assert.equal(await lab.locator('[data-supervised="weight"]').innerText(),oldWeight);assert.equal(await lab.locator('[data-supervised="loss"]').innerText(),oldLoss);
    await page.locator('#supervised-history').focus();await page.keyboard.press('Home');assert.equal(await lab.locator('[data-supervised="weight"]').innerText(),oldWeight);assert.equal(await lab.locator('[data-supervised="decision"]').innerText(),'Thumbs-down');
    await lab.locator('.workshop-detail summary').click();assert.equal(await lab.locator('.workshop-detail tbody tr').count(),3);await lab.locator('.workshop-detail summary').click();
    await lab.getByRole('button',{name:'Reset models'}).click();assert.equal(await page.locator('#supervised-history').inputValue(),'0.75');assert.equal(await page.locator('#supervised-task').inputValue(),'regression');
    await page.locator('#supervised-task').selectOption('classification');await lab.screenshot({path:path.join(out,'classification.png'),style:'.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}'});
    await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'workbench-dark.png'),style:'.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}'});await page.getByRole('button',{name:'Switch to light theme'}).click();
    await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
    await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
    for(const [i,a] of [1,0,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
    for(const [label,name] of [['Download the supervised learning workbook ZIP','chapter-13-supervised-learning.zip'],['Download PDF','ai-handbook-chapter-13.pdf']]){
      const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));
    }
    await page.getByRole('button',{name:'Mark Chapter 13 complete'}).click();
    const bookmark='9-explore-two-fitted-models';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
    const b=await page.locator('#save-place').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
    await page.locator('.reader-tools summary').click();const waitBackup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await waitBackup).suggestedFilename(),'ai-handbook-chapter-13-progress.json');
    await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-12-v1'))),prior);
    await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
    await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});
    await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
    await page.locator('#supervised-task').selectOption('classification');await lab.screenshot({path:path.join(out,'mobile-lab.png'),style:'.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),2);assert.equal(await page.locator('#supervised-task').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/0.8202/);
    await page.emulateMedia({media:'screen'});await page.evaluate(()=>dispatchEvent(new Event('afterprint')));assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.deepEqual(errors,[]);
    const report={passed:true,headings:12,diagrams:3,optionalNotes:7,checks:['six fitted model configurations','threshold and prediction independence','training and validation plots','JSON download parity','quiz and search','PDF and workbook downloads','chapter navigation','progress isolation','mobile and dark themes','fixed print comparison'],errors};
    await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
