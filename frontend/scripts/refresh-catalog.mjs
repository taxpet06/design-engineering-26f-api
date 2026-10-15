import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE = 'https://courses.dartmouth.edu/';
export const TERM_CONFIG = [{ id:'26F', code:'202609', label:'Fall 2026', historical:false },{ id:'26X', code:'202606', label:'Summer 2026', historical:true },{ id:'26S', code:'202603', label:'Spring 2026', historical:true }];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
// X-hour labels transcribed from the Registrar's Class Schedule. Only label exact published matches.
// https://registrar.dartmouth.edu/sites/registrar/files/2025-07/class_schedule.pdf
const X_HOURS = {'10':['Thu',735,785],'11':['Tue',735,785],'12':['Tue',800,850],'2':['Thu',800,850],'10A':['Fri',930,980],'2A':['Wed',1050,1100],'3A':['Mon',1050,1100],'3B':['Fri',995,1045],'6A':['Tue',1110,1160],'6B':['Tue',1170,1220],'9L':['Thu',545,595],'9S':['Wed',545,595],'8S':['Wed',465,515],'8L':['Thu',465,515]};
export function plainText(value='') {
  const entities={nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“'};
  return String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&(#x[\da-f]+|#\d+|\w+);/gi,(m,e)=>e.startsWith('#')?String.fromCodePoint(e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1))):entities[e]??m).replace(/\s+/g,' ').trim();
}
export function courseId(code) { return code.trim().replace(/\s+/g,' ').replace(/ ([0-9]+)(?=\.|$)/,(_,n)=>' '+Number(n)); }
export const detailSource = (term,crn) => `${SOURCE}?details&srcdb=${term}&crn=${crn}`;
const validISODate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const minutes=value=>{if(!/^\d{4}$/.test(value))throw Error('Invalid meeting time');const h=Number(value.slice(0,2)),m=Number(value.slice(2));if(h>23||m>59)throw Error('Invalid meeting time');return h*60+m;};
export function parseMeetings(row) {
  const raw=JSON.parse(row.meetingTimes||'[]');
  if(!Array.isArray(raw))throw Error('Meeting times must be an array');
  return raw.map(meeting=>{const day=DAYS[Number(meeting.meet_day)],start=minutes(meeting.start_time),end=minutes(meeting.end_time);if(!day||start>=end||!validISODate(row.start_date)||!validISODate(row.end_date)||row.start_date>row.end_date)throw Error('Invalid meeting interval');const x=X_HOURS[row.account_code];return {days:[day],start,end,startDate:row.start_date,endDate:row.end_date,kind:x&&x[0]===day&&x[1]===start&&x[2]===end?'x-hour':'class'};});
}
export function isExcluded(row) {return !!row.isCancelled||row.stat==='C'||row.hide==='Y'||row.grid__hide==='true'||row.section==='ZZ'||row.no==='ZZ';}
export function companionChoices(row,detail,term,ids) {
  const linked=String(row.linked_crns||'').split(',').filter(Boolean).map(crn=>`${term}:${crn}`);
  const text=plainText(detail.required_sections);
  if(linked.some(id=>!ids.has(id)))return {options:[],verified:false,reason:'A required component is missing, canceled, or hidden in the published inventory.'};
  const described=[...String(detail.required_sections||'').matchAll(/data-key="crn:(\d+)"/g)].map(m=>`${term}:${m[1]}`);
  if(linked.length&&described.length&&new Set(described).size===linked.length&&linked.every(id=>described.includes(id))) {
    if(/one of the following section/i.test(text))return {options:linked.map(id=>[id]),verified:true};
    if(/the following section/i.test(text))return {options:[linked],verified:true};
  }
  return {options:[],verified:false,reason:linked.length?'The source does not unambiguously specify permitted component combinations.':'The source does not explicitly verify whether additional required components are absent.'};
}
export function buildBundles(sections) {
  const byId=new Map(sections.map(s=>[s.id,s]));const bundles=[];
  for(const main of sections.filter(s=>!['Lab','Discussion'].includes(s.component))) {
    let combinations=main.companionOptions.length?main.companionOptions:[[]];
    for(const option of combinations){const componentIds=[...new Set([main.id,...option])].sort();const parts=componentIds.map(id=>byId.get(id));if(parts.some(p=>!p))continue;
      // Every companion's explicit back-link must accept the chosen combination.
      if(parts.some(p=>p.companionOptions.length&&!p.companionOptions.some(o=>o.every(id=>componentIds.includes(id)))))continue;
      const reasons=[...new Set(parts.flatMap(p=>p.reviewReasons))];
      const verified=main.componentsVerified&&parts.every(p=>p.verification==='verified');
      bundles.push({id:componentIds.join('+'),course_id:main.course_id,term:main.term,section_number:parts.map(p=>p.section_number).join(' + '),componentIds,meetings:parts.flatMap(p=>p.meetings),source:main.source,verification:verified?'verified':'needsReview',reviewReasons:reasons});
    }
  }
  return bundles.sort((a,b)=>a.id.localeCompare(b.id));
}
export function buildSnapshot(rawTerms,prerequisites={},retrievedAt=new Date().toISOString()) {
  const courses=new Map(),sections=[],terms=[],coverage=[],equivalences=[];
  for(const {config,search,details} of rawTerms){
    if(search.count!==search.results?.length||!search.count)throw Error(`Incomplete ${config.id} search: ${search.count} != ${search.results?.length}`);
    if(new Set(search.results.map(r=>r.crn)).size!==search.results.length)throw Error('Duplicate official CRN');
    const rows=search.results.filter(r=>!isExcluded(r)),ids=new Set(rows.map(r=>`${config.id}:${r.crn}`));
    for(const row of rows){const detail=details[row.crn];if(!detail||detail.crn!==row.crn||detail.code!==row.code)throw Error(`Missing/mismatched detail ${row.crn}`);
      const id=courseId(row.code),source=detailSource(config.code,row.crn);const evidence={source,retrievedAt,verification:'needsReview'};
      if(!courses.has(id))courses.set(id,{id,code:row.code,title:plainText(row.title),department:id.split(' ')[0],credits:Number.isFinite(Number(row.grid__credit_hours))?Number(row.grid__credit_hours):0,level:'undergraduate',description:plainText(detail.description),source,prerequisite:prerequisites[id]?.prerequisite??{kind:'review',text:'Prerequisites are not explicitly verified in the course feed. Review the catalog and department guidance.',evidence},...(prerequisites[id]?.corequisite?{corequisite:prerequisites[id].corequisite}:{}),...(prerequisites[id]?.recommendedPreparation?{recommendedPreparation:prerequisites[id].recommendedPreparation}:{}),...(prerequisites[id]?.coverage?{prerequisiteCoverage:prerequisites[id].coverage}:{}),...(prerequisites[id]?.identityEvidence?{prerequisiteIdentityEvidence:prerequisites[id].identityEvidence}:{})});
      for(const match of String(detail.xlist||'').matchAll(/data-group="code:([^"]+)" data-key="crn:(\d+)"/g)) {
        if(ids.has(`${config.id}:${match[2]}`))equivalences.push({from:id,to:courseId(match[1]),kind:'cross-listing',scope:`${config.id}:${row.crn}|${config.id}:${match[2]}`,evidence:{source,retrievedAt,verification:'verified',note:'Explicit term-specific cross-listed section; this does not establish unrestricted credit substitution.'}});
      }
      const components=companionChoices(row,detail,config.id,ids),reviewReasons=[];
      let meetings=[];try{meetings=parseMeetings(row);}catch{reviewReasons.push('One or more published meeting intervals could not be parsed.');}
      if(!meetings.length)reviewReasons.push('Meeting times are arranged, missing, or not published.');
      if(!components.verified)reviewReasons.push(components.reason);
      if(plainText(detail.special_approval))reviewReasons.push(`Permission required: ${plainText(detail.special_approval)}. Approval has not been verified.`);
      if(plainText(detail.course_coreqs)||plainText(detail.section_coreqs))reviewReasons.push(`Published corequisite needs review: ${plainText(detail.course_coreqs)} ${plainText(detail.section_coreqs)}`);
      const restriction=plainText(detail.registration_restrictions).replace('Enrollment is limited to Thayer School of Engineering or Undergraduate level students.','').replace('Enrollment is limited to Undergraduate level students.','').replace('Guarini Graduate School level students may not enroll.','').replace('Students in the High School Student (UG) college may not enroll.','').trim();
      if(restriction)reviewReasons.push(`Registration restriction: ${restriction}`);
      if(/placement|not (?:open|eligible)|permission|approval/i.test(plainText(detail.description)))reviewReasons.push('The course description includes placement, permission, or enrollment conditions requiring review.');
      sections.push({id:`${config.id}:${row.crn}`,crn:row.crn,course_id:id,term:config.id,section_number:row.section||row.no,component:plainText(detail.schd_html)||row.schd,instructor:plainText(detail.instructordetail_html)||plainText(row.instr),meetings,source,verification:reviewReasons.length?'needsReview':'verified',reviewReasons,companionOptions:components.options,componentsVerified:components.verified});
    }
    const dates=rows.flatMap(r=>[r.start_date,r.end_date]).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    terms.push({id:config.id,code:config.id,label:config.label,start_date:dates[0],end_date:dates.at(-1),historical:config.historical,is_current:!config.historical});
    coverage.push({term:config.id,sourceCount:search.count,importedCount:rows.length,excludedCount:search.count-rows.length,subjects:new Set(rows.map(r=>courseId(r.code).split(' ')[0])).size,bundles:0});
  }
  const bundles=buildBundles(sections);for(const c of coverage)c.bundles=bundles.filter(b=>b.term===c.term).length;
  const departments=[...new Set([...courses.values()].map(c=>c.department))].sort().map(code=>({id:code,code,name:code}));
  return {version:2,source:SOURCE,exported_at:retrievedAt,courses:[...courses.values()].sort((a,b)=>a.id.localeCompare(b.id)),sections,bundles,terms,departments,coverage,equivalences};
}
export function validateSnapshot(snapshot,previous) {
  if(snapshot.version!==2||!snapshot.sections.length||!snapshot.courses.length)throw Error('Empty/invalid catalog');
  const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  const validSource=value=>{try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='dartmouth.edu'||u.hostname.endsWith('.dartmouth.edu')||u.hostname==='dartmouth.smartcatalogiq.com');}catch{return false;}};
  if(!validSource(snapshot.source)||Number.isNaN(Date.parse(snapshot.exported_at)))throw Error('Invalid provenance');
  const termIds=new Set(snapshot.terms.map(t=>t.id));
  for(const term of snapshot.terms)if(term.code!==term.id||!validDate(term.start_date)||!validDate(term.end_date)||term.start_date>term.end_date)throw Error('Invalid term identity/dates');
  const checkEvidence=evidence=>{if(!validSource(evidence?.source)||Number.isNaN(Date.parse(evidence?.retrievedAt))||!['verified','needsReview'].includes(evidence?.verification))throw Error('Invalid rule provenance');};
  const checkRule=rule=>{
    if(!rule||!['none','course','all','any','review','waiver'].includes(rule.kind))throw Error('Invalid rule kind');
    checkEvidence(rule.evidence);
    if(rule.kind==='course'&&!/^[A-Z]+ \d+(?:\.\d+)?$/.test(rule.courseId))throw Error('Invalid prerequisite course identity');
    if(rule.concurrentOnly!==undefined&&(rule.kind!=='course'||rule.concurrentOnly!==true||rule.concurrent!==true))throw Error('Invalid same-term requirement');
    if((rule.kind==='review'||rule.kind==='waiver')&&(!rule.text||typeof rule.text!=='string'))throw Error('Missing rule explanation');
    if(rule.kind==='all'||rule.kind==='any'){if(!Array.isArray(rule.rules)||!rule.rules.length)throw Error('Empty prerequisite rule');rule.rules.forEach(checkRule);}
  };
  for(const course of snapshot.courses){if(!validSource(course.source))throw Error('Invalid course source');checkRule(course.prerequisite);if(course.corequisite)checkRule(course.corequisite);
    for(const preparation of course.recommendedPreparation??[]){if(!preparation.text)throw Error('Missing preparation text');checkEvidence(preparation.evidence);}
    if(course.prerequisiteIdentityEvidence)checkEvidence(course.prerequisiteIdentityEvidence);
    const audit=course.prerequisiteCoverage;
    if(audit){
      if(!['verified','unresolved','unmatched','failed-source'].includes(audit.status)||!audit.reason||!audit.catalogEdition||!validSource(audit.source)||Number.isNaN(Date.parse(audit.retrievedAt)))throw Error('Invalid prerequisite coverage');
      if(audit.status==='verified'&&(!audit.sourceText?.trim()||course.prerequisite.evidence.verification!=='verified'||course.prerequisite.kind==='review'))throw Error('Verified prerequisite requires explicit evidence');
    }
  }
  for(const section of snapshot.sections){if(!termIds.has(section.term)||!validSource(section.source))throw Error('Invalid section term/source');for(const meeting of section.meetings)if(!validDate(meeting.startDate)||!validDate(meeting.endDate)||meeting.startDate>meeting.endDate||!meeting.days.length||meeting.days.some(d=>!DAYS.includes(d))||!Number.isInteger(meeting.start)||!Number.isInteger(meeting.end)||meeting.start<0||meeting.start>=meeting.end||meeting.end>1440)throw Error('Invalid meeting interval');}
  const ids=new Set(snapshot.sections.map(s=>s.id));if(ids.size!==snapshot.sections.length)throw Error('Duplicate section identities');
  const courseIds=new Set(snapshot.courses.map(c=>c.id));
  for(const section of snapshot.sections){if(section.id!==`${section.term}:${section.crn}`||!courseIds.has(section.course_id))throw Error('Invalid section identity');for(const option of section.companionOptions)for(const id of option)if(!ids.has(id))throw Error('Dangling companion');}
  for(const bundle of snapshot.bundles)if(bundle.componentIds.some(id=>!ids.has(id))||bundle.id!==[...bundle.componentIds].sort().join('+'))throw Error('Invalid bundle');
  for(const c of snapshot.coverage){if(c.sourceCount!==c.importedCount+c.excludedCount||snapshot.sections.filter(s=>s.term===c.term).length!==c.importedCount)throw Error('Coverage mismatch');const old=previous?.coverage?.find(p=>p.term===c.term);if(old&&c.sourceCount<old.sourceCount*.8)throw Error('Unexpected source shrink; preserve last good snapshot and investigate');}
  return true;
}
export async function publishSnapshot(snapshot,destination) {
  let previous;try{previous=JSON.parse(await fs.readFile(destination,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  validateSnapshot(snapshot,previous);
  const temporary=destination+'.pending';await fs.writeFile(temporary,JSON.stringify(snapshot,null,2)+'\n');await fs.rename(temporary,destination);
}
async function request(route,body){const response=await fetch(`${SOURCE}api/?page=fose&route=${route}`,{method:'POST',headers:{'content-type':'application/json'},body:encodeURIComponent(JSON.stringify(body)),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Official source HTTP ${response.status}`);const value=await response.json();if(value.fatal)throw Error(value.fatal);return value;}
export async function refresh({offline=false,destination=path.join(ROOT,'src/data/snapshot.json')}={}) {
  const rawDir=path.join(ROOT,'scripts/raw');await fs.mkdir(rawDir,{recursive:true});const rawTerms=[];
  const home=offline?await fs.readFile(path.join(rawDir,'source-home.html'),'utf8'):await(await fetch(SOURCE)).text();
  for(const config of TERM_CONFIG){if(!home.includes(`"code":"${config.code}"`))throw Error(`${config.label} not published; no future inference allowed`);
    let search,details;
    if(offline){search=JSON.parse(gunzipSync(await fs.readFile(path.join(rawDir,`${config.code}-search.json.gz`))));details=JSON.parse(gunzipSync(await fs.readFile(path.join(rawDir,`${config.code}-details.json.gz`))));}
    else{search=await request('search',{other:{srcdb:config.code},criteria:[{field:'session',value:'U'}]});details={};let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<search.results.length){const row=search.results[next++];details[row.crn]=await request('details',{group:`code:${row.code}`,key:`crn:${row.crn}`,srcdb:config.code,matched:`crn:${row.crn}`});}}));}
    rawTerms.push({config,search,details});
  }
  const prereqs=JSON.parse(await fs.readFile(path.join(ROOT,'scripts/prerequisites.json'),'utf8'));
  const retrievedAt=offline?JSON.parse(await fs.readFile(path.join(rawDir,'provenance.json'),'utf8')).retrievedAt:new Date().toISOString();
  const snapshot=buildSnapshot(rawTerms,prereqs,retrievedAt);
  const subjectSelect=home.match(/<select id="crit-subject"[\s\S]*?<\/select>/)?.[0]||'';
  const names=new Map([...subjectSelect.matchAll(/<option value="([A-Z]+)">([^<]+)<\/option>/g)].map(m=>[m[1],plainText(m[2]).replace(new RegExp('^'+m[1]+' - '),'')]));
  for(const department of snapshot.departments)department.name=names.get(department.code)||department.name;
  for(const course of snapshot.courses)course.department=names.get(course.department)||course.department;
  let previous;try{previous=JSON.parse(await fs.readFile(destination,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  validateSnapshot(snapshot,previous);
  if(!offline){await fs.writeFile(path.join(rawDir,'source-home.html'),home);for(const {config,search,details} of rawTerms){await fs.writeFile(path.join(rawDir,`${config.code}-search.json.gz`),gzipSync(JSON.stringify(search)));await fs.writeFile(path.join(rawDir,`${config.code}-details.json.gz`),gzipSync(JSON.stringify(details)));}await fs.writeFile(path.join(rawDir,'provenance.json'),JSON.stringify({retrievedAt,source:SOURCE,filter:{session:'U'},schemaVersion:2},null,2));}
  await publishSnapshot(snapshot,destination);console.log(JSON.stringify(snapshot.coverage,null,2));return snapshot;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))refresh({offline:process.argv.includes('--offline')}).catch(error=>{console.error(`Refresh failed; existing snapshot preserved: ${error.message}`);process.exitCode=1;});
