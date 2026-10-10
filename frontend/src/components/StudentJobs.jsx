import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, Building2, CheckCircle2, ExternalLink, LoaderCircle, MapPin, Search } from 'lucide-react';
import api, { getApiError } from '../api/http';

function salaryLabel(job) {
	if (job.stipend_salary) return job.stipend_salary;
	if (job.package_lpa != null) return `${job.package_lpa} LPA`;
	const min = job.annual_salary_min == null || job.annual_salary_min === '' ? Number.NaN : Number(job.annual_salary_min);
	const max = job.annual_salary_max == null || job.annual_salary_max === '' ? Number.NaN : Number(job.annual_salary_max);
	if (!Number.isFinite(min) && !Number.isFinite(max)) return '';
	const currency = job.salary_currency || 'USD';
	try {
		const format = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
		if (Number.isFinite(min) && Number.isFinite(max)) return `${format(min)} – ${format(max)} / year`;
		return `${format(Number.isFinite(min) ? min : max)} / year`;
	} catch {
		return `${Number.isFinite(min) ? min : max} ${currency} / year`;
	}
}

function jobTypes(job) {
	return Array.isArray(job.job_type) ? job.job_type : job.job_type ? [job.job_type] : [];
}

export default function StudentJobs({ isInternship = false, recruiterJds = [], student }) {
	const [jobs, setJobs] = useState([]);
	const [source, setSource] = useState('CampusLink recruiter database');
	const [appliedIds, setAppliedIds] = useState(() => new Set());
	const [query, setQuery] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [applyingId, setApplyingId] = useState('');
	const [notice, setNotice] = useState('');

	useEffect(() => {
		let cancelled = false;
		const type = isInternship ? 'internship' : 'job';
		Promise.allSettled([api.get(`/v1/jobs/aggregate?type=${type}`), api.get('/v1/jobs/applications/me')]).then(([jobsResult, applicationsResult]) => {
			if (cancelled) return;
			if (jobsResult.status === 'fulfilled') {
				setJobs(Array.isArray(jobsResult.value.data.jobs) ? jobsResult.value.data.jobs : []);
				setSource(jobsResult.value.data.source || 'CampusLink recruiter database');
			}
			else { setJobs([]); setError(getApiError(jobsResult.reason)); }
			if (applicationsResult.status === 'fulfilled') setAppliedIds(new Set(applicationsResult.value.data || []));
		}).finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, []);

	const filteredJobs = useMemo(() => jobs.filter((job) => {
		const internship = jobTypes(job).some((type) => /intern/i.test(type));
		if (isInternship !== internship) return false;
		const searchText = [job.title, job.company, job.description, job.location, ...(job.tags || []), ...jobTypes(job)].join(' ').toLowerCase();
		return searchText.includes(query.trim().toLowerCase());
	}), [jobs, query, isInternship]);

	const handleApply = async (job) => {
		if (appliedIds.has(job.id) || applyingId) return;
		setApplyingId(job.id);
		setNotice('');
		const applicationUrl = job.application_url || job.url;
		const applicationTab = window.open(applicationUrl, '_blank', 'noopener,noreferrer');
		try {
			await api.post('/v1/jobs/apply', { job_id: job.id, title: job.title, company: job.company, url: applicationUrl });
			setAppliedIds((current) => new Set([...current, job.id]));
			setNotice(`Application to ${job.company} saved to your profile.`);
			window.dispatchEvent(new CustomEvent('campuslink:application-updated', { detail: { jobId: job.id } }));
		} catch (requestError) {
			if (applicationTab) applicationTab.close();
			setNotice(getApiError(requestError));
		} finally { setApplyingId(''); }
	};

	const isDemoFeed = /sample data/i.test(source);
	const hasLiveFeed = /jobicy|internshala/i.test(source);
	const title = isDemoFeed ? (isInternship ? 'Sample internships' : 'Sample jobs') : hasLiveFeed ? (isInternship ? 'Live internships' : 'Live jobs') : (isInternship ? 'Internships' : 'Jobs');
	return <div className="mx-auto max-w-7xl space-y-6">
		<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Career opportunities</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{isDemoFeed ? 'Development preview listings help you explore the jobs experience before recruiters publish roles.' : hasLiveFeed ? 'Live listings are combined from Jobicy and the configured Internshala or regional feed.' : 'Listings from the configured external feeds will appear here when opportunities are available.'}</p></div><span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] ${isDemoFeed ? 'border-indigo-300/20 bg-indigo-300/5 text-indigo-100' : 'border-emerald-300/20 bg-emerald-300/5 text-emerald-100'}`}><span className={`h-1.5 w-1.5 rounded-full ${isDemoFeed ? 'bg-indigo-300' : 'bg-emerald-300'}`} />{source}</span></header>
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4"><label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/70 px-3"><Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" /><input aria-label="Search jobs by keyword or tech stack" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600" onChange={(event) => setQuery(event.target.value)} placeholder="Search by role, company, or skill" value={query} /></label><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500"><span>{filteredJobs.length} {filteredJobs.length === 1 ? 'role' : 'roles'}{query && ` matching '${query}'`}</span><span>{student.branch} · CGPA {Number(student.cgpa).toFixed(2)}</span></div></div>
		{error && <div className="rounded-lg border border-rose-300/15 bg-rose-300/[0.04] px-4 py-3 text-xs leading-5 text-rose-200">{error}</div>}
		{notice && <div aria-live="polite" className="rounded-lg border border-indigo-300/15 bg-indigo-300/[0.04] px-4 py-3 text-xs text-indigo-100" role="status">{notice}</div>}
		{loading ? <div className="flex min-h-48 items-center justify-center text-sm text-slate-400"><LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin text-cyan-300" />Loading live and CampusLink listings...</div> : filteredJobs.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-5 py-12 text-center"><BriefcaseBusiness aria-hidden="true" className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-4 text-sm font-medium text-slate-300">{error ? 'Job listings are unavailable' : query ? `No matching ${isInternship ? 'internships' : 'jobs'} found` : `No ${isInternship ? 'internships' : 'jobs'} are available right now`}</p><p className="mt-1 text-xs text-slate-500">{error ? 'Check the CampusLink API connection and try again.' : query ? 'Try another keyword or clear your search.' : 'New listings will appear here when the feed is available.'}</p></div> : <div className="grid min-w-0 gap-4 lg:grid-cols-2">{filteredJobs.map((job) => {
			const alreadyApplied = appliedIds.has(job.id);
			const matchingJd = recruiterJds.find((jd) => jd.id === job.recruiter_jd_id);
			const salary = salaryLabel(job);
			return <article className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300/25 hover:shadow-lg hover:shadow-indigo-950/30" key={job.id}><div className="flex min-w-0 items-start gap-3 p-5"><div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-cyan-200">{job.logo ? <img alt={`${job.company} logo`} className="h-full w-full object-contain p-1" loading="lazy" src={job.logo} /> : <Building2 aria-hidden="true" className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300">{job.company}</p><h2 className="mt-1 break-words text-base font-semibold text-white">{job.title}</h2><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">{job.location && <span className="flex items-center gap-1"><MapPin aria-hidden="true" className="h-3 w-3" />{job.location}</span>}{jobTypes(job).map((type) => <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400" key={type}>{type}</span>)}{job.duration && <span className="rounded bg-cyan-300/5 px-1.5 py-0.5 text-cyan-200">{job.duration}</span>}{matchingJd && <span className="text-emerald-300">CampusLink recruiter posting</span>}</div></div></div><div className="min-w-0 flex-1 px-5 pb-4"><p className="line-clamp-4 break-words text-xs leading-5 text-slate-400">{job.description}</p>{salary && <p className="mt-3 text-xs font-medium text-emerald-200">{salary}</p>}{job.tags?.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{job.tags.map((tag) => <span className="rounded-md border border-indigo-300/10 bg-indigo-300/[0.04] px-2 py-1 text-[10px] text-indigo-100/80" key={tag}>{tag}</span>)}</div>}</div><footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-4"><span className="text-[10px] text-slate-600">{job.published_at ? `Published ${new Date(job.published_at).toLocaleDateString()}` : job.drive_date ? `Drive ${new Date(job.drive_date).toLocaleDateString()}` : 'Live listing'}</span><div className="flex flex-wrap gap-2"><a className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white" href={job.application_url || job.url} rel="noreferrer" target="_blank">Details <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /></a><button className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-70 ${alreadyApplied ? 'border border-emerald-300/20 bg-emerald-300/5 text-emerald-200' : 'bg-indigo-400/15 text-indigo-100 hover:bg-indigo-400/25'}`} disabled={alreadyApplied || applyingId === job.id} onClick={() => handleApply(job)} type="button">{alreadyApplied ? <><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />Applied</> : applyingId === job.id ? <><LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />Saving...</> : <>Apply Now <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></>}</button></div></footer></article>;
		})}</div>}
		<p className="text-[10px] leading-5 text-slate-600">Listings and requirements are provided by recruiters through CampusLink. Application status is saved to your authenticated CampusLink profile.</p>
	</div>;
}
