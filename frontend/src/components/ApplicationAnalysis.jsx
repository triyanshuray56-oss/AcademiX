import { useEffect, useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, CheckCircle2, ClipboardCheck, LoaderCircle, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import api, { getApiError } from '../api/http';

function AnalysisCard({ item }) {
	return <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-indigo-300/20 sm:p-6">
		<div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300">{item.company}</p><h2 className="mt-1 break-words text-base font-semibold text-white">{item.title}</h2><p className="mt-2 text-[10px] text-slate-500">Applied {new Date(item.applied_at).toLocaleDateString()} | Status: {item.application_status}</p></div><span className="rounded-full border border-indigo-300/20 bg-indigo-300/[0.06] px-3 py-1 text-[10px] font-medium text-indigo-100">Interview {Math.round(item.finalized_interview_score)}/100</span></div>
		{item.requirements_available ? <>
			<div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Skill match" value={item.skill_match_percent == null ? 'N/A' : `${item.skill_match_percent}%`} /><Metric label="CGPA" value={`${Number(item.cgpa).toFixed(2)}${item.minimum_cgpa == null ? '' : ` / ${item.minimum_cgpa} min`}`} /><Metric label="Projects" value={item.project_count} /><Metric label="Design / communication" value={`${Math.round(item.finalized_system_design_score)} / ${Math.round(item.finalized_communication_score)}`} /></div>
			<div className="mt-4 grid gap-4 sm:grid-cols-2"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Matched skills</p><p className="mt-2 text-xs leading-5 text-emerald-200">{item.matched_skills?.join(', ') || 'No structured skill match found'}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Skills to strengthen</p><p className="mt-2 text-xs leading-5 text-amber-200">{item.missing_skills?.join(', ') || 'No missing listed skills'}</p></div></div>
		</> : <p className="mt-4 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100">The original listing is no longer in the active feed. Your application is included, but current role requirements could not be rechecked.</p>}
		<p className="mt-4 flex items-start gap-2 rounded-lg border border-indigo-300/10 bg-indigo-300/[0.035] p-3 text-xs leading-5 text-slate-300"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-200" />{item.recommendation}</p>
		<a className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs text-slate-300 transition hover:border-indigo-300/30 hover:text-white" href={item.application_url} rel="noreferrer" target="_blank">Open original application <ArrowUpRight className="h-3.5 w-3.5" /></a>
	</article>;
}

function Metric({ label, value }) {
	return <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums text-white">{value}</p></div>;
}

export default function ApplicationAnalysis() {
	const [analysis, setAnalysis] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [retry, setRetry] = useState(0);
	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError('');
		api.get('/v1/applications/analysis')
			.then(({ data }) => { if (!cancelled) setAnalysis(data); })
			.catch((requestError) => { if (!cancelled) setError(getApiError(requestError)); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [retry]);

	return <div className="mx-auto max-w-7xl space-y-6">
		<header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Personal outcomes</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Application Analysis</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Review applied roles against your current profile after a mock interview result has been finalized.</p></header>
		{loading ? <div className="flex min-h-48 items-center justify-center text-sm text-slate-400"><LoaderCircle className="mr-2 h-4 w-4 animate-spin text-cyan-300" />Loading your application analysis...</div> : error ? <div className="rounded-xl border border-rose-300/15 bg-slate-900 p-5"><p className="flex items-center gap-2 text-sm text-rose-200"><XCircle className="h-4 w-4" />Could not load application analysis: {error}</p><button className="mt-3 inline-flex items-center gap-2 text-xs text-cyan-200" onClick={() => setRetry((value) => value + 1)} type="button"><RefreshCw className="h-3.5 w-3.5" />Try again</button></div> : !analysis?.finalized_interview_result ? <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-5 py-14 text-center"><ClipboardCheck className="mx-auto h-9 w-9 text-indigo-200/70" /><h2 className="mt-4 text-base font-semibold text-slate-100">No finalized application results available for analysis yet</h2><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-500">Save a completed mock interview assessment in Mock Tests &amp; Interviews. Your applied roles will be analyzed once that result is saved.</p></section> : analysis.results?.length ? <><div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.035] px-4 py-3 text-xs text-emerald-100"><CheckCircle2 className="h-4 w-4" />Interview assessment finalized. Showing {analysis.results.length} application{analysis.results.length === 1 ? '' : 's'} against your current profile.</div><div className="grid gap-4 xl:grid-cols-2">{analysis.results.map((item) => <AnalysisCard item={item} key={item.application_id} />)}</div></> : <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-5 py-14 text-center"><BriefcaseBusiness className="mx-auto h-9 w-9 text-slate-600" /><h2 className="mt-4 text-base font-semibold text-slate-100">No applications to analyze yet</h2><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-500">Apply to a job or internship first. Analysis will appear here after your interview assessment is finalized.</p></section>}
	</div>;
}
