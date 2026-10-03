const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
function numericEqual(actual,expected){
  if(typeof expected==='number'){assert.ok(Math.abs(actual-expected)<=1e-10,`${actual} != ${expected}`);return;}
  if(expected&&typeof expected==='object'){assert.deepEqual(Object.keys(actual),Object.keys(expected));for(const key of Object.keys(expected))numericEqual(actual[key],expected[key]);return;}
  assert.equal(actual,expected);
}
const base='http://127.0.0.1:4321',route='/chapters/14-unsupervised-learning-and-other-approaches/';
const screenshotStyle='.topbar,.reader-tools,.skip-link,#scroll-track{visibility:hidden!important}';
(async()=>{
  const out=path.resolve(__dirname,'../tmp/qa/chapter-14');await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1512,height:1100},reducedMotion:'reduce'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/chapters/13-supervised-learning-regression-and-classification/',{waitUntil:'networkidle'});
    const prior={version:1,chapter:13,complete:true,bookmark:'1-start-with-the-outcome-you-want-to-predict'};
    await page.evaluate(p=>localStorage.setItem('ai-handbook-progress-chapter-13-v1',JSON.stringify(p)),prior);
    await page.getByRole('link',{name:'Read Chapter 14'}).click();await page.waitForURL(base+route);await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('.chapter-content h2').count(),12);assert.equal(await page.locator('figure.diagram svg').count(),3);
    assert.equal(await page.locator('.optional-depth').count(),6);assert.equal(await page.locator('.optional-depth[open]').count(),0);
    assert.equal(await page.locator('.chapter-nav[aria-current="page"]').getAttribute('href'),route);
    assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'false');
    const missing=await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash));assert.deepEqual(missing,[]);
    await page.screenshot({path:path.join(out,'desktop.png')});
    for(let i=0;i<3;i++)await page.locator('figure.diagram').nth(i).screenshot({path:path.join(out,'diagram-'+i+'.png'),style:screenshotStyle});
    assert.ok(await page.locator('figure.diagram svg').evaluateAll(svgs=>svgs.every(svg=>(svg.getAttribute('aria-labelledby')||'').split(' ').every(id=>!!document.getElementById(id)?.textContent))));
    await page.getByRole('button',{name:'Search Chapter 14'}).click();await page.locator('#search-input').fill('pseudo-label');await page.locator('.search-item:visible').filter({hasText:'7. Find out'}).click();
    const note=page.locator('.optional-depth').filter({has:page.locator('summary',{hasText:'pseudo-labels'})});assert.equal(await note.getAttribute('open'),'');await note.locator('summary').click();
    const lab=page.locator('.unsupervised-lab');await lab.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.unsupervised-lab')?.closest('astro-island')?.hasAttribute('ssr'));
    const {experiment}=await import('../src/lib/unsupervised-learning.mjs');
    assert.equal(await lab.locator('[data-unsup="inertia"]').innerText(),'75.0000');assert.equal(await lab.locator('[data-unsup="step"]').innerText(),'0');assert.equal(await lab.locator('svg circle').count(),9);
    await lab.getByRole('button',{name:'Move centers and reassign'}).click();assert.equal(await lab.locator('[data-unsup="inertia"]').innerText(),'51.1667');assert.equal(await lab.locator('[data-unsup="step"]').innerText(),'1');assert.equal(await lab.getByRole('button',{name:'Run to stop'}).isDisabled(),true);
    await lab.screenshot({path:path.join(out,'clusters.png'),style:screenshotStyle});
    async function checkDownload(expected,name){
      const wait=page.waitForEvent('download');await lab.getByRole('button',{name:'Download exploration result'}).click();const d=await wait;assert.equal(d.suggestedFilename(),'chapter-14-'+expected.mode+'-result.json');const file=path.join(out,name+'.json');await d.saveAs(file);numericEqual(JSON.parse(await fs.readFile(file,'utf8')),expected);
    }
    for(const k of [2,3])for(const start of ['spread','first'])for(const weight of [1,3]){
      await page.locator('#unsup-k').selectOption(String(k));await page.locator('#unsup-start').selectOption(start);await page.locator('#unsup-weight').selectOption(String(weight));
      assert.equal(await lab.locator('[data-unsup="step"]').innerText(),'0');await lab.getByRole('button',{name:'Run to stop'}).click();
      const expected=experiment('clusters',k,start,weight);assert.equal(await lab.locator('[data-unsup="inertia"]').innerText(),expected.state.inertia.toFixed(4));
      assert.match(await lab.locator('[data-unsup="status"]').innerText(),/^Stable assignments/);await checkDownload(expected,`clusters-${k}-${start}-${weight}`);
    }
    await lab.getByRole('button',{name:'Reset exploration'}).click();await page.locator('#unsup-start').selectOption('first');await page.locator('#unsup-weight').selectOption('3');
    for(const step of [1,2,3]){await lab.getByRole('button',{name:'Move centers and reassign'}).click();const r=experiment('clusters',3,'first',3,step);assert.equal(await lab.locator('[data-unsup="step"]').innerText(),String(step));assert.equal(await lab.locator('[data-unsup="inertia"]').innerText(),r.state.inertia.toFixed(4));}
    await page.locator('#unsup-mode').selectOption('pca');assert.equal(await page.locator('#unsup-k').count(),0);assert.equal(await lab.locator('[data-unsup="variance"]').innerText(),'69.97%');assert.equal(await lab.locator('[data-unsup="residual"]').innerText(),'5.7459');assert.equal(await lab.locator('svg .validation-point').count(),9);
    await lab.locator('.workshop-detail summary').click();assert.equal(await lab.locator('.workshop-detail tbody tr').count(),9);assert.match(await lab.locator('.workshop-detail tbody tr').nth(4).innerText(),/25.6387/);
    await checkDownload(experiment('pca'),'pca');await lab.locator('.workshop-detail summary').click();await lab.screenshot({path:path.join(out,'pca.png'),style:screenshotStyle});
    await page.getByRole('button',{name:'Switch to dark theme'}).click();await lab.screenshot({path:path.join(out,'workbench-dark.png'),style:screenshotStyle});await page.getByRole('button',{name:'Switch to light theme'}).click();
    await lab.getByRole('button',{name:'Reset exploration'}).click();assert.equal(await page.locator('#unsup-mode').inputValue(),'clusters');assert.equal(await lab.locator('[data-unsup="inertia"]').innerText(),'75.0000');await checkDownload(experiment('clusters',3,'spread',1,0),'initial');
    await page.locator('.solution summary').first().click();assert.equal(await page.locator('.solution').first().getAttribute('open'),'');
    await page.locator('.quiz').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.quiz')?.closest('astro-island')?.hasAttribute('ssr'));
    for(const [i,a] of [1,0,2,1,2].entries())await page.locator(`input[name="question-${i}"][value="${a}"]`).check();await page.getByRole('button',{name:'Check my answers'}).click();assert.match(await page.locator('.quiz-actions [role="status"]').innerText(),/^5\/5 correct/);
    for(const [label,name] of [['Download the unsupervised learning workbook ZIP','chapter-14-unsupervised-learning.zip'],['Download PDF','ai-handbook-chapter-14.pdf']]){
      const wait=page.waitForEvent('download');await page.getByRole('link',{name:label}).click();const d=await wait;assert.equal(d.suggestedFilename(),name);const saved=path.join(out,name);await d.saveAs(saved);assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.resolve(__dirname,'../public/downloads/'+name)));
    }
    await page.getByRole('button',{name:'Mark Chapter 14 complete'}).click();
    const bookmark='9-explore-groups-and-compressed-coordinates';await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),bookmark);await page.waitForFunction(id=>document.querySelector('.page-toc [data-section="'+id+'"]')?.getAttribute('aria-current')==='location',bookmark);
    const b=await page.locator('#save-place').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#resume-place').getAttribute('href'),'#'+bookmark);
    await page.locator('.reader-tools summary').click();const waitBackup=page.waitForEvent('download');await page.locator('#export-progress').click();assert.equal((await waitBackup).suggestedFilename(),'ai-handbook-chapter-14-progress.json');
    await page.locator('#import-progress').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});await page.waitForFunction(()=>document.getElementById('toast')?.textContent?.includes('not a valid'));assert.equal(await page.locator('#complete-chapter').getAttribute('aria-pressed'),'true');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-handbook-progress-chapter-13-v1'))),prior);
    await page.goto(base+'/curriculum/',{waitUntil:'networkidle'});assert.equal(await page.locator('.curriculum-part li').count(),42);assert.equal(await page.locator('.curriculum-part small').count(),0);assert.equal(await page.locator('.curriculum-part li a').count(),42);assert.match(await page.locator('.availability').innerText(),/All 42 chapters are available/);
    await page.goto(base+route,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'mobile.png')});
    await page.getByRole('button',{name:'Open handbook navigation'}).click();assert.equal(await page.locator('.chapter-nav[aria-current="page"]').isVisible(),true);await page.keyboard.press('Escape');
    await lab.screenshot({path:path.join(out,'mobile-clusters.png'),style:screenshotStyle});await page.locator('#unsup-mode').selectOption('pca');await lab.screenshot({path:path.join(out,'mobile-pca.png'),style:screenshotStyle});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:1200,height:1000});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('.chapter-content details:not([open])').count(),0);await page.emulateMedia({media:'print'});assert.equal(await lab.locator('.print-only').isVisible(),true);assert.equal(await lab.locator('.print-only tbody tr').count(),4);assert.equal(await page.locator('#unsup-mode').isVisible(),false);assert.match(await lab.locator('.print-only').innerText(),/69.97%/);
    await page.emulateMedia({media:'screen'});await page.evaluate(()=>dispatchEvent(new Event('afterprint')));assert.equal(await page.locator('.optional-depth[open]').count(),0);assert.deepEqual(errors,[]);
    const report={passed:true,headings:12,diagrams:3,optionalNotes:6,checks:['eight clustering fits','stepwise convergence','PCA reconstructions','JSON parity including initialization','quiz and search','PDF and workbook downloads','chapter navigation','progress isolation','mobile and dark themes','fixed print comparison'],errors};
    await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
