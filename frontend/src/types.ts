export type ID = string;
export type Verification = 'verified' | 'needsReview';
export interface Evidence { source: string; retrievedAt: string; verification: Verification; note?: string; catalogEdition?: string; sourceText?: string }
export interface Course { id: ID; code: string; title: string; department: string; credits: number; level: string; description: string; source: string; prerequisite: CourseRule; corequisite?: CourseRule; recommendedPreparation?: Preparation[]; prerequisiteCoverage?: PrerequisiteCoverage; prerequisiteIdentityEvidence?: Evidence }
export type CourseRule = { kind: 'none'; evidence: Evidence } | { kind: 'course'; courseId: ID; concurrent?: boolean; concurrentOnly?: boolean; evidence: Evidence } | { kind: 'all' | 'any'; rules: CourseRule[]; evidence: Evidence } | { kind: 'review'; text: string; evidence: Evidence } | { kind: 'waiver'; text: string; evidence: Evidence };
export interface Meeting { days: string[]; start: number; end: number; startDate: string; endDate: string; kind: 'class' | 'x-hour'; room?: string }
export interface Section { id: ID; crn: string; course_id: ID; term: string; section_number: string; component: string; instructor: string; meetings: Meeting[]; source: string; verification: Verification; reviewReasons: string[]; companionOptions: ID[][]; componentsVerified: boolean }
export interface CourseBundle { id: ID; course_id: ID; term: string; section_number: string; componentIds: ID[]; meetings: Meeting[]; source: string; verification: Verification; reviewReasons: string[] }
export interface Term { id: ID; code: string; label: string; start_date: string; end_date: string; is_current: boolean; historical: boolean }
export interface Department { id: ID; name: string; code: string }
export interface Coverage { term: string; sourceCount: number; importedCount: number; excludedCount: number; subjects: number; bundles: number }
export interface Catalog { version: 2; source: string; exported_at: string; courses: Course[]; sections: Section[]; bundles: CourseBundle[]; terms: Term[]; departments: Department[]; coverage: Coverage[]; equivalences?: Equivalence[] }
export interface Preferences { major: string; interests: string[]; completedCourseIds: ID[]; term: string; timePreference: 'none' | 'morning' | 'afternoon' }
export type Plan = [ID | null, ID | null, ID | null];
export interface EligibilityReason { blocking?: boolean; code: string; message: string; source?: string }
export interface Eligibility { status: 'eligible' | 'ineligible' | 'needsReview'; reasons: EligibilityReason[] }
export interface Recommendation { eligibility: Eligibility; prerequisitesConfirmed: boolean; course: Course; section: CourseBundle; alternatives: CourseBundle[]; score: number; reasons: string[]; breakdown: { interest: number; major: number; requirement: number; time: number } }
export interface RequirementGroup { id: string; label: string; category: 'entry' | 'core' | 'elective' | 'culminating'; count: number; options: string[][]; evidence: Evidence; reviewNotes?: string[]; sequence?: string; priorCompletedCourseIds?: string[]; exclusive?: boolean; courseRanges?: { subject: string; min: number; max: number; exclude?: number[] }[]; optionBuckets?: string[]; allocation?: { subjectCounts?: Record<string, number>; minDistinctBuckets?: number; atLeast?: { courseIds: string[]; count: number } } }
export interface MajorRules { name: string; catalogEdition: '2026-27'; cohort: '2030'; source: string; evidence: Evidence; relevantSubjects: string[]; groups: RequirementGroup[]; reviewNotes: string[] }
export interface Equivalence { from: string; to: string; kind: 'renumbering' | 'cross-listing' | 'substitution'; evidence: Evidence; scope?: string }
export interface RequirementProgress { id: string; label: string; category: RequirementGroup['category']; completed: number; planned: number; remaining: number; count: number; status: 'completed' | 'planned' | 'remaining' | 'needsReview'; courses: string[]; source: string; notes: string[] }
export interface Progress { groups: RequirementProgress[]; completed: number; planned: number; remaining: number; needsReview: string[]; source?: string }


export interface Preparation { text: string; evidence: Evidence }
export interface PrerequisiteCoverage { status: 'verified' | 'unresolved' | 'unmatched' | 'failed-source'; reason: string; source: string; catalogEdition: string; retrievedAt: string; sourceText?: string }
