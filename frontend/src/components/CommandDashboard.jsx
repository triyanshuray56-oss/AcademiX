import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	Activity,
	ArrowUpRight,
	Award,
	BarChart3,
	BriefcaseBusiness,
	Building2,
	CircleDollarSign,
	LoaderCircle,
	Play,
	RefreshCw,
	TriangleAlert,
	Users,
} from 'lucide-react';
import api, { getApiError } from '../api/http';
import CandidateModal from './CandidateModal';

const STATUS_STYLES = {
	Placed: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
	'In-Progress': 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
	Pending: 'border-slate-700 bg-slate-800/70 text-slate-400',
};

function MetricCard({ icon: Icon, label, value, footnote, tone = 'cyan' }) {
	const tones = {
		cyan: 'bg-cyan-300/10 text-cyan-200',
		indigo: 'bg-indigo-300/10 text-indigo-200',
		green: 'bg-emerald-300/10 text-emerald-200',
		amber: 'bg-amber-300/10 text-amber-200',
	};
	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
			<div className="flex items-start justify-between gap-3"><p className="text-xs font-medium text-slate-500">{label}</p><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}><Icon aria-hidden="true" className="h-4 w-4" /></span></div>
			<p className="mt-4 text-3xl font-semibold tabular-nums text-white">{value}</p>
			<p className="mt-1 text-xs text-slate-500">{footnote}</p>
		</div>
	);
}

function Panel({ icon: Icon, title, eyebrow, children, className = '' }) {
	return (
		<section className={`rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6 ${className}`}>
			<div className="mb-5"><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300"><Icon aria-hidden="true" className="h-3.5 w-3.5" />{eyebrow}</p><h2 className="mt-1.5 text-base font-semibold text-white">{title}</h2></div>
			{children}
		</section>
	);
}

export default function CommandDashboard({ session }) {
	const [analytics, setAnalytics] = useState(null);
	const [students, setStudents] = useState([]);
	const [drives, setDrives] = useState([]);
	const [selectedDrive, setSelectedDrive] = useState('');
	const [matches, setMatches] = useState([]);
	const [selectedCandidateId, setSelectedCandidateId] = useState(null);
	const [loading, setLoading] = useState(true);
	const [matching, setMatching] = useState(false);
	const [error, setError] = useState('');
	const [matchMessage, setMatchMessage] = useState('');

	const loadDashboard = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const [analyticsResponse, studentsResponse, drivesResponse] = await Promise.all([
				api.get('/dashboard/analytics'),
				api.get('/students'),
				api.get('/drives'),
			]);
			setAnalytics(analyticsResponse.data);
			setStudents(studentsResponse.data);
			setDrives(drivesResponse.data.drives || []);
			setSelectedDrive((current) => current || String(drivesResponse.data.drives?.[0]?.id || ''));
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { loadDashboard(); }, [loadDashboard]);

	const studentsById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
	const selectedDriveRecord = drives.find((drive) => String(drive.id) === selectedDrive);

	const runMatching = async () => {
		if (!selectedDrive) return;
		setMatching(true);
		setMatchMessage('');
		setError('');
		try {
			const { data } = await api.post(`/matching/run-drive/${selectedDrive}`);
			setMatches(data.matches || []);
			setMatchMessage(`${data.created_records} new matches, ${data.updated_records} refreshed. ${data.shortlisted_count} shortlisted.`);
			const { data: nextAnalytics } = await api.get('/dashboard/analytics');
			setAnalytics(nextAnalytics);
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setMatching(false);
		}
	};

	if (loading) return <div className="flex min-h-80 items-center justify-center text-sm text-slate-400"><LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin text-cyan-300" />Loading command dashboard...</div>;
	if (error && !analytics) return <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-6 text-sm text-rose-200"><TriangleAlert aria-hidden="true" className="mr-2 inline h-4 w-4" />{error}<button className="ml-4 text-cyan-300" onClick={loadDashboard} type="button">Retry</button></div>;
	if (!analytics) return null;

	const metricCards = [
		{ icon: Users, label: 'Total students', value: analytics.total_students, footnote: `${analytics.placement_ready_count} placement-ready`, tone: 'indigo' },
		{ icon: BriefcaseBusiness, label: 'Active drives', value: analytics.active_drives_count, footnote: 'Scheduled or conflicted', tone: 'cyan' },
		{ icon: Award, label: 'Offers accepted', value: analytics.offers_accepted, footnote: 'Confirmed placements', tone: 'green' },
		{ icon: TriangleAlert, label: 'At-risk students', value: analytics.at_risk_unplaced_count, footnote: 'Readiness below 50', tone: 'amber' },
	];
	const branchData = Object.entries(analytics.branch_conversion_percentages || {});
	const packageData = Object.entries(analytics.package_trends || {});
	const maxPackage = Math.max(1, ...packageData.map(([, value]) => Number(value)));

	return (
		<div className="w-full min-w-0 space-y-8">
			<section className="relative overflow-hidden rounded-xl border border-blue-400/20 bg-gradient-to-r from-indigo-500/10 via-slate-900 to-cyan-500/[0.07] p-4 transition-all duration-300 hover:border-blue-500/50 sm:p-5"><div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-blue-400/10 blur-3xl" /><div className="relative flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200"><Activity aria-hidden="true" className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-white">{session?.role === 'admin' ? 'Admin Command Center' : 'Recruiter Workspace'}</p><p className="mt-1 text-xs leading-5 text-slate-400">{session?.role === 'admin' ? 'System health, verified user rosters, and campus-wide analytics.' : 'Post jobs, manage applicant pipelines, and hire top BPUT talent instantly.'}</p></div></div></section>
			<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
				<div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Placement cell · {session?.role}</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Command dashboard</h1><p className="mt-2 text-sm text-slate-400">Live placement health, recruiter demand, and explainable candidate matching.</p></div>
				<button className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-700 px-3 text-sm text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-100 sm:self-auto" onClick={loadDashboard} type="button"><RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh</button>
			</header>
			{error && <div className="rounded-lg border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-200" role="alert">{error}</div>}
			<section aria-label="Placement summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map((card) => <MetricCard {...card} key={card.label} />)}</section>

			<section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
				<Panel eyebrow="Branch outcomes" icon={BarChart3} title="Conversion by branch">
					<div className="space-y-6">{branchData.map(([branch, percentage]) => <div key={branch}><div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium text-slate-200">{branch}</span><span className="text-sm tabular-nums text-cyan-200">{Number(percentage).toFixed(1)}%</span></div><div aria-label={`${branch} conversion ${percentage}%`} className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all" style={{ width: `${Math.min(100, Math.max(0, Number(percentage)))}%` }} /></div></div>)}</div>
					<div className="mt-6 flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500"><ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />Conversion is placed students divided by branch enrollment.</div>
				</Panel>
				<Panel eyebrow="Recruiter demand" icon={CircleDollarSign} title="Average package by company">
					{packageData.length === 0 ? <p className="text-sm text-slate-500">No package data available.</p> : <div className="space-y-4">{packageData.map(([company, amount]) => <div className="grid grid-cols-[88px_minmax(0,1fr)_72px] items-center gap-3" key={company}><span className="truncate text-xs font-medium text-slate-300">{company}</span><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${Math.max(5, Number(amount) / maxPackage * 100)}%` }} /></div><span className="text-right text-xs tabular-nums text-slate-400">{Number(amount).toFixed(1)} LPA</span></div>)}</div>}
				</Panel>
			</section>

			<Panel eyebrow="AI-assisted placement" icon={Activity} title="Live matching evaluation">
				<div className="mb-5 flex flex-col gap-3 border-b border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
					<div><p className="text-sm font-medium text-slate-200">Evaluate eligible candidates</p><p className="mt-1 text-xs text-slate-500">Matching records and explanations are saved by the API.</p></div>
					<div className="flex flex-col gap-2 sm:flex-row">
						<select aria-label="Select placement drive" className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-cyan-400" onChange={(event) => { setSelectedDrive(event.target.value); setMatches([]); }} value={selectedDrive}>
							{drives.map((drive) => <option className="bg-slate-900" key={drive.id} value={drive.id}>{drive.company_name} · {new Date(drive.drive_date).toLocaleDateString()}</option>)}
						</select>
						<button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedDrive || matching || selectedDriveRecord?.status === 'Completed'} onClick={runMatching} type="button">{matching ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Play aria-hidden="true" className="h-4 w-4" />}{matching ? 'Evaluating...' : 'Run matching'}</button>
					</div>
				</div>
				{matchMessage && <p className="mb-4 rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-xs text-emerald-200" role="status">{matchMessage}</p>}
				{matches.length === 0 ? <div className="rounded-lg border border-dashed border-slate-700 px-4 py-10 text-center"><p className="text-sm font-medium text-slate-300">No evaluation loaded</p><p className="mt-1 text-xs text-slate-500">Choose an active drive and run matching to populate this table.</p></div> : <div className="overflow-x-auto rounded-lg border border-slate-800"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">Fit score</th><th className="px-4 py-3 font-semibold">Explainable reason</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-slate-800">{matches.map((match) => {
						const student = studentsById.get(match.student_id);
						const status = match.status;
						return <tr className="align-top" key={match.id}><td className="whitespace-nowrap px-4 py-4"><button aria-label={`Open deep profile for ${student?.name || `student ${match.student_id}`}`} className="text-left text-sm font-medium text-cyan-100 transition hover:text-white hover:underline" onClick={() => setSelectedCandidateId(match.student_id)} type="button">{student?.name || `Student #${match.student_id}`}</button><p className="mt-1 text-xs text-slate-500">{student?.branch || 'BPUT'}</p></td><td className="whitespace-nowrap px-4 py-4"><span className="text-sm font-semibold tabular-nums text-cyan-200">{Number(match.fit_score).toFixed(1)}%</span></td><td className="max-w-xl px-4 py-4 text-xs leading-5 text-slate-400">{match.explanation}</td><td className="px-4 py-4"><span className={`rounded-md border px-2 py-1.5 text-xs ${STATUS_STYLES[status] || STATUS_STYLES.Pending}`}>{status}</span></td></tr>;
					})}</tbody></table></div>}
				<div className="mt-4 flex flex-col gap-2 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-1.5"><Building2 aria-hidden="true" className="h-3.5 w-3.5" />{selectedDriveRecord ? `${selectedDriveRecord.company_name} · ${selectedDriveRecord.venue}` : 'No active drives'}</span><span>Candidate workflow actions persist separately from placement and offer status.</span></div>
			</Panel>
			{selectedCandidateId !== null && <CandidateModal canVerify={session?.role === 'admin'} onClose={() => setSelectedCandidateId(null)} studentId={selectedCandidateId} />}
		</div>
	);
}
