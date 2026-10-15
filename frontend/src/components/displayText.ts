import { validMeeting } from '../lib/eligibility';
import type { CourseBundle, CourseRule, EligibilityReason, Meeting } from '../types';
export function displayText(value: string) { return value.replace(/\\u0026/g, '&'); }
export function clockTime(minutes: number) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
export function meetingText(m: Meeting) { return `${m.days.join(', ')} ${clockTime(m.start)}–${clockTime(m.end)}${m.kind === 'x-hour' ? ' · X-hour' : ''}`; }
export function groupMeetings(meetings: Meeting[]): Meeting[] {
  const groups = new Map<string, Meeting>();
  for (const meeting of meetings) {
    const key = `${meeting.start}:${meeting.end}:${meeting.startDate}:${meeting.endDate}:${meeting.kind}:${meeting.room ?? ''}`;
    const existing = groups.get(key);
    if (existing) existing.days = [...new Set([...existing.days, ...meeting.days])];
    else groups.set(key, { ...meeting, days: [...meeting.days] });
  }
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return [...groups.values()].map(m => ({...m, days: m.days.sort((a,b) => days.indexOf(a)-days.indexOf(b))}));
}
export function bundleText(bundle: CourseBundle) { return bundle.meetings.length && bundle.meetings.every(validMeeting) ? groupMeetings(bundle.meetings).map(meetingText).join(' / ') : 'Times unconfirmed'; }
export function reasonText(reasons: EligibilityReason[]) {
  const reason = reasons.find(r => r.blocking);
  return reason ? reason.message.split(/(?<=\.)\s/)[0] : '';
}
export function ruleText(rule: CourseRule): string {
  if (rule.kind === 'none') return rule.evidence.verification === 'verified' ? 'No prerequisites, verified in the published source.' : 'Prerequisites unconfirmed.';
  if (rule.kind === 'review') return rule.text;
  if (rule.kind === 'waiver') return `${rule.text} (prerequisite waiver not confirmed)`;
  if (rule.kind === 'course') return `${rule.courseId}${rule.concurrentOnly ? ' (must be taken in the same term)' : rule.concurrent ? ' (concurrent enrollment permitted)' : ''}`;
  return `(${rule.rules.map(ruleText).join(rule.kind === 'all' ? ' and ' : ' or ')})`;
}
