import { NavLink } from 'react-router-dom';
import { Activity, BriefcaseBusiness, MessageSquareText, ShieldAlert, Users, Video, FileText, Megaphone, ChartNoAxesCombined, Building2 } from 'lucide-react';

const items = [
	{ label: 'Command Center', to: '/recruiter/command', icon: Activity },
	{ label: 'Community Leaderboard', to: '/recruiter/community', icon: Users },
	{ label: 'Jobs & Internships', to: '/recruiter/jobs', icon: BriefcaseBusiness },
	{ label: 'Applicants', to: '/recruiter/applicants', icon: Users }, { label: 'Interviews', to: '/recruiter/interviews', icon: Video },
	{ label: 'Offers', to: '/recruiter/offers', icon: FileText }, { label: 'Notices', to: '/recruiter/notices', icon: Megaphone },
	{ label: 'Analytics', to: '/recruiter/analytics', icon: ChartNoAxesCombined }, { label: 'Company Profile', to: '/recruiter/profile', icon: Building2 },
	{ label: 'Messages', to: '/recruiter/messages', icon: MessageSquareText },
	{ label: 'Conflict Resolver', to: '/recruiter/conflicts', icon: ShieldAlert },
];

export default function RecruiterSidebar() {
	return <div><div className="mb-4 hidden px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 lg:block">Recruiter Portal</div><nav aria-label="Recruiter portal" className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">{items.map(({ label, to, icon: Icon }) => to ? <NavLink key={label} to={to} className={({ isActive }) => `inline-flex min-h-10 min-w-0 items-center gap-2 rounded-lg px-2.5 text-base transition ${isActive ? 'bg-indigo-400/10 text-cyan-100 ring-1 ring-indigo-300/10' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}><Icon aria-hidden="true" className="h-4 w-4 shrink-0"/><span className="truncate">{label}</span></NavLink> : <div aria-label={`${label}, coming next`} className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-lg px-2.5 text-base text-slate-600" key={label}><Icon aria-hidden="true" className="h-4 w-4 shrink-0"/><span className="min-w-0 flex-1 truncate">{label}</span><span className="hidden text-[9px] uppercase tracking-wide sm:inline">Soon</span></div>)}</nav></div>;
}
