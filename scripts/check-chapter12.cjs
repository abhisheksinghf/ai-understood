const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/12-preparing-data-for-machine-learning/';
(async()=>{
  const out=path.resolve(__dirname,'../tmp/qa/chapter-12');await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/chapters/11-project-movie-recommendation-assistant/',{waitUntil:'networkidle'});
    const prior={version:1,chapter:11,complete:true,bookmark:'1-start-with-a-small-product-promise'};
    await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-11-v1',JSON.stringify(p)),prior);
    await page.getByRole('link',{name:'Read Chapter 12'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);
    assert.equal(await page.locator('.optional-depth').count(),7);assert.equal(await page.locator('.optional-depth[open]').count(),0);
    assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
    assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'false');
    const missing=await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash));assert.deepEqual(missing,[]);
    await page.screenshot({path:path.join(out,'desktop.png')});
    for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png')});
    assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
    await page.getByRole('button',{name:'Search Chapter 12'}).click();await page.locator('#search-input').fill('sampling bias');await page.locator('.search-item:visible').filter({hasText:'2. Inspect before'}).click();
    const note=page.locator('.optional-depth').filter({has:page.locator('summary',{hasText:'sampling bias'})});assert.equal(await note.getAttribute('open'),'');await note.locator('summary').click();
    const lab=page.locator('.data-prep');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.data-prep')?.closest('astro-island')?.hasAttribute('ssr'));
    const {prepareData}=await import('../src/lib/data-preparation.mjs');
    for(const [strategy,scope,fill,mean,columns] of [['median','train','110','111.6667','8'],['mean','train','112.5','112.5','8'],['median','all','127.5','132.5','9'],['mean','all','133.75','133.75','9']]){
      await page.locator('#prep-strategy').selectOption(strategy);await page.locator('#prep-scope').selectOption(scope);
      assert.equal(Number(await lab.locator('[data-prep="fill"]').innerText()),Number(fill));assert.equal(Number(await lab.locator('[data-prep="mean"]').innerText()),Number(mean));assert.equal(await lab.locator('[data-prep="columns"]').innerText(),columns);
      assert.equal(await lab.locator('.prep-leaky').count(),scope==='all'?1:0);
      await page.locator('#prep-event').selectOption('E07');assert.equal(await lab.locator('[data-feature="genre=__unknown__"]').innerText(),scope==='train'?'1':'0');
      const wait=page.waitForEvent('download');await lab.getByRole('button',{name:scope==='train'?'Download prepared data':'Download leakage comparison'}).click();const download=await wait;
      assert.equal(download.suggestedFilename(),scope==='train'?'chapter-12-prepared-data.json':'chapter-12-leakage-demo.json');const file=path.join(out,strategy+'-'+scope+'.json');await download.saveAs(file);assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),prepareData(strategy,scope));
    }
    await lab.screenshot({path:path.join(out,'leakage.png')});await lab.getByRole('button',{name:'Reset preparation'}).click();
    assert.equal(await page.locator('#prep-event').inputValue(),'E04');assert.equal(await lab.locator('[data-feature="runtime_missing"]').innerText(),'1');assert.equal(await lab.locator('[data-feature="runtime_z"]').innerText(),'-0.1118');assert.equal(await lab.locator('[data-feature="genre=sci-fi"]').innerText(),'1');
    await lab.screenshot({path:path.join(out,'workbench.png')});await lab.locator('.workshop-detail summary').click();assert.equal(await lab.locator('.prep-table-wrap tbody tr').count(),10);
    await lab.screenshot({path:path.join(out,'audit.png')});await lab.locator('.workshop-detail summary').click();
    await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'workbench-dark.png')});await page.getByRole('button',{name:'Switch to light theme'}).click();
    await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
    await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
    for(const [i,a] of [1,0,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
    for(const [label,name] of [['Download the data preparation workbook ZIP','chapter-12-data-preparation.zip'],['Download PDF','ai-handbook-chapter-12.pdf']]){
      const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));
    }
    await page.getByRole('button',{name:'Mark Chapter 12 complete'}).click();
    const bookmark='8-explore-the-preparation-workbench';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
    const b=await page.locator('#save-place').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
    await page.locator('.reader-tools summary').click();const waitBackup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await waitBackup).suggestedFilename(),'ai-handbook-chapter-12-progress.json');
    await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-11-v1'))),prior);
    await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
    await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});
    await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
    await lab.scrollIntoViewIfNeeded();await lab.screenshot({path:path.join(out,'mobile-lab.png')});await page.locator('#prep-scope').selectOption('all');await page.locator('#prep-event').selectOption('E07');assert.equal(await lab.locator('[data-feature="genre=documentary"]').innerText(),'1');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),4);assert.equal(await page.locator('#prep-scope').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/127.5/);
    await page.emulateMedia({media:'screen'});await page.evaluate(()=>dispatchEvent(new Event('afterprint')));assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.deepEqual(errors,[]);
    const report={passed:true,headings:12,diagrams:3,optionalNotes:7,checks:['four preprocessing modes','missing and unknown indicators','cleaning audit','JSON download parity','quiz and search','PDF and workbook downloads','chapter navigation','progress isolation','mobile and dark themes','fixed print comparison'],errors};
    await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
