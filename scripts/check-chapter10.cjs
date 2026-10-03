const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:4321',route='/chapters/10-building-an-llm-application-with-python/';
(async()=>{
  const out=path.resolve(__dirname,'../tmp/qa/chapter-10');await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chapters/09-prompting-and-context-design/',{waitUntil:'networkidle'});
  const prior={version:1,chapter:9,complete:true,bookmark:'7-explore-the-prompt-workshop'};
  await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-9-v1',JSON.stringify(p)),prior);
  await page.getByRole('link',{name:'Read Chapter 10'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
  assert.equal(await page.locator('.chapter-content h2').count(),12);
  assert.equal(await page.locator('figure.diagram svg').count(),3);
  assert.equal(await page.locator('.katex').count(),0);assert.equal(await page.locator('.katex-error').count(),0);
  assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);
  assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'false');
  const missing=await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash));assert.deepEqual(missing,[]);
  await page.screenshot({path:path.join(out,'desktop.png')});
  for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png')});
  const accessible=await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent)));assert.equal(accessible,true);
  await page.getByRole('button',{name:'Search Chapter 10'}).click();await page.locator('#search-input').fill('idempotency');
  await page.locator('.search-item:visible').filter({hasText:'7. Retry temporary'}).click();
  const note=page.locator('.optional-depth').filter({has:page.locator('summary',{hasText:'backoff'})});
  assert.equal(await note.getAttribute('open'),'');await note.locator(':scope > summary').click();
  await page.getByRole('button',{name:'Search Chapter 10'}).click();await page.locator('#search-input').fill('zzznomatch');assert.equal(await page.locator('.search-item:visible').count(),0);await page.keyboard.press('Escape');
  const lab=page.locator('.application-trace');await lab.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>!document.querySelector('.application-trace')?.closest('astro-island')?.hasAttribute('ssr'));
  const recording=JSON.parse(await fs.readFile(path.resolve(__dirname,'../src/data/applicationTrace.json'),'utf8'));
  assert.equal(await page.getByRole('button',{name:'Previous event',exact:true}).isEnabled(),false);
  for(const item of recording.cases){
    await page.locator('#app-case').selectOption(item.id);
    for(const budget of ['1','2']){
      await page.locator('#app-budget').selectOption(budget);
      const run=item.runs[budget];
      for(let i=0;i<run.trace.length;i++){
        assert.equal((await lab.locator('[data-app="stage"]').innerText()).toLowerCase(),run.trace[i].stage.replaceAll('_',' '));
        assert.equal(await lab.locator('[data-app="detail"]').innerText(),run.trace[i].detail);
        if(i<run.trace.length-1)await page.getByRole('button',{name:'Next event',exact:false}).click();
      }
      assert.match(await lab.locator('[data-app="outcome"]').innerText(),new RegExp(run.status));
      assert.equal(await page.getByRole('button',{name:'Next event',exact:false}).isEnabled(),false);
      if(run.candidate){
        const details=lab.locator('details').filter({has:page.locator('summary',{hasText:'authored candidate'})});
        if(await details.getAttribute('open')===null)await details.locator('summary').click();
        assert.deepEqual(JSON.parse(await lab.locator('[data-app="candidate"]').innerText()),run.candidate);
      }else assert.equal(await lab.locator('[data-app="no-candidate"]').innerText(),'No candidate accepted.');
      await page.getByRole('button',{name:'Restart trace',exact:true}).click();assert.equal(await lab.locator('[data-app="candidate"]').count(),0);
    }
  }
  await page.locator('#app-case').selectOption('transient');await page.locator('#app-budget').selectOption('2');
  await page.getByRole('button',{name:'Jump to outcome',exact:true}).click();
  await lab.screenshot({path:path.join(out,'workshop.png')});
  await page.getByRole('button',{name:'Previous event',exact:true}).click();assert.equal(await lab.locator('[data-app="outcome"]').count(),0);
  await page.getByRole('button',{name:'Next event',exact:false}).click();
  const fullTrace=lab.locator('details').filter({has:page.locator('summary',{hasText:'full recorded trace'})});await fullTrace.locator('summary').click();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download this trace',exact:true}).click();const traceFile=await pending;
  assert.equal(traceFile.suggestedFilename(),'chapter-10-transient-2-attempt-trace.json');
  const tracePath=path.join(out,traceFile.suggestedFilename());await traceFile.saveAs(tracePath);
  assert.deepEqual(JSON.parse(await fs.readFile(tracePath,'utf8')),{notice:recording.notice,case:'transient',totalAttemptBudget:2,...recording.cases.find(c=>c.id==='transient').runs['2']});
  await fullTrace.locator('summary').click();
  await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'workshop-dark.png')});await page.getByRole('button',{name:'Switch to light theme'}).click();
  await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
  await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
  assert.equal(await page.getByRole('button',{name:'Check my answers'}).isEnabled(),false);
  for(const [i,a] of [1,0,2,1,2].entries())await page.locator('input[name="question-'+i+'"][value="'+a+'"]').check();
  await page.getByRole('button',{name:'Check my answers'}).click();assert.ok((await page.locator('.quiz-actions [role="status"]').innerText()).startsWith('5/5 correct'));
  await page.getByRole('button',{name:'Try again',exact:true}).click();assert.equal(await page.locator('.quiz input:checked').count(),0);
  for(const [label,filename] of [['Download the Python LLM application workbook ZIP','chapter-10-llm-app-workbook.zip'],['Download PDF','ai-handbook-chapter-10.pdf']]){
    const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const download=await wait;assert.equal(download.suggestedFilename(),filename);
    const saved=path.join(out,filename);await download.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+filename)));
  }
  await page.getByRole('button',{name:'Mark Chapter 10 complete'}).click();
  const bookmark='8-trace-the-application-through-success-and-failure';
  await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);
  await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
  const bounds=await page.locator('#save-place').boundingBox();await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
  await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
  await page.locator('.reader-tools summary').click();const wait=page.waitForEvent('download');await page.locator('#export-progress').click();const backup=await wait;assert.equal(backup.suggestedFilename(),'ai-handbook-chapter-10-progress.json');
  await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));
  assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-9-v1'))),prior);
  await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);
  await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(out,'mobile.png')});await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
  await page.locator('#app-case').selectOption('unsupported');await page.locator('#app-budget').selectOption('2');await page.getByRole('button',{name:'Jump to outcome',exact:true}).click();
  await lab.screenshot({path:path.join(out,'mobile-lab.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('.application-trace .print-only').isVisible(),true);assert.equal(await page.locator('.application-trace .print-only tbody tr').count(),10);assert.equal(await page.locator('#app-budget').isVisible(),false);
  await page.emulateMedia({media:'screen'});await page.evaluate(()=>dispatchEvent(new Event('afterprint')));assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.deepEqual(errors,[]);
  const report={passed:true,headings:12,diagrams:3,optionalNotes:6,recordedRuns:20,checks:['all recorded events and outcomes','candidate and failure states','step navigation and reset','trace download','accessible diagrams','quiz and search','PDF and workbook downloads','progress isolation','curriculum','mobile and dark theme','print fallback'],errors};
  await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
