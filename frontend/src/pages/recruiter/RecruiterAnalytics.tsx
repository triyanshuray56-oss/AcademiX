import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	Activity,
	AlertCircle,
	BriefcaseBusiness,
	CalendarDays,
	CheckCircle2,
	Download,
	FileBarChart2,
	Percent,
	RefreshCw,
	Sparkles,
	Target,
	Users,
} from 'lucide-react';
import api, { getApiError } from '../../api/http';

type FunnelStage = { name: string; count: number; conversion_rate: number | null };
type JobPerformance = {
	job_id: number;
	role: string;
	company: string;
	category: string;
	applications: number;
	shortlisted: number;
	interviews: number;
	offers: number;
	accepted: number;
	placements: number;
	shortlist_rate: number;
	offer_rate: number;
	placement_rate: number;
	conversion_rate: number;
};
type SkillInsight = { skill: string; job_count: number; candidate_count: number; gap_count: number; coverage_rate: number };
type Analytics = {
	total_jobs: number;
	total_applications: number;
	shortlisted: number;
	interviews: number;
	offers: number;
	accepted: number;
	placements: number;
	average_fit_score: number | null;
	offer_acceptance_rate: number | null;
	placement_rate: number | null;
	funnel: FunnelStage[];
	job_performance: JobPerformance[];
	candidate_quality: {
		average_fit_score: number | null;
		highest_fit_score: number | null;
		strong_matches: number;
		manual_review: number;
		excellent_matches: number;
		potential_matches: number;
		low_matches: number;
	};
	most_requested_skills: SkillInsight[];
	strongest_coverage_skills: SkillInsight[];
	difficult_to_source_skills: SkillInsight[];
	recruitment_speed: {
		application_to_interview_days: number | null;
		interview_to_offer_days: number | null;
		offer_to_placement_days: number | null;
	};
	insights: string[];
	applied_from: string | null;
	applied_to: string | null;
};
type Posting = { id: number; company_name: string; role_title: string; job_category: 'job' | 'internship' };
type SortBy = 'applications' | 'shortlist_rate' | 'offer_rate' | 'placement_rate';

const inputClass = 'min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10';
function percent(value: number | null) {
	return value === null ? 'Not available' : `${value.toFixed(1)}%`;
}

function formatDays(value: number | null) {
	return value === null ? 'Insufficient timestamp data' : `${value.toFixed(1)} days`;
}

function escapeCsv(value: string | number) {
	return `"${String(value).replace(/"/g, '""')}"`;
}

export default function RecruiterAnalytics() {
	const [analytics, setAnalytics] = useState<Analytics | null>(null);
	const [jobs, setJobs] = useState<Posting[]>([]);
	const [loading, setLoading] = useState(true);
	const [jobsLoading, setJobsLoading] = useState(true);
	const [error, setError] = useState('');
	const [jobsError, setJobsError] = useState('');
	const [jobFilter, setJobFilter] = useState('all');
	const [categoryFilter, setCategoryFilter] = useState('all');
	const [dateFrom, setDateFrom] = useState('');
	const [dateTo, setDateTo] = useState('');
	const [sortBy, setSortBy] = useState<SortBy>('applications');

	const loadJobs = useCallback(async () => {
		setJobsLoading(true);
		setJobsError('');
		try {
			const { data } = await api.get('/v1/recruiter-portal/jobs');
			setJobs(Array.isArray(data) ? data : []);
		} catch (e) {
			setJobsError(getApiError(e));
		} finally {
			setJobsLoading(false);
		}
	}, []);
	useEffect(() => { loadJobs(); }, [loadJobs]);

	const loadAnalytics = useCallback(async (signal?: AbortSignal) => {
		setLoading(true);
		setError('');
		const params: Record<string, string | number> = {};
		if (jobFilter !== 'all') params.job_id = Number(jobFilter);
		if (categoryFilter !== 'all') params.category = categoryFilter;
		if (dateFrom) params.date_from = dateFrom;
		if (dateTo) params.date_to = dateTo;
		try {
			const { data } = await api.get('/v1/recruiter-portal/analytics', { params, signal });
			if (!data
				|| !Array.isArray(data.funnel)
				|| !Array.isArray(data.job_performance)
				|| !Array.isArray(data.most_requested_skills)
				|| !Array.isArray(data.strongest_coverage_skills)
				|| !Array.isArray(data.difficult_to_source_skills)
				|| !Array.isArray(data.insights)
				|| !data.candidate_quality
				|| !data.recruitment_speed) {
				throw new Error('The recruiter analytics response was not in the expected format.');
			}
			setAnalytics(data);
		} catch (e) {
			if (!signal?.aborted) {
				setError(e instanceof Error && !('response' in e) ? e.message : getApiError(e));
			}
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	}, [jobFilter, categoryFilter, dateFrom, dateTo]);
	useEffect(() => {
		const controller = new AbortController();
		loadAnalytics(controller.signal);
		return () => controller.abort();
	}, [loadAnalytics]);

	const sortedJobs = useMemo(() => {
		if (!analytics) return [];
		return [...analytics.job_performance].sort((a, b) => {
			const difference = b[sortBy] - a[sortBy];
			return difference || a.role.localeCompare(b.role);
		});
	}, [analytics, sortBy]);

	const exportSummary = () => {
		if (!analytics) return;
		const rows: (string | number)[][] = [
			['Recruitment Analytics Summary'],
			['Applications date range', `${dateFrom || 'All time'} to ${dateTo || 'Today'}`],
			[],
			['Metric', 'Value'],
			['Total jobs', analytics.total_jobs],
			['Total applications', analytics.total_applications],
			['Shortlisted', analytics.shortlisted],
			['Interviews', analytics.interviews],
			['Offers', analytics.offers],
			['Accepted', analytics.accepted],
			['Placements', analytics.placements],
			['Average fit score', analytics.average_fit_score ?? 'Not available'],
			[],
			['Role', 'Company', 'Category', 'Applications', 'Shortlisted', 'Interviews', 'Offers', 'Accepted', 'Placements', 'Shortlist rate', 'Offer rate', 'Placement rate'],
			...sortedJobs.map((job) => [job.role, job.company, job.category, job.applications, job.shortlisted, job.interviews, job.offers, job.accepted, job.placements, `${job.shortlist_rate}%`, `${job.offer_rate}%`, `${job.placement_rate}%`]),
		];
		const content = rows.map((row) => row.map((value) => escapeCsv(value ?? '')).join(',')).join('\r\n');
		const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = 'recruitment-analytics.csv';
		link.click();
		URL.revokeObjectURL(url);
	};

	const kpis = [
		{ label: 'Total Jobs', value: analytics?.total_jobs, icon: BriefcaseBusiness, tone: 'text-cyan-200' },
		{ label: 'Total Applications', value: analytics?.total_applications, icon: Users, tone: 'text-indigo-200' },
		{ label: 'Shortlisted', value: analytics?.shortlisted, icon: Target, tone: 'text-violet-200' },
		{ label: 'Interviews', value: analytics?.interviews, icon: Activity, tone: 'text-sky-200' },
		{ label: 'Offers', value: analytics?.offers, icon: FileBarChart2, tone: 'text-amber-200' },
		{ label: 'Placements', value: analytics?.placements, icon: CheckCircle2, tone: 'text-emerald-200' },
	];
	const hasActivity = Boolean(analytics && (analytics.total_jobs || analytics.total_applications));

	return <div className="w-full min-w-0">
		<header className="flex flex-wrap items-end justify-between gap-4">
			<div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Recruiter workspace</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Recruitment Analytics</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Understand your hiring funnel, candidate quality, and placement outcomes.</p></div>
			<button className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:bg-slate-800 disabled:opacity-50" disabled={!analytics || loading} onClick={exportSummary} type="button"><Download className="h-4 w-4"/>Export Summary</button>
		</header>

		<section aria-label="Analytics filters" className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2 xl:grid-cols-4">
			<label className="text-xs font-medium text-slate-400">Job<select className={`${inputClass} mt-1.5`} onChange={(e) => setJobFilter(e.target.value)} value={jobFilter}><option value="all">All recruiter jobs</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.role_title} · {job.company_name}</option>)}</select></label>
			<label className="text-xs font-medium text-slate-400">Category<select className={`${inputClass} mt-1.5`} onChange={(e) => setCategoryFilter(e.target.value)} value={categoryFilter}><option value="all">All categories</option><option value="job">Jobs</option><option value="internship">Internships</option></select></label>
			<label className="text-xs font-medium text-slate-400">Applications from<input className={`${inputClass} mt-1.5`} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} type="date" value={dateFrom}/></label>
			<label className="text-xs font-medium text-slate-400">Applications to<input className={`${inputClass} mt-1.5`} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} type="date" value={dateTo}/></label>
		</section>
		{jobsError && <div role="alert" className="mt-3 flex items-center justify-between rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-3 text-sm text-amber-100"><span>{jobsError}</span><button className="underline" onClick={loadJobs} type="button">Retry jobs</button></div>}
		{error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.05] p-4 text-sm text-rose-200"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4"/>{error}</span><button className="inline-flex items-center gap-1.5 underline" onClick={() => loadAnalytics()} type="button"><RefreshCw className="h-3.5 w-3.5"/>Retry</button></div>}

		<div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{kpis.map(({ label, value, icon: Icon, tone }) => <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-slate-700 sm:p-5" key={label}><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-300">{label}</p><Icon aria-hidden="true" className={`h-5 w-5 ${tone}`}/></div><p className="mt-3 text-3xl font-bold tracking-tight text-white">{loading ? '—' : value ?? 0}</p></article>)}</div>

		{loading && <div aria-label="Loading recruitment analytics" className="mt-5 grid gap-4 xl:grid-cols-2">{[0, 1, 2, 3].map((item) => <div className="h-72 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60" key={item}/>)}</div>}
		{!loading && analytics && !hasActivity && <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center"><FileBarChart2 className="mx-auto h-8 w-8 text-slate-500"/><h2 className="mt-3 font-semibold text-white">No recruiter activity in this selection</h2><p className="mt-2 text-sm text-slate-400">Analytics will appear when recruiter jobs or applications are available.</p></div>}

		{!loading && analytics && hasActivity && <>
			<div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
				<section aria-labelledby="funnel-title" className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Pipeline conversion</p><h2 className="mt-1 text-lg font-bold text-white" id="funnel-title">Hiring funnel</h2></div><Percent className="h-5 w-5 text-slate-500"/></div><div className="mt-5 space-y-3">{analytics.funnel.map((stage, index) => {
					const maxCount = Math.max(analytics.total_applications, 1);
					const width = Math.max(stage.count > 0 ? 4 : 0, stage.count / maxCount * 100);
					return <div className="grid grid-cols-[105px_minmax(0,1fr)_46px] items-center gap-3 sm:grid-cols-[125px_minmax(0,1fr)_54px]" key={stage.name}><span className="truncate text-xs font-medium text-slate-300 sm:text-sm">{stage.name}</span><div className="h-8 overflow-hidden rounded-md bg-slate-950/80"><div className={`flex h-full min-w-0 items-center rounded-md px-2 transition-all duration-500 ${index === 5 ? 'bg-emerald-400/75' : index >= 3 ? 'bg-cyan-400/70' : 'bg-indigo-400/70'}`} style={{ width: `${width}%` }}><span className="truncate text-[11px] font-semibold text-slate-950">{stage.count}</span></div></div><span className="text-right text-xs font-semibold tabular-nums text-slate-300">{stage.conversion_rate === null ? '—' : `${stage.conversion_rate}%`}</span></div>;
				})}<p className="pt-1 text-right text-[11px] text-slate-500">Conversion from the previous stage; Applications has no prior-stage rate.</p></div></section>

				<section aria-labelledby="quality-title" className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Deterministic scoring</p><h2 className="mt-1 text-lg font-bold text-white" id="quality-title">Candidate Quality</h2><p className="mt-1 text-xs text-slate-400">Same role-fit scorer used by the Applicants page.</p></div><div className="mt-5 grid grid-cols-2 gap-3"><QualityMetric label="Average fit score" value={analytics.candidate_quality.average_fit_score === null ? 'Not available' : `${analytics.candidate_quality.average_fit_score.toFixed(1)}%`}/><QualityMetric label="Highest fit score" value={analytics.candidate_quality.highest_fit_score === null ? 'Not available' : `${analytics.candidate_quality.highest_fit_score.toFixed(1)}%`}/><QualityMetric label="Strong matches (75+)" value={analytics.candidate_quality.strong_matches}/><QualityMetric label="Manual review (60–74)" value={analytics.candidate_quality.manual_review}/></div><div className="mt-4 space-y-2">{[['Excellent Match', analytics.candidate_quality.excellent_matches, 'bg-emerald-300'], ['Potential Match', analytics.candidate_quality.potential_matches, 'bg-amber-300'], ['Low Match', analytics.candidate_quality.low_matches, 'bg-slate-500']].map(([label, count, color]) => <div className="flex items-center justify-between gap-3 text-xs" key={label as string}><span className="flex items-center gap-2 text-slate-400"><span className={`h-2 w-2 rounded-full ${color}`}/>{label}</span><span className="font-semibold tabular-nums text-slate-200">{count}</span></div>)}</div></section>
			</div>

			<section aria-labelledby="jobs-title" className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 p-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Role-level outcomes</p><h2 className="mt-1 text-lg font-bold text-white" id="jobs-title">Job Performance</h2></div><label className="text-xs font-medium text-slate-400">Sort by<select className={`${inputClass} mt-1.5 min-h-10 sm:w-52`} onChange={(e) => setSortBy(e.target.value as SortBy)} value={sortBy}><option value="applications">Applications</option><option value="shortlist_rate">Shortlist rate</option><option value="offer_rate">Offer rate</option><option value="placement_rate">Placement rate</option></select></label></div>{sortedJobs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-950/50 text-[11px] uppercase tracking-wide text-slate-500"><tr>{['Role', 'Category', 'Applications', 'Shortlisted', 'Interviews', 'Offers', 'Placements', 'Placement rate'].map((head) => <th className="px-4 py-3 font-semibold" key={head}>{head}</th>)}</tr></thead><tbody>{sortedJobs.map((job) => <tr className="border-t border-slate-800/80 transition hover:bg-slate-800/30" key={job.job_id}><td className="px-4 py-3"><span className="block font-semibold text-slate-100">{job.role}</span><span className="mt-0.5 block text-xs text-slate-500">{job.company}</span></td><td className="px-4 py-3"><span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">{job.category}</span></td><td className="px-4 py-3 tabular-nums text-slate-200">{job.applications}</td><td className="px-4 py-3 tabular-nums text-slate-200">{job.shortlisted} <span className="text-xs text-slate-500">({job.shortlist_rate}%)</span></td><td className="px-4 py-3 tabular-nums text-slate-200">{job.interviews}</td><td className="px-4 py-3 tabular-nums text-slate-200">{job.offers} <span className="text-xs text-slate-500">({job.offer_rate}%)</span></td><td className="px-4 py-3 tabular-nums text-slate-200">{job.placements}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.min(job.placement_rate, 100)}%` }}/></div><span className="text-xs tabular-nums text-emerald-200">{job.placement_rate}%</span></div></td></tr>)}</tbody></table></div> : <p className="p-6 text-sm text-slate-400">No recruiter jobs match these filters.</p>}</section>

			<div className="mt-4 grid gap-4 xl:grid-cols-3">
				<SkillPanel title="Most requested skills" caption="Frequency across selected job descriptions." rows={analytics.most_requested_skills} valueKey="job_count" valueLabel="jobs"/>
				<SkillPanel title="Strongest candidate coverage" caption="Coverage among applicants to jobs requiring the skill." rows={analytics.strongest_coverage_skills} valueKey="coverage_rate" valueLabel="% covered"/>
				<SkillPanel title="Skill Demand & Gaps" caption="Most commonly missing required skills." rows={analytics.difficult_to_source_skills} valueKey="gap_count" valueLabel="gaps"/>
			</div>

			<div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
				<section aria-labelledby="speed-title" className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-cyan-200"/><h2 className="text-lg font-bold text-white" id="speed-title">Recruitment Speed</h2></div><p className="mt-1 text-xs text-slate-400">Intervals are calculated only where recorded event timestamps support them.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><SpeedMetric label="Application → interview scheduled" value={formatDays(analytics.recruitment_speed.application_to_interview_days)}/><SpeedMetric label="Interview → offer" value={formatDays(analytics.recruitment_speed.interview_to_offer_days)}/><SpeedMetric label="Offer → placement" value={formatDays(analytics.recruitment_speed.offer_to_placement_days)}/></div></section>
				<section aria-labelledby="intelligence-title" className="rounded-xl border border-indigo-300/15 bg-gradient-to-br from-indigo-400/[0.08] to-slate-900/70 p-5 sm:p-6"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-200"/><h2 className="text-lg font-bold text-white" id="intelligence-title">Recruiter Intelligence</h2></div><p className="mt-1 text-xs text-slate-400">Deterministic summaries of the selected real data; not hiring decisions.</p><ul className="mt-4 space-y-3">{analytics.insights.map((insight) => <li className="flex gap-2.5 text-sm leading-6 text-slate-200" key={insight}><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300"/>{insight}</li>)}</ul></section>
			</div>
		</>}
		{jobsLoading && <p className="sr-only">Loading recruiter job filter options…</p>}
	</div>;
}

function QualityMetric({ label, value }: { label: string; value: string | number }) {
	return <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1.5 text-lg font-bold tabular-nums text-white">{value}</p></div>;
}

function SpeedMetric({ label, value }: { label: string; value: string }) {
	return <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/50 p-3"><p className="min-h-8 text-xs text-slate-400">{label}</p><p className={`mt-1 text-sm font-semibold ${value === 'Insufficient timestamp data' ? 'text-slate-500' : 'text-cyan-100'}`}>{value}</p></div>;
}

function SkillPanel({ title, caption, rows, valueKey, valueLabel }: { title: string; caption: string; rows: SkillInsight[]; valueKey: 'job_count' | 'coverage_rate' | 'gap_count'; valueLabel: string }) {
	const max = Math.max(1, ...rows.map((row) => row[valueKey]));
	return <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-5"><h2 className="font-bold text-white">{title}</h2><p className="mt-1 min-h-8 text-xs leading-5 text-slate-400">{caption}</p>{rows.length ? <ul className="mt-4 space-y-3">{rows.map((row) => <li key={row.skill}><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-medium text-slate-200">{row.skill}</span><span className="shrink-0 text-xs tabular-nums text-slate-400">{valueKey === 'coverage_rate' ? `${row.coverage_rate.toFixed(1)} ${valueLabel}` : `${row[valueKey]} ${valueLabel}`}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${valueKey === 'gap_count' ? 'bg-amber-300/80' : 'bg-cyan-300/80'}`} style={{ width: `${Math.max(3, row[valueKey] / max * 100)}%` }}/></div>{valueKey !== 'job_count' && <p className="mt-1 text-[10px] text-slate-500">{row.candidate_count} applicants with this requirement · {row.gap_count} gaps</p>}</li>)}</ul> : <div className="mt-4 rounded-lg border border-dashed border-slate-800 p-5 text-center text-xs text-slate-500">No matching skill data available.</div>}</section>;
}
