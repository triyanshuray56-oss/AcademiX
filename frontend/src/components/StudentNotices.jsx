import { useEffect, useMemo, useState } from 'react';
import {
	ArrowUpRight,
	BellRing,
	BriefcaseBusiness,
	CalendarClock,
	CheckCircle2,
	Clock3,
	LoaderCircle,
	Megaphone,
	RefreshCw,
	Search,
	ShieldCheck,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getApiError } from '../api/http';
import {
	fetchAdminAnnouncements,
	fetchDeadlines,
	fetchPlacementAnnouncements,
	fetchRecruiterAnnouncements,
} from '../api/notifications';

function closingLabel(deadline, now) {
	const milliseconds = new Date(deadline).getTime() - now;
	if (milliseconds <= 0) return 'Closing now';
	const days = Math.ceil(milliseconds / 86400000);
	return `Closing in ${days} ${days === 1 ? 'day' : 'days'}`;
}

function DeadlineCard({ item, now }) {
	const external = /^https?:\/\//i.test(item.direct_link || '');
	const urgency =
		item.urgency === 'closing_today'
			? 'border-rose-300/25 bg-rose-400/10 text-rose-100'
			: item.urgency === 'closing_soon'
			? 'border-amber-300/25 bg-amber-400/[0.08] text-amber-100'
			: 'border-indigo-300/20 bg-indigo-400/[0.06] text-indigo-100';

	return (
		<article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition hover:border-amber-300/20">
			<div className="flex min-w-0 items-start gap-3 p-5">
				<span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-cyan-200">
					{item.logo ? (
						<img
							alt={`${item.company} logo`}
							className="h-full w-full object-contain"
							loading="lazy"
							src={item.logo}
						/>
					) : (
						<BriefcaseBusiness className="h-5 w-5" />
					)}
				</span>
				<div className="min-w-0 flex-1">
					<p className="truncate text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300">
						{item.company}
					</p>
					<h2 className="mt-1 break-words text-base font-semibold text-white">{item.role_title}</h2>
					<p className="mt-2 text-[10px] text-slate-500">
						{item.location || 'Location not specified'} | {item.drive_id ? 'Drive registration' : 'Job application'}
					</p>
				</div>
			</div>
			<div className={`mx-5 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${urgency}`}>
				<span className="flex items-center gap-2 text-xs font-semibold">
					<Clock3 className="h-4 w-4" />
					{closingLabel(item.deadline, now)}
				</span>
				<span className="text-[10px] opacity-75">
					{new Date(item.deadline).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
				</span>
			</div>
			<footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-4">
				<span className="inline-flex items-center gap-1.5 text-[9px] text-slate-600">
					<CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
					Registration closing time
				</span>
				<a
					className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-indigo-400/15 px-3 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-400/25"
					href={item.direct_link}
					rel={external ? 'noreferrer' : undefined}
					target={external ? '_blank' : undefined}
				>
					View opening <ArrowUpRight className="h-3.5 w-3.5" />
				</a>
			</footer>
		</article>
	);
}

function AnnouncementCard({ notice }) {
	return (
		<article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
			<div className="flex min-w-0 items-start gap-3">
				<span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-cyan-200">
					{notice.logo ? (
						<img
							alt={`${notice.company || 'Company'} logo`}
							className="h-full w-full object-contain"
							loading="lazy"
							src={notice.logo}
						/>
					) : (
						<Megaphone className="h-5 w-5" />
					)}
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="rounded-full border border-indigo-300/15 bg-indigo-300/5 px-2 py-1 text-[9px] text-indigo-100">
							{notice.category}
						</span>
						<time className="rounded-full bg-slate-800 px-2 py-1 text-[9px] text-slate-400" dateTime={notice.published_at}>
							{new Date(notice.published_at).toLocaleDateString()}
						</time>
					</div>
					<h2 className="mt-3 text-sm font-semibold text-white">{notice.title}</h2>
					{notice.company && (
						<p className="mt-1 text-[10px] text-cyan-200">
							{notice.company}
							{notice.role_title ? ` | ${notice.role_title}` : ''}
							{notice.package ? ` | ${notice.package}` : ''}
						</p>
					)}
				</div>
			</div>
			<p className="mt-3 line-clamp-4 text-xs leading-5 text-slate-400">{notice.message}</p>
			<div className="mt-4 flex items-center justify-between gap-2">
				<span
					className={`rounded-full px-2 py-1 text-[9px] ${
						notice.priority === 'High' ? 'bg-amber-300/10 text-amber-100' : 'bg-slate-800 text-slate-400'
					}`}
				>
					{notice.priority || 'Normal'}
				</span>
				{notice.direct_link && (
					<a
						className="inline-flex items-center gap-1 text-xs font-medium text-indigo-200 hover:text-white"
						href={notice.direct_link}
						rel={/^https?:\/\//i.test(notice.direct_link) ? 'noreferrer' : undefined}
						target={/^https?:\/\//i.test(notice.direct_link) ? '_blank' : undefined}
					>
						View opening <ArrowUpRight className="h-3.5 w-3.5" />
					</a>
				)}
			</div>
		</article>
	);
}

function AdminAnnouncementCard({ notice }) {
	return (
		<article className="rounded-xl border border-indigo-500/20 bg-slate-900/90 p-5 space-y-3">
			<div className="flex min-w-0 items-start gap-3">
				<span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-indigo-500/30 bg-indigo-950/50 text-indigo-300">
					<ShieldCheck className="h-5 w-5" />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-300">
							Admin Announcement
						</span>
						<time className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] text-slate-400" dateTime={notice.published_at}>
							{new Date(notice.published_at).toLocaleDateString()}
						</time>
					</div>
					<h2 className="mt-2 text-sm font-semibold text-white">{notice.title}</h2>
					<p className="mt-0.5 text-[10px] text-slate-500">
						Publisher: <span className="text-slate-300">{notice.publisher || 'Placement Cell Administration'}</span>
					</p>
				</div>
			</div>

			<p className="text-xs leading-5 text-slate-300 whitespace-pre-wrap">{notice.message}</p>

			<div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
				<div className="flex items-center gap-2">
					<span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
						{notice.category}
					</span>
					<span
						className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
							notice.priority === 'High'
								? 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
								: 'bg-slate-800 text-slate-400'
						}`}
					>
						{notice.priority} Priority
					</span>
				</div>
				{notice.direct_link && (
					<a
						className="inline-flex items-center gap-1 text-xs font-medium text-indigo-300 hover:text-white"
						href={notice.direct_link}
						rel={/^https?:\/\//i.test(notice.direct_link) ? 'noreferrer' : undefined}
						target={/^https?:\/\//i.test(notice.direct_link) ? '_blank' : undefined}
					>
						View details <ArrowUpRight className="h-3.5 w-3.5" />
					</a>
				)}
			</div>
		</article>
	);
}

function RecruiterNoticeCard({ notice }) {
	return (
		<article className="rounded-xl border border-cyan-500/20 bg-slate-900/90 p-5 space-y-3">
			<div className="flex min-w-0 items-start gap-3">
				<span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-cyan-500/30 bg-cyan-950/50 text-cyan-300">
					{notice.logo_url ? (
						<img
							alt={`${notice.company_name} logo`}
							className="h-full w-full object-contain"
							loading="lazy"
							src={notice.logo_url}
						/>
					) : (
						<BriefcaseBusiness className="h-5 w-5" />
					)}
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cyan-300">
							{notice.company_name}
						</span>
						<time className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] text-slate-400" dateTime={notice.published_at}>
							{new Date(notice.published_at).toLocaleDateString()}
						</time>
					</div>
					<h2 className="mt-2 text-sm font-semibold text-white">{notice.title}</h2>
					<p className="mt-0.5 text-[10px] text-slate-500">
						Recruiter Update • <span className="text-slate-300">{notice.category}</span>
					</p>
				</div>
			</div>

			<p className="text-xs leading-5 text-slate-300 whitespace-pre-wrap">{notice.message}</p>

			<div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
				<div className="flex items-center gap-2">
					<span
						className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
							notice.priority === 'High'
								? 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
								: 'bg-slate-800 text-slate-400'
						}`}
					>
						{notice.priority} Priority
					</span>
				</div>
				{notice.direct_link && (
					<a
						className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-white"
						href={notice.direct_link}
					>
						View company opening <ArrowUpRight className="h-3.5 w-3.5" />
					</a>
				)}
			</div>
		</article>
	);
}

export default function StudentNotices() {
	const [searchParams, setSearchParams] = useSearchParams();
	const rawSection = searchParams.get('section');
	const section = ['announcements', 'admin', 'recruiter', 'deadlines'].includes(rawSection || '')
		? rawSection
		: 'announcements';

	const [feed, setFeed] = useState(null);
	const [announcements, setAnnouncements] = useState([]);
	const [adminAnnouncements, setAdminAnnouncements] = useState([]);
	const [recruiterNotices, setRecruiterNotices] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [retry, setRetry] = useState(0);
	const [now, setNow] = useState(Date.now());
	const [query, setQuery] = useState('');

	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 60000);
		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError('');

		const loadActiveFeed = async () => {
			try {
				if (section === 'deadlines') {
					const data = await fetchDeadlines();
					if (!cancelled) setFeed(data);
				} else if (section === 'admin') {
					const data = await fetchAdminAnnouncements();
					if (!cancelled) setAdminAnnouncements(data);
				} else if (section === 'recruiter') {
					const data = await fetchRecruiterAnnouncements();
					if (!cancelled) setRecruiterNotices(data);
				} else {
					// Placement announcements (default)
					const data = await fetchPlacementAnnouncements();
					if (!cancelled) setAnnouncements(data);
				}
			} catch (requestError) {
				if (!cancelled) setError(getApiError(requestError));
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		void loadActiveFeed();
		return () => {
			cancelled = true;
		};
	}, [section, retry]);

	const filteredDeadlines = useMemo(
		() =>
			(feed?.deadlines || []).filter((item) =>
				`${item.company} ${item.role_title} ${item.location}`
					.toLowerCase()
					.includes(query.trim().toLowerCase()),
			),
		[feed, query],
	);

	const filteredAdmin = useMemo(
		() =>
			adminAnnouncements.filter((item) =>
				`${item.title} ${item.message} ${item.category}`
					.toLowerCase()
					.includes(query.trim().toLowerCase()),
			),
		[adminAnnouncements, query],
	);

	const filteredRecruiter = useMemo(
		() =>
			recruiterNotices.filter((item) =>
				`${item.title} ${item.message} ${item.company_name} ${item.category}`
					.toLowerCase()
					.includes(query.trim().toLowerCase()),
			),
		[recruiterNotices, query],
	);

	const chooseSection = (next) => setSearchParams({ section: next });

	return (
		<div className="mx-auto max-w-7xl space-y-6">
			{/* Page Header */}
			<header>
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Placement cell</p>
				<h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Notices &amp; deadlines</h1>
				<p className="mt-2 text-sm text-slate-400">
					Official placement announcements, administrator notices, employer updates, and application deadlines.
				</p>
			</header>

			{/* Subsections Navigation Tabs */}
			<div className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
				<button
					aria-current={section === 'announcements' ? 'page' : undefined}
					className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium transition ${
						section === 'announcements'
							? 'bg-indigo-400/15 text-indigo-100 shadow-sm'
							: 'text-slate-400 hover:text-slate-200'
					}`}
					onClick={() => chooseSection('announcements')}
					type="button"
				>
					<Megaphone className="h-3.5 w-3.5" />
					Placement Announcements
				</button>
				<button
					aria-current={section === 'admin' ? 'page' : undefined}
					className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium transition ${
						section === 'admin'
							? 'bg-indigo-500/20 text-indigo-200 shadow-sm'
							: 'text-slate-400 hover:text-slate-200'
					}`}
					onClick={() => chooseSection('admin')}
					type="button"
				>
					<ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
					Admin
				</button>
				<button
					aria-current={section === 'recruiter' ? 'page' : undefined}
					className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium transition ${
						section === 'recruiter'
							? 'bg-cyan-400/15 text-cyan-100 shadow-sm'
							: 'text-slate-400 hover:text-slate-200'
					}`}
					onClick={() => chooseSection('recruiter')}
					type="button"
				>
					<BriefcaseBusiness className="h-3.5 w-3.5 text-cyan-400" />
					Recruiter / HR
				</button>
				<button
					aria-current={section === 'deadlines' ? 'page' : undefined}
					className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium transition ${
						section === 'deadlines'
							? 'bg-amber-300/10 text-amber-100 shadow-sm'
							: 'text-slate-400 hover:text-slate-200'
					}`}
					onClick={() => chooseSection('deadlines')}
					type="button"
				>
					<CalendarClock className="h-3.5 w-3.5 text-amber-400" />
					Drive deadlines
				</button>
			</div>

			{/* ==================================================================== */}
			{/* Subsection 1: Placement Announcements */}
			{/* ==================================================================== */}
			{section === 'announcements' && (
				<>
					{loading ? (
						<div className="flex min-h-40 items-center justify-center text-sm text-slate-400">
							<LoaderCircle className="mr-2 h-4 w-4 animate-spin text-cyan-300" />
							Loading live announcements...
						</div>
					) : error ? (
						<div className="rounded-xl border border-rose-300/15 bg-slate-900 p-5 text-xs text-rose-200">
							Could not load announcements: {error}
							<button
								className="ml-3 text-cyan-200 hover:underline"
								onClick={() => setRetry((value) => value + 1)}
								type="button"
							>
								Try again
							</button>
						</div>
					) : announcements.length ? (
						<div className="grid gap-4 lg:grid-cols-2">
							{announcements.map((notice) => (
								<AnnouncementCard key={notice.id} notice={notice} />
							))}
						</div>
					) : (
						<section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-5 py-12 text-center">
							<Megaphone className="mx-auto h-8 w-8 text-slate-600" />
							<h2 className="mt-4 text-sm font-semibold text-slate-200">No live announcements right now</h2>
							<p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
								New recruiter listings and scheduled drives will appear here automatically.
							</p>
							<button
								className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-amber-200 hover:underline"
								onClick={() => chooseSection('deadlines')}
								type="button"
							>
								View deadlines <ArrowUpRight className="h-3.5 w-3.5" />
							</button>
						</section>
					)}
				</>
			)}

			{/* ==================================================================== */}
			{/* Subsection 2: Admin Announcements */}
			{/* ==================================================================== */}
			{section === 'admin' && (
				<>
					{!loading && !error && adminAnnouncements.length > 0 && (
						<label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 sm:max-w-sm">
							<Search className="h-3.5 w-3.5 text-slate-500" />
							<input
								aria-label="Filter Admin announcements"
								className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Filter by title or topic..."
								value={query}
							/>
						</label>
					)}

					{loading ? (
						<div className="flex min-h-40 items-center justify-center text-sm text-slate-400">
							<LoaderCircle className="mr-2 h-4 w-4 animate-spin text-indigo-400" />
							Loading Admin announcements...
						</div>
					) : error ? (
						<div className="rounded-xl border border-rose-300/15 bg-slate-900 p-5 text-xs text-rose-200">
							Could not load Admin announcements: {error}
							<button
								className="ml-3 text-cyan-200 hover:underline"
								onClick={() => setRetry((value) => value + 1)}
								type="button"
							>
								Try again
							</button>
						</div>
					) : filteredAdmin.length ? (
						<div className="grid gap-4 lg:grid-cols-2">
							{filteredAdmin.map((notice) => (
								<AdminAnnouncementCard key={notice.id} notice={notice} />
							))}
						</div>
					) : (
						<section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-5 py-12 text-center">
							<ShieldCheck className="mx-auto h-8 w-8 text-slate-600" />
							<h2 className="mt-4 text-sm font-semibold text-slate-200">
								{query ? 'No Admin announcements match your search' : 'No Admin announcements have been published yet.'}
							</h2>
							<p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
								{query
									? 'Try another search term or clear the filter.'
									: 'Official institutional notices, policy updates, and placement cell guidelines will appear here once published by administrators.'}
							</p>
						</section>
					)}
				</>
			)}

			{/* ==================================================================== */}
			{/* Subsection 3: Recruiter / HR Announcements */}
			{/* ==================================================================== */}
			{section === 'recruiter' && (
				<>
					{!loading && !error && recruiterNotices.length > 0 && (
						<label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 sm:max-w-sm">
							<Search className="h-3.5 w-3.5 text-slate-500" />
							<input
								aria-label="Filter Recruiter announcements"
								className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Filter by company or role..."
								value={query}
							/>
						</label>
					)}

					{loading ? (
						<div className="flex min-h-40 items-center justify-center text-sm text-slate-400">
							<LoaderCircle className="mr-2 h-4 w-4 animate-spin text-cyan-400" />
							Loading Recruiter / HR announcements...
						</div>
					) : error ? (
						<div className="rounded-xl border border-rose-300/15 bg-slate-900 p-5 text-xs text-rose-200">
							Could not load Recruiter / HR announcements: {error}
							<button
								className="ml-3 text-cyan-200 hover:underline"
								onClick={() => setRetry((value) => value + 1)}
								type="button"
							>
								Try again
							</button>
						</div>
					) : filteredRecruiter.length ? (
						<div className="grid gap-4 lg:grid-cols-2">
							{filteredRecruiter.map((notice) => (
								<RecruiterNoticeCard key={notice.id} notice={notice} />
							))}
						</div>
					) : (
						<section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-5 py-12 text-center">
							<BriefcaseBusiness className="mx-auto h-8 w-8 text-slate-600" />
							<h2 className="mt-4 text-sm font-semibold text-slate-200">
								{query ? 'No recruiter announcements match your search' : 'No Recruiter / HR announcements have been published yet.'}
							</h2>
							<p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
								{query
									? 'Try another company name or keyword.'
									: 'Company updates, hiring drives, and recruitment notices from verified employers will appear here once published.'}
							</p>
						</section>
					)}
				</>
			)}

			{/* ==================================================================== */}
			{/* Subsection 4: Drive Deadlines */}
			{/* ==================================================================== */}
			{section === 'deadlines' && (
				<>
					<div className="flex flex-col justify-between gap-3 rounded-xl border border-amber-300/15 bg-gradient-to-r from-amber-300/[0.07] via-slate-900 to-slate-900 p-4 sm:flex-row sm:items-center sm:p-5">
						<div className="flex items-start gap-3">
							<span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-300/10 text-amber-200">
								<CalendarClock className="h-5 w-5" />
							</span>
							<div>
								<h2 className="text-sm font-semibold text-white">Registrations closing in the next 7 days</h2>
								<p className="mt-1 text-[10px] text-slate-400">
									Only active job and placement-drive deadlines from 1 to 7 days away appear here.
								</p>
							</div>
						</div>
						{feed && (
							<span className="w-fit rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[9px] text-slate-400">
								As of {new Date(feed.as_of).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
							</span>
						)}
					</div>

					{feed?.note && <p className="text-[10px] leading-5 text-slate-600">{feed.note}</p>}

					{!loading && !error && filteredDeadlines.length > 0 && (
						<label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 sm:max-w-sm">
							<Search className="h-3.5 w-3.5 text-slate-500" />
							<input
								aria-label="Filter deadlines"
								className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Filter by company or role"
								value={query}
							/>
						</label>
					)}

					{loading ? (
						<div className="flex min-h-44 items-center justify-center text-sm text-slate-400">
							<LoaderCircle className="mr-2 h-4 w-4 animate-spin text-amber-300" />
							Checking application deadlines...
						</div>
					) : error ? (
						<div className="rounded-xl border border-rose-300/15 bg-slate-900 p-5">
							<p className="text-xs text-rose-200">Could not load deadlines: {error}</p>
							<button
								className="mt-3 inline-flex items-center gap-2 text-xs text-cyan-300 hover:underline"
								onClick={() => setRetry((value) => value + 1)}
								type="button"
							>
								<RefreshCw className="h-3.5 w-3.5" />
								Try again
							</button>
						</div>
					) : filteredDeadlines.length === 0 ? (
						<div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-5 py-12 text-center">
							<CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300/70" />
							<h2 className="mt-4 text-sm font-semibold text-slate-200">
								{query ? 'No deadlines match your filter' : 'No registrations closing this week'}
							</h2>
							<p className="mt-2 text-xs text-slate-500">
								{query ? 'Try another company or role name.' : 'Only deadlines one to seven days away are shown here.'}
							</p>
						</div>
					) : (
						<div className="grid gap-4 lg:grid-cols-2">
							{filteredDeadlines.map((item) => (
								<DeadlineCard item={item} key={item.id} now={now} />
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}
