import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Search, ShieldAlert, Users } from 'lucide-react';
import {
	fetchAdminRecruiters,
	fetchAdminStudents,
	fetchAdminUsers,
	updateAdminUser,
	type AdminRecruiter,
	type AdminStudent,
	type AdminUser,
} from '../../api/admin';
import { getApiError } from '../../api/http';

type Section = 'users' | 'students' | 'faculty' | 'recruiters';
type UserDraft = { role: AdminUser['role']; is_active: boolean };

const TITLES: Record<Section, string> = {
	users: 'User & Role Management',
	students: 'Student Management',
	faculty: 'Faculty & Placement Officer Management',
	recruiters: 'Recruiter & Company Management',
};

const DESCRIPTIONS: Record<Section, string> = {
	users: 'Search authenticated accounts and manage supported roles and account status.',
	students: 'Review recorded student directory, academic, onboarding, and verification information.',
	faculty: 'Faculty and placement-officer account records are not available in the current account model.',
	recruiters: 'Review recruiter accounts, existing company profiles, and recorded job posting activity.',
};

export default function CoreManagement({ section }: { section: Section }) {
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [students, setStudents] = useState<AdminStudent[]>([]);
	const [recruiters, setRecruiters] = useState<AdminRecruiter[]>([]);
	const [drafts, setDrafts] = useState<Record<number, UserDraft>>({});
	const [searchInput, setSearchInput] = useState('');
	const [search, setSearch] = useState('');
	const [role, setRole] = useState('');
	const [activeFilter, setActiveFilter] = useState('');
	const [branch, setBranch] = useState('');
	const [onboardingFilter, setOnboardingFilter] = useState('');
	const [loading, setLoading] = useState(section !== 'faculty');
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');

	const load = useCallback(async () => {
		if (section === 'faculty') return;
		setLoading(true);
		setError('');
		try {
			if (section === 'users') {
				const rows = await fetchAdminUsers({
					search,
					role,
					is_active: activeFilter,
				});
				setUsers(rows);
				setDrafts(Object.fromEntries(rows.map(({ id, role: userRole, is_active }) => [
					id,
					{ role: userRole, is_active },
				])));
			} else if (section === 'students') {
				setStudents(await fetchAdminStudents({
					search,
					branch,
					onboarding_complete: onboardingFilter,
				}));
			} else {
				setRecruiters(await fetchAdminRecruiters({
					search,
					is_active: activeFilter,
				}));
			}
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setLoading(false);
		}
	}, [activeFilter, branch, onboardingFilter, role, search, section]);

	useEffect(() => { void load(); }, [load]);

	const submitSearch = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSearch(searchInput.trim());
	};

	const saveUser = async (user: AdminUser) => {
		const draft = drafts[user.id];
		if (!draft || (draft.role === user.role && draft.is_active === user.is_active)) return;
		if (!window.confirm(`Apply the selected role and account status to ${user.email}?`)) return;
		setError('');
		setNotice('');
		try {
			await updateAdminUser(user.id, draft);
			setNotice(`Updated account ${user.email}.`);
			await load();
		} catch (requestError) {
			setError(getApiError(requestError));
		}
	};

	const isSelf = (email: string) => email === localStorage.getItem('email');

	return (
		<div className="w-full min-w-0 space-y-6">
			<header>
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Admin Portal · Core Administration</p>
				<h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{TITLES[section]}</h1>
				<p className="mt-2 text-sm text-slate-400">{DESCRIPTIONS[section]}</p>
			</header>

			{section === 'faculty' ? (
				<section className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-6 text-amber-100" role="status">
					No faculty or placement-officer role, account type, or departmental assignment exists in the current system. This view is informational only; no records or permissions have been fabricated.
				</section>
			) : (
				<>
					<form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4" onSubmit={submitSearch}>
						<label className="grid min-w-56 flex-1 gap-1.5 text-xs text-slate-400">
							Search
							<span className="relative">
								<Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
								<input className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-cyan-300/60" onChange={(event) => setSearchInput(event.target.value)} placeholder={section === 'students' ? 'Name, email, or roll number' : 'Email or company'} value={searchInput} />
							</span>
						</label>
						{section === 'users' && <label className="grid gap-1.5 text-xs text-slate-400">Role
							<select className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setRole(event.target.value)} value={role}>
								<option value="">All roles</option><option value="student">Student</option><option value="recruiter">Recruiter</option><option value="admin">Admin</option>
							</select>
						</label>}
						{(section === 'users' || section === 'recruiters') && <label className="grid gap-1.5 text-xs text-slate-400">Account status
							<select className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setActiveFilter(event.target.value)} value={activeFilter}>
								<option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option>
							</select>
						</label>}
						{section === 'students' && <>
							<label className="grid gap-1.5 text-xs text-slate-400">Branch
								<input className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setBranch(event.target.value)} placeholder="All branches" value={branch} />
							</label>
							<label className="grid gap-1.5 text-xs text-slate-400">Onboarding
								<select className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setOnboardingFilter(event.target.value)} value={onboardingFilter}>
									<option value="">All profiles</option><option value="true">Complete</option><option value="false">Incomplete</option>
								</select>
							</label>
						</>}
						<button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm text-slate-200 hover:border-cyan-300/40" type="submit">Search</button>
					</form>

					{section === 'users' && <p className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100" role="status"><ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />Account changes are protected against self-lockout and removal of the last active administrator. The current project has no audit-log storage, so these updates are not recorded in an audit history.</p>}
					{section === 'recruiters' && <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100" role="status">No recruiter verification or registration-request workflow is recorded in the current system. Posting counts are matched by the company name in an existing company profile; they are unavailable when no company name is recorded.</p>}
					{error && <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}
					{notice && <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-100" role="status">{notice}</p>}

					{loading ? <p className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-10 text-center text-sm text-slate-400">Loading records…</p> : (
						<section className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
							{section === 'users' && <table className="w-full min-w-[680px] text-left text-sm">
								<thead className="border-b border-slate-800 text-xs text-slate-500"><tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
								<tbody className="divide-y divide-slate-800">{users.map((user) => {
									const draft = drafts[user.id] ?? { role: user.role, is_active: user.is_active };
									const disabled = isSelf(user.email);
									return <tr key={user.id}>
										<td className="px-4 py-3 text-slate-200">{user.email}{disabled && <span className="ml-2 text-xs text-slate-500">(you)</span>}</td>
										<td className="px-4 py-3"><select aria-label={`Role for ${user.email}`} className="min-h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-slate-100" disabled={disabled} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, role: event.target.value as AdminUser['role'] } }))} value={draft.role}><option value="student">Student</option><option value="recruiter">Recruiter</option><option value="admin">Admin</option></select></td>
										<td className="px-4 py-3"><select aria-label={`Status for ${user.email}`} className="min-h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-slate-100" disabled={disabled} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, is_active: event.target.value === 'true' } }))} value={String(draft.is_active)}><option value="true">Active</option><option value="false">Inactive</option></select></td>
										<td className="px-4 py-3"><button className="min-h-9 rounded-md border border-cyan-300/20 px-3 text-xs text-cyan-100 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled || (draft.role === user.role && draft.is_active === user.is_active)} onClick={() => void saveUser(user)} type="button">Save changes</button></td>
									</tr>;
								})}</tbody>
							</table>}
							{section === 'students' && <table className="w-full min-w-[850px] text-left text-sm">
								<thead className="border-b border-slate-800 text-xs text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Branch / Roll no.</th><th className="px-4 py-3">CGPA</th><th className="px-4 py-3">Backlogs</th><th className="px-4 py-3">Skills</th><th className="px-4 py-3">Profile / verification</th></tr></thead>
								<tbody className="divide-y divide-slate-800">{students.map((student) => <tr key={student.id}>
									<td className="px-4 py-3"><p className="text-slate-200">{student.name}</p><p className="text-xs text-slate-500">{student.email}</p></td>
									<td className="px-4 py-3 text-slate-300">{student.branch}<p className="text-xs text-slate-500">{student.university_roll_number || 'Roll number not recorded'}</p></td>
									<td className="px-4 py-3 text-slate-200">{student.cgpa.toFixed(2)}</td>
									<td className="px-4 py-3 text-slate-300">{student.active_backlogs} active · {student.cleared_backlogs} cleared</td>
									<td className="max-w-64 px-4 py-3 text-slate-300">{student.skills || 'Not recorded'}</td>
									<td className="px-4 py-3 text-xs text-slate-300">{student.onboarding_complete ? 'Onboarding complete' : 'Onboarding incomplete'}<p>{student.documents_confirmed ? 'Documents confirmed' : 'Documents unconfirmed'} · {student.college_id_verified ? 'ID verified' : 'ID unverified'}</p></td>
								</tr>)}</tbody>
							</table>}
							{section === 'recruiters' && <table className="w-full min-w-[760px] text-left text-sm">
								<thead className="border-b border-slate-800 text-xs text-slate-500"><tr><th className="px-4 py-3">Recruiter</th><th className="px-4 py-3">Company profile</th><th className="px-4 py-3">Activity</th><th className="px-4 py-3">Status</th></tr></thead>
								<tbody className="divide-y divide-slate-800">{recruiters.map((recruiter) => <tr key={recruiter.id}>
									<td className="px-4 py-3 text-slate-200">{recruiter.email}</td>
									<td className="px-4 py-3 text-slate-300">{recruiter.company_name || 'Company profile not completed'}<p className="text-xs text-slate-500">{[recruiter.industry, recruiter.location].filter(Boolean).join(' · ') || 'Industry/location not recorded'}</p>{recruiter.description && <p className="mt-1 max-w-sm text-xs text-slate-500">{recruiter.description}</p>}</td>
									<td className="px-4 py-3 text-slate-300">{recruiter.job_posting_count === null ? 'Posting activity unavailable' : `${recruiter.job_posting_count} recorded job postings`}</td>
									<td className="px-4 py-3 text-slate-300">{recruiter.is_active ? 'Active' : 'Inactive'}</td>
								</tr>)}</tbody>
							</table>}
							{((section === 'users' && users.length === 0) || (section === 'students' && students.length === 0) || (section === 'recruiters' && recruiters.length === 0)) && <p className="px-4 py-10 text-center text-sm text-slate-400"><Users aria-hidden="true" className="mx-auto mb-2 h-5 w-5 text-slate-600" />No matching records are available.</p>}
						</section>
					)}
				</>
			)}
		</div>
	);
}
