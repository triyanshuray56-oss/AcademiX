import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	AlertCircle,
	ArrowDownWideNarrow,
	BriefcaseBusiness,
	CheckCircle2,
	ChevronRight,
	Clipboard,
	ClipboardCheck,
	Clock3,
	Filter,
	LoaderCircle,
	RefreshCw,
	Search,
	Sparkles,
	UserRound,
	Users,
} from 'lucide-react';
import api, { getApiError } from '../../api/http';

type Applicant = {
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

type Posting = {
	id: number;
	company_name: string;
	role_title: string;
};

type ApplicantBrief = {
	strengths: string[];
	concerns: string[];
	job_alignment: string;
	interview_focus: string[];
	recommendation: string;
};

const pipelineStages = [
	{ label: 'Applied', matches: ['applied', 'submitted'], color: 'text-cyan-200', dot: 'bg-cyan-300' },
	{ label: 'Review', matches: ['review', 'screening', 'shortlisted'], color: 'text-indigo-200', dot: 'bg-indigo-300' },
	{ label: 'Interview', matches: ['interview'], color: 'text-violet-200', dot: 'bg-violet-300' },
	{ label: 'Offer', matches: ['offer'], color: 'text-amber-200', dot: 'bg-amber-300' },
	{ label: 'Hired', matches: ['hired', 'accepted'], color: 'text-emerald-200', dot: 'bg-emerald-300' },
	{ label: 'Closed', matches: ['rejected', 'withdrawn', 'closed'], color: 'text-rose-200', dot: 'bg-rose-300' },
];

const fieldClass = 'min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10';

function formatDate(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? 'Date unavailable'
		: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStage(status: string) {
	const normalized = status.toLowerCase();
	return pipelineStages.find((stage) => stage.matches.some((match) => normalized.includes(match)));
}

function FitScore({ score, compact = false }: { score: number; compact?: boolean }) {
	const tone = score >= 75 ? 'text-emerald-200' : score >= 45 ? 'text-amber-200' : 'text-slate-300';
	return (
		<div className={`flex items-center gap-2 ${compact ? '' : 'min-w-24'}`}>
			<div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-800 sm:w-16">
				<div className={`h-full rounded-full ${score >= 75 ? 'bg-emerald-300' : score >= 45 ? 'bg-amber-300' : 'bg-slate-500'}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
			</div>
			<span className={`text-xs font-semibold tabular-nums ${tone}`}>{Math.round(score)}%</span>
		</div>
	);
}

function fitLabel(score: number) {
	if (score >= 90) return 'Excellent Match';
	if (score >= 75) return 'Strong Match';
	if (score >= 60) return 'Potential Match';
	return 'Low Match';
}

export default function RecruiterApplicants() {
	const [applicants, setApplicants] = useState<Applicant[]>([]);
	const [postings, setPostings] = useState<Posting[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [search, setSearch] = useState('');
	const [jobId, setJobId] = useState('');
	const [status, setStatus] = useState('');
	const [branch, setBranch] = useState('');
	const [pipelineFilter, setPipelineFilter] = useState('');
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [brief, setBrief] = useState<ApplicantBrief | null>(null);
	const [briefLoading, setBriefLoading] = useState(false);
	const [briefError, setBriefError] = useState('');
	const briefRequestId = useRef(0);
	const [pitch, setPitch] = useState('');
	const [pitchLoading, setPitchLoading] = useState(false);
	const [pitchError, setPitchError] = useState('');
	const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
	const pitchRequestId = useRef(0);

	const load = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const params = jobId ? { job_id: Number(jobId) } : undefined;
			const [applicantResponse, postingResponse] = await Promise.all([
				api.get('/v1/recruiter-portal/jobs/applicants', { params }),
				api.get('/v1/recruiter-portal/jobs'),
			]);
			if (!Array.isArray(applicantResponse.data) || !Array.isArray(postingResponse.data)) {
				throw new Error('The recruiter applicants response was not in the expected format.');
			}
			setApplicants(applicantResponse.data);
			setPostings(postingResponse.data);
		} catch (requestError) {
			setError(requestError instanceof Error && !('response' in requestError)
				? requestError.message
				: getApiError(requestError));
		} finally {
			setLoading(false);
		}
	}, [jobId]);

	useEffect(() => {
		load();
	}, [load]);

	const branches = useMemo(
		() => [...new Set(applicants.map((applicant) => applicant.student_branch).filter(Boolean))].sort(),
		[applicants],
	);
	const statuses = useMemo(
		() => [...new Set(applicants.map((applicant) => applicant.status).filter(Boolean))].sort(),
		[applicants],
	);
	const filteredApplicants = useMemo(() => {
		const term = search.trim().toLowerCase();
		return applicants
			.filter((applicant) => {
				const matchesSearch = !term
					|| `${applicant.student_name} ${applicant.job_title}`.toLowerCase().includes(term)
					|| postings.some((posting) => posting.role_title === applicant.job_title
						&& posting.company_name.toLowerCase().includes(term));
				return matchesSearch
					&& (!pipelineFilter || pipelineStages.find((stage) => stage.label === pipelineFilter)?.matches.some((match) => applicant.status.toLowerCase().includes(match)))
					&& (!status || applicant.status === status)
					&& (!branch || applicant.student_branch === branch);
			})
			.sort((first, second) => second.fit_score - first.fit_score
				|| new Date(second.created_at).getTime() - new Date(first.created_at).getTime());
	}, [applicants, branch, pipelineFilter, postings, search, status]);
	const selectedApplicant = filteredApplicants.find((applicant) => applicant.application_id === selectedId)
		|| filteredApplicants[0]
		|| null;
	const loadBrief = useCallback(async (applicationId: number) => {
		const requestId = ++briefRequestId.current;
		setBriefLoading(true);
		setBriefError('');
		setBrief(null);
		try {
			const { data } = await api.get(`/v1/recruiter-portal/jobs/applicants/${applicationId}/ai-brief`);
			if (requestId === briefRequestId.current) setBrief(data);
		} catch (requestError) {
			if (requestId === briefRequestId.current) setBriefError(getApiError(requestError));
		} finally {
			if (requestId === briefRequestId.current) setBriefLoading(false);
		}
	}, []);
	useEffect(() => {
		briefRequestId.current += 1;
		pitchRequestId.current += 1;
		setPitch('');
		setPitchLoading(false);
		setPitchError('');
		setCopyState('idle');
		if (selectedApplicant) loadBrief(selectedApplicant.application_id);
		else {
			setBriefLoading(false);
			setBrief(null);
			setBriefError('');
		}
	}, [selectedApplicant?.application_id, loadBrief]);

	const generatePitch = async () => {
		if (!selectedApplicant) return;
		const requestId = ++pitchRequestId.current;
		setPitchLoading(true);
		setPitchError('');
		setCopyState('idle');
		try {
			const { data } = await api.post(
				`/v1/recruiter-portal/jobs/applicants/${selectedApplicant.application_id}/candidate-pitch`,
			);
			if (requestId === pitchRequestId.current) setPitch(data.pitch);
		} catch (requestError) {
			if (requestId === pitchRequestId.current) setPitchError(getApiError(requestError));
		} finally {
			if (requestId === pitchRequestId.current) setPitchLoading(false);
		}
	};

	const copyPitch = async () => {
		try {
			await navigator.clipboard.writeText(pitch);
			setCopyState('copied');
		} catch {
			setCopyState('error');
		}
	};
	const averageFit = applicants.length
		? Math.round(applicants.reduce((total, applicant) => total + applicant.fit_score, 0) / applicants.length)
		: 0;
	const topFitCount = applicants.filter((applicant) => applicant.fit_score >= 75).length;
	const activePipelineStage = pipelineFilter || (status ? getStage(status)?.label : '');

	const selectStage = (stageLabel: string) => {
		if (stageLabel === 'All applicants') {
			setPipelineFilter('');
			setStatus('');
			return;
		}
		if (!pipelineStages.some((item) => item.label === stageLabel)) return;
		setStatus('');
		setPipelineFilter(stageLabel);
	};

	const clearFilters = () => {
		setSearch('');
		setJobId('');
		setStatus('');
		setBranch('');
		setPipelineFilter('');
	};

	return (
		<div className="w-full min-w-0">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
						<Users aria-hidden="true" className="h-4 w-4" /> Recruiter workspace
					</p>
					<h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Applicants</h1>
					<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Review your applicant pipeline and focus on candidates whose experience aligns with each role.</p>
				</div>
				<div className="inline-flex items-center gap-2 rounded-xl border border-indigo-300/15 bg-indigo-300/[0.05] px-4 py-3 text-xs text-indigo-100">
					<Sparkles aria-hidden="true" className="h-4 w-4 text-cyan-200" />
					<span>Ranked by role fit</span>
					<ArrowDownWideNarrow aria-hidden="true" className="h-4 w-4 text-indigo-200" />
				</div>
			</header>

			<section aria-label="Applicant overview" className="mt-6 grid gap-3 sm:grid-cols-3">
				{[
					{ label: 'Applicants', value: applicants.length, note: 'Across your postings', icon: Users, color: 'text-cyan-200' },
					{ label: 'Average fit', value: `${averageFit}%`, note: 'Based on role requirements', icon: Sparkles, color: 'text-indigo-200' },
					{ label: 'Strong matches', value: topFitCount, note: 'Candidates scoring 75%+', icon: CheckCircle2, color: 'text-emerald-200' },
				].map(({ label, value, note, icon: Icon, color }) => (
					<article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5" key={label}>
						<div className="flex items-start justify-between gap-3">
							<div><p className="text-xs font-medium text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-white">{loading ? '—' : value}</p><p className="mt-1 text-[11px] text-slate-500">{note}</p></div>
							<span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950/80 ${color}`}><Icon aria-hidden="true" className="h-4 w-4" /></span>
						</div>
					</article>
				))}
			</section>

			<section aria-label="ATS applicant pipeline" className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
					<div><h2 className="text-sm font-semibold text-white">Hiring pipeline</h2><p className="mt-1 text-xs text-slate-500">Select a stage to narrow the applicant list.</p></div>
					<span className="text-[11px] text-slate-500">{filteredApplicants.length} shown</span>
				</div>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
					<button aria-pressed={!status && !pipelineFilter} className={`rounded-lg border px-3 py-3 text-left transition ${!status && !pipelineFilter ? 'border-cyan-300/30 bg-cyan-300/[0.07]' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'}`} onClick={() => selectStage('All applicants')} type="button">
						<span className="block text-[11px] text-slate-400">All applicants</span><span className="mt-1 block text-lg font-semibold text-white">{applicants.length}</span>
					</button>
					{pipelineStages.map((stage) => {
						const count = applicants.filter((applicant) => stage.matches.some((match) => applicant.status.toLowerCase().includes(match))).length;
						const active = activePipelineStage === stage.label;
						return <button aria-pressed={active} className={`rounded-lg border px-3 py-3 text-left transition ${active ? 'border-indigo-300/30 bg-indigo-300/[0.07]' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'}`} key={stage.label} onClick={() => selectStage(stage.label)} type="button">
							<span className="flex items-center gap-1.5 text-[11px] text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />{stage.label}</span><span className={`mt-1 block text-lg font-semibold ${stage.color}`}>{count}</span>
						</button>;
					})}
				</div>
			</section>

			<section aria-label="Search and filter applicants" className="mt-5 rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:p-4">
				<div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_repeat(3,minmax(9rem,13rem))]">
					<label className="relative min-w-0">
						<span className="sr-only">Search applicants, roles, or companies</span>
						<Search aria-hidden="true" className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
						<input className={`${fieldClass} pl-9`} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, role, or company" value={search} />
					</label>
					<label><span className="sr-only">Filter by job</span><select className={fieldClass} onChange={(event) => setJobId(event.target.value)} value={jobId}><option value="">All jobs</option>{postings.map((posting) => <option key={posting.id} value={posting.id}>{posting.role_title} · {posting.company_name}</option>)}</select></label>
					<label><span className="sr-only">Filter by status</span><select className={fieldClass} onChange={(event) => { setStatus(event.target.value); setPipelineFilter(''); }} value={status}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
					<label><span className="sr-only">Filter by branch</span><select className={fieldClass} onChange={(event) => setBranch(event.target.value)} value={branch}><option value="">All branches</option>{branches.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
				</div>
				<div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
					<p className="flex items-center gap-1.5"><Filter aria-hidden="true" className="h-3.5 w-3.5" /> Fit score first, newest application next</p>
					{(search || jobId || status || branch || pipelineFilter) && <button className="font-medium text-cyan-200 transition hover:text-white" onClick={clearFilters} type="button">Clear filters</button>}
				</div>
			</section>

			{error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.05] p-4 text-sm text-rose-200"><span className="flex items-center gap-2"><AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />{error}</span><button className="min-h-9 rounded-md px-3 font-medium underline underline-offset-2" onClick={load} type="button">Retry</button></div>}

			{loading ? (
				<div aria-label="Loading applicants" className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
					<div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">{[0, 1, 2, 3].map((item) => <div className="h-16 animate-pulse rounded-lg bg-slate-800/60" key={item} />)}</div>
					<div className="hidden h-72 animate-pulse rounded-xl border border-slate-800 bg-slate-900/50 xl:block" />
				</div>
			) : !error && applicants.length === 0 ? (
				<div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-14 text-center">
					<span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-300/10 text-indigo-200"><BriefcaseBusiness aria-hidden="true" className="h-5 w-5" /></span>
					<h2 className="mt-4 text-base font-semibold text-white">No applicants yet</h2>
					<p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">Applications for your recruiter postings will appear here when candidates apply.</p>
				</div>
			) : !error && filteredApplicants.length === 0 ? (
				<div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center">
					<Search aria-hidden="true" className="mx-auto h-6 w-6 text-slate-500" /><h2 className="mt-3 text-sm font-semibold text-white">No applicants match these filters</h2><p className="mt-1 text-xs text-slate-500">Try a different search or clear the active filters.</p><button className="mt-4 min-h-9 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800" onClick={clearFilters} type="button">Clear filters</button>
				</div>
			) : !error && (
				<div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
					<section aria-label="Applicant list" className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
						<div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-5">
							<div><h2 className="text-sm font-semibold text-white">Candidate shortlist</h2><p className="mt-0.5 text-[11px] text-slate-500">{filteredApplicants.length} candidate{filteredApplicants.length === 1 ? '' : 's'}</p></div>
							<span className="rounded-md bg-indigo-300/10 px-2 py-1 text-[10px] font-medium text-indigo-100">ATS</span>
						</div>
						<div className="hidden overflow-x-auto md:block">
							<table className="w-full min-w-[680px] text-left">
								<thead className="bg-slate-950/40 text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3 font-semibold">Candidate</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Role fit</th><th className="px-4 py-3 font-semibold">Applied</th><th className="px-3 py-3" /></tr></thead>
								<tbody className="divide-y divide-slate-800/80">
									{filteredApplicants.map((applicant) => {
										const selected = selectedApplicant?.application_id === applicant.application_id;
										return <tr aria-selected={selected} className={`cursor-pointer transition hover:bg-slate-800/50 ${selected ? 'bg-indigo-300/[0.06]' : ''}`} key={applicant.application_id} onClick={() => setSelectedId(applicant.application_id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedId(applicant.application_id); }} tabIndex={0}>
											<td className="px-5 py-3.5"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200">{applicant.student_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-medium text-white">{applicant.student_name}</span><span className="mt-0.5 block text-[11px] text-slate-500">{applicant.student_branch} · {applicant.student_cgpa.toFixed(2)} CGPA</span></span></div></td>
											<td className="max-w-48 truncate px-4 py-3.5 text-xs text-slate-300">{applicant.job_title}</td>
											<td className="px-4 py-3.5"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-medium ${getStage(applicant.status)?.color || 'text-slate-300'} border-current/20 bg-slate-950/40`}>{applicant.status}</span></td>
											<td className="px-4 py-3.5"><FitScore score={applicant.fit_score} /></td>
											<td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500">{formatDate(applicant.created_at)}</td>
											<td className="px-3 py-3.5"><ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-600" /></td>
										</tr>;
									})}
								</tbody>
							</table>
						</div>
						<div className="divide-y divide-slate-800/80 md:hidden">
							{filteredApplicants.map((applicant) => <button aria-pressed={selectedApplicant?.application_id === applicant.application_id} className={`w-full p-4 text-left transition ${selectedApplicant?.application_id === applicant.application_id ? 'bg-indigo-300/[0.06]' : 'hover:bg-slate-800/50'}`} key={applicant.application_id} onClick={() => setSelectedId(applicant.application_id)} type="button">
								<span className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{applicant.student_name}</span><span className="mt-1 block text-[11px] text-slate-500">{applicant.student_branch} · {applicant.student_cgpa.toFixed(2)} CGPA</span></span><FitScore compact score={applicant.fit_score} /></span>
								<span className="mt-3 flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs text-slate-300">{applicant.job_title}</span><span className="shrink-0 rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300">{applicant.status}</span></span>
								<span className="mt-2 block text-[10px] text-slate-600">Applied {formatDate(applicant.created_at)}</span>
							</button>)}
						</div>
					</section>

					{selectedApplicant && <aside aria-label="Candidate inspector" className="h-fit min-w-0 rounded-xl border border-slate-800 bg-slate-900/70 xl:sticky xl:top-20">
						<div className="border-b border-slate-800 p-5">
							<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Candidate inspector</p>
							<div className="mt-4 flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-indigo-300/15 bg-indigo-300/[0.08] text-sm font-semibold text-indigo-100">{selectedApplicant.student_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div className="min-w-0"><h2 className="truncate text-base font-semibold text-white">{selectedApplicant.student_name}</h2><p className="mt-1 text-xs text-slate-400">{selectedApplicant.student_branch}</p></div></div>
							<div className="mt-5 flex items-end justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3"><div><p className="text-[10px] uppercase tracking-wide text-slate-500">Role fit</p><p className="mt-1 text-2xl font-bold tabular-nums text-white">{Math.round(selectedApplicant.fit_score)}<span className="text-sm text-slate-500">%</span></p></div><FitScore compact score={selectedApplicant.fit_score} /></div>
						</div>
						<div className="space-y-5 p-4 sm:p-5">
							<div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Applied role</p><p className="mt-1.5 text-sm font-medium text-slate-100">{selectedApplicant.job_title}</p></div>
							<div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"><p className="text-[10px] text-slate-500">CGPA</p><p className="mt-1 text-sm font-semibold text-white">{selectedApplicant.student_cgpa.toFixed(2)}<span className="text-slate-500"> / 10</span></p></div><div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"><p className="text-[10px] text-slate-500">Application</p><p className="mt-1 truncate text-sm font-semibold text-white">{selectedApplicant.status}</p></div></div>
							<div className="flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500"><Clock3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> Applied {formatDate(selectedApplicant.created_at)}</div>

							<section aria-label="AI Candidate Intelligence" className="overflow-hidden rounded-xl border border-indigo-300/15 bg-gradient-to-br from-indigo-300/[0.07] via-slate-950/60 to-cyan-300/[0.04]">
								<header className="flex items-center gap-2 border-b border-slate-800/80 px-4 py-3">
									<span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-300/10 text-cyan-200"><Sparkles aria-hidden="true" className="h-3.5 w-3.5" /></span>
									<div><h3 className="text-xs font-semibold text-white">AI Candidate Intelligence</h3><p className="text-[10px] text-slate-500">Profile and role evidence</p></div>
								</header>
								<div className="space-y-4 p-4">
									<div className="rounded-lg border border-slate-800/80 bg-slate-950/55 p-3">
										<div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Overall fit</p><p className="mt-1 text-sm font-semibold text-white">{fitLabel(selectedApplicant.fit_score)}</p></div><span className="text-lg font-bold tabular-nums text-cyan-100">{Math.round(selectedApplicant.fit_score)}%</span></div>
										<div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full transition-[width] duration-700 ${selectedApplicant.fit_score >= 90 ? 'bg-emerald-300' : selectedApplicant.fit_score >= 75 ? 'bg-cyan-300' : selectedApplicant.fit_score >= 60 ? 'bg-amber-300' : 'bg-rose-300'}`} style={{ width: `${Math.max(0, Math.min(100, selectedApplicant.fit_score))}%` }} /></div>
									</div>

									{briefLoading ? <div aria-label="Loading candidate intelligence" className="space-y-2 py-2"><div className="h-3 w-2/3 animate-pulse rounded bg-slate-800" /><div className="h-3 w-full animate-pulse rounded bg-slate-800" /><div className="h-3 w-5/6 animate-pulse rounded bg-slate-800" /><p className="pt-1 text-[10px] text-slate-500">Preparing profile-based insights…</p></div>
										: briefError ? <div role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] p-3"><p className="text-[11px] leading-5 text-rose-200">Candidate intelligence is unavailable: {briefError}</p><button className="mt-2 text-[10px] font-semibold text-cyan-200 underline underline-offset-2" onClick={() => loadBrief(selectedApplicant.application_id)} type="button">Retry</button></div>
											: brief ? <div className="space-y-4">
												<IntelligenceList heading="Strengths" items={brief.strengths} tone="emerald" />
												<IntelligenceList heading="Concerns & skill gaps" items={brief.concerns} tone="amber" />
												<div><h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Job alignment</h4><p className="mt-1.5 text-[11px] leading-5 text-slate-300">{brief.job_alignment || 'There is insufficient profile or job data to explain role alignment.'}</p></div>
												<IntelligenceList heading="Interview focus" items={brief.interview_focus} tone="indigo" />
												<div className="rounded-lg border border-indigo-300/15 bg-indigo-300/[0.05] p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-200">AI recommendation</p><p className="mt-1.5 text-sm font-semibold text-white">{brief.recommendation}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">A review aid only; the recruiter makes the final decision.</p></div>
											</div>
												: <p className="text-[11px] leading-5 text-slate-400">No candidate intelligence is available for this application.</p>}
								</div>
							</section>

							<section aria-label="Candidate pitch" className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
								<div className="flex items-center gap-2"><BriefcaseBusiness aria-hidden="true" className="h-4 w-4 text-cyan-200" /><h3 className="text-xs font-semibold text-white">Candidate pitch</h3></div>
								<p className="mt-1.5 text-[10px] leading-4 text-slate-500">Generate a factual, recruiter-ready summary from the recorded profile.</p>
								<button className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-3 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60" disabled={pitchLoading} onClick={generatePitch} type="button">
									{pitchLoading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : pitch ? <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> : <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />}
									{pitchLoading ? 'Generating pitch…' : pitch ? 'Regenerate' : 'Generate Candidate Pitch'}
								</button>
								{pitchError && <p role="alert" className="mt-2 text-[11px] leading-5 text-rose-200">Pitch unavailable: {pitchError}</p>}
								{pitch && <div className="mt-3 space-y-2"><pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3 font-sans text-[11px] leading-5 text-slate-300">{pitch}</pre><button className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-[11px] font-medium text-slate-200 transition hover:border-cyan-300/30 hover:bg-slate-800" onClick={copyPitch} type="button">{copyState === 'copied' ? <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" /> : <Clipboard aria-hidden="true" className="h-3.5 w-3.5" />}{copyState === 'copied' ? 'Copied' : 'Copy Pitch'}</button>{copyState === 'error' && <p role="alert" className="text-[10px] text-rose-200">Copy was unavailable in this browser. Select and copy the pitch text above.</p>}</div>}
							</section>

							<p className="rounded-lg border border-amber-300/10 bg-amber-300/[0.035] p-3 text-[10px] leading-4 text-slate-400">AI-generated hiring insights are recommendations only. Final hiring decisions remain with the recruiter.</p>
						</div>
					</aside>}
				</div>
			)}
		</div>
	);
}

function IntelligenceList({ heading, items, tone }: { heading: string; items: string[]; tone: 'emerald' | 'amber' | 'indigo' }) {
	const bulletTone = {
		emerald: 'bg-emerald-300',
		amber: 'bg-amber-300',
		indigo: 'bg-indigo-300',
	}[tone];
	return <div><h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{heading}</h4>{items.length ? <ul className="mt-1.5 space-y-1.5">{items.map((item, index) => <li className="flex gap-2 text-[11px] leading-5 text-slate-300" key={`${item}-${index}`}><span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${bulletTone}`} />{item}</li>)}</ul> : <p className="mt-1.5 text-[11px] text-slate-500">Insufficient profile data.</p>}</div>;
}
