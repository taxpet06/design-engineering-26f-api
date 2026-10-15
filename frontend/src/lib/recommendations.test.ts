import { interestPresets } from '../data/interests';
import { getMajorProgress } from './requirements';
import { describe, it, expect } from 'vitest';
import type { Catalog, Course, CourseBundle, CourseRule, Meeting, Preferences, Section } from '../types';
import { evaluateCourseRule, getSectionEligibility, recommendThirdCourses, sectionsConflict, validatePinnedSections } from './recommendations';
import { catalog as official } from '../data/catalog';
const evidence = { source: 'https://example.test/official-fixture', retrievedAt:'2026-10-15', verification:'verified' as const };
const none: CourseRule = { kind:'none', evidence };
const prefs: Preferences = {major:'Computer Science',interests:['technology-engineering'],completedCourseIds:[],term:'26F',timePreference:'none'};
const meeting = (start=600,end=650,days=['Mon'],startDate='2026-09-14',endDate='2026-11-25'): Meeting => ({start,end,days,startDate,endDate,kind:'class'});
function fixture() {
  const courses: Course[] = ['COSC 1','MATH 3','ANTH 1','COSC 10'].map(id=>({id,code:id,title:id,department:id.split(' ')[0],credits:1,level:'undergraduate',description:'Test fixture',source:evidence.source,prerequisite:none}));
  const sections: Section[] = courses.map((c,i)=>({id:`26F:${i+1}`,crn:String(i+1),course_id:c.id,term:'26F',section_number:'01',component:'Lecture',instructor:'Test',meetings:[meeting(500+i*70,550+i*70)],source:evidence.source,verification:'verified',reviewReasons:[],companionOptions:[],componentsVerified:true}));
  const bundles: CourseBundle[] = sections.map(s=>({id:s.id,course_id:s.course_id,term:s.term,section_number:s.section_number,componentIds:[s.id],meetings:s.meetings,source:s.source,verification:s.verification,reviewReasons:[]}));
  const catalog: Catalog = {version:2,source:evidence.source,exported_at:evidence.retrievedAt,courses,sections,bundles,terms:[],departments:[],coverage:[]};
  return {catalog,bundles};
}
describe('dated multi-meeting scheduling',()=>{
  it('allows back-to-back meetings and different effective dates',()=>{
    expect(sectionsConflict({meetings:[meeting(600,660)]},{meetings:[meeting(660,700)]})).toBe(false);
    expect(sectionsConflict({meetings:[meeting(600,660,['Mon'],'2026-09-14','2026-09-20')]},{meetings:[meeting(610,650,['Mon'],'2026-09-21','2026-10-10')]})).toBe(false);
  });
  it('requires an actual shared weekday within the date intersection',()=>{
    expect(sectionsConflict({meetings:[meeting(600,660,['Mon'],'2026-09-15','2026-09-16')]},{meetings:[meeting(610,650,['Mon'],'2026-09-15','2026-09-16')]})).toBe(false);
  });
  it('reserves X-hours and every required companion interval',()=>{
    expect(sectionsConflict({meetings:[meeting(500,550),{...meeting(700,750,['Thu']),kind:'x-hour'}]},{meetings:[meeting(740,790,['Thu'])]})).toBe(true);
    expect(sectionsConflict({meetings:[meeting(500,550),meeting(900,1000,['Fri'])]},{meetings:[meeting(950,1030,['Fri'])]})).toBe(true);
  });
});
describe('eligibility and source uncertainty',()=>{
  it('only completed courses satisfy prerequisites, and permits explicit concurrent corequisites',()=>{
    const rule: CourseRule={kind:'course',courseId:'MATH 3',evidence,concurrent:true};
    expect(evaluateCourseRule(rule,[],['MATH 3'],'ENGS 20').status).toBe('ineligible');
    expect(evaluateCourseRule(rule,[],['MATH 3'],'ENGS 20',true).status).toBe('eligible');
    expect(evaluateCourseRule(rule,[],[],'ENGS 20',true).status).toBe('ineligible');
  });
  it('honors alternatives and confirmed renumbering',()=>{
    expect(evaluateCourseRule({kind:'course',courseId:'COSC 11',evidence},['COSC 30'],[],'COSC 31').status).toBe('eligible');
    expect(evaluateCourseRule({kind:'any',rules:[{kind:'course',courseId:'COSC 1',evidence},{kind:'review',text:'permission',evidence}],evidence},[],[],'COSC 10').status).toBe('needsReview');
  });
  it('keeps missing times and unverifiable required components unresolved',()=>{
    const {catalog,bundles}=fixture();catalog.sections[0].meetings=[];
    expect(getSectionEligibility(catalog,prefs,bundles[0],[]).status).toBe('needsReview');
    catalog.sections[1].componentsVerified=false;
    expect(getSectionEligibility(catalog,prefs,bundles[1],[]).status).toBe('needsReview');
  });
  it('rejects an incomplete lecture/lab bundle and overlapping pins',()=>{
    const {catalog,bundles}=fixture();catalog.sections[0].companionOptions=[[catalog.sections[2].id]];
    expect(getSectionEligibility(catalog,prefs,bundles[0],[]).reasons.some(r=>r.code==='required-component')).toBe(true);
    catalog.sections[0].companionOptions=[];catalog.sections[1].meetings=bundles[1].meetings=bundles[0].meetings;
    expect(validatePinnedSections(catalog,prefs,bundles.slice(0,2)).status).toBe('ineligible');
    expect(recommendThirdCourses(catalog,prefs,bundles.slice(0,2))).toEqual([]);
  });
  it('requires explicit exploration of unknown academic rules, while retaining registration advisories',()=>{
    const {catalog,bundles}=fixture();catalog.courses[3].prerequisite={kind:'review',text:'Unknown',evidence:{...evidence,verification:'needsReview'}};
    expect(recommendThirdCourses(catalog,prefs,bundles.slice(0,2)).map(r=>r.course.id)).toEqual(['ANTH 1']);
    catalog.sections[0].verification='needsReview';
    const recs=recommendThirdCourses(catalog,prefs,bundles.slice(0,2),[],{includeUnconfirmedPrerequisites:true});
    expect(recs).toHaveLength(2);
    expect(recs.find(r=>r.course.id==='COSC 10')!.eligibility.status).toBe('needsReview');
    expect(recs.map(r=>r.course.id)).toEqual(['ANTH 1','COSC 10']);
  });
});
describe('weighted deterministic recommendations',()=>{
  it('lets a pending pin be completed by the third course and rejects unrelated third courses',()=>{
    const {catalog,bundles}=fixture();
    catalog.courses[0].corequisite={kind:'course',courseId:'ANTH 1',concurrent:true,concurrentOnly:true,evidence};
    expect(getSectionEligibility(catalog,prefs,bundles[0],[bundles[1]],true).status).toBe('needsReview');
    expect(getSectionEligibility(catalog,prefs,bundles[0],[bundles[1]]).status).toBe('ineligible');
    expect(recommendThirdCourses(catalog,prefs,bundles.slice(0,2)).map(r=>r.course.id)).toEqual(['ANTH 1']);
    expect(getSectionEligibility(catalog,prefs,bundles[0],[bundles[1],bundles[2]]).status).toBe('eligible');
  });
  it('does not award planned progress for identical duplicate saved bundles',()=>{
    const {catalog,bundles}=fixture();
    const progress=getMajorProgress(catalog,prefs,[bundles[0],bundles[0]]);
    expect(progress.groups.find(group=>group.id==='cs-programming')!.planned).toBe(0);
  });
  it('awards each category once and requires every meeting start to match time preference',()=>{
    const {catalog,bundles}=fixture();const pins=[bundles[1],bundles[2]];
    catalog.sections[0].meetings=bundles[0].meetings=[meeting(480,530),{...meeting(800,850,['Thu']),kind:'x-hour'}];
    const rec=recommendThirdCourses(catalog,{...prefs,timePreference:'morning'},pins).find(r=>r.course.id==='COSC 1')!;
    expect(rec.breakdown.interest).toBe(40);expect(rec.breakdown.major).toBe(25);expect(rec.breakdown.time).toBe(0);expect(rec.score).toBeLessThanOrEqual(100);
  });
  it('returns the best bundle per course with stable inspected alternatives',()=>{
    const {catalog,bundles}=fixture();const original=catalog.sections[3];const alt={...original,id:'26F:99',crn:'99',section_number:'02'};catalog.sections.push(alt);catalog.bundles.push({...bundles[3],id:alt.id,componentIds:[alt.id]});
    const recommendations=recommendThirdCourses(catalog,prefs,bundles.slice(0,2));const chosen=recommendations.find(r=>r.course.id==='COSC 10')!;
    expect(chosen.section.id).toBe('26F:4');expect(chosen.alternatives.map(b=>b.id)).toEqual(['26F:99']);
    const pins = bundles.slice(0,2); catalog.bundles.reverse(); expect(recommendThirdCourses(catalog,prefs,pins).find(r=>r.course.id==='COSC 10')!.section.id).toBe('26F:4');
  });
});
describe('real official snapshot',()=>{
  it('keeps CHEM 5 lab alternatives and HUM 1 required discussions with lecture',()=>{
    const chemistry=official.bundles.filter(b=>b.term==='26F'&&b.course_id==='CHEM 5');expect(chemistry).toHaveLength(3);expect(chemistry.every(b=>b.componentIds.length===2)).toBe(true);
    const humanities=official.bundles.filter(b=>b.term==='26F'&&b.course_id==='HUM 1');expect(humanities.length).toBeGreaterThan(1);expect(humanities.every(b=>b.componentIds.length===2)).toBe(true);
  });
  it('preserves real permission conditions and never promotes unknown prerequisites',()=>{
    const b=official.bundles.find(b=>b.id==='26F:91925')!;expect(getSectionEligibility(official,prefs,b,[]).status).toBe('needsReview');expect(b.reviewReasons.some(r=>r.includes('Instructor Permission'))).toBe(true);
  });
});


it('blocks simultaneous selection of explicitly cross-listed sections',()=>{
  const {catalog,bundles}=fixture();catalog.equivalences=[{from:'COSC 1',to:'MATH 3',kind:'cross-listing',scope:'26F:1|26F:2',evidence}];
  expect(getSectionEligibility(catalog,prefs,bundles[0],[bundles[1]]).reasons.some(r=>r.code==='duplicate')).toBe(true);
  catalog.equivalences[0].scope='26S:1|26S:2';
  expect(getSectionEligibility(catalog,prefs,bundles[0],[bundles[1]]).status).toBe('eligible');
});

it('confirmed cross-listed credit satisfies prerequisites and blocks repeat credit',()=>{
  expect(evaluateCourseRule({kind:'course',courseId:'ENGS 32',evidence},['PHYS 48'],[],'ENGS 62').status).toBe('eligible');
  const {catalog,bundles}=fixture();catalog.courses[0]={...catalog.courses[0],id:'ENGS 32',code:'ENGS 32'};catalog.sections[0].course_id=bundles[0].course_id='ENGS 32';
  expect(getSectionEligibility(catalog,{...prefs,completedCourseIds:['PHYS 48']},bundles[0],[]).status).toBe('ineligible');
});

it('awards requirement points only for progress beyond completed courses and existing selections',()=>{
  const {catalog,bundles}=fixture();const pins=[bundles[1],bundles[2]];
  expect(recommendThirdCourses(catalog,prefs,pins).find(r=>r.course.id==='COSC 1')!.breakdown.requirement).toBe(25);
  expect(recommendThirdCourses(catalog,{...prefs,completedCourseIds:['ENGS 20']},pins).find(r=>r.course.id==='COSC 1')!.breakdown.requirement).toBe(0);
  catalog.courses[2]={...catalog.courses[2],id:'ENGS 20',code:'ENGS 20'};catalog.sections[2].course_id=bundles[2].course_id='ENGS 20';
  expect(recommendThirdCourses(catalog,prefs,pins).find(r=>r.course.id==='COSC 1')!.breakdown.requirement).toBe(0);
});

it('rejects impossible calendar dates and gives each selected component distinct review context',()=>{
  const {catalog,bundles}=fixture();catalog.sections[0].meetings=bundles[0].meetings=[meeting(600,650,['Mon'],'2026-02-31','2026-03-20')];
  expect(getSectionEligibility(catalog,prefs,bundles[0],[]).reasons.some(r=>r.code==='unknown-time')).toBe(true);
  catalog.sections[0].verification=bundles[0].verification='needsReview';catalog.sections[0].reviewReasons=bundles[0].reviewReasons=['Instructor permission required'];
  const reasons=getSectionEligibility(catalog,prefs,bundles[0],[]).reasons.filter(r=>r.message.includes('Instructor permission'));
  expect(reasons).toHaveLength(1);expect(reasons[0].message).toContain('COSC 1 · Lecture 1');
});

it('matches both original and new course numbers in either prerequisite direction',()=>{
  for(const [oldCode,newCode] of [['COSC 30','COSC 11'],['COSC 31','COSC 12'],['COSC 50','COSC 14'],['COSC 70','COSC 17']]) {
    for(const completed of [oldCode,newCode])for(const required of [oldCode,newCode])expect(evaluateCourseRule({kind:'course',courseId:required,evidence},[completed],[],'COSC 90').status).toBe('eligible');
  }
});
it('scores preset subjects regardless of official department display names',()=>{
  const {catalog,bundles}=fixture();
  // Only this test removes admission uncertainty; production source remains untouched.
  catalog.courses[0]={...official.courses.find(c=>c.id==='COSC 1')!,prerequisite:none};
  expect(catalog.courses[0].department).toBe('Computer Science');
  const recommendations=recommendThirdCourses(catalog,{...prefs,interests:['technology-engineering']},[bundles[1],bundles[2]]);
  expect(recommendations.find(r=>r.course.id==='COSC 1')!.breakdown.interest).toBe(40);
});
it('groups confirmed credit aliases and excludes aliases of a replaced course',()=>{
  const {catalog,bundles}=fixture();catalog.courses[0]={...catalog.courses[0],id:'COSC 30',code:'COSC 30'};catalog.sections[0].course_id=bundles[0].course_id='COSC 30';
  catalog.courses[3]={...catalog.courses[3],id:'COSC 11',code:'COSC 11'};catalog.sections[3].course_id=bundles[3].course_id='COSC 11';
  const pins=[bundles[1],bundles[2]],recs=recommendThirdCourses(catalog,prefs,pins);
  expect(recs).toHaveLength(1);expect(recs[0].alternatives).toHaveLength(1);
  expect(recommendThirdCourses(catalog,prefs,pins,['COSC 11'])).toHaveLength(0);
});
it('restores the reported Fall 2026 WRIT 2 / COSC 1 flow with potential CS progress',()=>{
  const pins=['WRIT 2','COSC 1'].map(id=>official.bundles.find(b=>b.term==='26F'&&b.course_id===id&&b.section_number==='01')!);
  expect(pins.every(Boolean)).toBe(true);
  expect(validatePinnedSections(official,prefs,pins).status).toBe('needsReview');
  const recs=recommendThirdCourses(official,{...prefs,interests:[]},pins);
  expect(recs.length).toBeGreaterThan(12);
  expect(recs.some(r=>r.eligibility.status==='needsReview')).toBe(true);
  expect(recs.every(r=>getSectionEligibility(official,prefs,r.section,pins).status!=='ineligible')).toBe(true);
  expect(getMajorProgress(official,prefs,pins).groups.find(g=>g.id==='cs-programming')).toMatchObject({completed:0,planned:1});
  expect(getSectionEligibility(official,prefs,pins[1],[pins[0]]).status).toBe('needsReview');
});
it.each(interestPresets)('scores every subject in $label once, including overlapping selections',(preset)=>{
  const {catalog,bundles}=fixture();
  for (const i of [1,2]) {
    const id='TEST'+i+' 1';catalog.courses[i]={...catalog.courses[i],id,code:id};bundles[i].course_id=catalog.sections[i].course_id=id;
  }
  for (const subject of preset.subjects) {
    catalog.courses[0]={...catalog.courses[0],id:subject+' 1',code:subject+' 1'};
    bundles[0].course_id=catalog.sections[0].course_id=subject+' 1';
    const pins=bundles.slice(1,3);
    const rec=recommendThirdCourses(catalog,{...prefs,interests:interestPresets.map(p=>p.id)},pins).find(r=>r.section.id===bundles[0].id)!;
    expect(rec.breakdown.interest).toBe(40);
    expect(recommendThirdCourses(catalog,{...prefs,interests:[]},pins).find(r=>r.section.id===bundles[0].id)!.breakdown.interest).toBe(0);
  }
});
it('keeps known invalid choices blocked even alongside advisory evidence',()=>{
  const {catalog,bundles}=fixture();
  catalog.courses[0].prerequisite={kind:'all',evidence,rules:[{kind:'review',text:'Permission',evidence},{kind:'course',courseId:'COSC 10',evidence}]};
  expect(getSectionEligibility(catalog,prefs,bundles[0],[])).toMatchObject({status:'ineligible'});
  expect(recommendThirdCourses(catalog,prefs,bundles.slice(1,3)).some(r=>r.course.id==='COSC 1')).toBe(false);
  expect(getSectionEligibility(catalog,{...prefs,term:'26S'},bundles[1],[]).status).toBe('ineligible');
  catalog.sections[1].companionOptions=[['missing']];
  expect(getSectionEligibility(catalog,prefs,bundles[1],[]).status).toBe('ineligible');
  const lab={...catalog.sections[2],id:'lab',component:'Lab',meetings:bundles[2].meetings};
  catalog.sections.push(lab);bundles[2].componentIds.push(lab.id);
  expect(getSectionEligibility(catalog,prefs,bundles[2],[]).status).toBe('ineligible');
});
