import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalog } from './data/catalog';
import { initialState, loadState, persistState, STORAGE_KEY, PREVIOUS_KEY, LEGACY_KEY } from './storage';
afterEach(() => vi.unstubAllGlobals());
function storageWith(entries: Record<string,string> = {}) {
  const store = new Map(Object.entries(entries));
  vi.stubGlobal('localStorage',{getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>store.set(key,value),removeItem:(key:string)=>store.delete(key)});
  return store;
}
function validState() {const state=initialState(catalog);state.saved=true;state.preferences.interests=['technology-engineering'];state.plan=[catalog.bundles[0].id,null,null];return state;}
describe('official storage boundary',()=>{
  it('round-trips official identities and clears both versions on reset',()=>{
    const store=storageWith();const state=validState();state.preferences.completedCourseIds=[catalog.courses[0].id];
    expect(persistState(state)).toBe(true);expect(loadState(catalog).state).toEqual(state);
    store.set(LEGACY_KEY,'legacy');expect(persistState(initialState(catalog))).toBe(true);expect(store.size).toBe(0);
  });
  it('preserves source-backed completion identities without any captured offering',()=>{
    const state=validState();state.preferences.completedCourseIds=['COSC 11','COSC 98','ENGS 262'];storageWith({[STORAGE_KEY]:JSON.stringify(state)});
    expect(loadState(catalog).state.preferences.completedCourseIds).toEqual(['COSC 11','COSC 98','ENGS 262']);
  });
  it('migrates valid preferences while resetting every synthetic ID even when a string looks real',()=>{
    storageWith({[LEGACY_KEY]:JSON.stringify({version:1,saved:true,preferences:{...validState().preferences,major:'Computer Science',completedCourseIds:[1,catalog.courses[0].id]},plan:[1,2,3]})});
    const {state,warning}=loadState(catalog);
    expect(state.version).toBe(3);expect(state.preferences.major).toBe('Computer Science');expect(state.preferences.interests).toEqual(validState().preferences.interests);
    expect(state.preferences.completedCourseIds).toEqual([]);expect(state.plan).toEqual([null,null,null]);expect(warning).toContain('sample completed courses and selections were reset');
  });
  it('never restores the legacy state after migration is saved',()=>{
    const store=storageWith({[LEGACY_KEY]:JSON.stringify({...validState(),version:1})});
    const loaded=loadState(catalog);expect(persistState(loaded.state)).toBe(true);expect(store.has(LEGACY_KEY)).toBe(false);expect(loadState(catalog).warning).toBe('');
  });
  it.each(['null','{broken','{"version":9}','{"version":2,"preferences":false}'])('recovers corrupt storage: %s',raw=>{storageWith({[STORAGE_KEY]:raw});expect(loadState(catalog).state).toEqual(initialState(catalog));expect(loadState(catalog).warning).toContain('could not be read');});
  it('validates fields, removes unknown IDs, and preserves unresolved valid pins',()=>{
    const state=validState();const raw={...state,preferences:{...state.preferences,major:'Mathematics',interests:[...state.preferences.interests,...state.preferences.interests,'unknown'],completedCourseIds:[catalog.courses[0].id,catalog.courses[0].id,1,'unknown'],timePreference:'sunset'},plan:[state.plan[0],'unknown',2]};
    storageWith({[STORAGE_KEY]:JSON.stringify(raw)});const loaded=loadState(catalog);
    expect(loaded.state.preferences.interests).toEqual(state.preferences.interests);expect(loaded.state.preferences.major).toBe('Undeclared');expect(loaded.state.preferences.timePreference).toBe('none');expect(loaded.state.preferences.completedCourseIds).toEqual([catalog.courses[0].id]);expect(loaded.state.plan).toEqual([state.plan[0],'unknown',null]);expect(loaded.warning).toContain('updated');
  });
  it('drops the plan for an unpublished term',()=>{const state=validState();state.preferences.term='30F';storageWith({[STORAGE_KEY]:JSON.stringify(state)});expect(loadState(catalog).state.plan).toEqual([null,null,null]);expect(loadState(catalog).state.preferences.term).toBe('26F');});
  it('retains cross-term and now-invalid pins for correction rather than silently certifying them',()=>{const state=validState();const other=catalog.bundles.find(b=>b.term!==state.preferences.term)!;state.plan=[other.id,null,null];storageWith({[STORAGE_KEY]:JSON.stringify(state)});expect(loadState(catalog).state.plan[0]).toBe(other.id);});
  it('handles unavailable browser storage without losing session planning',()=>{const fail=()=>{throw new Error('Blocked');};vi.stubGlobal('localStorage',{getItem:fail,setItem:fail,removeItem:fail});expect(loadState(catalog).state).toEqual(initialState(catalog));expect(loadState(catalog).warning).toContain('storage is unavailable');expect(persistState(validState())).toBe(false);});
});



it('migrates department interests without losing official selections or completed credit',()=>{
  const state=validState(); state.preferences.interests=['Computer Science','Physics','COSC','unknown']; state.preferences.completedCourseIds=['COSC 11'];
  state.plan=[catalog.bundles[0].id,catalog.bundles[1].id,catalog.bundles[2].id];
  const store=storageWith({[PREVIOUS_KEY]:JSON.stringify({...state,version:2})});
  const loaded=loadState(catalog).state;
  expect(loaded.plan).toEqual(state.plan);expect(loaded.preferences.completedCourseIds).toEqual(['COSC 11']);
  expect(loaded.preferences.interests).toEqual(['technology-engineering','math-science']);
  expect(loaded.saved).toBe(true);expect(persistState(loaded)).toBe(true);expect(store.has(PREVIOUS_KEY)).toBe(false);
  expect(loadState(catalog).state).toEqual(loaded);
});
it('saves and reloads an official plan with no optional interests',()=>{
  const state=validState();state.preferences.interests=[];storageWith();persistState(state);
  expect(loadState(catalog).state).toEqual(state);
});
