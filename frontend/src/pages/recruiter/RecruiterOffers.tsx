import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertCircle,
	ArrowUpRight,
	BriefcaseBusiness,
	CalendarDays,
	Check,
	CheckCircle2,
	ChevronRight,
	Clock3,
	FileText,
	LoaderCircle,
	MapPin,
	Plus,
	Search,
	UserRound,
	X,
} from 'lucide-react';
import api, { getApiError } from '../../api/http';

type OfferStatus = 'Draft' | 'Offer Sent' | 'Accepted' | 'Declined';
type Offer = {
	id: number;
	application_id: number;
	student_id: number;
	candidate_name: string;
	candidate_branch: string;
	candidate_cgpa: number;
	recruiter_jd_id: number;
	job_title: string;
	company_name: string;
	package_lpa: number;
	offer_date: string;
	joining_date?: string | null;
	location?: string | null;
	employment_type: string;
	notes: string;
	offer_status: OfferStatus;
	placement_status: 'Not Confirmed' | 'Confirmed';
	application_status: string;
	latest_interview_status?: string | null;
	created_at: string;
	updated_at: string;
};
type Posting = { id: number; company_name: string; role_title: string; package_lpa: number; job_category: 'job' | 'internship' };
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
type OfferApplicantsResponse = {
	applicants: Applicant[];
	ambiguous_count: number;
	unmatched_count: number;
};
type Draft = { job_id: string; application_id: string; package_lpa: string; offer_date: string; joining_date: string; location: string; notes: string };
type DateFilter = 'all' | 'today' | '30days';

const statuses: OfferStatus[] = ['Draft', 'Offer Sent', 'Accepted', 'Declined'];
const inputClass = 'mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10';
const emptyDraft = (): Draft => ({ job_id: '', application_id: '', package_lpa: '', offer_date: new Date().toISOString().slice(0, 10), joining_date: '', location: '', notes: '' });

function dateLabel(value?: string | null) {
	if (!value) return 'Not available';
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusTone(status: string) {
	if (status === 'Accepted' || status === 'Confirmed') return 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200';
	if (status === 'Offer Sent') return 'border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-100';
	if (status === 'Declined') return 'border-rose-300/20 bg-rose-300/[0.07] text-rose-200';
	return 'border-amber-300/20 bg-amber-300/[0.07] text-amber-100';
}

function Badge({ children }: { children: string }) {
	return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(children)}`}>{children}</span>;
}

export default function RecruiterOffers() {
	const [offers, setOffers] = useState<Offer[]>([]);
	const [jobs, setJobs] = useState<Posting[]>([]);
	const [applicants, setApplicants] = useState<Applicant[]>([]);
	const [ambiguousApplicants, setAmbiguousApplicants] = useState(0);
	const [unmatchedApplicants, setUnmatchedApplicants] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const [query, setQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [jobFilter, setJobFilter] = useState('all');
	const [dateFilter, setDateFilter] = useState<DateFilter>('all');
	const [selected, setSelected] = useState<Offer | null>(null);
	const [creating, setCreating] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState('');
	const [draft, setDraft] = useState<Draft>(emptyDraft);
	const [applicantsLoading, setApplicantsLoading] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const [offerResponse, jobResponse] = await Promise.all([
				api.get('/v1/recruiter-portal/offers'),
				api.get('/v1/recruiter-portal/jobs'),
			]);
			if (!Array.isArray(offerResponse.data) || !Array.isArray(jobResponse.data)) {
				throw new Error('The offers or recruiter jobs response was not in the expected format.');
			}
			setOffers(offerResponse.data);
			setJobs(jobResponse.data);
		} catch (e) {
			setError(e instanceof Error && !('response' in e) ? e.message : getApiError(e));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { load(); }, [load]);

	useEffect(() => {
		if (!draft.job_id) {
			setApplicants([]);
			setAmbiguousApplicants(0);
			setUnmatchedApplicants(0);
			setApplicantsLoading(false);
			return;
		}
		let cancelled = false;
		setApplicants([]);
		setFormError('');
		setApplicantsLoading(true);
		api.get<OfferApplicantsResponse>('/v1/recruiter-portal/offers/applicants', { params: { recruiter_jd_id: Number(draft.job_id) } })
			.then(({ data }) => {
				if (!Array.isArray(data.applicants)
					|| typeof data.ambiguous_count !== 'number'
					|| typeof data.unmatched_count !== 'number') {
					throw new Error('The applicants response was not in the expected format.');
				}
				if (!cancelled) {
					setApplicants(data.applicants);
					setAmbiguousApplicants(data.ambiguous_count);
					setUnmatchedApplicants(data.unmatched_count);
				}
			})
			.catch((e) => {
				if (!cancelled) {
					setApplicants([]);
					setAmbiguousApplicants(0);
					setUnmatchedApplicants(0);
					setFormError(getApiError(e));
				}
			})
			.finally(() => { if (!cancelled) setApplicantsLoading(false); });
		return () => { cancelled = true; };
	}, [draft.job_id]);

	const activeJob = jobs.find((job) => String(job.id) === draft.job_id);
	const existingApplications = useMemo(() => new Set(offers.map((offer) => offer.application_id)), [offers]);
	const eligibleApplicants = applicants.filter((applicant) => !existingApplications.has(applicant.application_id));
	const filtered = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		const now = new Date();
		return offers.filter((offer) => {
			const matchesQuery = !normalized || `${offer.candidate_name} ${offer.job_title} ${offer.company_name}`.toLowerCase().includes(normalized);
			const matchesStatus = statusFilter === 'all' || offer.offer_status === statusFilter;
			const matchesJob = jobFilter === 'all' || String(offer.recruiter_jd_id) === jobFilter;
			const offerDate = new Date(offer.offer_date);
			const matchesDate = dateFilter === 'all'
				|| (dateFilter === 'today' && offerDate.toDateString() === now.toDateString())
				|| (dateFilter === '30days' && now.getTime() - offerDate.getTime() <= 30 * 86400000 && offerDate <= now);
			return matchesQuery && matchesStatus && matchesJob && matchesDate;
		});
	}, [offers, query, statusFilter, jobFilter, dateFilter]);

	const createOffer = async (event: FormEvent) => {
		event.preventDefault();
		setFormError('');
		if (!draft.job_id || !draft.application_id || !draft.offer_date) {
			setFormError('Select a job and candidate, and enter an offer date.');
			return;
		}
		if (draft.package_lpa && (!Number.isFinite(Number(draft.package_lpa)) || Number(draft.package_lpa) < 0)) {
			setFormError('Package must be a valid non-negative amount.');
			return;
		}
		setSaving(true);
		try {
			const { data } = await api.post('/v1/recruiter-portal/offers', {
				application_id: Number(draft.application_id),
				recruiter_jd_id: Number(draft.job_id),
				package_lpa: draft.package_lpa === '' ? null : Number(draft.package_lpa),
				offer_date: new Date(`${draft.offer_date}T12:00:00`).toISOString(),
				joining_date: draft.joining_date || null,
				location: draft.location.trim() || null,
				notes: draft.notes.trim(),
			});
			setOffers((current) => [data, ...current]);
			setSelected(data);
			setCreating(false);
			setNotice('Offer draft created.');
			setDraft(emptyDraft());
		} catch (e) {
			setFormError(getApiError(e));
		} finally {
			setSaving(false);
		}
	};

	const updateOffer = async (offer: Offer, changes: { offer_status?: OfferStatus; placement_status?: 'Confirmed' }) => {
		setSaving(true);
		setError('');
		try {
			const { data } = await api.patch(`/v1/recruiter-portal/offers/${offer.id}`, changes);
			setOffers((current) => current.map((item) => item.id === data.id ? data : item));
			setSelected(data);
			setConfirming(false);
			setNotice(changes.placement_status ? 'Placement confirmation recorded.' : `Offer marked ${data.offer_status.toLowerCase()}.`);
		} catch (e) {
			setError(getApiError(e));
		} finally {
			setSaving(false);
		}
	};

	const stats = [
		{ label: 'Total Offers', value: offers.length, icon: FileText, tone: 'text-cyan-200' },
		{ label: 'Pending Acceptance', value: offers.filter((offer) => offer.offer_status === 'Offer Sent').length, icon: Clock3, tone: 'text-amber-200' },
		{ label: 'Accepted', value: offers.filter((offer) => offer.offer_status === 'Accepted').length, icon: CheckCircle2, tone: 'text-emerald-200' },
		{ label: 'Placement Confirmed', value: offers.filter((offer) => offer.placement_status === 'Confirmed').length, icon: Check, tone: 'text-indigo-200' },
	];
	const pipeline = [
		{ name: 'Draft', count: offers.filter((offer) => offer.offer_status === 'Draft').length },
		{ name: 'Offer Sent', count: offers.filter((offer) => offer.offer_status === 'Offer Sent').length },
		{ name: 'Accepted / Declined', count: offers.filter((offer) => offer.offer_status === 'Accepted' || offer.offer_status === 'Declined').length },
		{ name: 'Placement Confirmed', count: offers.filter((offer) => offer.placement_status === 'Confirmed').length },
	];

	return <div className="w-full min-w-0">
		<header className="flex flex-wrap items-end justify-between gap-4">
			<div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Recruiter workspace</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Offers &amp; Placements</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Track candidate offers, acceptance, and placement confirmation.</p></div>
			<button className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50" disabled={!jobs.length} onClick={() => { setDraft(emptyDraft()); setFormError(''); setCreating(true); }} type="button"><Plus className="h-4 w-4"/>Create Offer</button>
		</header>

		{notice && <p role="status" className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-200">{notice}</p>}
		<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon, tone }) => <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-5" key={label}><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-300">{label}</p><Icon aria-hidden="true" className={`h-5 w-5 ${tone}`}/></div><p className="mt-3 text-3xl font-bold tracking-tight text-white">{loading ? '—' : value}</p></article>)}</div>

		<section aria-label="Offer pipeline" className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
			<div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-white">Offer pipeline</h2><p className="mt-1 text-xs text-slate-400">Progress is recorded separately from student application status.</p></div><span className="text-xs text-slate-500">{offers.length} total</span></div>
			<div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{pipeline.map((stage, index) => <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4" key={stage.name}><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${index === 3 ? 'bg-emerald-300/10 text-emerald-200' : 'bg-indigo-300/10 text-indigo-200'}`}>{index === 3 ? <Check className="h-4 w-4"/> : <span className="text-sm font-bold">{index + 1}</span>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{stage.name}</p><p className="mt-1 text-xs text-slate-500">{loading ? '—' : stage.count} offer{stage.count === 1 ? '' : 's'}</p></div>{index < pipeline.length - 1 && <ChevronRight className="hidden h-4 w-4 text-slate-600 xl:block"/>}</div>)}</div>
		</section>

		<section aria-label="Search and filter offers" className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 lg:flex-row">
			<label className="relative min-w-0 flex-1"><span className="sr-only">Search candidate, role, or company</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500"/><input className={`${inputClass} mt-0 pl-9`} onChange={(e) => setQuery(e.target.value)} placeholder="Search candidate, role, or company" value={query}/></label>
			<label className="lg:w-48"><span className="sr-only">Filter by offer status</span><select className={`${inputClass} mt-0`} onChange={(e) => setStatusFilter(e.target.value)} value={statusFilter}><option value="all">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
			<label className="lg:w-56"><span className="sr-only">Filter by job</span><select className={`${inputClass} mt-0`} onChange={(e) => setJobFilter(e.target.value)} value={jobFilter}><option value="all">All jobs</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.role_title} · {job.company_name}</option>)}</select></label>
			<label className="lg:w-44"><span className="sr-only">Filter by offer date</span><select className={`${inputClass} mt-0`} onChange={(e) => setDateFilter(e.target.value as DateFilter)} value={dateFilter}><option value="all">Any offer date</option><option value="today">Today</option><option value="30days">Last 30 days</option></select></label>
		</section>

		{error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.05] p-4 text-sm text-rose-200"><span>{error}</span><button className="underline" onClick={load} type="button">Retry</button></div>}
		{loading ? <div aria-label="Loading offers" className="mt-5 grid gap-3">{[0, 1, 2].map((item) => <div className="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" key={item}/>)}</div>
			: filtered.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-14 text-center"><FileText className="mx-auto h-8 w-8 text-slate-500"/><h2 className="mt-3 font-semibold text-white">{offers.length ? 'No offers match these filters' : 'No offers yet'}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{offers.length ? 'Try changing your search or filters.' : 'Create an offer draft for a candidate who applied to one of your recruiter jobs.'}</p>{!offers.length && jobs.length > 0 && <button className="mt-5 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400" onClick={() => { setDraft(emptyDraft()); setCreating(true); }} type="button">Create your first offer</button>}</div>
				: <div className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60"><div className="hidden grid-cols-[minmax(180px,1.3fr)_minmax(160px,1.2fr)_110px_130px_130px_110px] gap-4 border-b border-slate-800 bg-slate-950/60 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 lg:grid"><span>Candidate</span><span>Role / Company</span><span>Package</span><span>Offer status</span><span>Placement</span><span>Offer date</span></div>{filtered.map((offer) => <button className="grid w-full gap-3 border-b border-slate-800/80 px-4 py-4 text-left transition last:border-0 hover:bg-slate-800/40 sm:px-5 lg:grid-cols-[minmax(180px,1.3fr)_minmax(160px,1.2fr)_110px_130px_130px_110px] lg:items-center lg:gap-4" key={offer.id} onClick={() => setSelected(offer)} type="button"><span className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-300/10 text-indigo-200"><UserRound className="h-5 w-5"/></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{offer.candidate_name}</span><span className="mt-1 block text-xs text-slate-400">{offer.candidate_branch} · CGPA {offer.candidate_cgpa.toFixed(2)}</span></span></span><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-200">{offer.job_title}</span><span className="mt-1 block truncate text-xs text-slate-400">{offer.company_name}</span></span><span className="text-sm font-semibold text-white">{offer.package_lpa.toLocaleString()} LPA</span><span><Badge>{offer.offer_status}</Badge></span><span><Badge>{offer.placement_status}</Badge></span><span className="text-xs text-slate-300">{dateLabel(offer.offer_date)}</span></button>)}</div>}

		{creating && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setCreating(false); }}><section aria-labelledby="create-offer-title" aria-modal="true" className="my-auto w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7" role="dialog"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">New offer</p><h2 className="mt-1 text-xl font-bold text-white" id="create-offer-title">Create offer draft</h2><p className="mt-1 text-sm text-slate-400">Candidate and job options come from existing recruiter applications and postings.</p></div><button aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => setCreating(false)} type="button"><X className="h-5 w-5"/></button></div>
			<form className="mt-5 space-y-4" onSubmit={createOffer}>
				<label className="block text-sm font-medium text-slate-200">Job<select className={inputClass} onChange={(e) => { setFormError(''); setDraft((current) => ({ ...current, job_id: e.target.value, application_id: '', package_lpa: '' })); }} required value={draft.job_id}><option value="">Select a recruiter job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.role_title} · {job.company_name}</option>)}</select></label>
				<label className="block text-sm font-medium text-slate-200">Candidate application<select className={inputClass} disabled={!draft.job_id || applicantsLoading || eligibleApplicants.length === 0} onChange={(e) => setDraft((current) => ({ ...current, application_id: e.target.value }))} required value={draft.application_id}><option value="">{applicantsLoading ? 'Loading applicants…' : draft.job_id ? 'Select an applicant' : 'Select a job first'}</option>{eligibleApplicants.map((applicant) => <option key={applicant.application_id} value={applicant.application_id}>{applicant.student_name} — {applicant.job_title} — {applicant.status}</option>)}</select></label>
				{draft.job_id && !applicantsLoading && !formError && applicants.length === 0 && <p className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-400">No applicants available for this job.</p>}
				{draft.job_id && !applicantsLoading && !formError && applicants.length > 0 && eligibleApplicants.length === 0 && <p className="rounded-lg border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2.5 text-sm text-amber-100">All applicants for this job already have an offer.</p>}
				{draft.job_id && !applicantsLoading && !formError && (ambiguousApplicants > 0 || unmatchedApplicants > 0) && <p className="text-xs leading-5 text-slate-500">{ambiguousApplicants > 0 && `${ambiguousApplicants} legacy application${ambiguousApplicants === 1 ? ' was' : 's were'} excluded because multiple recruiter jobs share the same company and title. `}{unmatchedApplicants > 0 && `${unmatchedApplicants} legacy application${unmatchedApplicants === 1 ? ' does' : 's do'} not match any recruiter job by exact company and title.`}</p>}
				<div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-200">Package (LPA)<input className={inputClass} min="0" onChange={(e) => setDraft((current) => ({ ...current, package_lpa: e.target.value }))} placeholder={activeJob ? `JD package: ${activeJob.package_lpa} LPA` : 'Uses job package if blank'} step="0.01" type="number" value={draft.package_lpa}/></label><label className="block text-sm font-medium text-slate-200">Employment type<input className={`${inputClass} text-slate-400`} readOnly value={activeJob?.job_category === 'internship' ? 'Internship (from job posting)' : activeJob ? 'Job (from job posting)' : 'Select a job first'}/></label></div>
				<div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-200">Offer date<input className={inputClass} onChange={(e) => setDraft((current) => ({ ...current, offer_date: e.target.value }))} required type="date" value={draft.offer_date}/></label><label className="block text-sm font-medium text-slate-200">Joining date<input className={inputClass} onChange={(e) => setDraft((current) => ({ ...current, joining_date: e.target.value }))} type="date" value={draft.joining_date}/></label></div>
				<label className="block text-sm font-medium text-slate-200">Location <span className="font-normal text-slate-500">(optional)</span><input className={inputClass} maxLength={240} onChange={(e) => setDraft((current) => ({ ...current, location: e.target.value }))} placeholder="Enter the agreed location, if known" value={draft.location}/></label>
				<label className="block text-sm font-medium text-slate-200">Notes <span className="font-normal text-slate-500">(optional)</span><textarea className={`${inputClass} min-h-24 py-3`} maxLength={10000} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} placeholder="Offer details or recruiter notes" value={draft.notes}/></label>
				{formError && <p className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] p-3 text-sm text-rose-200" role="alert">{formError}</p>}
				<div className="flex flex-wrap justify-end gap-3 border-t border-slate-800 pt-4"><button className="min-h-10 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-300 hover:bg-slate-800" onClick={() => setCreating(false)} type="button">Cancel</button><button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50" disabled={saving || applicantsLoading || eligibleApplicants.length === 0} type="submit">{saving && <LoaderCircle className="h-4 w-4 animate-spin"/>}Create draft</button></div>
			</form>
		</section></div>}

		{selected && <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/70 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><aside aria-label="Offer details" className="flex h-full w-full max-w-xl flex-col border-l border-slate-700 bg-slate-950 shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Offer details</p><h2 className="mt-1 text-xl font-bold text-white">{selected.candidate_name}</h2><p className="mt-1 text-sm text-slate-400">{selected.job_title} · {selected.company_name}</p></div><button aria-label="Close details" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => setSelected(null)} type="button"><X className="h-5 w-5"/></button></div>
			<div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6"><div className="flex flex-wrap gap-2"><Badge>{selected.offer_status}</Badge><Badge>{selected.placement_status}</Badge></div>
				<section className="grid grid-cols-2 gap-3"><Info icon={UserRound} label="Candidate" value={`${selected.candidate_name} · ${selected.candidate_branch}`}/><Info icon={BriefcaseBusiness} label="Role / company" value={`${selected.job_title} · ${selected.company_name}`}/><Info icon={FileText} label="Package" value={`${selected.package_lpa.toLocaleString()} LPA`}/><Info icon={CalendarDays} label="Offer date" value={dateLabel(selected.offer_date)}/><Info icon={CalendarDays} label="Joining date" value={dateLabel(selected.joining_date)}/><Info icon={MapPin} label="Location" value={selected.location || 'Not available'}/><Info icon={BriefcaseBusiness} label="Employment type" value={selected.employment_type === 'internship' ? 'Internship' : 'Job'}/><Info icon={Clock3} label="Interview status" value={selected.latest_interview_status || 'Not available'}/><Info icon={FileText} label="Application status" value={selected.application_status}/><Info icon={UserRound} label="Candidate CGPA" value={selected.candidate_cgpa.toFixed(2)}/></section>
				<section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><h3 className="text-sm font-semibold text-white">Offer notes</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{selected.notes || 'No notes added.'}</p></section>
				<p className="text-xs text-slate-500">Last updated {dateLabel(selected.updated_at)}</p>
				<div className="flex flex-wrap gap-2">{selected.offer_status === 'Draft' && <button className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50" disabled={saving} onClick={() => updateOffer(selected, { offer_status: 'Offer Sent' })} type="button">Send Offer</button>}{selected.offer_status === 'Offer Sent' && <><button className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50" disabled={saving} onClick={() => updateOffer(selected, { offer_status: 'Accepted' })} type="button">Mark Accepted</button><button className="rounded-lg border border-rose-300/20 px-4 py-2.5 text-sm font-semibold text-rose-200 hover:bg-rose-300/10 disabled:opacity-50" disabled={saving} onClick={() => updateOffer(selected, { offer_status: 'Declined' })} type="button">Mark Declined</button></>}{selected.offer_status === 'Declined' && <button className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50" disabled={saving} onClick={() => updateOffer(selected, { offer_status: 'Draft' })} type="button">Reopen for review</button>}{selected.offer_status === 'Accepted' && selected.placement_status !== 'Confirmed' && <button className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50" disabled={saving} onClick={() => setConfirming(true)} type="button">Confirm Placement</button>}{selected.placement_status === 'Confirmed' && <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-2 text-sm font-semibold text-emerald-200"><CheckCircle2 className="h-4 w-4"/>Placement confirmed</span>}</div>
			</div>
		</aside></div>}

		{confirming && selected && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"><section aria-labelledby="confirm-placement-title" aria-modal="true" className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" role="alertdialog"><div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-300/10 text-indigo-200"><CheckCircle2 className="h-5 w-5"/></div><h2 className="mt-4 text-lg font-bold text-white" id="confirm-placement-title">Confirm placement for this candidate?</h2><div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm"><p><span className="text-slate-500">Candidate:</span> <span className="text-slate-200">{selected.candidate_name}</span></p><p><span className="text-slate-500">Company:</span> <span className="text-slate-200">{selected.company_name}</span></p><p><span className="text-slate-500">Role:</span> <span className="text-slate-200">{selected.job_title}</span></p><p><span className="text-slate-500">Offer status:</span> <span className="text-slate-200">{selected.offer_status}</span></p></div><p className="mt-3 text-xs leading-5 text-slate-400">This records a placement confirmation only. It does not alter the candidate's academic record or application status.</p><div className="mt-5 flex justify-end gap-3"><button className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800" onClick={() => setConfirming(false)} type="button">Cancel</button><button className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50" disabled={saving} onClick={() => updateOffer(selected, { placement_status: 'Confirmed' })} type="button">{saving ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}Confirm placement</button></div></section></div>}
	</div>;
}

function Info({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
	return <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/50 p-3"><p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500"><Icon className="h-3.5 w-3.5"/>{label}</p><p className="mt-2 break-words text-sm text-slate-200">{value || 'Not available'}</p></div>;
}
