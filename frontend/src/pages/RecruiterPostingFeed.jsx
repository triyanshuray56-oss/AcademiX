import { useEffect, useState } from 'react';
import { ArrowUpRight, Building2, CheckCircle2, Code2, LoaderCircle, RefreshCw } from 'lucide-react';
import api, { getApiError } from '../api/http';

export default function RecruiterPostingFeed({ category }) {
	const internship = category === 'internship';
	const [postings, setPostings] = useState([]);
	const [appliedIds, setAppliedIds] = useState(() => new Set());
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const [applyingId, setApplyingId] = useState(null);
	const [retry, setRetry] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		Promise.allSettled([
			api.get(`/v1/jobs/internal-postings?category=${category}`),
			api.get('/v1/jobs/applications/me'),
		]).then(([postingsResult, applicationsResult]) => {
			if (cancelled) return;
			if (postingsResult.status === 'fulfilled') {
				setPostings(Array.isArray(postingsResult.value.data) ? postingsResult.value.data : []);
				setError('');
			} else {
				setPostings([]);
				setError(getApiError(postingsResult.reason));
			}
			if (applicationsResult.status === 'fulfilled') {
				setAppliedIds(new Set(applicationsResult.value.data || []));
			}
		}).finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [category, retry]);

	const apply = async (posting) => {
		const postingId = Number(posting.recruiter_jd_id);
		if (!Number.isInteger(postingId) || postingId <= 0) {
			setNotice('This recruiter posting is unavailable. Please refresh and try again.');
			return;
		}
		if (applyingId != null || appliedIds.has(posting.id)) return;
		setApplyingId(postingId);
		setNotice('');
		try {
			const { data } = await api.post(`/v1/jobs/internal-postings/${postingId}/apply`);
			setAppliedIds((current) => new Set([...current, data.job_id]));
			setNotice(`Your application to ${posting.company_name} was submitted.`);
			window.dispatchEvent(new CustomEvent('campuslink:application-updated', { detail: { jobId: data.job_id } }));
		} catch (error) {
			setNotice(getApiError(error));
		} finally {
			setApplyingId(null);
		}
	};

	return <div className="mx-auto max-w-7xl space-y-6">
		<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">CampusLink Recruiters</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Recruiter {internship ? 'internships' : 'jobs'}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Openings posted directly by recruiters through CampusLink.</p></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1.5 text-[10px] text-emerald-100">Internal postings · Live</span></header>
		{notice && <p aria-live="polite" className="rounded-lg border border-indigo-300/15 bg-indigo-300/[0.04] px-4 py-3 text-xs text-indigo-100" role="status">{notice}</p>}
		{error && <div className="rounded-lg border border-rose-300/15 bg-rose-300/[0.04] px-4 py-3"><p className="text-xs leading-5 text-rose-200">Recruiter postings are unavailable: {error}</p><button className="mt-2 inline-flex items-center gap-2 text-xs text-cyan-200" onClick={() => setRetry((value) => value + 1)} type="button"><RefreshCw className="h-3.5 w-3.5" />Try again</button></div>}
		{loading ? <div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((item) => <div className="h-64 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" key={item} />)}</div> : postings.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-5 py-12 text-center"><Building2 className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-4 text-sm font-medium text-slate-300">No active recruiter postings at the moment.</p><p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">Jobs and internships posted by recruiters will appear here dynamically.</p></div> : <div className="grid min-w-0 gap-4 lg:grid-cols-2">{postings.map((posting) => {
			const applied = appliedIds.has(posting.id);
			return <article className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition duration-200 hover:border-indigo-300/25 hover:shadow-lg hover:shadow-indigo-950/30" key={posting.id}><div className="flex min-w-0 items-start gap-3 p-5"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-700 bg-slate-950 text-cyan-200"><Building2 aria-hidden="true" className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300">{posting.company_name}</p><h2 className="mt-1 break-words text-base font-semibold text-white">{posting.role_title}</h2><span className="mt-2 inline-flex rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{internship ? 'Internship' : 'Full-time'}</span></div></div><div className="min-w-0 flex-1 space-y-4 px-5 pb-5"><p className="break-words text-xs leading-5 text-slate-400">{posting.description}</p><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><p className="text-[9px] uppercase tracking-wide text-slate-600">{internship ? 'Stipend / package' : 'CTC'}</p><p className="mt-1 text-xs font-semibold text-emerald-200">{posting.package_lpa != null ? `${posting.package_lpa} LPA` : 'Not specified'}</p></div><div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><p className="text-[9px] uppercase tracking-wide text-slate-600">CGPA cutoff</p><p className="mt-1 text-xs font-semibold text-slate-200">{posting.cgpa_cutoff ?? 'Not specified'}</p></div></div><div><p className="text-[9px] uppercase tracking-wide text-slate-600">Eligible branches</p><p className="mt-1 text-xs text-slate-300">{posting.branch_eligibility || 'Not specified by recruiter'}</p></div>{posting.tech_stack?.length > 0 && <div><p className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-slate-600"><Code2 className="h-3 w-3" />Tech stack</p><div className="mt-2 flex flex-wrap gap-1.5">{posting.tech_stack.map((skill) => <span className="rounded-md border border-indigo-300/10 bg-indigo-300/[0.04] px-2 py-1 text-[10px] text-indigo-100/80" key={skill}>{skill}</span>)}</div></div>}{posting.application_deadline && <p className="text-[10px] text-slate-500">Apply by {new Date(posting.application_deadline).toLocaleDateString()}</p>}</div><footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-4"><span className="text-[10px] text-slate-600">CampusLink recruiter posting</span><button className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-70 ${applied ? 'border border-emerald-300/20 bg-emerald-300/5 text-emerald-200' : 'bg-indigo-400/15 text-indigo-100 hover:bg-indigo-400/25'}`} disabled={applied || applyingId === posting.recruiter_jd_id} onClick={(event) => { event.preventDefault(); void apply(posting); }} type="button">{applied ? <><CheckCircle2 className="h-3.5 w-3.5" />Applied</> : applyingId === posting.recruiter_jd_id ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Submitting...</> : <>Apply Now <ArrowUpRight className="h-3.5 w-3.5" /></>}</button></footer></article>;
		})}</div>}
		<p className="text-[10px] leading-5 text-slate-600">Applications are saved to your CampusLink application record for recruiter follow-up, application analysis, and interview tracking.</p>
	</div>;
}
