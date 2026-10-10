import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Activity, AlertTriangle, Bell, BellRing, BookOpen, BriefcaseBusiness, CalendarClock, ChartNoAxesCombined, Check, ChevronDown, Code2, FileText, GraduationCap, LayoutDashboard, LogOut, Megaphone, MessageSquareText, ShieldAlert, ShieldCheck, Sparkles, UserRound, Users, Video, X } from 'lucide-react';
import AuthPages from './pages/AuthPages';
import CommandDashboard from './components/CommandDashboard';
import ConflictResolver from './components/ConflictResolver';
import StudentPortal from './components/StudentPortal';
import api from './api/http';
import { ProfileAvatar } from './components/ProfilePicture';
import AIChatWidget from './components/AIChatWidget';
import ApplicationAnalysis from './components/ApplicationAnalysis';
import CodingCompetition from './pages/CodingCompetition';
import CodingPractice from './pages/CodingPractice';
import StudentRecruiterJobs from './pages/StudentRecruiterJobs';
import StudentRecruiterInternships from './pages/StudentRecruiterInternships';
import Landing from './pages/Landing';
import StudentCourses from './pages/StudentCourses';
import MobileCameraStream from './pages/MobileCameraStream';
import CommunityLeaderboard from './pages/CommunityLeaderboard';
import StudentMessages from './pages/StudentMessages';
import StaffMessages from './pages/StaffMessages';
import RecruiterSidebar from './components/RecruiterSidebar';
import AdminSidebar from './components/AdminSidebar';
import CoreManagement from './pages/admin/CoreManagement';
import PlacementOperations from './pages/admin/PlacementOperations';
import NotificationCenter from './pages/admin/NotificationCenter';
import Analytics from './pages/admin/Analytics';
import AuditLog from './pages/admin/AuditLog';
import SystemSettings from './pages/admin/SystemSettings';
import AttendanceOversight from './pages/admin/AttendanceOversight';
import GrievanceManagement from './pages/admin/GrievanceManagement';
import DataQualityImport from './pages/admin/DataQualityImport';
import BackupRecovery from './pages/admin/BackupRecovery';
import NotificationMonitoring from './pages/admin/NotificationMonitoring';
import EligibilityRules from './pages/admin/EligibilityRules';
import RecruiterJobs from './pages/recruiter/RecruiterJobs';
import RecruiterApplicants from './pages/recruiter/RecruiterApplicants';
import RecruiterInterviews from './pages/recruiter/RecruiterInterviews';
import RecruiterOffers from './pages/recruiter/RecruiterOffers';
import RecruiterAnalytics from './pages/recruiter/RecruiterAnalytics';
import RecruiterProfile from './pages/recruiter/RecruiterProfile';
import RecruiterNotices from './pages/recruiter/RecruiterNotices';
import RecruiterCommunity from './pages/recruiter/RecruiterCommunity';

const ROLE_HOME = {
	student: '/student/dashboard',
	recruiter: '/recruiter/command',
	admin: '/admin/command',
};

const CONFLICTS_HOME = {
	recruiter: '/recruiter/conflicts',
	admin: '/admin/conflicts',
};

const STUDENT_NAVIGATION = [
	{ id: 'profile', label: 'My Profile', icon: UserRound, children: [
		{ view: 'profile', label: 'Basic details', to: '/student/profile?section=basics' },
		{ view: 'profile', label: 'Internship / Work Experience', to: '/student/profile?section=experience' },
		{ view: 'profile', label: 'Projects', to: '/student/profile?section=projects' },
		{ view: 'profile', label: 'Positions of Responsibility', to: '/student/profile?section=responsibilities' },
		{ view: 'profile', label: 'Accomplishments', to: '/student/profile?section=accomplishments' },
		{ view: 'profile', label: 'Volunteering', to: '/student/profile?section=volunteering' },
		{ view: 'profile', label: 'Extracurriculars', to: '/student/profile?section=extracurriculars' },
		{ view: 'profile', label: 'Profile picture', to: '/student/profile?section=profile-picture' },
		{ view: 'profile', label: 'Documents', to: '/student/profile?section=documents' },
	] },
	{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, children: [{ view: 'dashboard', label: 'Overview', to: '/student/dashboard' }] },
	{ id: 'jobs', label: 'Jobs', icon: BriefcaseBusiness, children: [
		{ view: 'jobs', label: 'Full-time opportunities', to: '/student/jobs' },
		{ view: 'internships', label: 'Internship opportunities', to: '/student/internships' },
		{ view: 'application-analysis', label: 'Application Analysis', to: '/student/application-analysis' },
		{ label: 'Recruiters', children: [
			{ view: 'recruiter-jobs', label: 'Jobs', to: '/student/jobs/recruiter-jobs' },
			{ view: 'recruiter-internships', label: 'Internships', to: '/student/jobs/recruiter-internships' },
		] },
	] },
	{ id: 'growth', label: 'Growth', icon: ChartNoAxesCombined, children: [
		{ view: 'growth', label: 'Progress & readiness', to: '/student/growth' },
		{ view: 'compatibility', label: 'Job compatibility', to: '/student/compatibility' },
	] },
	{ id: 'courses', label: 'Courses', icon: BookOpen, children: [
		{ view: 'courses', label: 'Learning catalog', to: '/student/courses' },
	] },
	{ id: 'interviews', label: 'Interviews', icon: MessageSquareText, children: [
		{ view: 'interviews', label: 'Interview schedule', to: '/student/interviews' },
		{ view: 'mock-tests', label: 'Mock Tests & Interviews', to: '/student/mock-tests' },
	] },
	{ id: 'messages', label: 'Messages', icon: MessageSquareText, children: [
		{ view: 'messages', label: 'Admin', to: '/student/messages/admin' },
		{ view: 'messages', label: 'HR / Recruiter', to: '/student/messages/recruiter' },
		{ view: 'messages', label: 'Requests', to: '/student/messages/requests' },
	] },
	{ id: 'coding', label: 'Competitive Coding', icon: Code2, children: [
		{ view: 'coding-practice', label: 'Practice', to: '/student/coding/practice' },
		{ view: 'coding-competition', label: 'Competition', to: '/student/coding/competition' },
	] },
	{ id: 'notices', label: 'Notices & deadlines', icon: Megaphone, children: [
		{ view: 'notices', label: 'Placement Announcements', to: '/student/notices?section=announcements' },
		{ view: 'notices', label: 'Admin', to: '/student/notices?section=admin' },
		{ view: 'notices', label: 'Recruiter / HR', to: '/student/notices?section=recruiter' },
		{ view: 'notices', label: 'Drive deadlines', to: '/student/notices?section=deadlines' },
	] },
];
const STUDENT_VIEWS = new Set(STUDENT_NAVIGATION.flatMap((group) => group.children.map((child) => child.view)));

function relativeTime(dateValue) {
	if (!dateValue) return 'Just now';
	const hours = Math.round((new Date(dateValue).getTime() - Date.now()) / 3600000);
	if (hours < 0) return 'Just now';
	if (hours < 24) return `In ${hours}h`;
	return `In ${Math.ceil(hours / 24)}d`;
}

function NotificationBell({ role, email }) {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [items, setItems] = useState([]);
	const storageKey = `campuslink_notifications:${email}`;
	const [readIds, setReadIds] = useState(() => {
		try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
	});
	const unreadCount = items.filter((item) => !readIds.includes(item.id)).length;

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		Promise.allSettled([
			api.get('/drives'),
			role === 'student' ? Promise.resolve(null) : api.get('/dashboard/analytics'),
		])
			.then(([drivesResult, analyticsResult]) => {
				if (cancelled) return;
				const nextItems = [];
				const drives = drivesResult.status === 'fulfilled' ? drivesResult.value?.data?.drives || [] : [];
				const conflicts = drivesResult.status === 'fulfilled' ? drivesResult.value?.data?.conflicts || [] : [];
				for (const conflict of conflicts) {
					const companies = conflict.drive_ids.map((driveId) => drives.find((drive) => drive.id === driveId)?.company_name).filter(Boolean);
					nextItems.push({ id: `conflict-${conflict.drive_ids.join('-')}`, kind: 'conflict', title: 'Drive schedule conflict', detail: `${companies.join(' / ') || 'Placement drives'} need review.`, time: `Detected ${new Date().toLocaleString()}`, route: role === 'student' ? '/student/jobs' : CONFLICTS_HOME[role], icon: AlertTriangle });
				}
				for (const drive of drives) {
					if (drive.status === 'Completed') continue;
					const hoursUntil = (new Date(drive.drive_date).getTime() - Date.now()) / 3600000;
					if (hoursUntil < 0 || hoursUntil > 24 * 14) continue;
					nextItems.push({ id: `drive-${drive.id}`, kind: 'deadline', title: `${drive.company_name} drive approaching`, detail: `${drive.venue} · ${new Date(drive.drive_date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`, time: relativeTime(drive.drive_date), route: role === 'student' ? '/student/jobs' : CONFLICTS_HOME[role], icon: CalendarClock });
				}
				if (role !== 'student' && analyticsResult.status === 'fulfilled') {
					const atRisk = analyticsResult.value?.data?.at_risk_unplaced_count || 0;
					if (atRisk > 0) nextItems.push({ id: 'at-risk-students', kind: 'action', title: 'At-risk students need review', detail: `${atRisk} unplaced student(s) have readiness below 50.`, time: `Updated ${new Date().toLocaleString()}`, route: ROLE_HOME[role], icon: AlertTriangle });
				}
				setItems(nextItems);
			})
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [role, email]);

	const markRead = (id) => {
		setReadIds((current) => {
			const next = current.includes(id) ? current : [...current, id];
			localStorage.setItem(storageKey, JSON.stringify(next));
			return next;
		});
	};
	const markAllRead = () => {
		const next = items.map((item) => item.id);
		setReadIds(next);
		localStorage.setItem(storageKey, JSON.stringify(next));
	};

	return (
		<div className="relative">
			<button aria-expanded={open} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} className={`notification-bell relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-500 text-amber-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-200/80 ${unreadCount > 0 ? 'has-unread' : ''}`} onClick={() => setOpen((value) => !value)} type="button">
				{unreadCount > 0 ? <BellRing aria-hidden="true" className="notification-bell-icon h-5 w-5" /> : <Bell aria-hidden="true" className="notification-bell-icon h-5 w-5" />}
				{unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-slate-950 bg-rose-500 px-1 text-[9px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
			</button>
			{open && <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
				<div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><div><p className="text-sm font-semibold text-white">Notifications</p><p className="mt-0.5 text-[10px] text-slate-500">{unreadCount ? `${unreadCount} unread updates` : 'All caught up'}</p></div><div className="flex items-center gap-2">{unreadCount > 0 && <button className="text-[10px] font-medium text-cyan-300 hover:text-white" onClick={markAllRead} type="button">Mark all read</button>}<button aria-label="Close notifications" className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-white" onClick={() => setOpen(false)} type="button"><X aria-hidden="true" className="h-4 w-4" /></button></div></div>
				<div className="max-h-[min(65vh,28rem)] overflow-y-auto">{loading ? <p className="p-5 text-center text-xs text-slate-500">Checking deadlines and actions...</p> : items.length === 0 ? <p className="p-5 text-center text-xs text-slate-500">No new notifications.</p> : items.map((item) => { const Icon = item.icon; const unread = !readIds.includes(item.id); return <Link className={`flex gap-3 border-b border-slate-800/80 px-4 py-3 transition hover:bg-slate-800/70 ${unread ? 'bg-indigo-400/[0.04]' : ''}`} key={item.id} onClick={() => { markRead(item.id); setOpen(false); }} to={item.route}><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.kind === 'conflict' ? 'bg-rose-400/10 text-rose-200' : item.kind === 'deadline' ? 'bg-amber-300/10 text-amber-200' : 'bg-indigo-300/10 text-indigo-200'}`}><Icon aria-hidden="true" className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="text-xs font-semibold text-slate-100">{item.title}</span>{unread && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />}</span><span className="mt-1 block text-[11px] leading-4 text-slate-400">{item.detail}</span><span className="mt-1.5 block text-[10px] text-slate-600">{item.time}</span></span><Check aria-hidden="true" className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${unread ? 'text-slate-700' : 'text-emerald-300'}`} /></Link>; })}</div>
				<div className="border-t border-slate-800 px-4 py-2.5 text-[10px] text-slate-600">Alerts are generated from active drives and placement analytics.</div>
			</div>}
		</div>
	);
}

function readSession() {
	const accessToken = localStorage.getItem('access_token');
	const role = localStorage.getItem('role');
	const email = localStorage.getItem('email');
	return accessToken && role && email ? { access_token: accessToken, role, email } : null;
}

function AppShell({ session, onLogout }) {
	const location = useLocation();
	const [studentPictureUrl, setStudentPictureUrl] = useState(null);
	const activeStudentGroup = session.role === 'student'
		? STUDENT_NAVIGATION.find((group) => group.children.some((child) => child.to?.split('?')[0] === location.pathname || child.children?.some((nested) => nested.to === location.pathname)))?.id
		: undefined;
	const [openStudentGroup, setOpenStudentGroup] = useState(activeStudentGroup || 'profile');
	const navigation = session.role === 'student'
		? []
		: [
			{ to: ROLE_HOME[session.role], label: 'Command dashboard', icon: LayoutDashboard },
			{ to: CONFLICTS_HOME[session.role], label: 'Conflict resolver', icon: ShieldAlert },
			{ to: `/${session.role}/messages`, label: 'Messages', icon: MessageSquareText },
		];

	useEffect(() => {
		if (session.role !== 'student') return undefined;
		let cancelled = false;
		const updateFromProfile = (event) => setStudentPictureUrl(event.detail?.url || null);
		window.addEventListener('campuslink:profile-picture-updated', updateFromProfile);
		api.get('/students/me')
			.then(({ data }) => { if (!cancelled) setStudentPictureUrl(data.profile_picture_url || null); })
			.catch(() => { if (!cancelled) setStudentPictureUrl(null); });
		return () => {
			cancelled = true;
			window.removeEventListener('campuslink:profile-picture-updated', updateFromProfile);
		};
	}, [session.email, session.role]);

	useEffect(() => {
		if (activeStudentGroup) setOpenStudentGroup(activeStudentGroup);
	}, [activeStudentGroup]);

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100">
			<header className="sticky top-0 z-20 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl">
				<div className="mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
					<Link className="flex items-center gap-3" to={ROLE_HOME[session.role] || '/'}>
						<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 text-white"><Activity aria-hidden="true" className="h-5 w-5" /></span>
						<span><span className="block text-sm font-semibold text-white">CampusLink</span><span className="block text-[10px] uppercase tracking-[0.15em] text-slate-500">BPUT Placement Network</span></span>
					</Link>
					<div className="flex items-center gap-3">
						<NotificationBell email={session.email} role={session.role} />
						{session.role === 'student' && <ProfileAvatar name={session.email} pictureUrl={studentPictureUrl} size="sm" />}
						<div className="hidden text-right sm:block"><p className="max-w-56 truncate text-xs text-slate-300">{session.email}</p><p className="text-[10px] uppercase tracking-wider text-cyan-300">{session.role}</p></div>
						<button className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-300 transition hover:border-rose-400/40 hover:bg-rose-400/5 hover:text-rose-200" onClick={onLogout} type="button"><LogOut aria-hidden="true" className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></button>
					</div>
				</div>
			</header>
			<div className="flex w-full min-w-0 flex-col lg:flex-row">
				<aside className="w-full min-w-0 border-b border-slate-800 bg-slate-900/60 px-4 py-3 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-[232px] lg:shrink-0 lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r lg:px-4 lg:py-7">
					{session.role === 'admin' ? <AdminSidebar /> : session.role === 'recruiter' ? <RecruiterSidebar /> : <><div className="mb-4 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 lg:block">Workspace</div>
					<nav aria-label="Primary navigation" className={`grid w-full gap-1.5 ${session.role === 'student' ? '' : 'grid-cols-2 lg:grid-cols-1'}`}>
						<NavLink className={({ isActive }) => `inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-3 text-xs font-medium transition sm:text-sm ${isActive ? 'bg-indigo-400/10 text-cyan-100 ring-1 ring-indigo-300/20' : 'text-slate-300 hover:bg-slate-800/80'}`} to="/community"><Users aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-300" /><span className="truncate">Community Leaderboard</span></NavLink>
		{session.role === 'student' ? STUDENT_NAVIGATION.map(({ id, label, icon: Icon, children }) => {
			const expanded = openStudentGroup === id;
			const active = children.some((child) => `${location.pathname}${location.search}` === child.to || child.children?.some((nested) => location.pathname === nested.to));
			if (id === 'courses') return <NavLink aria-current={active ? 'page' : undefined} className={`flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-3 text-left text-xs font-medium transition sm:text-sm ${active ? 'bg-indigo-400/10 text-cyan-100 ring-1 ring-indigo-300/20 shadow-[0_0_18px_rgba(99,102,241,0.10)]' : 'text-slate-300 hover:bg-slate-800/80'}`} key={id} to="/student/courses"><Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-300" /><span className="min-w-0 flex-1 truncate">{label}</span></NavLink>;
			return <div className="min-w-0 rounded-lg" key={id}>
				<button aria-expanded={expanded} className={`flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-3 text-left text-xs font-medium transition sm:text-sm ${active ? 'bg-indigo-400/10 text-cyan-100 ring-1 ring-indigo-300/20 shadow-[0_0_18px_rgba(99,102,241,0.10)]' : 'text-slate-300 hover:bg-slate-800/80'}`} onClick={() => setOpenStudentGroup(expanded ? '' : id)} type="button"><Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-300" /><span className="min-w-0 flex-1 truncate">{label}</span><ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform duration-300 ${expanded ? 'rotate-180 text-cyan-200' : 'text-slate-500'}`} /></button>
								<div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}><div className="overflow-hidden"><div className="ml-4 mt-1 space-y-1 border-l border-indigo-300/15 pl-3">{children.map((child) => {
									if (child.children) return <div className="py-1" key={child.label}><p className="px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">{child.label}</p><div className="space-y-1">{child.children.map((nested) => {
										const nestedActive = location.pathname === nested.to;
										return <Link aria-current={nestedActive ? 'page' : undefined} className={`block rounded-md border-l-2 px-3 py-2 text-[11px] leading-4 transition sm:text-xs ${nestedActive ? '-ml-[14px] border-cyan-300 bg-indigo-400/10 font-medium text-cyan-100 shadow-[0_0_16px_rgba(99,102,241,0.12)]' : 'border-transparent text-slate-500 hover:bg-slate-800/60 hover:text-slate-200'}`} key={nested.to} to={nested.to}>{nested.label}</Link>;
										})}</div></div>;
									const childActive = `${location.pathname}${location.search}` === child.to || (!location.search && child.to === location.pathname);
										return <Link aria-current={childActive ? 'page' : undefined} className={`block rounded-md border-l-2 px-3 py-2 text-[11px] leading-4 transition sm:text-xs ${childActive ? '-ml-[14px] border-cyan-300 bg-indigo-400/10 font-medium text-cyan-100 shadow-[0_0_16px_rgba(99,102,241,0.12)]' : 'border-transparent text-slate-500 hover:bg-slate-800/60 hover:text-slate-200'}`} key={child.to} to={child.to}>{child.label}</Link>;
									})}</div></div></div>
							</div>;
						}) : navigation.map(({ to, label, icon: Icon }) => (
							<NavLink className={({ isActive }) => `inline-flex min-h-10 min-w-0 items-center gap-2 rounded-lg px-2.5 text-xs transition sm:gap-3 sm:px-3 sm:text-sm ${isActive || location.pathname === to ? 'bg-indigo-400/10 text-cyan-100 ring-1 ring-indigo-300/10' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`} key={to} to={to}>
								<Icon aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span>
							</NavLink>
						))}
					</nav></>}
					{session.role === 'student' && <div className="mt-6 hidden rounded-xl border border-indigo-300/15 bg-indigo-300/[0.04] p-4 lg:block"><p className="flex items-center gap-2 text-xs font-semibold text-indigo-100"><CalendarClock aria-hidden="true" className="h-4 w-4 text-amber-300" />Placement deadlines</p><p className="mt-2 text-xs leading-5 text-slate-500">Upcoming drive dates and urgent placement alerts appear in the notification bell.</p></div>}
					<div className="mt-8 hidden rounded-xl border border-slate-800 bg-slate-950/50 p-4 lg:block"><div className="flex items-center gap-2 text-xs font-medium text-slate-300"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-300" />Session protected</div><p className="mt-2 text-xs leading-5 text-slate-500">Your workspace is connected to the local CampusLink API.</p></div>
				</aside>
				<main className={`w-full min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-9 ${session.role === 'recruiter' ? 'recruiter-readable' : ''}`}><Outlet /></main>
			</div>
			<AIChatWidget userRole={session.role} />
		</div>
	);
}

function Protected({ session, roles, children }) {
	if (!session) return <Navigate replace to="/login" />;
	if (roles && !roles.includes(session.role)) return <Navigate replace to={ROLE_HOME[session.role] || '/login'} />;
	return children;
}

function AppRoutes() {
	const navigate = useNavigate();
	const location = useLocation();
	const [session, setSession] = useState(readSession);

	const logout = useCallback(() => {
		localStorage.removeItem('access_token');
		localStorage.removeItem('role');
		localStorage.removeItem('email');
		setSession(null);
		navigate('/login', { replace: true });
	}, [navigate]);

	useEffect(() => {
		const handleUnauthorized = () => logout();
		window.addEventListener('campuslink:unauthorized', handleUnauthorized);
		return () => window.removeEventListener('campuslink:unauthorized', handleUnauthorized);
	}, [logout]);

	useEffect(() => {
		if (!session?.access_token) return undefined;
		let cancelled = false;
		api.get('/auth/me')
			.then(({ data }) => {
				if (!cancelled && (data.email !== session.email || data.role !== session.role || !data.is_active)) logout();
			})
			.catch(() => { if (!cancelled) logout(); });
		return () => { cancelled = true; };
	}, [session?.access_token, session?.email, session?.role, logout]);

	const handleAuthenticated = (nextSession) => {
		setSession(nextSession);
		navigate(ROLE_HOME[nextSession.role] || '/', { replace: true });
	};

	return (
		<Routes>
			<Route path="/" element={<Landing session={session} />} />
			<Route path="/login" element={session ? <Navigate replace to={ROLE_HOME[session.role] || '/'} /> : <AuthPages initialRole={location.state?.role} initialView={location.state?.view || 'login'} onAuthenticated={handleAuthenticated} />} />
			<Route path="/proctor/mobile-stream" element={<MobileCameraStream />} />
			<Route element={<Protected session={session}><AppShell onLogout={logout} session={session} /></Protected>}>
				<Route path="/community" element={<CommunityLeaderboard />} />
				<Route path="/student/coding/practice" element={<Protected session={session} roles={['student']}><CodingPractice /></Protected>} />
				<Route path="/student/coding/competition" element={<Protected session={session} roles={['student']}><CodingCompetition /></Protected>} />
				<Route path="/student/application-analysis" element={<Protected session={session} roles={['student']}><ApplicationAnalysis /></Protected>} />
				<Route path="/student/courses" element={<Protected session={session} roles={['student']}><StudentCourses /></Protected>} />
				<Route path="/student/jobs/recruiter-jobs" element={<Protected session={session} roles={['student']}><StudentRecruiterJobs /></Protected>} />
				<Route path="/student/jobs/recruiter-internships" element={<Protected session={session} roles={['student']}><StudentRecruiterInternships /></Protected>} />
				<Route path="/student/messages/:section" element={<Protected session={session} roles={['student']}><StudentMessages session={session} /></Protected>} />
				<Route path="/student/:view" element={<Protected session={session} roles={['student']}><StudentPortalRoute session={session} /></Protected>} />
				<Route path="/admin/command" element={<Protected session={session} roles={['admin']}><CommandDashboard session={session} /></Protected>} />
				<Route path="/admin/messages" element={<Protected session={session} roles={['admin']}><StaffMessages session={session} /></Protected>} />
				<Route path="/admin/conflicts" element={<Protected session={session} roles={['admin']}><ConflictResolver /></Protected>} />
				<Route path="/admin/users" element={<Protected session={session} roles={['admin']}><CoreManagement section="users" /></Protected>} />
				<Route path="/admin/students" element={<Protected session={session} roles={['admin']}><CoreManagement section="students" /></Protected>} />
				<Route path="/admin/faculty" element={<Protected session={session} roles={['admin']}><CoreManagement section="faculty" /></Protected>} />
				<Route path="/admin/recruiters" element={<Protected session={session} roles={['admin']}><CoreManagement section="recruiters" /></Protected>} />
				<Route path="/admin/operations/drives" element={<Protected session={session} roles={['admin']}><PlacementOperations section="drives" /></Protected>} />
				<Route path="/admin/operations/applications" element={<Protected session={session} roles={['admin']}><PlacementOperations section="applications" /></Protected>} />
				<Route path="/admin/operations/eligibility" element={<Protected session={session} roles={['admin']}><PlacementOperations section="eligibility" /></Protected>} />
				<Route path="/admin/operations/organization" element={<Protected session={session} roles={['admin']}><PlacementOperations section="organization" /></Protected>} />
				<Route path="/admin/announcements" element={<Protected session={session} roles={['admin']}><NotificationCenter /></Protected>} />
				<Route path="/admin/notices" element={<Navigate replace to="/admin/announcements" />} />
				<Route path="/admin/reports" element={<Protected session={session} roles={['admin']}><Analytics /></Protected>} />
				<Route path="/admin/analytics" element={<Navigate replace to="/admin/reports" />} />
				<Route path="/admin/audit" element={<Protected session={session} roles={['admin']}><AuditLog /></Protected>} />
				<Route path="/admin/settings" element={<Protected session={session} roles={['admin']}><SystemSettings /></Protected>} />
				<Route path="/admin/oversight" element={<Protected session={session} roles={['admin']}><AttendanceOversight /></Protected>} />
				<Route path="/admin/grievances" element={<Protected session={session} roles={['admin']}><GrievanceManagement /></Protected>} />
				<Route path="/admin/imports" element={<Protected session={session} roles={['admin']}><DataQualityImport /></Protected>} />
				<Route path="/admin/backups" element={<Protected session={session} roles={['admin']}><BackupRecovery /></Protected>} />
				<Route path="/admin/notifications" element={<Protected session={session} roles={['admin']}><NotificationMonitoring /></Protected>} />
				<Route path="/admin/policies" element={<Protected session={session} roles={['admin']}><EligibilityRules /></Protected>} />
				<Route path="/recruiter/command" element={<Protected session={session} roles={['recruiter']}><CommandDashboard session={session} /></Protected>} />
				<Route path="/recruiter/community" element={<Protected session={session} roles={['recruiter']}><RecruiterCommunity recruiterEmail={session?.email} /></Protected>} />
				<Route path="/recruiter/jobs" element={<Protected session={session} roles={['recruiter']}><RecruiterJobs /></Protected>} />
				<Route path="/recruiter/applicants" element={<Protected session={session} roles={['recruiter']}><RecruiterApplicants /></Protected>} />
				<Route path="/recruiter/interviews" element={<Protected session={session} roles={['recruiter']}><RecruiterInterviews /></Protected>} />
				<Route path="/recruiter/offers" element={<Protected session={session} roles={['recruiter']}><RecruiterOffers /></Protected>} />
				<Route path="/recruiter/analytics" element={<Protected session={session} roles={['recruiter']}><RecruiterAnalytics /></Protected>} />
				<Route path="/recruiter/profile" element={<Protected session={session} roles={['recruiter']}><RecruiterProfile onLogout={logout} /></Protected>} />
				<Route path="/recruiter/notices" element={<Protected session={session} roles={['recruiter']}><RecruiterNotices /></Protected>} />
				<Route path="/recruiter/messages" element={<Protected session={session} roles={['recruiter']}><StaffMessages session={session} /></Protected>} />
				<Route path="/recruiter/conflicts" element={<Protected session={session} roles={['recruiter']}><ConflictResolver fullWidth /></Protected>} />
			</Route>
			<Route path="*" element={<Navigate replace to={session ? ROLE_HOME[session.role] || '/login' : '/login'} />} />
		</Routes>
	);
}

export default function App() {
	return <BrowserRouter><AppRoutes /></BrowserRouter>;
}

function StudentPortalRoute({ session }) {
	const { view } = useParams();
	if (!STUDENT_VIEWS.has(view)) {
		return <Navigate replace to="/student/dashboard" />;
	}
	return <StudentPortal key={view} session={session} view={view} />;
}
