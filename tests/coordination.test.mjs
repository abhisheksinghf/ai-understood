import test from 'node:test';
import assert from 'node:assert/strict';
import {runCoordination,availabilityReport,verifyAvailability,protocolTranscript} from '../src/lib/coordination.mjs';
test('parallel checks reduce elapsed time without reducing work',()=>{
 const p=runCoordination(),s=runCoordination({schedule:'sequential'});
 assert.equal(p.chosen,'M003');assert.equal(p.status,'verified');assert.equal(p.elapsed,6);assert.equal(s.elapsed,8);assert.equal(p.workUnits,8);assert.equal(s.workUnits,8);
 assert.ok(p.jobs.slice(1).every(j=>j.start>=p.jobs[0].end));
});
test('handoff changes ownership while preserving task and evidence',()=>{const r=runCoordination({pattern:'handoff'});assert.equal(r.owner,'Movie specialist');assert.equal(r.handoffs,1);assert.equal(r.jobs[0].owner,'Manager');assert.equal(r.jobs[1].owner,'Movie specialist');assert.equal(r.status,'verified');assert.equal(r.reports.availability.region,'IN');});
for(const scenario of ['missing','wrong_region','stale','conflict'])test(`${scenario} cannot support a verified recommendation`,()=>{const r=runCoordination({scenario});assert.equal(r.status,'insufficient_evidence');assert.equal(r.chosen,null);const unsafe=runCoordination({scenario,validate:false});assert.equal(unsafe.status,'unsupported');assert.equal(unsafe.chosen,'M003');});
test('budget prevents scheduling extra workers and finalization',()=>{for(const budget of [1,2]){const r=runCoordination({budget});assert.equal(r.jobCount,budget);assert.equal(r.chosen,null);assert.equal(r.status,'incomplete');assert.equal(r.reports.taste,undefined);}});
test('negative evidence differs from absent evidence',()=>{assert.match(verifyAvailability(availabilityReport('normal'),'M001').reason,/unavailable/);assert.match(verifyAvailability(null,'M003').reason,/unknown/);});
test('result contracts reject wrong movie, wrong type, and conflicting records',()=>{
 for(const row of [{movie_id:'M999',available:true},{movie_id:'M003',available:'true'},null]){const r=availabilityReport('normal');r.records=[row];assert.equal(verifyAvailability(r,'M003').ok,false);}
 const r=availabilityReport('normal');r.records=r.records.filter(x=>x.movie_id==='M001');assert.equal(verifyAvailability(r,'M003').ok,false);
});
test('independent run reports cannot mutate future runs',()=>{const r=runCoordination();r.reports.catalog.movies[0].title='changed';r.reports.taste.ranking[0]='M999';assert.equal(runCoordination().chosen,'M003');assert.equal(runCoordination().reports.catalog.movies[0].title,'Moonlight Map');});
test('invalid configuration is rejected instead of silently changing the lesson',()=>{for(const c of [{scenario:'x'},{pattern:'x'},{schedule:'x'},{budget:0},{budget:true},{validate:'yes'},{unexpected:1}])assert.throws(()=>runCoordination(c));});
test('illustrative MCP exchange pairs IDs and discovers the callable schema',()=>{const t=protocolTranscript();assert.equal(t.length,7);assert.equal(t[2].method,'notifications/initialized');assert.equal('id'in t[2],false);for(const [a,b]of[[0,1],[3,4],[5,6]])assert.equal(t[a].id,t[b].id);assert.equal(t[0].params.protocolVersion,t[1].result.protocolVersion);assert.equal(t[4].result.tools[0].name,t[5].params.name);assert.equal(t[6].result.isError,false);});
