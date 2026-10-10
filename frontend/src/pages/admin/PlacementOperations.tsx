import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Building2, Search, ShieldAlert } from 'lucide-react';
import {
	createAdminDrive,
	fetchAdminApplication,
	fetchAdminApplications,
	fetchAdminDrives,
	fetchAdminEligibilityJobs,
	fetchAdminOrganization,
	reviewAdminEligibility,
	updateAdminDrive,
	type AdminApplication,
	type AdminDriveStatus,
	type AdminEligibilityJob,
	type AdminEligibilityResult,
	type AdminEligibilityReview,
	type AdminOrganization,
	type AdminPlacementDrive,
	type AdminPlacementDriveDraft,
} from '../../api/admin';
import { getApiError } from '../../api/http';

type Section = 'drives' | 'applications' | 'eligibility' | 'organization';
type FilterState = { search: string; branch: string; status: string; date_from: string; date_to: string };
type DriveDraft = {
	company_name: string;
	drive_date: string;
	registration_deadline: string;
	venue: string;
	status: AdminDriveStatus;
};

const TITLES: Record<Section, string> = {
	drives: 'Placement Drives & Scheduling',
	applications: 'Application & Placement Tracking',
	eligibility: 'Eligibility & Verification',
	organization: 'Department & Branch Management',
};

const emptyDriveDraft: DriveDraft = {
	company_name: '',
	drive_date: '',
	registration_deadline: '',
	venue: '',
	status: 'Scheduled',
};

function asLocalInput(value: string | null): string {
	if (!value) return '';
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return '';
	const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}

function asApiDate(value: string): string {
	return new Date(value).toISOString();
}

function dateLabel(value: string | null) {
	return value ? new Date(value).toLocaleString() : 'Not recorded';
}

function ErrorNotice({ message }: { message: string }) {
	return message ? <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 px-4 py-3 text-sm text-rose-200" role="alert">{message}</p> : null;
}

function LoadingOrEmpty({
	loading,
	hasRecords,
	emptyText,
}: {
	loading: boolean;
	hasRecords: boolean;
	emptyText: string;
}) {
	if (loading) return <p className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-10 text-center text-sm text-slate-400">Loading recorded data…</p>;
	if (!hasRecords) return <p className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-10 text-center text-sm text-slate-400">{emptyText}</p>;
	return null;
}

function PlacementDrives() {
	const [drives, setDrives] = useState<AdminPlacementDrive[]>([]);
	const [filters, setFilters] = useState<FilterState>({ search: '', branch: '', status: '', date_from: '', date_to: '' });
	const [searchInput, setSearchInput] = useState('');
	const [draft, setDraft] = useState<DriveDraft>(emptyDriveDraft);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');

	const load = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			setDrives(await fetchAdminDrives({
				search: filters.search,
				status: filters.status,
				date_from: filters.date_from,
				date_to: filters.date_to,
			}));
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setLoading(false);
		}
	}, [filters]);

	useEffect(() => { void load(); }, [load]);

	const beginEdit = (drive: AdminPlacementDrive) => {
		setEditingId(drive.id);
		setDraft({
			company_name: drive.company_name,
			drive_date: asLocalInput(drive.drive_date),
			registration_deadline: asLocalInput(drive.registration_deadline),
			venue: drive.venue,
			status: drive.status,
		});
		setNotice('');
	};

	const cancelEdit = () => {
		setEditingId(null);
		setDraft(emptyDriveDraft);
	};

	const save = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!draft.drive_date || !draft.company_name.trim() || !draft.venue.trim()) {
			setError('Company, drive date, and venue are required.');
			return;
		}
		const driveDate = asApiDate(draft.drive_date);
		const deadline = draft.registration_deadline ? asApiDate(draft.registration_deadline) : null;
		if (deadline && new Date(deadline) > new Date(driveDate)) {
			setError('Registration deadline cannot be after the drive date.');
			return;
		}
		const action = editingId === null ? 'Create' : 'Save changes to';
		if (!window.confirm(`${action} the ${draft.company_name.trim()} placement drive?`)) return;
		const payload: AdminPlacementDriveDraft = {
			company_name: draft.company_name.trim(),
			drive_date: driveDate,
			registration_deadline: deadline,
			venue: draft.venue.trim(),
			status: draft.status,
		};
		setSaving(true);
		setError('');
		setNotice('');
		try {
			if (editingId === null) await createAdminDrive(payload);
			else await updateAdminDrive(editingId, payload);
			setNotice(editingId === null ? 'Placement drive created.' : 'Placement drive updated.');
			cancelEdit();
			await load();
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="space-y-6">
			<header>
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Admin Portal · Placement Operations</p>
				<h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{TITLES.drives}</h1>
				<p className="mt-2 text-sm text-slate-400">Manage recorded placement drives. New or edited schedules are checked against existing drive conflicts before they are saved.</p>
			</header>
			{notice && <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-100" role="status">{notice}</p>}
			<ErrorNotice message={error} />
			<form className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, search: searchInput.trim() })); }}>
				<label className="grid gap-1.5 text-xs text-slate-400">Company search
					<span className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100" onChange={(event) => setSearchInput(event.target.value)} placeholder="Company name" value={searchInput} /></span>
				</label>
				<label className="grid gap-1.5 text-xs text-slate-400">Status
					<select className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} value={filters.status}><option value="">All statuses</option><option>Scheduled</option><option>Conflicted</option><option>Completed</option></select>
				</label>
				<label className="grid gap-1.5 text-xs text-slate-400">Date from<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} type="date" value={filters.date_from} /></label>
				<label className="grid gap-1.5 text-xs text-slate-400">Date to<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} type="date" value={filters.date_to} /></label>
				<div className="md:col-span-2 xl:col-span-4"><button className="min-h-10 rounded-lg border border-slate-700 px-4 text-sm text-slate-200 hover:border-cyan-300/40" type="submit">Search drives</button></div>
			</form>

			<form className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={(event) => void save(event)}>
				<h2 className="text-sm font-semibold text-slate-100 md:col-span-2 xl:col-span-3">{editingId === null ? 'Create a placement drive' : `Edit drive #${editingId}`}</h2>
				<label className="grid gap-1.5 text-xs text-slate-400">Company<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, company_name: event.target.value }))} required value={draft.company_name} /></label>
				<label className="grid gap-1.5 text-xs text-slate-400">Drive date and time<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setDraft((current) => ({ ...current, drive_date: event.target.value }))} required type="datetime-local" value={draft.drive_date} /></label>
				<label className="grid gap-1.5 text-xs text-slate-400">Registration deadline<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setDraft((current) => ({ ...current, registration_deadline: event.target.value }))} type="datetime-local" value={draft.registration_deadline} /></label>
				<label className="grid gap-1.5 text-xs text-slate-400">Venue<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, venue: event.target.value }))} required value={draft.venue} /></label>
				<label className="grid gap-1.5 text-xs text-slate-400">Status<select className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as AdminDriveStatus }))} value={draft.status}><option>Scheduled</option><option>Conflicted</option><option>Completed</option></select></label>
				<div className="flex items-end gap-2"><button className="min-h-10 rounded-lg bg-cyan-300/10 px-4 text-sm font-medium text-cyan-100 hover:bg-cyan-300/20 disabled:opacity-50" disabled={saving} type="submit">{saving ? 'Saving…' : editingId === null ? 'Create drive' : 'Save changes'}</button>{editingId !== null && <button className="min-h-10 rounded-lg border border-slate-700 px-4 text-sm text-slate-300" onClick={cancelEdit} type="button">Cancel</button>}</div>
			</form>

			<LoadingOrEmpty emptyText="No placement drives match the selected filters." hasRecords={drives.length > 0} loading={loading} />
			{!loading && drives.map((drive) => (
				<article className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5" key={drive.id}>
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div><div className="flex items-center gap-2"><Building2 aria-hidden="true" className="h-4 w-4 text-cyan-300" /><h2 className="font-semibold text-white">{drive.company_name}</h2><span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">{drive.status}</span></div><p className="mt-2 text-sm text-slate-400">{dateLabel(drive.drive_date)} · {drive.venue}</p><p className="mt-1 text-xs text-slate-500">Registration deadline: {dateLabel(drive.registration_deadline)}</p></div>
						<button className="min-h-9 rounded-lg border border-slate-700 px-3 text-xs text-slate-200 hover:border-cyan-300/40" onClick={() => beginEdit(drive)} type="button">Edit drive</button>
					</div>
					{drive.conflicting_drive_ids.length > 0 && <p className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs leading-5 text-amber-100" role="status"><AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />Existing schedule conflict with drive(s) {drive.conflicting_drive_ids.join(', ')}. Resolve it using the existing Conflict Resolver.</p>}
					<div className="border-t border-slate-800 pt-3"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recorded recruiter job criteria</h3>{drive.recruiter_jobs.length ? <ul className="mt-2 space-y-1 text-sm text-slate-300">{drive.recruiter_jobs.map((job) => <li key={job.id}>{job.role_title} · minimum CGPA {job.min_cgpa} · branches {job.eligible_branches?.length ? job.eligible_branches.join(', ') : 'not specified or unavailable'} · deadline {dateLabel(job.application_deadline)}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No recruiter job description is linked to this company name.</p>}</div>
				</article>
			))}
		</div>
	);
}

function ApplicationTracking() {
	const [applications, setApplications] = useState<AdminApplication[]>([]);
	const [selected, setSelected] = useState<AdminApplication | null>(null);
	const [filters, setFilters] = useState<FilterState>({ search: '', branch: '', status: '', date_from: '', date_to: '' });
	const [searchInput, setSearchInput] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const load = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			setApplications(await fetchAdminApplications(filters));
			setSelected(null);
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setLoading(false);
		}
	}, [filters]);

	useEffect(() => { void load(); }, [load]);

	const showDetail = async (applicationId: number) => {
		setError('');
		try {
			setSelected(await fetchAdminApplication(applicationId));
		} catch (requestError) {
			setError(getApiError(requestError));
		}
	};

	return (
		<div className="space-y-6">
			<header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Admin Portal · Placement Operations</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{TITLES.applications}</h1><p className="mt-2 text-sm text-slate-400">Read-only institution-wide view of recorded student applications, linked interviews, and actual offer and placement statuses.</p></header>
			<ErrorNotice message={error} />
			<form className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2 xl:grid-cols-6" onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, search: searchInput.trim() })); }}>
				<label className="grid gap-1.5 text-xs text-slate-400">Student, company, or job<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setSearchInput(event.target.value)} value={searchInput} /></label>
				<label className="grid gap-1.5 text-xs text-slate-400">Branch<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setFilters((current) => ({ ...current, branch: event.target.value }))} value={filters.branch} /></label>
				<label className="grid gap-1.5 text-xs text-slate-400">Recorded application status<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} placeholder="Exact status" value={filters.status} /></label>
				<label className="grid gap-1.5 text-xs text-slate-400">From date<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} type="date" value={filters.date_from} /></label>
				<label className="grid gap-1.5 text-xs text-slate-400">To date<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} type="date" value={filters.date_to} /></label>
				<div className="flex items-end"><button className="min-h-10 rounded-lg border border-slate-700 px-4 text-sm text-slate-200 hover:border-cyan-300/40" type="submit">Search applications</button></div>
			</form>
			<LoadingOrEmpty emptyText="No recorded applications match these filters." hasRecords={applications.length > 0} loading={loading} />
			{!loading && applications.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-slate-800 text-xs text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Company / job</th><th className="px-4 py-3">Application status</th><th className="px-4 py-3">Linked lifecycle</th><th className="px-4 py-3">Applied at</th></tr></thead><tbody className="divide-y divide-slate-800">{applications.map((application) => <tr className="cursor-pointer hover:bg-slate-800/40" key={application.id} onClick={() => void showDetail(application.id)}><td className="px-4 py-3 text-slate-200">{application.student_name}<p className="text-xs text-slate-500">{application.branch} · {application.student_email}</p></td><td className="px-4 py-3 text-slate-300">{application.company_name}<p className="text-xs text-slate-500">{application.job_title}</p></td><td className="px-4 py-3 text-cyan-100">{application.status}</td><td className="px-4 py-3 text-slate-300">{application.interviews.length} interviews · {application.offers.length} offers{application.offers.some((offer) => offer.placement_status === 'Confirmed') ? ' · placement confirmed' : ''}</td><td className="px-4 py-3 text-slate-400">{dateLabel(application.created_at)}</td></tr>)}</tbody></table></div>}
			{selected && <section aria-label="Application details" className="space-y-4 rounded-xl border border-cyan-300/20 bg-slate-900 p-4 sm:p-5"><div><h2 className="text-lg font-semibold text-white">Application detail · #{selected.id}</h2><p className="mt-1 text-sm text-slate-400">{selected.student_name} · {selected.company_name} · {selected.job_title} · recorded status: {selected.status}</p></div><div className="grid gap-4 lg:grid-cols-2"><div><h3 className="text-sm font-medium text-slate-200">Interviews</h3>{selected.interviews.length ? <ul className="mt-2 space-y-2 text-sm text-slate-400">{selected.interviews.map((interview) => <li className="rounded-lg border border-slate-800 p-3" key={interview.id}>{interview.interview_type} · {interview.status}<p>{dateLabel(interview.scheduled_at)} · {interview.duration_minutes} min · {interview.interviewer}</p></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No interview records are linked.</p>}</div><div><h3 className="text-sm font-medium text-slate-200">Offers and placement</h3>{selected.offers.length ? <ul className="mt-2 space-y-2 text-sm text-slate-400">{selected.offers.map((offer) => <li className="rounded-lg border border-slate-800 p-3" key={offer.id}>Offer: {offer.offer_status} · placement: {offer.placement_status}<p>{offer.package_lpa} LPA · offer date {dateLabel(offer.offer_date)} · joining {offer.joining_date || 'not recorded'}</p></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No offer record is linked; no offer or placement status is inferred.</p>}</div></div></section>}
		</div>
	);
}

function EligibilityReview() {
	const [drives, setDrives] = useState<AdminPlacementDrive[]>([]);
	const [jobs, setJobs] = useState<AdminEligibilityJob[]>([]);
	const [selectedTarget, setSelectedTarget] = useState('');
	const [filters, setFilters] = useState({ search: '', branch: '', result: '' as AdminEligibilityResult | '', documents_confirmed: '', college_id_verified: '' });
	const [searchInput, setSearchInput] = useState('');
	const [review, setReview] = useState<AdminEligibilityReview | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const targets = useMemo(() => [
		...drives.map((drive) => ({ key: `drive:${drive.id}`, label: `Drive · ${drive.company_name} · ${dateLabel(drive.drive_date)}` })),
		...jobs.map((job) => ({ key: `job:${job.id}`, label: `Job · ${job.company_name} · ${job.role_title}` })),
	], [drives, jobs]);

	const loadTargets = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const [driveRows, jobRows] = await Promise.all([fetchAdminDrives(), fetchAdminEligibilityJobs()]);
			setDrives(driveRows);
			setJobs(jobRows);
			setSelectedTarget((current) => current || (jobRows[0] ? `job:${jobRows[0].id}` : driveRows[0] ? `drive:${driveRows[0].id}` : ''));
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { void loadTargets(); }, [loadTargets]);

	const runReview = async (activeFilters = filters) => {
		const [targetType, rawId] = selectedTarget.split(':');
		if (!rawId) return;
		setLoading(true);
		setError('');
		try {
			const target = targetType === 'drive' ? { drive_id: Number(rawId) } : { job_id: Number(rawId) };
			setReview(await reviewAdminEligibility(target, activeFilters));
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (selectedTarget) void runReview();
		// Filter edits are applied explicitly so the administrator controls when results refresh.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedTarget]);

	return (
		<div className="space-y-6">
			<header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Admin Portal · Placement Operations</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{TITLES.eligibility}</h1><p className="mt-2 text-sm text-slate-400">Review recruiter-recorded CGPA, skills, and branch criteria with the existing match scorer. Verification flags show recorded student fields only; no manual approval or exception is created here.</p></header>
			<ErrorNotice message={error} />
			<div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-2 xl:grid-cols-3">
				<label className="grid gap-1.5 text-xs text-slate-400">Review target<select className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setSelectedTarget(event.target.value)} value={selectedTarget}><option value="">Select a drive or job</option>{targets.map((target) => <option key={target.key} value={target.key}>{target.label}</option>)}</select></label>
				<label className="grid gap-1.5 text-xs text-slate-400">Student search<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setSearchInput(event.target.value)} value={searchInput} /></label>
				<label className="grid gap-1.5 text-xs text-slate-400">Branch filter<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setFilters((current) => ({ ...current, branch: event.target.value }))} value={filters.branch} /></label>
				<label className="grid gap-1.5 text-xs text-slate-400">Eligibility result<select className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setFilters((current) => ({ ...current, result: event.target.value as AdminEligibilityResult | '' }))} value={filters.result}><option value="">All results</option><option>Meets recorded criteria</option><option>Does not meet recorded criteria</option><option>Requires review</option></select></label>
				<label className="grid gap-1.5 text-xs text-slate-400">Documents confirmed<select className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setFilters((current) => ({ ...current, documents_confirmed: event.target.value }))} value={filters.documents_confirmed}><option value="">All</option><option value="true">Confirmed</option><option value="false">Not confirmed</option></select></label>
				<label className="grid gap-1.5 text-xs text-slate-400">College ID verified<select className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setFilters((current) => ({ ...current, college_id_verified: event.target.value }))} value={filters.college_id_verified}><option value="">All</option><option value="true">Verified</option><option value="false">Not verified</option></select></label>
				<div className="md:col-span-2 xl:col-span-3"><button className="min-h-10 rounded-lg border border-slate-700 px-4 text-sm text-slate-200 hover:border-cyan-300/40 disabled:opacity-50" disabled={!selectedTarget || loading} onClick={() => { const nextFilters = { ...filters, search: searchInput.trim() }; setFilters(nextFilters); void runReview(nextFilters); }} type="button">Review eligibility</button></div>
			</div>
			{loading && <LoadingOrEmpty emptyText="" hasRecords={false} loading />}
			{!loading && review?.message && <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100" role="status">{review.message}</p>}
			{!loading && review && !review.message && review.roles.map((role) => <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4" key={role.id}><div><h2 className="font-semibold text-white">{role.company_name} · {role.role_title}</h2><p className="mt-1 text-xs text-slate-400">Minimum CGPA {role.min_cgpa} · branches {role.eligible_branches?.length ? role.eligible_branches.join(', ') : 'not specified'} · required skills {role.required_skills || 'not specified'}</p></div><LoadingOrEmpty emptyText="No students match these eligibility and verification filters." hasRecords={role.students.length > 0} loading={false} />{role.students.map((student) => <article className="rounded-lg border border-slate-800 p-3" key={student.student_id}><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-medium text-slate-100">{student.name} · {student.branch}</h3><p className="text-xs text-slate-500">{student.email} · CGPA {student.cgpa} · active backlogs {student.active_backlogs} · cleared {student.cleared_backlogs}</p></div><span className={`rounded-full px-2.5 py-1 text-xs ${student.result === 'Meets recorded criteria' ? 'bg-emerald-300/10 text-emerald-200' : student.result === 'Requires review' ? 'bg-amber-300/10 text-amber-100' : 'bg-rose-300/10 text-rose-200'}`}>{student.result} · {student.fit_score}%</span></div><p className="mt-2 text-xs leading-5 text-slate-400">{student.reason}</p><p className="mt-1 text-xs text-slate-500">Matched: {student.matched_skills.join(', ') || 'none'} · Missing: {student.missing_skills.join(', ') || 'none'} · documents {student.documents_confirmed ? 'confirmed' : 'not confirmed'} · college ID {student.college_id_verified ? 'verified' : 'not verified'}</p>{student.warnings.length > 0 && <ul className="mt-2 space-y-1 text-xs text-amber-100">{student.warnings.map((warning) => <li className="flex gap-2" key={warning}><AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{warning}</li>)}</ul>}</article>)}</section>)}
		</div>
	);
}

function OrganizationManagement() {
	const [organization, setOrganization] = useState<AdminOrganization | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [search, setSearch] = useState('');
	useEffect(() => {
		fetchAdminOrganization().then(setOrganization).catch((requestError) => setError(getApiError(requestError))).finally(() => setLoading(false));
	}, []);
	const branches = organization?.branches.filter((branch) => branch.name.toLowerCase().includes(search.trim().toLowerCase())) ?? [];
	return (
		<div className="space-y-6">
			<header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Admin Portal · Placement Operations</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{TITLES.organization}</h1><p className="mt-2 text-sm text-slate-400">Inspect existing branch values from student profiles. The current data model does not contain managed departments or branch records, so this view is read-only.</p></header>
			<ErrorNotice message={error} />
			<LoadingOrEmpty emptyText="No branch values are recorded in student profiles." hasRecords={branches.length > 0} loading={loading} />
			{organization && <><p className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm leading-5 text-amber-100" role="status"><ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{organization.department_message}</p><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Departments</p><p className="mt-2 text-lg font-semibold text-slate-100">{organization.departments_available ? 'Available' : 'Not modeled'}</p></div><div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Students without a branch value</p><p className="mt-2 text-lg font-semibold text-slate-100">{organization.unassigned_student_count}</p></div></div><label className="grid max-w-md gap-1.5 text-xs text-slate-400">Search recorded branches<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setSearch(event.target.value)} value={search} /></label>{branches.length > 0 && <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"><table className="w-full text-left text-sm"><thead className="border-b border-slate-800 text-xs text-slate-500"><tr><th className="px-4 py-3">Recorded branch label</th><th className="px-4 py-3">Student profiles</th><th className="px-4 py-3">Management</th></tr></thead><tbody className="divide-y divide-slate-800">{branches.map((branch) => <tr key={branch.name}><td className="px-4 py-3 text-slate-200">{branch.name}</td><td className="px-4 py-3 text-slate-300">{branch.student_count}</td><td className="px-4 py-3 text-xs text-slate-500">Read-only profile value</td></tr>)}</tbody></table></div>}<p className="text-xs text-slate-500">Adding department records, branch codes, or edit/deactivation controls requires an approved organizational model and migration. No records have been fabricated.</p></>}
		</div>
	);
}

export default function PlacementOperations({ section }: { section: Section }) {
	if (section === 'drives') return <PlacementDrives />;
	if (section === 'applications') return <ApplicationTracking />;
	if (section === 'eligibility') return <EligibilityReview />;
	return <OrganizationManagement />;
}
