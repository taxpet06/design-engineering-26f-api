import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const catalog = JSON.parse(readFileSync(new URL('../src/data/snapshot.json', import.meta.url), 'utf8')) as Catalog;
import { interestPresets } from '../src/data/interests';
import type { Catalog, Preferences } from '../src/types';
const key='third-course:official:v3';
const review=resolve(process.cwd(),'../.impeccable/prerequisite-verification');
const fixtureURL='http://127.0.0.1:4174/e2e/fixtures/index.html';
const prefs:Preferences={major:'Computer Science',interests:['technology-engineering'],completedCourseIds:[],term:'26F',timePreference:'none'};
async function storedPlan(page:Page){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}').plan,key);}
async function profile(page:Page,url='/',interest='Technology & Engineering',completed:string[]=[]){
  await page.goto(url);
  await page.getByRole('combobox',{name:'Major',exact:true}).selectOption('Computer Science');
  await page.getByRole('checkbox',{name:interest,exact:true}).check();
  for(const id of completed){ const c=catalog.courses.find(c=>c.id===id)!; await page.getByRole('searchbox',{name:'Search completed courses'}).fill(c.code); await page.getByRole('checkbox',{name:new RegExp('^'+c.code+' ')}).first().check(); }
  await page.getByRole('button',{name:'Continue to planner'}).click();
}
async function pin(page:Page,slot:number,id:string,code:string){
  await page.getByRole('button',{name:`Choose course ${slot}`,exact:true}).first().click();
  await page.getByRole('searchbox',{name:'Search available courses'}).fill(code);
  await page.getByRole('button',{name:new RegExp(`^Select .* bundle ${id.replace(/[+]/g,'\\+')} for course ${slot}$`)}).click();
}
async function seed(page:Page,plan:(string|null)[],preferences=prefs,url='/'){
  await page.addInitScript(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key,state:{version:3,saved:true,preferences,plan}});
  await page.goto(url);
}
async function capture(page:Page,name:string,fullPage=true){await mkdir(review,{recursive:true});await page.screenshot({path:resolve(review,name+'.png'),fullPage});}
const subjectName='Technology & Engineering';
const realPrefs={...prefs,interests:['technology-engineering'],completedCourseIds:['MATH 3','MATH 8']};

test('default suggestions exclude unconfirmed advanced CS while explicit exploration remains available',async({page})=>{
  const pins=['WRIT 2','COSC 1'].map(id=>catalog.bundles.find(b=>b.term==='26F'&&b.course_id===id&&b.section_number==='01')!.id);
  await page.goto('/');
  await page.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key,state:{version:3,saved:true,preferences:{...prefs,interests:[]},plan:[...pins,null]}});
  await page.reload();
  const include=page.getByRole('checkbox',{name:'Include courses with unconfirmed prerequisites'});
  await expect(include).not.toBeChecked();
  while(await page.getByRole('button',{name:'Show more',exact:true}).count()) await page.getByRole('button',{name:'Show more',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Add COSC /})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Add ENGS 050 as third course'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Add ENGS 066 as third course'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Add ENGS 012 as third course'})).toBeVisible();
  await capture(page,'confirmed-default-suggestions');
  await include.check();
  for(let i=0;i<3;i++) await page.getByRole('button',{name:'Show more',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add COSC 69.17 as third course'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Add COSC 89.37 as third course'})).toHaveCount(0);
  await page.getByRole('button',{name:'Add COSC 69.17 as third course'}).click();
  const chosen=await storedPlan(page);
  await page.reload();
  await expect.poll(()=>storedPlan(page)).toEqual(chosen);
  await expect(page.getByLabel('Three-course term plan').locator('article').nth(2)).toContainText('Prerequisites unconfirmed');
});

test('identical saved bundles explain duplicate errors in slots and details',async({page})=>{
  const writ=catalog.bundles.find(b=>b.term==='26F'&&b.course_id==='WRIT 2'&&b.section_number==='01')!;
  await page.goto('/');
  await page.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key,state:{version:3,saved:true,preferences:prefs,plan:[writ.id,writ.id,'26F:91080']}});
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('already in your plan');
  const slots=page.getByLabel('Three-course term plan').locator('article');
  await expect(slots.nth(0)).toContainText('Change this selection to continue.');
  await expect(slots.nth(1)).toContainText('Change this selection to continue.');
  await slots.nth(0).getByRole('button',{name:/^WRIT 002 /}).click();
  await expect(page.getByRole('dialog')).toContainText('already in your plan');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Remove WRIT 002 from course 2'}).click();
  await page.reload();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('newly verified prerequisites preserve an invalid saved third course and explain the correction',async({page})=>{
  const pins=['WRIT 2','COSC 1'].map(code=>catalog.bundles.find(b=>b.term==='26F'&&b.course_id===code&&b.section_number==='01')!);
  const advanced=catalog.bundles.find(b=>b.term==='26F'&&b.course_id==='COSC 31')!;
  const plan=[pins[0].id,pins[1].id,advanced.id];
  await page.goto('/');
  await page.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key,state:{version:3,saved:true,preferences:{...prefs,interests:[]},plan}});
  await page.reload();
  await expect.poll(()=>storedPlan(page)).toEqual(plan);
  await expect(page.getByRole('alert')).toContainText('Your plan needs a change');
  const third=page.getByLabel('Three-course term plan').locator('article').nth(2);
  await expect(third).toContainText('Change this selection to continue.');
  await third.locator('button').nth(1).click();
  await expect(page.getByRole('dialog')).toContainText('prerequisite waiver not confirmed');
  await page.getByText('Published prerequisite text',{exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('COSC 10');
  await capture(page,'saved-course-requires-correction');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:/^Add .* as third course$/}).first().click();
  const corrected=await storedPlan(page);
  expect(corrected.slice(0,2)).toEqual(plan.slice(0,2));
  expect(corrected[2]).not.toBe(advanced.id);
  await page.reload();
  await expect.poll(()=>storedPlan(page)).toEqual(corrected);
  await expect(page.getByText('Your three-course plan is saved',{exact:true})).toBeVisible();
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).preferences.completedCourseIds,key)).toEqual([]);
});


for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
test(`real Fall 2026 plan: WRIT 2 and COSC 1, add, replace and reload at ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('group',{name:'Interests Optional'}).getByRole('checkbox')).toHaveCount(8);
  await page.getByRole('combobox',{name:'Major',exact:true}).selectOption('Computer Science');
  await page.getByRole('button',{name:'Continue to planner'}).click();
  const pins=['WRIT 2','COSC 1'].map(code=>catalog.bundles.find(b=>b.term==='26F'&&b.course_id===code&&b.section_number==='01')!);
  for(const [i,b] of pins.entries()) await pin(page,i+1,b.id,b.course_id);
  await expect(page.getByText('Some course details need confirmation. Check before registering.',{exact:true})).toBeVisible();
  const adds=page.getByRole('button',{name:/^Add .* as third course$/});
  await expect(adds).toHaveCount(6);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('1 potentially covered',{exact:false})).toBeVisible();
  await page.getByText('Requirement details',{exact:true}).click();
  const programming=page.getByRole('link',{name:'Programming: COSC 1 or ENGS 20'}).locator('..');
  await expect(programming).toContainText(/0 completed.*1 potential/);
  await page.getByText('Requirement details',{exact:true}).click();
  const oldScores=await page.locator('article').filter({has:adds}).allTextContents();
  await page.getByRole('combobox',{name:'Major',exact:true}).selectOption('Engineering Sciences');
  await expect.poll(()=>storedPlan(page)).toEqual([pins[0].id,pins[1].id,null]);
  await expect(page.getByRole('combobox',{name:'Major',exact:true})).toHaveValue('Engineering Sciences');
  await expect(page.getByText('0 potentially covered',{exact:false})).toBeVisible();
  expect(await page.locator('article').filter({has:adds}).allTextContents()).not.toEqual(oldScores);
  await page.getByRole('combobox',{name:'Major',exact:true}).selectOption('Computer Science');
  await page.getByRole('button',{name:'Show more',exact:true}).click();await expect(adds).toHaveCount(12);
  const suggestion=page.locator('article').filter({has:page.getByRole('button',{name:/^Add .* as third course$/})}).first();
  expect(await suggestion.locator('ul').first().locator('li').count()).toBeLessThanOrEqual(2);
  await expect(suggestion.getByRole('link',{name:'Check course details'})).toHaveAttribute('href',/^https:\/\/courses.dartmouth.edu\//);
  await capture(page,`real-suggestions-${viewport.width}`);
  const opener=page.getByLabel('Three-course term plan').locator('article').nth(1).locator('button').nth(1);
  await opener.click();await expect(page.getByRole('dialog')).toContainText('Instructor Permission');
  await expect(page.getByRole('dialog').getByRole('link',{name:'Check course details'}).first()).toHaveAttribute('href',/^https:\/\/courses.dartmouth.edu\//);
  await page.keyboard.press('Escape');await expect(opener).toBeFocused();
  await adds.first().click();
  await expect(page.getByText('Your three-course plan is saved',{exact:true})).toBeVisible();
  const saved=await storedPlan(page);expect(saved.every(Boolean)).toBe(true);
  await page.evaluate(()=>scrollTo(0,0));await capture(page,`real-saved-${viewport.width}`);await capture(page,`real-saved-viewport-${viewport.width}`,false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();await expect(page.getByText('Your three-course plan is saved',{exact:true})).toBeVisible();
  await expect.poll(()=>storedPlan(page)).toEqual(saved);
  await page.getByRole('button',{name:'Compare alternatives',exact:true}).click();
  await expect(adds).toHaveCount(6);await adds.first().click();
  const replaced=await storedPlan(page);expect(replaced.slice(0,2)).toEqual(saved.slice(0,2));expect(replaced[2]).not.toBe(saved[2]);
  await page.reload();await expect.poll(()=>storedPlan(page)).toEqual(replaced);
  await expect(page.getByText('Your three-course plan is saved',{exact:true})).toBeVisible();
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).preferences.interests,key)).toEqual([]);
  expect(errors).toEqual([]);
});
}

test('official v2 migration preserves the plan and completed credit with preset interests',async({page})=>{
  const plan:(string|null)[]=['WRIT 2','COSC 1'].map(code=>catalog.bundles.find(b=>b.term==='26F'&&b.course_id===code&&b.section_number==='01')!.id);
  plan.push(null);
  await page.goto('/');
  await page.evaluate(({plan,prefs})=>{localStorage.clear();localStorage.setItem('third-course:official:v2',JSON.stringify({version:2,saved:true,plan,preferences:{...prefs,interests:['Computer Science','Physics'],completedCourseIds:['COSC 11']}}));},{plan,prefs});
  await page.reload();await expect.poll(()=>storedPlan(page)).toEqual(plan);
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).preferences,key)).toMatchObject({interests:['technology-engineering','math-science'],completedCourseIds:['COSC 11']});
  expect(await page.evaluate(()=>localStorage.getItem('third-course:official:v2'))).toBeNull();
  await page.reload();await expect.poll(()=>storedPlan(page)).toEqual(plan);
});

test('official snapshot: migration retains recognized preferences and resets synthetic selections',async({page})=>{
  await page.addInitScript(({prefs})=>localStorage.setItem('third-course:v1',JSON.stringify({version:1,saved:true,preferences:{...prefs,completedCourseIds:[1,3,18]},plan:[1,3,18]})),{prefs:realPrefs});
  await page.goto('/');await expect(page.getByRole('status')).toContainText('sample completed courses and selections were reset');
  await expect.poll(()=>storedPlan(page)).toEqual([null,null,null]);
  expect(await page.evaluate(()=>localStorage.getItem('third-course:v1'))).toBeNull();
  await page.reload();await expect(page.getByText('Class of 2030',{exact:false}).first()).toBeVisible();
});

test('official snapshot: missing official pin stays visible and historical terms are explicit',async({page})=>{
  await seed(page,['26F:removed-official',null,null],realPrefs);
  await expect(page.getByRole('heading',{name:'Saved selection unavailable'})).toBeVisible();await expect(page.getByRole('alert')).toContainText('no longer in this snapshot');
  await capture(page,'constraint');
  await page.getByRole('button',{name:'Remove unavailable selection from course 1'}).click();
  await page.getByRole('combobox',{name:'Planning term'}).selectOption('26S');
  await expect(page.getByText('Historical reference only.',{exact:false})).toBeVisible();
  await expect.poll(()=>storedPlan(page)).toEqual([null,null,null]);
});

test('test fixture: full third-course workflow, replacement, progress, details, reload and time preferences',async({page})=>{
  await profile(page,fixtureURL);
  await pin(page,1,'26F:T1','MATH 3');await pin(page,2,'26F:T2','COSC 1');
  await expect(page.getByRole('button',{name:'Add MATH 8 as third course'})).toBeVisible();
  const progress=page.getByRole('heading',{name:'Major course progress'}).locator('..');
  await expect(progress).toContainText('1 potentially covered');
  await page.getByRole('button',{name:'View MATH 8 details'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'View MATH 8 details'})).toBeFocused();
  await page.getByText('Inspect 1 alternative bundle',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Choose this bundle'})).toBeVisible();
  await page.getByRole('button',{name:'Add MATH 8 as third course'}).click();await expect(page.getByText('Your three-course plan is saved',{exact:true})).toBeVisible();await expect(progress).toContainText('2 potentially covered');
  await capture(page,'fixture-success-labeled');
  await page.reload();await expect(page.getByText('Your three-course plan is saved',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Compare alternatives'}).click();await page.getByRole('button',{name:'Add ENGS 20 as third course'}).click();await expect.poll(()=>storedPlan(page)).toEqual(['26F:T1','26F:T2','26F:T5']);
  await page.getByRole('button',{name:'Edit preferences',exact:true}).click();await page.getByRole('combobox',{name:'Preferred class time'}).selectOption('afternoon');await page.getByRole('button',{name:'Save preferences'}).click();await expect.poll(()=>storedPlan(page)).toEqual(['26F:T1','26F:T2','26F:T5']);
});

test('test fixture: prerequisites, X-hour conflicts, invalid pins and completed updates are enforced',async({page})=>{
  await profile(page,fixtureURL);await pin(page,1,'26F:T1','MATH 3');
  await page.getByRole('button',{name:'Choose course 2',exact:true}).first().click();await page.getByRole('searchbox',{name:'Search available courses'}).fill('HIST 1');await expect(page.getByRole('button',{name:/Select HIST 1 bundle/})).toBeDisabled();await expect(page.getByText(/including reserved X-hours/).first()).toBeVisible();await page.getByRole('searchbox',{name:'Search available courses'}).fill('COSC 10');
  await expect(page.getByRole('button',{name:/Select COSC 10 bundle/})).toBeDisabled();await expect(page.getByText(/Complete COSC 1 before/).first()).toBeVisible();
  await page.getByRole('button',{name:'Close course browser'}).click();await page.getByRole('button',{name:'Edit preferences',exact:true}).click();await page.getByRole('searchbox',{name:'Search completed courses'}).fill('COSC 1');await page.getByRole('checkbox',{name:/COSC 1 Test COSC 1/}).check();await page.getByRole('button',{name:'Save preferences'}).click();
  await pin(page,2,'26F:T3','COSC 10');await expect(page.getByRole('button',{name:'Add MATH 8 as third course'})).toBeVisible();
  await page.getByRole('button',{name:'Edit preferences',exact:true}).click();await page.getByRole('button',{name:'Remove completed COSC 1'}).click();await page.getByRole('button',{name:'Save preferences'}).click();await expect(page.getByRole('alert')).toContainText('Complete COSC 1');await expect.poll(()=>storedPlan(page)).toEqual(['26F:T1','26F:T3',null]);
});





test('all eight optional presets save and reload as stable IDs',async({page})=>{
  await page.goto('/');
  const interests=page.getByRole('group',{name:'Interests Optional'});
  await expect(interests.getByRole('checkbox')).toHaveCount(8);
  await expect(page.getByRole('combobox',{name:'Major',exact:true}).locator('option')).toHaveCount(5);
  for(const preset of interestPresets) await interests.getByRole('checkbox',{name:preset.label,exact:true}).check();
  await page.getByRole('button',{name:'Continue to planner'}).click();await page.reload();
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).preferences.interests,key)).toEqual(interestPresets.map(p=>p.id));
  await page.getByRole('button',{name:'Edit preferences',exact:true}).click();
  for(const preset of interestPresets) await page.getByRole('checkbox',{name:preset.label,exact:true}).uncheck();
  await page.getByRole('button',{name:'Save preferences'}).click();await page.reload();
  await expect(page.getByRole('heading',{name:'Your third course starts here.'})).toBeVisible();
});

test('unconfirmed times stay advisory and an invalid third course can be replaced',async({page})=>{
  await profile(page,fixtureURL);await pin(page,1,'26F:T1','MATH 3');await pin(page,2,'26F:T2','COSC 1');
  await page.getByRole('button',{name:'Add ENGS 20 as third course'}).click();
  await expect(page.getByText('Your three-course plan is saved',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Three-course term plan').locator('article').nth(2)).toContainText('Times unconfirmed');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button',{name:'Edit preferences',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search completed courses'}).fill('ENGS 20');
  await page.getByRole('checkbox',{name:/ENGS 20 Test ENGS 20/}).check();await page.getByRole('button',{name:'Save preferences'}).click();
  await expect(page.getByRole('alert')).toContainText('already completed ENGS 20');
  await expect(page.getByRole('alert').getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button',{name:'Replace third',exact:true}).click();
  await page.getByRole('button',{name:'Add MATH 8 as third course'}).click();
  await expect(page.getByText('Your three-course plan is saved',{exact:true})).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
});

test('replacement details check against the two retained courses',async({page})=>{
  await profile(page,fixtureURL);await pin(page,1,'26F:T1','MATH 3');await pin(page,2,'26F:T2','COSC 1');
  await page.getByRole('button',{name:'Add MATH 8 as third course'}).click();
  await page.getByRole('button',{name:'Compare alternatives',exact:true}).click();
  await page.getByRole('button',{name:'View ECON 1 details'}).click();
  await expect(page.getByRole('dialog')).toContainText('Verified eligible');
  await expect(page.getByRole('dialog')).not.toContainText('overlaps');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Add ECON 1 as third course'}).click();
  await expect.poll(()=>storedPlan(page)).toEqual(['26F:T1','26F:T2','26F:T7']);
  await expect(page.getByText('Your three-course plan is saved',{exact:true})).toBeVisible();
});
