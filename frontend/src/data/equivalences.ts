import type { Equivalence } from '../types';
import prerequisiteEquivalences from './prerequisite-equivalences.json';
export const equivalenceVersion = '2026-27.3';
const source = 'https://dartmouth.smartcatalogiq.com/en/current/orc/departments-programs-undergraduate/computer-science';
export const equivalences: Equivalence[] = [
  ...(prerequisiteEquivalences as Equivalence[]),
  ...[['ENGS 31', 'COSC 56'], ['ENGS 43', 'EAPS 66'], ['ENGS 50', 'COSC 50'], ['ENGS 66', 'COSC 30'], ['ENGS 67', 'COSC 63'], ['ENGS 69', 'COSC 65'], ['ENGS 69', 'COSC 165'], ['ENGS 91', 'COSC 71'], ['ENGS 92', 'PHYS 70']].map(([from, to]) => ({ from, to, kind: 'cross-listing' as const, evidence: { source: 'https://dartmouth.smartcatalogiq.com/en/current/orc/departments-programs-undergraduate/engineering-sciences/engs-engineering-sciences-undergraduate/engs-' + from.split(' ')[1], retrievedAt: '2026-10-15', verification: 'verified' as const, note: 'Explicit ORC Cross Listed Courses relationship; one credit identity, including applicable CS numbering transition.' } })),
  ...[['PHYS 48', 'ENGS 32', 'phys-48'], ['PHYS 30', 'ENGS 30', 'phys-30']].map(([from, to, slug]) => ({ from, to, kind: 'cross-listing' as const, evidence: { source: 'https://dartmouth.smartcatalogiq.com/en/current/orc/departments-programs-undergraduate/physics-and-astronomy/phys-physics-undergraduate/' + slug, retrievedAt: '2026-10-15', verification: 'verified' as const, note: 'The ORC explicitly lists the matching engineering course under Cross Listed Courses; one credit identity.' } })),
  ...[['COSC 30', 'COSC 11'], ['COSC 31', 'COSC 12'], ['COSC 50', 'COSC 14'], ['COSC 70', 'COSC 17']].map(([from, to]) => ({ from, to, kind: 'renumbering' as const, evidence: { source, retrievedAt: '2026-10-15', verification: 'verified' as const, note: 'Explicit 2026-27 ORC numbering transition.' } })),
  { from: 'ENGS 20', to: 'COSC 1', kind: 'substitution', scope: 'COSC prerequisite', evidence: { source, retrievedAt: '2026-10-15', verification: 'verified', note: 'Directional substitution; this does not establish equivalent credit or allow duplicate counting.' } },
];
export function canonicalCourseId(id: string): string {
  const normalized = id.trim().toUpperCase().replace(/\s+/g, ' ').replace(/^([A-Z]+) 0+(\d)/, '$1 $2');
  return equivalences.find(e => e.kind === 'renumbering' && e.evidence.verification === 'verified' && e.from === normalized)?.to ?? normalized;
}

/** Verified credit aliases; directional substitutions deliberately do not imply identical credit. */
export function equivalentCourseIds(id: string): string[] {
  const found = new Set([canonicalCourseId(id)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const mapping of equivalences) {
      if (mapping.kind === 'substitution' || mapping.evidence.verification !== 'verified') continue;
      const from = canonicalCourseId(mapping.from), to = canonicalCourseId(mapping.to);
      if (found.has(from) || found.has(to)) {
        for (const alias of [from, to]) if (!found.has(alias)) { found.add(alias); changed = true; }
      }
    }
  }
  return [...found].sort();
}
export function creditIdentity(id: string): string { return equivalentCourseIds(id)[0]; }
