import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertCircle,
	CalendarClock,
	CalendarDays,
	CheckCircle2,
	Clock3,
	ExternalLink,
	FileCheck2,
	Link as LinkIcon,
	LoaderCircle,
	MessageSquareText,
	Plus,
	RefreshCw,
	Search,
	UserRound,
	Users,
	X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../../api/http';

type ApplicantOption = {
	application_id: number;
	student_id: number;
	student_name: string;
	student_branch: string;
	student_cgpa: number;
	job_title: string;
	status: string;
	fit_score: number;
	created_at: string;
};

type Posting = { id: number; company_name: string; role_title: string };
type InterviewStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled' | 'No Show';
type AssessmentViolation = { event_type: string; timestamp: string; strike_count: number };
type CandidateAssessment = {
	assessment_id: string;
	trust_score: number;
	current_strikes: number;
	auto_submit_triggered: boolean;
	completed: boolean;
	violations: AssessmentViolation[];
};
type Interview = {
	id: number;
	application_id: number;
	student_id: number;
	candidate_name: string;
	candidate_branch: string;
	candidate_cgpa: number;
	job_title: string;
	company_name: string;
	interview_type: string;
	scheduled_at: string;
	duration_minutes: number;
	interviewer: string;
	meeting_link: string;
	notes: string;
	status: InterviewStatus;
	created_at: string;
	assessments: CandidateAssessment[];
};
type InterviewDraft = {
	application_id: string;
	interview_type: string;
	scheduled_at: string;
	duration_minutes: string;
	interviewer: string;
	meeting_link: string;
	notes: string;
};
type Tab = 'Upcoming' | 'Today' | 'Completed' | 'Cancelled';

const tabs: Tab[] = ['Upcoming', 'Today', 'Completed', 'Cancelled'];
const inputClass = 'mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10';

function parsedDate(value: string) {
	return new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
}

function localDay(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toDateTimeInput(value?: string) {
	if (!value) return '';
	const date = parsedDate(value);
	if (Number.isNaN(date.getTime())) return '';
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
	return local.toISOString().slice(0, 16);
}

function formatDate(value: string) {
	const date = parsedDate(value);
	return Number.isNaN(date.getTime())
		? 'Not available'
		: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(value: string) {
	const date = parsedDate(value);
	return Number.isNaN(date.getTime())
		? 'Not available'
		: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function statusClass(status: InterviewStatus) {
	const classes: Record<InterviewStatus, string> = {
		Scheduled: 'border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-100',
		'In Progress': 'border-indigo-300/20 bg-indigo-300/[0.07] text-indigo-100',
		Completed: 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100',
		Cancelled: 'border-rose-300/20 bg-rose-300/[0.07] text-rose-100',
		'No Show': 'border-amber-300/20 bg-amber-300/[0.07] text-amber-100',
	};
	return classes[status] || 'border-slate-700 bg-slate-800 text-slate-300';
}

function statusForTab(interview: Interview, tab: Tab) {
	const time = parsedDate(interview.scheduled_at);
	const today = localDay(new Date());
	if (tab === 'Today') return localDay(time) === today && ['Scheduled', 'In Progress'].includes(interview.status);
	if (tab === 'Upcoming') return interview.status === 'Scheduled' && localDay(time) > today;
	if (tab === 'Completed') return ['Completed', 'No Show'].includes(interview.status);
	return interview.status === 'Cancelled';
}

function emptyDraft(): InterviewDraft {
	return {
		application_id: '',
		interview_type: 'Technical',
		scheduled_at: '',
		duration_minutes: '60',
		interviewer: '',
		meeting_link: '',
		notes: '',
	};
}

export default function RecruiterInterviews() {
	const [interviews, setInterviews] = useState<Interview[]>([]);
	const [applicants, setApplicants] = useState<ApplicantOption[]>([]);
	const [postings, setPostings] = useState<Posting[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [tab, setTab] = useState<Tab>('Upcoming');
	const [search, setSearch] = useState('');
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<Interview | null>(null);
	const [draft, setDraft] = useState<InterviewDraft>(emptyDraft);
	const [formError, setFormError] = useState('');
	const [saving, setSaving] = useState(false);
	const [actionError, setActionError] = useState('');
	const [notice, setNotice] = useState('');
	const [notesDraft, setNotesDraft] = useState('');
	const [notesSaving, setNotesSaving] = useState(false);
	const [assessmentExpanded, setAssessmentExpanded] = useState(true);

	const load = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const [interviewResponse, applicantResponse, postingResponse] = await Promise.all([
				api.get('/v1/recruiter-portal/interviews'),
				api.get('/v1/recruiter-portal/jobs/applicants'),
				api.get('/v1/recruiter-portal/jobs'),
			]);
			if (!Array.isArray(interviewResponse.data)
				|| !Array.isArray(applicantResponse.data)
				|| !Array.isArray(postingResponse.data)) {
				throw new Error('The interview or candidate response was not in the expected format.');
			}
			setInterviews(interviewResponse.data);
			setApplicants(applicantResponse.data);
			setPostings(postingResponse.data);
		} catch (requestError) {
			setError(requestError instanceof Error && !('response' in requestError)
				? requestError.message
				: getApiError(requestError));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { load(); }, [load]);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		return interviews
			.filter((interview) => statusForTab(interview, tab))
			.filter((interview) => !term || `${interview.candidate_name} ${interview.job_title} ${interview.company_name} ${interview.interviewer}`.toLowerCase().includes(term));
	}, [interviews, search, tab]);
	const selected = interviews.find((interview) => interview.id === selectedId) || filtered[0] || null;
	const todayKey = localDay(new Date());
	const upcomingCount = interviews.filter((item) => item.status === 'Scheduled' && localDay(parsedDate(item.scheduled_at)) > todayKey).length;
	const todayCount = interviews.filter((item) => localDay(parsedDate(item.scheduled_at)) === todayKey && ['Scheduled', 'In Progress'].includes(item.status)).length;
	const completedCount = interviews.filter((item) => ['Completed', 'No Show'].includes(item.status)).length;
	const pendingAssessmentCount = new Set(
		interviews.flatMap((item) => item.assessments.filter((assessment) => !assessment.completed).map((assessment) => `${item.student_id}:${assessment.assessment_id}`)),
	).size;
	const candidates = useMemo(() => {
		const byId = new Map<number, ApplicantOption>();
		for (const applicant of applicants) {
			if (!byId.has(applicant.student_id)) byId.set(applicant.student_id, applicant);
		}
		return [...byId.values()].sort((first, second) => first.student_name.localeCompare(second.student_name));
	}, [applicants]);
	const selectedCandidate = applicants.find((applicant) => applicant.application_id === Number(draft.application_id));
	const candidateApplications = selectedCandidate
		? applicants.filter((applicant) => applicant.student_id === selectedCandidate.student_id)
		: [];

	useEffect(() => {
		setNotesDraft(selected?.notes || '');
		setActionError('');
	}, [selected?.id, selected?.notes]);

	const openCreate = () => {
		setEditing(null);
		setFormError('');
		setDraft(emptyDraft());
		setModalOpen(true);
	};

	const openReschedule = (interview: Interview) => {
		setEditing(interview);
		setFormError('');
		setDraft({
			application_id: String(interview.application_id),
			interview_type: interview.interview_type,
			scheduled_at: toDateTimeInput(interview.scheduled_at),
			duration_minutes: String(interview.duration_minutes),
			interviewer: interview.interviewer,
			meeting_link: interview.meeting_link,
			notes: interview.notes,
		});
		setModalOpen(true);
	};

	const updateDraft = (key: keyof InterviewDraft, value: string) => {
		setDraft((current) => ({
			...current,
			[key]: value,
		}));
	};

	const saveInterview = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setFormError('');
		const scheduledDate = new Date(draft.scheduled_at);
		const duration = Number(draft.duration_minutes);
		if (!editing && !draft.application_id) {
			setFormError('Select a candidate and job application.');
			return;
		}
		if (!draft.scheduled_at || Number.isNaN(scheduledDate.getTime())) {
			setFormError('Enter a valid interview date and time.');
			return;
		}
		if (!Number.isInteger(duration) || duration < 1 || duration > 720) {
			setFormError('Duration must be between 1 and 720 minutes.');
			return;
		}
		if (!draft.interviewer.trim()) {
			setFormError('Enter an interviewer name.');
			return;
		}
		setSaving(true);
		try {
			const payload = {
				...(!editing ? { application_id: Number(draft.application_id), interview_type: draft.interview_type } : {}),
				scheduled_at: scheduledDate.toISOString(),
				duration_minutes: duration,
				interviewer: draft.interviewer.trim(),
				meeting_link: draft.meeting_link.trim(),
				notes: draft.notes.trim(),
			};
			if (editing) {
				await api.patch(`/v1/recruiter-portal/interviews/${editing.id}`, payload);
			} else {
				await api.post('/v1/recruiter-portal/interviews', payload);
			}
			setModalOpen(false);
			setNotice(editing ? 'Interview schedule updated.' : 'Interview scheduled.');
			await load();
		} catch (requestError) {
			setFormError(getApiError(requestError));
		} finally {
			setSaving(false);
		}
	};

	const updateStatus = async (interview: Interview, status: InterviewStatus) => {
		setActionError('');
		try {
			await api.patch(`/v1/recruiter-portal/interviews/${interview.id}`, { status });
			setNotice(`Interview marked ${status.toLowerCase()}.`);
			await load();
		} catch (requestError) {
			setActionError(getApiError(requestError));
		}
	};

	const saveNotes = async () => {
		if (!selected) return;
		setNotesSaving(true);
		setActionError('');
		try {
			await api.patch(`/v1/recruiter-portal/interviews/${selected.id}`, { notes: notesDraft });
			setNotice('Interview notes saved.');
			await load();
		} catch (requestError) {
			setActionError(getApiError(requestError));
		} finally {
			setNotesSaving(false);
		}
	};

	return (
		<div className="w-full min-w-0">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><CalendarDays aria-hidden="true" className="h-4 w-4" /> Recruiter workspace</p>
					<h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Interviews</h1>
					<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Manage candidate interviews, assessments, and interview outcomes.</p>
				</div>
				<button className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:bg-indigo-400" onClick={openCreate} type="button"><Plus aria-hidden="true" className="h-4 w-4" /> Schedule Interview</button>
			</header>

			{error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.05] p-4 text-sm text-rose-200"><span className="flex items-center gap-2"><AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />{error}</span><button className="min-h-9 px-3 underline" onClick={load} type="button">Retry</button></div>}
			{notice && <p role="status" className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] px-4 py-3 text-xs text-emerald-100">{notice}</p>}

			<section aria-label="Interview summary" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: 'Upcoming Interviews', value: upcomingCount, note: 'Scheduled after today', icon: CalendarClock, tone: 'text-cyan-200' },
					{ label: "Today's Interviews", value: todayCount, note: 'Scheduled for today', icon: Clock3, tone: 'text-indigo-200' },
					{ label: 'Completed', value: completedCount, note: 'Completed or marked no-show', icon: CheckCircle2, tone: 'text-emerald-200' },
					{ label: 'Pending Assessment', value: pendingAssessmentCount, note: 'Open candidate proctoring sessions', icon: FileCheck2, tone: 'text-amber-200' },
				].map(({ label, value, note, icon: Icon, tone }) => <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5" key={label}>
					<div className="flex items-start justify-between"><div><p className="text-xs font-medium text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold text-white">{loading ? '—' : value}</p><p className="mt-1 text-[10px] text-slate-500">{note}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950/70 ${tone}`}><Icon aria-hidden="true" className="h-4 w-4" /></span></div>
				</article>)}
			</section>

			<div className="mt-6 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.78fr)]">
				<section aria-label="Interviews" className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4 sm:px-5">
						<div><h2 className="text-sm font-semibold text-white">Interview schedule</h2><p className="mt-1 text-[11px] text-slate-500">{filtered.length} {tab.toLowerCase()} interview{filtered.length === 1 ? '' : 's'}</p></div>
						<label className="relative w-full sm:max-w-56"><span className="sr-only">Search interviews</span><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><input className={`${inputClass} mt-0 pl-9`} onChange={(event) => setSearch(event.target.value)} placeholder="Search interviews" value={search} /></label>
					</div>
					<div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-3 pt-2 sm:px-4">{tabs.map((item) => <button aria-pressed={tab === item} className={`min-h-10 shrink-0 border-b-2 px-3 text-xs font-medium transition ${tab === item ? 'border-cyan-300 text-cyan-100' : 'border-transparent text-slate-500 hover:text-slate-200'}`} key={item} onClick={() => setTab(item)} type="button">{item}</button>)}</div>
					{loading ? <div aria-label="Loading interviews" className="space-y-3 p-4">{[0, 1, 2].map((item) => <div className="h-28 animate-pulse rounded-lg bg-slate-800/60" key={item} />)}</div>
						: error ? <div className="p-8 text-center text-xs text-slate-500">Interview records could not be loaded.</div>
							: filtered.length === 0 ? <div className="px-5 py-12 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-400"><CalendarDays aria-hidden="true" className="h-5 w-5" /></span><h3 className="mt-3 text-sm font-semibold text-slate-200">No {tab.toLowerCase()} interviews</h3><p className="mt-1 text-xs text-slate-500">{interviews.length ? 'Try another tab or schedule an interview for an applicant.' : 'Scheduled interviews will appear here when added.'}</p><button className="mt-4 min-h-9 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800" onClick={openCreate} type="button">Schedule Interview</button></div>
								: <div className="divide-y divide-slate-800/80">{filtered.map((interview) => <InterviewCard active={selected?.id === interview.id} interview={interview} key={interview.id} onSelect={() => setSelectedId(interview.id)} />)}</div>}
				</section>

				{selected ? <aside aria-label="Interview detail inspector" className="h-fit min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 xl:sticky xl:top-20">
					<header className="border-b border-slate-800 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300">Interview details</p><h2 className="mt-1.5 text-lg font-semibold text-white">{selected.candidate_name}</h2><p className="mt-1 text-xs text-slate-400">{selected.job_title} · {selected.company_name || 'Company not available'}</p></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusClass(selected.status)}`}>{selected.status}</span></div></header>
					<div className="space-y-5 p-4 sm:p-5">
						<DetailGroup title="Candidate"><DetailRow label="Name" value={selected.candidate_name} /><DetailRow label="Branch" value={selected.candidate_branch || 'Not available'} /><DetailRow label="CGPA" value={Number.isFinite(selected.candidate_cgpa) ? `${selected.candidate_cgpa.toFixed(2)} / 10` : 'Not available'} /></DetailGroup>
						<DetailGroup title="Interview"><DetailRow label="Role" value={selected.job_title} /><DetailRow label="Type" value={selected.interview_type} /><DetailRow label="Date" value={formatDate(selected.scheduled_at)} /><DetailRow label="Time" value={formatTime(selected.scheduled_at)} /><DetailRow label="Duration" value={`${selected.duration_minutes} minutes`} /><DetailRow label="Interviewer" value={selected.interviewer || 'Not available'} /><DetailRow label="Meeting link" value={selected.meeting_link || 'Not available'} link={selected.meeting_link} /></DetailGroup>

						{['Scheduled', 'In Progress'].includes(selected.status) && <div className="grid grid-cols-2 gap-2">
							{selected.meeting_link ? <a className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-cyan-500/15 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/25" href={selected.meeting_link} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /> Join Interview</a> : <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-800 px-3 text-[10px] text-slate-500"><LinkIcon aria-hidden="true" className="h-3.5 w-3.5" /> Link not available</span>}
							<button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800" onClick={() => openReschedule(selected)} type="button"><RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> Reschedule</button>
							<button className="min-h-9 rounded-lg border border-rose-300/20 px-3 text-xs font-medium text-rose-200 hover:bg-rose-300/[0.06]" onClick={() => updateStatus(selected, 'Cancelled')} type="button">Cancel Interview</button>
							<button className="min-h-9 rounded-lg border border-emerald-300/20 px-3 text-xs font-medium text-emerald-200 hover:bg-emerald-300/[0.06]" onClick={() => updateStatus(selected, 'Completed')} type="button">Mark Completed</button>
						</div>}
						{selected.status === 'Completed' && <div className="flex flex-wrap gap-2"><button className="min-h-9 rounded-lg border border-indigo-300/20 px-3 text-xs font-medium text-indigo-100 hover:bg-indigo-300/[0.06]" onClick={() => setAssessmentExpanded(true)} type="button">View Assessment</button><Link className="inline-flex min-h-9 items-center rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800" to="/recruiter/applicants">View Candidate</Link></div>}
						{actionError && <p role="alert" className="text-xs text-rose-200">{actionError}</p>}

						<section className="border-t border-slate-800 pt-4">
							<div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-xs font-semibold text-white"><MessageSquareText aria-hidden="true" className="h-3.5 w-3.5 text-cyan-200" /> Interview notes</h3><button className="text-[10px] font-medium text-cyan-200 hover:text-white" disabled={notesSaving || notesDraft === selected.notes} onClick={saveNotes} type="button">{notesSaving ? 'Saving…' : 'Save notes'}</button></div>
							<textarea className="mt-2 min-h-24 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs leading-5 text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/50" onChange={(event) => setNotesDraft(event.target.value)} placeholder="No notes recorded. Add interview observations…" value={notesDraft} />
						</section>

						<section className="border-t border-slate-800 pt-4">
							<div className="flex items-center justify-between gap-2"><div><h3 className="flex items-center gap-2 text-xs font-semibold text-white"><FileCheck2 aria-hidden="true" className="h-3.5 w-3.5 text-indigo-200" /> Assessment &amp; proctoring</h3><p className="mt-1 text-[10px] text-slate-500">Existing candidate sessions; not linked to this interview.</p></div><button aria-expanded={assessmentExpanded} aria-label="Toggle assessment details" className="rounded-md p-1 text-slate-500 hover:text-white" onClick={() => setAssessmentExpanded((open) => !open)} type="button">{assessmentExpanded ? <X aria-hidden="true" className="h-3.5 w-3.5" /> : <Plus aria-hidden="true" className="h-3.5 w-3.5" />}</button></div>
							{assessmentExpanded && (selected.assessments.length ? <div className="mt-3 space-y-3">{selected.assessments.map((assessment) => <article className="rounded-lg border border-slate-800 bg-slate-950/45 p-3" key={assessment.assessment_id}>
								<div className="flex items-start justify-between gap-3"><div><p className="break-all text-[11px] font-medium text-slate-200">{assessment.assessment_id}</p><p className="mt-1 text-[10px] text-slate-500">{assessment.completed ? 'Completed' : 'In progress / open'}</p></div><span className="rounded-md border border-indigo-300/15 bg-indigo-300/[0.05] px-2 py-1 text-[10px] text-indigo-100">Trust {assessment.trust_score}%</span></div>
								<div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><p className="text-slate-400">Integrity flags <span className="ml-1 font-semibold text-white">{assessment.current_strikes}</span></p><p className="text-slate-400">Auto-submit <span className="ml-1 font-semibold text-white">{assessment.auto_submit_triggered ? 'Triggered' : 'No'}</span></p></div>
								{assessment.violations.length > 0 && <div className="mt-3 border-t border-slate-800 pt-2"><p className="text-[10px] font-medium text-slate-400">Recorded events</p><ul className="mt-1 space-y-1">{assessment.violations.map((violation, index) => <li className="flex justify-between gap-2 text-[10px] text-slate-500" key={`${violation.timestamp}-${index}`}><span>{violation.event_type.replaceAll('_', ' ')}</span><span>{formatDate(violation.timestamp)}</span></li>)}</ul></div>}
							</article>)}</div> : <p className="mt-3 rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-[11px] text-slate-500">Assessment data not available</p>)}
						</section>

						<section className="border-t border-slate-800 pt-4"><h3 className="flex items-center gap-2 text-xs font-semibold text-white"><Users aria-hidden="true" className="h-3.5 w-3.5 text-cyan-200" /> Interview history</h3>
							{interviews.filter((item) => item.student_id === selected.student_id && item.id !== selected.id).length ? <ul className="mt-3 space-y-2">{interviews.filter((item) => item.student_id === selected.student_id && item.id !== selected.id).map((item) => <li className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5" key={item.id}><span className="min-w-0"><span className="block truncate text-[11px] text-slate-200">{item.job_title} · {item.interview_type}</span><span className="mt-1 block text-[10px] text-slate-500">{formatDate(item.scheduled_at)}</span></span><span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] ${statusClass(item.status)}`}>{item.status}</span></li>)}</ul> : <p className="mt-2 text-[11px] text-slate-500">No previous interview records.</p>}
						</section>
					</div>
				</aside> : <aside className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center"><div><UserRound aria-hidden="true" className="mx-auto h-6 w-6 text-slate-600" /><p className="mt-3 text-xs text-slate-500">Select an interview to view its details.</p></div></aside>}
			</div>

			{modalOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
				<section aria-labelledby="schedule-interview-title" aria-modal="true" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 shadow-2xl sm:rounded-2xl" role="dialog">
					<header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Recruiter workspace</p><h2 className="mt-1 text-lg font-semibold text-white" id="schedule-interview-title">{editing ? 'Reschedule interview' : 'Schedule interview'}</h2></div><button aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" disabled={saving} onClick={() => setModalOpen(false)} type="button"><X aria-hidden="true" className="h-4 w-4" /></button></header>
					<form className="space-y-4 p-5" onSubmit={saveInterview}>
						{!editing && <div className="grid gap-4 sm:grid-cols-2">
							<label className="text-xs font-medium text-slate-300">Candidate<select className={inputClass} onChange={(event) => { const next = applicants.find((item) => item.student_id === Number(event.target.value)); setDraft((current) => ({ ...current, application_id: next ? String(next.application_id) : '' })); }} required value={selectedCandidate?.student_id || ''}><option value="">Select candidate</option>{candidates.map((candidate) => <option key={candidate.student_id} value={candidate.student_id}>{candidate.student_name} · {candidate.student_branch}</option>)}</select></label>
							<label className="text-xs font-medium text-slate-300">Job / application<select className={inputClass} onChange={(event) => updateDraft('application_id', event.target.value)} required value={draft.application_id}><option value="">Select applied role</option>{candidateApplications.map((application) => <option key={application.application_id} value={application.application_id}>{application.job_title}{postings.find((posting) => posting.role_title === application.job_title) ? ` · ${postings.find((posting) => posting.role_title === application.job_title)?.company_name}` : ''}</option>)}</select></label>
						</div>}
						{editing && <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300"><span className="font-medium text-white">{editing.candidate_name}</span> · {editing.job_title} · {editing.company_name}</div>}
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="text-xs font-medium text-slate-300">Interview type<select className={inputClass} disabled={Boolean(editing)} onChange={(event) => updateDraft('interview_type', event.target.value)} value={draft.interview_type}>{['Technical', 'HR', 'Managerial', 'Technical + HR'].map((type) => <option key={type}>{type}</option>)}</select></label>
							<label className="text-xs font-medium text-slate-300">Date and start time<input className={inputClass} min={toDateTimeInput(new Date().toISOString())} onChange={(event) => updateDraft('scheduled_at', event.target.value)} required type="datetime-local" value={draft.scheduled_at} /></label>
							<label className="text-xs font-medium text-slate-300">Duration<select className={inputClass} onChange={(event) => updateDraft('duration_minutes', event.target.value)} value={draft.duration_minutes}>{[15, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
							<label className="text-xs font-medium text-slate-300">Interviewer<input className={inputClass} maxLength={160} onChange={(event) => updateDraft('interviewer', event.target.value)} placeholder="Interviewer name" required value={draft.interviewer} /></label>
						</div>
						<label className="block text-xs font-medium text-slate-300">Meeting link<input className={inputClass} maxLength={1000} onChange={(event) => updateDraft('meeting_link', event.target.value)} placeholder="https://…" type="url" value={draft.meeting_link} /></label>
						<label className="block text-xs font-medium text-slate-300">Notes<textarea className={`${inputClass} min-h-24 py-3`} maxLength={10000} onChange={(event) => updateDraft('notes', event.target.value)} placeholder="Preparation context or interview notes" value={draft.notes} /></label>
						{formError && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] p-3 text-xs text-rose-200">{formError}</p>}
						{!editing && applicants.length === 0 && <p className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs text-amber-100">No applicant records are available to schedule. Candidate choices are taken from real applications.</p>}
						<div className="flex flex-col-reverse gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end"><button className="min-h-10 rounded-lg border border-slate-700 px-4 text-xs font-medium text-slate-300 hover:bg-slate-800" disabled={saving} onClick={() => setModalOpen(false)} type="button">Cancel</button><button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-60" disabled={saving || (!editing && applicants.length === 0)} type="submit">{saving && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}{saving ? 'Saving…' : editing ? 'Save changes' : 'Schedule Interview'}</button></div>
					</form>
				</section>
			</div>}
		</div>
	);
}

function InterviewCard({ interview, active, onSelect }: { interview: Interview; active: boolean; onSelect: () => void }) {
	return <button aria-pressed={active} className={`w-full p-4 text-left transition sm:p-5 ${active ? 'bg-indigo-300/[0.06]' : 'hover:bg-slate-800/40'}`} onClick={onSelect} type="button">
		<div className="flex flex-wrap items-start justify-between gap-3">
			<div className="flex min-w-0 items-start gap-3"><span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-950/60"><span className="text-[9px] uppercase text-cyan-200">{formatDate(interview.scheduled_at).split(' ')[0]}</span><span className="text-sm font-bold text-white">{parsedDate(interview.scheduled_at).getDate()}</span></span><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-white">{interview.candidate_name}</h3><p className="mt-1 truncate text-xs text-slate-400">{interview.job_title} · {interview.company_name}</p></div></div>
			<span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusClass(interview.status)}`}>{interview.status}</span>
		</div>
		<div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-slate-400 sm:grid-cols-3">
			<span className="flex items-center gap-1.5"><Clock3 aria-hidden="true" className="h-3.5 w-3.5 text-cyan-200" />{formatTime(interview.scheduled_at)} · {interview.duration_minutes}m</span>
			<span className="flex items-center gap-1.5"><Users aria-hidden="true" className="h-3.5 w-3.5 text-indigo-200" />{interview.interview_type}</span>
			<span className="col-span-2 flex items-center gap-1.5 truncate sm:col-span-1"><UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-500" />{interview.interviewer || 'Interviewer not available'}</span>
		</div>
		{interview.assessments.length > 0 && <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-indigo-300/10 bg-indigo-300/[0.04] px-2 py-1 text-[10px] text-indigo-100"><FileCheck2 aria-hidden="true" className="h-3 w-3" />{interview.assessments[0].trust_score}% proctor trust · candidate assessment</p>}
	</button>;
}

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
	return <section><h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">{title}</h3><div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/35 p-3">{children}</div></section>;
}

function DetailRow({ label, value, link }: { label: string; value: string; link?: string }) {
	return <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 text-[11px]"><span className="text-slate-500">{label}</span>{link ? <a className="flex min-w-0 items-center gap-1 truncate text-cyan-200 underline-offset-2 hover:underline" href={link} rel="noreferrer" target="_blank">{value}<ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" /></a> : <span className="min-w-0 break-words text-slate-200">{value || 'Not available'}</span>}</div>;
}
