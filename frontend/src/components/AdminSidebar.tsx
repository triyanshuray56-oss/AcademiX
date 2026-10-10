import { NavLink } from 'react-router-dom';
import {
	BarChart3,
	Building2,
	BriefcaseBusiness,
	ClipboardList,
	GraduationCap,
	LockKeyhole,
	LayoutDashboard,
	Megaphone,
	MessageSquareText,
	Network,
	ShieldAlert,
	ShieldCheck,
	Sliders,
	Users,
	Compass,
	Database,
	Eye,
	FileSpreadsheet,
	LifeBuoy,
	Radio,
} from 'lucide-react';

const groups = [
	{
		label: 'Workspace',
		items: [
			{ label: 'Community Leaderboard', to: '/community', icon: Users },
			{ label: 'Command dashboard', to: '/admin/command', icon: LayoutDashboard },
			{ label: 'Conflict resolver', to: '/admin/conflicts', icon: ShieldAlert },
			{ label: 'Messages', to: '/admin/messages', icon: MessageSquareText },
		],
	},
	{
		label: 'People & Access',
		items: [
			{ label: 'User & Role Management', to: '/admin/users', icon: LockKeyhole },
			{ label: 'Student Management', to: '/admin/students', icon: GraduationCap },
			{ label: 'Faculty & Placement Officer Management', to: '/admin/faculty', icon: Users },
			{ label: 'Recruiter & Company Management', to: '/admin/recruiters', icon: Building2 },
		],
	},
	{
		label: 'Placement Operations',
		items: [
			{ label: 'Placement Drives & Scheduling', to: '/admin/operations/drives', icon: BriefcaseBusiness },
			{ label: 'Application & Placement Tracking', to: '/admin/operations/applications', icon: ClipboardList },
			{ label: 'Eligibility & Verification', to: '/admin/operations/eligibility', icon: ShieldAlert },
			{ label: 'Department & Branch Management', to: '/admin/operations/organization', icon: Network },
		],
	},
	{
		label: 'Governance & Analytics',
		items: [
			{ label: 'Announcements & Notices', to: '/admin/announcements', icon: Megaphone },
			{ label: 'Reports & Data Export', to: '/admin/reports', icon: BarChart3 },
			{ label: 'Audit Logs & Security', to: '/admin/audit', icon: ShieldCheck },
			{ label: 'System Settings & Integrations', to: '/admin/settings', icon: Sliders },
		],
	},
	{
		label: 'Oversight & Operations',
		items: [
			{ label: 'Attendance & Assessment', to: '/admin/oversight', icon: Eye },
			{ label: 'Grievances & Support', to: '/admin/grievances', icon: LifeBuoy },
			{ label: 'Data Import & Quality', to: '/admin/imports', icon: FileSpreadsheet },
			{ label: 'Backup & Recovery', to: '/admin/backups', icon: Database },
			{ label: 'Notification Monitoring', to: '/admin/notifications', icon: Radio },
			{ label: 'Policy & Eligibility Rules', to: '/admin/policies', icon: Compass },
		],
	},
];

export default function AdminSidebar() {
	return (
		<nav aria-label="Admin portal" className="space-y-5">
			{groups.map((group) => (
				<section key={group.label}>
					<h2 className="mb-2 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 lg:block">
						{group.label}
					</h2>
					<div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
						{group.items.map(({ label, to, icon: Icon }) => (
							<NavLink
								className={({ isActive }) => `${to === '/community' ? 'inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-3 text-xs font-medium sm:text-sm' : 'inline-flex min-h-10 min-w-0 items-center gap-2 rounded-lg px-2.5 text-xs transition sm:gap-3 sm:px-3 sm:text-sm'} ${isActive ? 'bg-indigo-400/10 text-cyan-100 ring-1 ring-indigo-300/10' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
								end
								key={to}
								to={to}
							>
								<Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
								<span className="min-w-0 truncate">{label}</span>
							</NavLink>
						))}
					</div>
				</section>
			))}
		</nav>
	);
}
