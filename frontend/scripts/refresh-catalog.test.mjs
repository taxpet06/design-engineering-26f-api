import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { buildSnapshot, companionChoices, courseId, detailSource, isExcluded, parseMeetings, plainText, publishSnapshot, refresh, ROOT, TERM_CONFIG, validateSnapshot } from './refresh-catalog.mjs';
const snapshot=JSON.parse(await fs.readFile(path.join(ROOT,'src/data/snapshot.json'),'utf8'));
test('official snapshot coverage and unique term:CRN identities',()=>{
  assert.equal(validateSnapshot(snapshot),true);assert.deepEqual(snapshot.coverage.map(c=>c.sourceCount),[1013,320,1040]);assert.equal(new Set(snapshot.sections.map(s=>s.id)).size,2373);assert(snapshot.courses.some(c=>c.code==='AAAS 20.02'));assert(snapshot.sections.every(s=>!s.section_number.includes('ZZ')));
});
test('acquired search counts match every retained public offering',async()=>{
  for(const term of TERM_CONFIG){const search=JSON.parse(gunzipSync(await fs.readFile(path.join(ROOT,`scripts/raw/${term.code}-search.json.gz`))));const expected=search.results.filter(r=>!isExcluded(r)).map(r=>`${term.id}:${r.crn}`).sort();assert.deepEqual(snapshot.sections.filter(s=>s.term===term.id).map(s=>s.id).sort(),expected);}
});
test('does not infer prerequisites or required-component absence from blanks',()=>{
  assert.equal(companionChoices({linked_crns:''},{required_sections:''},'26F',new Set()).verified,false);
  assert.equal(courseId('COSC 001'),'COSC 1');assert.equal(courseId('COSC 089.10'),'COSC 89.10');
  const row={crn:'1',code:'TEST 001',title:'Missing evidence',start_date:'2026-09-14',end_date:'2026-11-25'};
  const missing=buildSnapshot([{config:TERM_CONFIG[0],search:{count:1,results:[row]},details:{'1':{crn:'1',code:'TEST 001'}}}],{});
  assert.equal(missing.courses[0].prerequisite.kind,'review');
});
test('all-of and one-of required sections produce different combinations',()=>{
  const row={linked_crns:'1,2'},ids=new Set(['26F:1','26F:2']);const links='<a data-key="crn:1"></a><a data-key="crn:2"></a>';
  assert.deepEqual(companionChoices(row,{required_sections:'one of the following section(s)'+links},'26F',ids).options,[['26F:1'],['26F:2']]);
  assert.deepEqual(companionChoices(row,{required_sections:'the following section(s)'+links},'26F',ids).options,[['26F:1','26F:2']]);
  assert.equal(companionChoices(row,{required_sections:links},'26F',new Set(['26F:1'])).verified,false);
});
test('excludes canceled and hidden administrative offerings and strips source HTML',()=>{
  for(const row of [{isCancelled:'Y'},{stat:'C'},{hide:'Y'},{grid__hide:'true'},{section:'ZZ'}])assert.equal(isExcluded(row),true);
  assert.equal(plainText('<p>A &amp; B&nbsp;<script>bad()</script> C</p>'),'A & B C');
});
test('meeting parser preserves X-hours and effective dates',()=>{
  const meetings=parseMeetings({meetingTimes:'[{"meet_day":"3","start_time":"1215","end_time":"1305"}]',account_code:'10',start_date:'2026-09-14',end_date:'2026-11-25'});
  assert.equal(meetings[0].kind,'x-hour');assert.equal(meetings[0].startDate,'2026-09-14');
  assert.throws(()=>parseMeetings({meetingTimes:'[{"meet_day":"9","start_time":"2560","end_time":"1305"}]'}));
});
test('incomplete acquisition rejects before publication',()=>{
  assert.throws(()=>buildSnapshot([{config:TERM_CONFIG[0],search:{count:2,results:[]},details:{}}]),/Incomplete/);
});
test('failed validation preserves the exact last good snapshot',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'third-course-refresh-'));const destination=path.join(dir,'snapshot.json');
  const original=JSON.stringify(snapshot);await fs.writeFile(destination,original);
  await assert.rejects(publishSnapshot({...snapshot,sections:[]},destination),/Empty/);assert.equal(await fs.readFile(destination,'utf8'),original);
  await fs.rm(dir,{recursive:true,force:true});
});

test('term identifiers, provenance, dates and explicit cross-list scope remain valid',()=>{
  assert(snapshot.terms.every(t=>t.id===t.code));assert(snapshot.sections.every(s=>snapshot.terms.some(t=>t.id===s.term)));
  assert.equal(snapshot.departments.find(d=>d.code==='COSC').name,'Computer Science');
  assert(snapshot.equivalences.some(e=>e.kind==='cross-listing'&&e.from==='AAAS 20.02'&&e.to==='HIST 10.06'&&e.scope==='26F:90856|26F:90895'));
  const invalid=structuredClone(snapshot);invalid.sections[0].meetings[0].startDate='2026-02-31';assert.throws(()=>validateSnapshot(invalid),/meeting interval/);
});

test('parser rejects impossible and malformed effective dates',()=>{
  const row={meetingTimes:'[{"meet_day":"3","start_time":"1215","end_time":"1305"}]',account_code:'10',start_date:'2026-09-14',end_date:'2026-11-25'};
  assert.throws(()=>parseMeetings({...row,start_date:'2026-02-31'}),/Invalid meeting interval/);
  assert.throws(()=>parseMeetings({...row,end_date:'invalid'}),/Invalid meeting interval/);
});

test('simulated source acquisition outage preserves the exact last good snapshot',async(t)=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'third-course-source-failure-')),destination=path.join(dir,'snapshot.json');
  const original=JSON.stringify(snapshot);await fs.writeFile(destination,original);
  t.mock.method(globalThis,'fetch',async()=>{throw Error('simulated source outage');});
  try { await assert.rejects(refresh({destination}),/simulated source outage/);assert.equal(await fs.readFile(destination,'utf8'),original); }
  finally { t.mock.restoreAll();await fs.rm(dir,{recursive:true,force:true}); }
});
test('unexpected source shrink fails before replacing existing evidence or snapshot',()=>{
  const previous={...snapshot,coverage:snapshot.coverage.map(c=>({...c,sourceCount:c.sourceCount*2}))};
  assert.throws(()=>validateSnapshot(snapshot,previous),/Unexpected source shrink/);
});
test('official source links use FOSE section-detail deep-link format',()=>{
  assert.equal(detailSource('202609','91925'),'https://courses.dartmouth.edu/?details&srcdb=202609&crn=91925');
  assert(snapshot.sections.every(section=>new URL(section.source).searchParams.has('details')));
});

test('prerequisite metadata retains recommendations separately and rejects unsupported verified coverage',()=>{
  const row={crn:'1',code:'TEST 001',title:'Source evidence',start_date:'2026-09-14',end_date:'2026-11-25'};
  const source='https://dartmouth.smartcatalogiq.com/en/current/orc';
  const evidence={source,retrievedAt:'2026-10-15',verification:'verified',catalogEdition:'2026-27',sourceText:'COSC 10 or permission of the instructor.'};
  const prerequisite={kind:'any',evidence,rules:[{kind:'course',courseId:'COSC 10',evidence},{kind:'waiver',text:'Permission of the instructor.',evidence}]};
  const coverage={status:'verified',reason:'Explicit source text',source,retrievedAt:'2026-10-15',catalogEdition:'2026-27',sourceText:evidence.sourceText};
  const recommendedPreparation=[{text:'MATH 3 is recommended.',evidence}];
  const built=buildSnapshot([{config:TERM_CONFIG[0],search:{count:1,results:[row]},details:{'1':{crn:'1',code:'TEST 001'}}}],{'TEST 1':{prerequisite,coverage,recommendedPreparation}});
  assert.deepEqual(built.courses[0].prerequisite,prerequisite);
  assert.deepEqual(built.courses[0].prerequisiteCoverage,coverage);
  assert.deepEqual(built.courses[0].recommendedPreparation,recommendedPreparation);
  assert.equal(validateSnapshot(built),true);
  built.courses[0].prerequisiteCoverage.sourceText='';
  assert.throws(()=>validateSnapshot(built),/explicit evidence/);
});
