import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statuses = ['verified', 'unresolved', 'unmatched', 'failed-source'];

export function mergePrerequisites(courses, shards) {
  const expected = new Set(courses.map(course => course.id));
  const entries = {};
  const counts = Object.fromEntries(statuses.map(status => [status, 0]));
  for (const shard of shards) for (const [id, entry] of Object.entries(shard)) {
    if (!expected.has(id)) throw Error(`Unexpected course in research shard: ${id}`);
    if (entries[id]) throw Error(`Overlapping research assignments: ${id}`);
    if (!entry.prerequisite || !statuses.includes(entry.coverage?.status)) throw Error(`Missing prerequisite coverage: ${id}`);
    if (entry.coverage.status === 'verified' && (!entry.coverage.sourceText?.trim() || entry.prerequisite.kind === 'review' || entry.prerequisite.evidence?.verification !== 'verified')) throw Error(`Unsupported verification: ${id}`);
    entries[id] = entry;
    counts[entry.coverage.status]++;
  }
  const missing = [...expected].filter(id => !entries[id]);
  if (missing.length) throw Error(`Research coverage missing for ${missing.length} courses: ${missing.slice(0, 10).join(', ')}`);
  return {
    entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))),
    report: { total: expected.size, counts, generatedAt: new Date().toISOString(), courses: Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, entry.coverage])) },
  };
}

async function main() {
  const directory = path.join(ROOT, 'scripts/prerequisite-research');
  const courses = JSON.parse(await fs.readFile(path.join(ROOT, 'src/data/snapshot.json'), 'utf8')).courses;
  const shards = await Promise.all(['cs-results.json', 'stem-results.json', 'humanities-results.json'].map(async file => JSON.parse(await fs.readFile(path.join(directory, file), 'utf8'))));
  const { entries, report } = mergePrerequisites(courses, shards);
  const aliases = JSON.parse(await fs.readFile(path.join(directory, 'stem-equivalences.json'), 'utf8'));
  const fromIds = new Set();
  for (const alias of aliases) {
    if (alias.kind !== 'renumbering' || alias.evidence?.verification !== 'verified' || !alias.evidence.sourceText || !/^https:\/\/eaps\.dartmouth\.edu\//.test(alias.evidence.source) || !/^EARS \d+(?:\.\d+)?$/.test(alias.from) || !/^EAPS \d+(?:\.\d+)?$/.test(alias.to) || fromIds.has(alias.from)) throw Error('Invalid or ambiguous course-number crosswalk');
    fromIds.add(alias.from);
  }
  const destination = path.join(ROOT, 'scripts/prerequisites.json');
  await fs.writeFile(destination + '.pending', JSON.stringify(entries, null, 2) + '\n');
  await fs.rename(destination + '.pending', destination);
  const aliasDestination = path.join(ROOT, 'src/data/prerequisite-equivalences.json');
  await fs.writeFile(aliasDestination + '.pending', JSON.stringify(aliases, null, 2) + '\n');
  await fs.rename(aliasDestination + '.pending', aliasDestination);
  await fs.writeFile(path.join(directory, 'coverage-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ total: report.total, counts: report.counts }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
