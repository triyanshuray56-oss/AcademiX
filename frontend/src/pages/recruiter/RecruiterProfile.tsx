import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
	Building2,
	CircleUserRound,
	ExternalLink,
	Globe2,
	LockKeyhole,
	LogOut,
	MapPin,
	Pencil,
	Phone,
	Save,
	ShieldCheck,
	SlidersHorizontal,
	Users,
	X,
} from 'lucide-react';
import api, { getApiError } from '../../api/http';

type AuthenticatedUser = {
	email: string;
	role: 'recruiter';
	is_active: boolean;
};

type RecruiterCompanyProfile = {
	account: AuthenticatedUser;
	company_name: string | null;
	description: string | null;
	website: string | null;
	logo_url: string | null;
	location: string | null;
	industry: string | null;
	contact_name: string | null;
	contact_email: string | null;
	contact_phone: string | null;
};

type ProfileDraft = Omit<RecruiterCompanyProfile, 'account' | 'email' | 'role' | 'is_active'>;

type RecruiterJob = {
	id: number;
	company_name: string;
	role_title: string;
	min_cgpa: number;
	required_skills: string;
	job_category: 'job' | 'internship';
	eligible_branches: string[];
};

type View = 'profile' | 'settings';
type NotificationPreferences = {
	applicantUpdates: boolean;
	interviewReminders: boolean;
	productUpdates: boolean;
};

const EMPTY_PROFILE: ProfileDraft = {
	company_name: '',
	description: '',
	website: '',
	logo_url: '',
	location: '',
	industry: '',
	contact_name: '',
	contact_email: '',
	contact_phone: '',
};

const INPUT_CLASS = 'mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-70';

function initialsFromName(value: string) {
	const words = value.trim().split(/\s+/).filter(Boolean);
	return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'R';
}

function toDraft(profile: RecruiterCompanyProfile): ProfileDraft {
	return {
		company_name: profile.company_name || '',
		description: profile.description || '',
		website: profile.website || '',
		logo_url: profile.logo_url || '',
		location: profile.location || '',
		industry: profile.industry || '',
		contact_name: profile.contact_name || '',
		contact_email: profile.contact_email || '',
		contact_phone: profile.contact_phone || '',
	};
}

export default function RecruiterProfile({ onLogout }: { onLogout: () => void }) {
	const [activeView, setActiveView] = useState<View>('profile');
	const [profile, setProfile] = useState<RecruiterCompanyProfile | null>(null);
	const [draft, setDraft] = useState<ProfileDraft>(EMPTY_PROFILE);
	const [jobs, setJobs] = useState<RecruiterJob[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [editing, setEditing] = useState(false);
	const [error, setError] = useState('');
	const [jobsError, setJobsError] = useState('');
	const [saved, setSaved] = useState('');
	const [notifications, setNotifications] = useState<NotificationPreferences>({
		applicantUpdates: true,
		interviewReminders: true,
		productUpdates: false,
	});

	const load = useCallback(async () => {
		setLoading(true);
		setError('');
		setJobsError('');
		const [profileResult, jobsResult] = await Promise.allSettled([
			api.get<RecruiterCompanyProfile>('/v1/recruiter-profile'),
			api.get<RecruiterJob[]>('/v1/recruiter-portal/jobs'),
		]);
		if (profileResult.status === 'fulfilled') {
			const data = profileResult.value.data;
			if (data?.account?.role === 'recruiter' && typeof data.account.email === 'string') {
				setProfile(data);
				setDraft(toDraft(data));
			} else {
				setError('The recruiter profile response was not in the expected format.');
			}
		} else {
			setError(getApiError(profileResult.reason));
		}
		if (jobsResult.status === 'fulfilled') {
			if (Array.isArray(jobsResult.value.data)) {
				setJobs(jobsResult.value.data);
			} else {
				setJobsError('The recruiter jobs response was not in the expected format.');
			}
		} else {
			setJobsError(getApiError(jobsResult.reason));
		}
		setLoading(false);
	}, []);

	useEffect(() => { void load(); }, [load]);

	const categories = [...new Set(jobs.map((job) => job.job_category))];
	const categoryLabel = categories.length
		? categories.map((category) => category === 'internship' ? 'Internships' : 'Jobs').join(' · ')
		: 'No job categories configured';
	const branches = [...new Set(jobs.flatMap((job) => job.eligible_branches || []))];
	const skills = useMemo(
		() => [...new Set(jobs.flatMap((job) => job.required_skills.split(/[,;|\n]/).map((skill) => skill.trim()).filter(Boolean)))],
		[jobs],
	);
	const minimumCgpa = jobs.length ? Math.min(...jobs.map((job) => job.min_cgpa)) : null;
	const profileCompletion = Math.round(
		[
			draft.company_name,
			draft.description,
			draft.website,
			draft.location,
			draft.industry,
			draft.contact_name,
			draft.contact_email,
			draft.contact_phone,
		].filter((value) => value.trim()).length / 8 * 100,
	);
	const account = profile?.account;
	const displayedName = draft.company_name.trim() || 'Company name not set';

	const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSaving(true);
		setError('');
		setSaved('');
		try {
			const { data } = await api.put<RecruiterCompanyProfile>('/v1/recruiter-profile', draft);
			setProfile(data);
			setDraft(toDraft(data));
			setEditing(false);
			setSaved('Company profile saved.');
		} catch (saveError) {
			setError(getApiError(saveError));
		} finally {
			setSaving(false);
		}
	};

	const cancelEditing = () => {
		if (profile) setDraft(toDraft(profile));
		setEditing(false);
		setError('');
		setSaved('');
	};

	const updateDraft = (field: keyof ProfileDraft, value: string) => {
		setDraft((current) => ({ ...current, [field]: value }));
		setSaved('');
	};

	return <div className="w-full min-w-0 space-y-6">
		<header className="flex flex-wrap items-end justify-between gap-4">
			<div>
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Recruiter workspace</p>
				<h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Company Profile &amp; Settings</h1>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Manage your company presence, recruiter account, and hiring preferences.</p>
			</div>
			<div className="flex gap-2">
				{([
					['profile', 'Company profile', Building2],
					['settings', 'Settings', SlidersHorizontal],
				] as const).map(([view, label, Icon]) => <button aria-current={activeView === view ? 'page' : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${activeView === view ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100' : 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'}`} key={view} onClick={() => setActiveView(view)} type="button"><Icon aria-hidden="true" className="h-4 w-4"/>{label}</button>)}
			</div>
		</header>

		{error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.05] p-4 text-sm text-rose-200"><span>{error}</span><button className="underline" onClick={() => void load()} type="button">Retry</button></div>}
		{jobsError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-4 text-sm text-amber-100"><span>Job-level hiring preferences could not be loaded. {jobsError}</span><button className="underline" onClick={() => void load()} type="button">Retry</button></div>}
		{saved && <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] px-4 py-3 text-sm text-emerald-200" role="status">{saved}</p>}

		{loading ? <div aria-label="Loading recruiter profile" className="grid gap-4 xl:grid-cols-2"><div className="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60"/><div className="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60"/></div>
			: activeView === 'profile' ? <>
				<section aria-label="Company profile summary" className="flex min-w-0 flex-wrap items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
					<CompanyMark name={displayedName} logoUrl={draft.logo_url}/>
					<div className="min-w-0 flex-1">
						<p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">{draft.industry || 'Industry not set'}</p>
						<h2 className="mt-1 break-words text-2xl font-bold text-white">{displayedName}</h2>
						<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
							{draft.website && <a className="inline-flex items-center gap-1.5 text-cyan-200 hover:text-white" href={draft.website} rel="noreferrer" target="_blank"><Globe2 aria-hidden="true" className="h-4 w-4"/>{draft.website}<ExternalLink aria-hidden="true" className="h-3.5 w-3.5"/></a>}
							{draft.location && <span className="inline-flex items-center gap-1.5"><MapPin aria-hidden="true" className="h-4 w-4"/>{draft.location}</span>}
							{draft.contact_name && <span className="inline-flex items-center gap-1.5"><CircleUserRound aria-hidden="true" className="h-4 w-4"/>{draft.contact_name}</span>}
						</div>
					</div>
					<div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-44">
						<div><div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-400">Profile completion</span><span className="font-semibold text-cyan-100">{profileCompletion}%</span></div><div aria-label={`Profile ${profileCompletion}% complete`} className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800" role="img"><div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300 transition-all" style={{ width: `${profileCompletion}%` }}/></div></div>
						{!editing && <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:text-white" onClick={() => { setEditing(true); setError(''); }} type="button"><Pencil aria-hidden="true" className="h-4 w-4"/>Edit profile</button>}
					</div>
				</section>

				<div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
					<section aria-labelledby="company-details-heading" className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Company details</p><h2 className="mt-1 text-xl font-bold text-white" id="company-details-heading">{editing ? 'Edit company profile' : 'Profile information'}</h2><p className="mt-1 text-sm leading-6 text-slate-400">These details are private to your authenticated recruiter account.</p></div>
							{!editing && <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-400">Account profile</span>}
						</div>
						<form className="mt-5" onSubmit={saveProfile}>
							<fieldset className="grid min-w-0 gap-4 sm:grid-cols-2" disabled={!editing || saving}>
								<label className="text-xs font-medium text-slate-400">Company name<input autoComplete="organization" className={INPUT_CLASS} maxLength={160} onChange={(event) => updateDraft('company_name', event.target.value)} placeholder="Company name" value={draft.company_name}/></label>
								<label className="text-xs font-medium text-slate-400">Industry / category<input className={INPUT_CLASS} maxLength={120} onChange={(event) => updateDraft('industry', event.target.value)} placeholder="e.g. Software and IT services" value={draft.industry}/></label>
								<label className="text-xs font-medium text-slate-400">Company website<input className={INPUT_CLASS} maxLength={500} onChange={(event) => updateDraft('website', event.target.value)} placeholder="https://company.example" type="url" value={draft.website}/></label>
								<label className="text-xs font-medium text-slate-400">Company logo URL<input className={INPUT_CLASS} maxLength={500} onChange={(event) => updateDraft('logo_url', event.target.value)} placeholder="https://company.example/logo.png" type="url" value={draft.logo_url}/></label>
								<label className="text-xs font-medium text-slate-400">Company location<input autoComplete="address-level2" className={INPUT_CLASS} maxLength={240} onChange={(event) => updateDraft('location', event.target.value)} placeholder="City, region, country" value={draft.location}/></label>
								<label className="text-xs font-medium text-slate-400">Recruiter contact name<input autoComplete="name" className={INPUT_CLASS} maxLength={160} onChange={(event) => updateDraft('contact_name', event.target.value)} placeholder="Contact name" value={draft.contact_name}/></label>
								<label className="text-xs font-medium text-slate-400">Recruiter contact email<input autoComplete="email" className={INPUT_CLASS} maxLength={255} onChange={(event) => updateDraft('contact_email', event.target.value)} placeholder="name@company.example" type="email" value={draft.contact_email}/></label>
								<label className="text-xs font-medium text-slate-400">Recruiter contact phone<input autoComplete="tel" className={INPUT_CLASS} maxLength={50} onChange={(event) => updateDraft('contact_phone', event.target.value)} placeholder="+1 555 0100" type="tel" value={draft.contact_phone}/></label>
								<label className="text-xs font-medium text-slate-400 sm:col-span-2">Company description<textarea className={`${INPUT_CLASS} min-h-28 resize-y py-3`} maxLength={5000} onChange={(event) => updateDraft('description', event.target.value)} placeholder="Describe your company and what makes it a great place to work." value={draft.description}/><span className="mt-1 block text-right text-[11px] text-slate-500">{draft.description.length}/5000</span></label>
							</fieldset>
							{editing && <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-slate-800 pt-4"><button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-60" disabled={saving} onClick={cancelEditing} type="button"><X aria-hidden="true" className="h-4 w-4"/>Cancel</button><button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60" disabled={saving} type="submit">{saving ? <><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/>Saving…</> : <><Save aria-hidden="true" className="h-4 w-4"/>Save changes</>}</button></div>}
						</form>
					</section>

					<div className="min-w-0 space-y-4">
						<section aria-labelledby="branding-preview-heading" className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
							<p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Student-facing card preview</p>
							<h2 className="mt-1 text-xl font-bold text-white" id="branding-preview-heading">Company branding</h2>
							<div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
								<div className="flex min-w-0 items-center gap-3"><CompanyMark name={displayedName} logoUrl={draft.logo_url} small/><div className="min-w-0"><h3 className="break-words font-semibold text-white">{displayedName}</h3><p className="mt-1 text-xs text-slate-400">{draft.industry || 'Industry not set'}</p></div></div>
								<p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{draft.description.trim() || 'Add a short company description to help candidates understand your organization.'}</p>
								<div className="mt-4 space-y-2 border-t border-slate-800 pt-3 text-xs text-slate-400">
									{draft.website && <a className="flex min-w-0 items-center gap-2 break-all text-cyan-200 hover:text-white" href={draft.website} rel="noreferrer" target="_blank"><Globe2 aria-hidden="true" className="h-4 w-4 shrink-0"/>{draft.website}</a>}
									{draft.location && <p className="flex items-start gap-2"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/>{draft.location}</p>}
									{draft.contact_phone && <p className="flex items-center gap-2"><Phone aria-hidden="true" className="h-4 w-4 shrink-0"/>{draft.contact_phone}</p>}
								</div>
								{jobs.length > 0 && <div className="mt-4 border-t border-slate-800 pt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hiring focus from current listings</p><p className="mt-1 break-words text-xs leading-5 text-slate-300">{jobs.slice(0, 3).map((job) => job.role_title).join(' · ')}</p></div>}
							</div>
							<p className="mt-3 text-xs leading-5 text-slate-500">Preview only. Recruiter job postings remain shared listing records and are not assigned to this account.</p>
						</section>

						<AccountCard account={account} onLogout={onLogout}/>
					</div>
				</div>
			</> : <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
				<section aria-labelledby="preferences-heading" className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
					<div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Hiring configuration</p><h2 className="mt-1 text-xl font-bold text-white" id="preferences-heading">Hiring preferences</h2><p className="mt-2 text-sm leading-6 text-slate-400">Derived from the existing recruiter job listings. These are listing-level requirements, not account-wide preferences.</p></div>
					<div className="mt-5 grid gap-3 sm:grid-cols-2"><ReadOnlyField label="Job categories" value={categoryLabel}/><ReadOnlyField label="Minimum CGPA across listings" value={minimumCgpa === null ? 'Not available' : `${minimumCgpa.toFixed(2)} / 10`}/><ReadOnlyField label="Branches in listings" value={branches.length ? branches.join(', ') : 'No branch restrictions recorded'}/><ReadOnlyField label="Current listings" value={String(jobs.length)}/><ReadOnlyField label="Internship hiring" value={categories.includes('internship') ? 'Internship listings are present' : 'No internship listing found'}/></div>
					{skills.length > 0 && <div className="mt-5"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Technology / skill areas in listings</h3><div className="mt-2 flex flex-wrap gap-2">{skills.slice(0, 24).map((skill) => <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-xs text-slate-300" key={skill}>{skill}</span>)}</div></div>}
					{jobs.length > 0 && <div className="mt-5 space-y-2">{jobs.map((job) => <article className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4" key={job.id}><div className="min-w-0"><h3 className="break-words text-sm font-semibold text-white">{job.role_title}</h3><p className="mt-1 text-xs text-slate-400">{job.company_name} · {job.job_category === 'internship' ? 'Internship' : 'Job'}</p></div><div className="text-left text-xs text-slate-400 sm:text-right"><p>Min CGPA {job.min_cgpa.toFixed(2)}</p><p className="mt-1 break-words">{job.eligible_branches?.length ? job.eligible_branches.join(', ') : 'All branches / unspecified'}</p></div></article>)}</div>}
					{jobs.length === 0 && <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-6 text-center"><Building2 aria-hidden="true" className="mx-auto h-7 w-7 text-slate-500"/><p className="mt-3 text-sm font-medium text-slate-200">No job-specific preferences available</p><p className="mt-1 text-xs text-slate-500">Hiring requirements are configured on individual job postings.</p></div>}
					{jobsError && <p className="mt-3 text-xs text-amber-200">Listing-derived preferences are unavailable until listings can be loaded.</p>}
				</section>

				<div className="min-w-0 space-y-4">
					<section aria-labelledby="notification-heading" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
						<div className="flex items-center gap-3"><SlidersHorizontal aria-hidden="true" className="h-5 w-5 text-indigo-200"/><div><h2 className="font-bold text-white" id="notification-heading">Notification preferences</h2><p className="mt-1 text-xs text-slate-500">Session-only controls · not saved</p></div></div>
						<div className="mt-4 space-y-3">{([
							['applicantUpdates', 'Applicant updates'],
							['interviewReminders', 'Interview reminders'],
							['productUpdates', 'Product announcements'],
						] as const).map(([key, label]) => <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-300" key={key}><span>{label}</span><input checked={notifications[key]} className="h-4 w-4 accent-cyan-300" onChange={(event) => setNotifications((current) => ({ ...current, [key]: event.target.checked }))} type="checkbox"/></label>)}</div>
						<p className="mt-3 text-xs leading-5 text-slate-500">Persistent notification preferences are not supported by the current notification model.</p>
					</section>

					<section aria-labelledby="team-access-heading" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
						<div className="flex items-center gap-3"><Users aria-hidden="true" className="h-5 w-5 text-amber-200"/><div><h2 className="font-bold text-white" id="team-access-heading">Sub-account permissions</h2><p className="mt-1 text-xs text-slate-500">Future-ready · not available</p></div></div>
						<p className="mt-3 text-sm leading-6 text-slate-400">Recruiter accounts do not currently support team members or granular permissions.</p>
						<button className="mt-4 min-h-10 cursor-not-allowed rounded-lg border border-slate-700 px-3 text-sm text-slate-500" disabled type="button">Coming soon</button>
					</section>

					<AccountCard account={account} onLogout={onLogout}/>
				</div>
			</div>}
	</div>;
}

function CompanyMark({ name, logoUrl, small = false }: { name: string; logoUrl: string; small?: boolean }) {
	return <div aria-label={`${name} logo`} className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl border border-indigo-300/15 bg-gradient-to-br from-indigo-400/20 to-cyan-300/10 font-bold text-cyan-100 ${small ? 'h-12 w-12 text-sm' : 'h-16 w-16 text-xl'}`} role="img">
		<span aria-hidden="true">{initialsFromName(name)}</span>
		{logoUrl && <img alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" src={logoUrl}/>}
	</div>;
}

function AccountCard({ account, onLogout }: { account?: AuthenticatedUser; onLogout: () => void }) {
	return <section aria-labelledby="account-heading" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
		<div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/10 text-emerald-200"><LockKeyhole aria-hidden="true" className="h-5 w-5"/></div><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Security &amp; account</p><h2 className="mt-1 font-bold text-white" id="account-heading">Authenticated recruiter</h2></div></div>
		<div className="mt-5 space-y-3">
			<ReadOnlyField label="Signed-in email" value={account?.email || 'Not available'}/>
			<ReadOnlyField label="Role" value={account?.role === 'recruiter' ? 'Recruiter' : 'Not available'}/>
			<div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3"><span className="text-xs text-slate-400">Account status</span>{account ? <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${account.is_active ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200' : 'border-rose-300/20 bg-rose-300/[0.06] text-rose-200'}`}>{account.is_active ? 'Active' : 'Inactive'}</span> : <span className="text-sm text-slate-500">Not available</span>}</div>
		</div>
		<p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200"/>Account access uses the existing CampusLink authentication session.</p>
		<button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-300/20 px-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-300/10" onClick={onLogout} type="button"><LogOut aria-hidden="true" className="h-4 w-4"/>Sign out securely</button>
	</section>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
	return <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 break-words text-sm text-slate-200">{value}</p></div>;
}
