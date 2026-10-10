import { useEffect, useMemo, useState } from 'react';
import { Activity, Award, BookOpenCheck, BriefcaseBusiness, CalendarClock, CheckCircle2, Code2, FileText, GraduationCap, LoaderCircle, ShieldCheck, Sparkles, Target, TrendingUp } from 'lucide-react';
import api, { getApiError } from '../api/http';
import { ProfileAvatar } from './ProfilePicture';

function PanelHeading({ icon: Icon, eyebrow, title }) {
	return <div className="mb-4 flex items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-400/10 text-cyan-200"><Icon aria-hidden="true" className="h-4 w-4" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">{eyebrow}</p><h2 className="mt-1 text-sm font-semibold text-white sm:text-base">{title}</h2></div></div>;
}

function DeadlineBanner({ drives }) {
	if (!drives.length) return null;
	return <div className="flex min-w-0 items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3"><CalendarClock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><div className="min-w-0"><p className="text-xs font-semibold text-amber-100">Upcoming placement deadline</p><p className="mt-1 break-words text-xs leading-5 text-amber-100/70">{drives.map((drive) => `${drive.company_name} · ${new Date(drive.drive_date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`).join(' • ')}</p></div></div>;
}

function DashboardPlacementUpdates() {
	const [announcements, setAnnouncements] = useState([]);
	const [deadlines, setDeadlines] = useState([]);
	const [loading, setLoading] = useState(true);
	const [now, setNow] = useState(Date.now());
	useEffect(() => {
		let cancelled = false;
		Promise.allSettled([api.get('/v1/notices/announcements'), api.get('/v1/notices/deadlines')]).then(([noticeResult, deadlineResult]) => {
			if (cancelled) return;
			if (noticeResult.status === 'fulfilled') setAnnouncements(Array.isArray(noticeResult.value.data) ? noticeResult.value.data.slice(0, 3) : []);
			if (deadlineResult.status === 'fulfilled') setDeadlines(Array.isArray(deadlineResult.value.data.deadlines) ? deadlineResult.value.data.deadlines.slice(0, 3) : []);
		}).finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, []);
	useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
	const closesIn = (deadline) => {
		const hours = Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 3600000));
		return hours < 24 ? `Closing in ${hours}h` : `Closing in ${Math.ceil(hours / 24)} days`;
	};
	return <section className="grid gap-5 xl:grid-cols-2">
		<article className="rounded-xl border border-slate-800 bg-slate-900 p-5"><PanelHeading icon={BriefcaseBusiness} eyebrow="Placement cell" title="Latest announcements" />{loading ? <p className="text-xs text-slate-500">Loading announcements...</p> : announcements.length ? <div className="space-y-3">{announcements.map((notice) => <div className="border-t border-slate-800 pt-3 first:border-0 first:pt-0" key={notice.id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-200">{notice.title}</p><span className="rounded-full border border-indigo-300/15 bg-indigo-300/5 px-2 py-0.5 text-[9px] text-indigo-100">{notice.category}</span></div><p className="mt-1 text-[10px] leading-4 text-slate-500">{notice.message}</p><p className="mt-1 text-[9px] text-slate-600">{new Date(notice.published_at).toLocaleDateString()}</p></div>)}</div> : <p className="text-xs text-slate-500">No placement announcements have been published.</p>}<a className="mt-4 inline-flex text-[10px] font-medium text-cyan-300 hover:text-white" href="/student/notices?section=announcements">View all notices <span aria-hidden="true" className="ml-1">→</span></a></article>
		<article className="rounded-xl border border-amber-300/15 bg-slate-900 p-5"><PanelHeading icon={CalendarClock} eyebrow="Registration window" title="Closing in the next 7 days" />{loading ? <p className="text-xs text-slate-500">Checking registration deadlines...</p> : deadlines.length ? <div className="space-y-3">{deadlines.map((item) => <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3 first:border-0 first:pt-0" key={item.id}><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{item.company} · {item.role_title}</p><p className="mt-1 text-[10px] text-slate-500">Drive {new Date(item.drive_date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p></div><span className="rounded-full border border-amber-300/20 bg-amber-300/5 px-2 py-1 text-[9px] font-medium text-amber-100">{closesIn(item.deadline)}</span></div>)}</div> : <p className="text-xs text-slate-500">No drive registrations close within the next 7 days.</p>}<a className="mt-4 inline-flex text-[10px] font-medium text-amber-200 hover:text-white" href="/student/notices?section=deadlines">View all deadlines <span aria-hidden="true" className="ml-1">→</span></a></article>
	</section>;
}

function ReadinessRing({ score }) {
	const radius = 54;
	const length = Math.PI * 2 * radius;
	const clamped = Math.min(100, Math.max(0, Number(score || 0)));
	return <div className="relative grid h-36 w-36 shrink-0 place-items-center"><svg aria-label={`Overall placement readiness ${Math.round(clamped)} out of 100`} className="absolute inset-0 -rotate-90" role="img" viewBox="0 0 128 128"><defs><linearGradient id="dashboard-readiness-gradient"><stop stopColor="#6366f1" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs><circle cx="64" cy="64" fill="none" r={radius} stroke="#1e293b" strokeWidth="10" /><circle cx="64" cy="64" fill="none" r={radius} stroke="url(#dashboard-readiness-gradient)" strokeDasharray={length} strokeDashoffset={length * (1 - clamped / 100)} strokeLinecap="round" strokeWidth="10" /></svg><div className="text-center"><p className="text-4xl font-semibold tabular-nums text-white">{Math.round(clamped)}</p><p className="text-[10px] uppercase tracking-widest text-slate-500">of 100</p></div></div>;
}

function SkillRadar({ student }) {
	const skills = student.verified_tech_stack || [];
	const coreTerms = ['data structures', 'algorithms', 'operating systems', 'dbms', 'computer networks', 'oop'];
	const coreCount = skills.filter((skill) => coreTerms.some((term) => skill.toLowerCase().includes(term))).length;
	const coding = Number(student.coding_score ?? Math.min(100, Number(student.leetcode_rating || 0) / 20));
	const values = [
		{ label: 'Coding', value: coding },
		{ label: 'Core CS', value: Number(student.coding_score ?? (coreCount / coreTerms.length * 100)) },
		{ label: 'Aptitude', value: Number(student.aptitude_score || 0) },
		{ label: 'System design', value: Number(student.system_design_score || 0) },
		{ label: 'Communication', value: Number(student.ai_speech_score || 0) },
	].map((item) => ({ ...item, value: Math.min(100, Math.max(0, item.value)) }));
	const center = { x: 165, y: 145 };
	const radius = 88;
	const point = (index, scale) => {
		const angle = -Math.PI / 2 + index * (Math.PI * 2 / values.length);
		return { x: center.x + Math.cos(angle) * radius * scale, y: center.y + Math.sin(angle) * radius * scale };
	};
	const polygon = (scale) => values.map((_, index) => { const p = point(index, scale); return `${p.x},${p.y}`; }).join(' ');
	const dataPoints = values.map((item, index) => ({ ...item, ...point(index, item.value / 100) }));
	const labels = values.map((item, index) => {
		const p = point(index, 1.23);
		return <text className="fill-slate-400" fontSize="9" key={item.label} textAnchor={p.x < center.x - 15 ? 'end' : p.x > center.x + 15 ? 'start' : 'middle'} x={p.x} y={p.y + 3}>{item.label}</text>;
	});
	return <div className="min-w-0"><svg aria-label="Competency radar showing coding, core CS, aptitude, system design, and communication scores" className="mx-auto w-full max-w-[390px] overflow-visible" role="img" viewBox="0 0 330 290">{[0.25, 0.5, 0.75, 1].map((scale) => <polygon fill="none" key={scale} points={polygon(scale)} stroke="#334155" strokeDasharray={scale === 1 ? undefined : '3 4'} strokeWidth="1" />)}{values.map((item, index) => { const p = point(index, 1); return <line key={item.label} stroke="#334155" x1={center.x} x2={p.x} y1={center.y} y2={p.y} />; })}<polygon fill="rgba(99,102,241,.22)" points={dataPoints.map((p) => `${p.x},${p.y}`).join(' ')} stroke="#818cf8" strokeWidth="2" />{dataPoints.map((item) => <circle cx={item.x} cy={item.y} fill="#67e8f9" key={item.label} r="3.5"><title>{item.label}: {Math.round(item.value)}%</title></circle>)}{labels}</svg><div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">{values.map((item) => <div className="flex min-w-0 items-center justify-between gap-2 text-[10px]" key={item.label}><span className="truncate text-slate-500">{item.label}</span><span className="tabular-nums text-slate-300">{Math.round(item.value)}%</span></div>)}</div><p className="mt-3 text-[10px] leading-4 text-slate-600">Core CS is estimated from listed core subjects when a dedicated score is unavailable.</p></div>;
}

function AcademicTrend({ semesterCgpas }) {
	const values = (semesterCgpas || []).map((value, index) => ({ semester: index + 1, value: value == null ? null : Number(value) })).filter((item) => Number.isFinite(item.value));
	if (!values.length) return <div className="flex min-h-52 items-center justify-center rounded-lg border border-dashed border-slate-700 px-4 text-center text-xs text-slate-500">Add semester CGPA values to see your academic trend.</div>;
	const width = 620; const height = 230; const left = 42; const right = 18; const top = 16; const bottom = 34;
	const x = (index) => values.length === 1 ? (left + width - right) / 2 : left + index * ((width - left - right) / (values.length - 1));
	const y = (value) => top + (10 - value) * ((height - top - bottom) / 10);
	const points = values.map((item, index) => ({ x: x(index), y: y(item.value), ...item }));
	const path = points.length === 1 ? `M ${points[0].x} ${points[0].y}` : points.slice(1).reduce((acc, current, index) => { const previous = points[index]; const span = (current.x - previous.x) / 3; return `${acc} C ${previous.x + span} ${previous.y}, ${current.x - span} ${current.y}, ${current.x} ${current.y}`; }, `M ${points[0].x} ${points[0].y}`);
	return <svg aria-label="Semester by semester CGPA trend chart" className="w-full" role="img" viewBox={`0 0 ${width} ${height}`}><defs><linearGradient id="cgpa-line-gradient"><stop stopColor="#818cf8" /><stop offset="1" stopColor="#22d3ee" /></linearGradient><linearGradient id="cgpa-area-gradient" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#6366f1" stopOpacity=".24" /><stop offset="1" stopColor="#6366f1" stopOpacity="0" /></linearGradient></defs>{[0, 2.5, 5, 7.5, 10].map((tick) => <g key={tick}><line stroke="#1e293b" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text fill="#64748b" fontSize="9" textAnchor="end" x={left - 8} y={y(tick) + 3}>{tick}</text></g>)}<path d={`${path} L ${points.at(-1).x} ${height - bottom} L ${points[0].x} ${height - bottom} Z`} fill="url(#cgpa-area-gradient)" /><path d={path} fill="none" stroke="url(#cgpa-line-gradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />{points.map((item) => <g key={item.semester}><circle cx={item.x} cy={item.y} fill="#0f172a" r="5" stroke="#67e8f9" strokeWidth="2"><title>Semester {item.semester}: {item.value.toFixed(2)} CGPA</title></circle><text fill="#94a3b8" fontSize="9" textAnchor="middle" x={item.x} y={height - 12}>S{item.semester}</text></g>)}</svg>;
}

function ReadinessBreakdown({ student }) {
	const skillCount = (student.verified_tech_stack || []).length;
	const parts = [
		{ label: 'Academic', earned: Number(student.cgpa || 0) / 10 * 30, max: 30, color: 'from-indigo-500 to-indigo-300' },
		{ label: 'Verified skills', earned: Math.min(skillCount / 10, 1) * 30, max: 30, color: 'from-violet-500 to-indigo-300' },
		{ label: 'Mock interview', earned: Number(student.mock_interview_score || 0) / 100 * 40, max: 40, color: 'from-cyan-500 to-teal-300' },
	];
	return <div className="space-y-4">{parts.map((part) => <div key={part.label}><div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><span className="text-slate-400">{part.label}</span><span className="tabular-nums text-slate-200">{part.earned.toFixed(1)} <span className="text-slate-600">/ {part.max}</span></span></div><div aria-label={`${part.label} readiness contribution ${part.earned.toFixed(1)} of ${part.max}`} className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full bg-gradient-to-r ${part.color} transition-[width] duration-700`} style={{ width: `${Math.max(0, Math.min(100, part.earned / part.max * 100))}%` }} /></div></div>)}</div>;
}

function DashboardMetric({ label, value, detail, icon: Icon }) {
	return <article className="group rounded-xl border border-slate-800 bg-slate-900/90 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300/20 hover:shadow-lg hover:shadow-indigo-950/30"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500"><Icon aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />{label}</div><p className="mt-2 text-2xl font-semibold tabular-nums text-white">{value}</p>{detail && <p className="mt-1 text-[10px] text-slate-500">{detail}</p>}</article>;
}

function CompletenessTracker({ student }) {
	const skills = student.verified_tech_stack || [];
	const sections = [
		['Basic details', Boolean(student.name && student.branch && student.university_roll_number && student.cgpa != null)],
		['Academic record', Boolean(student.semester_cgpas?.some((value) => value != null) || student.tenth_percentage != null || student.twelfth_percentage != null)],
		['Technical profile', skills.length > 0],
		['Work experience', Boolean(student.internship_experiences?.length)],
		['Projects', Boolean(student.project_showcase?.length)],
		['Leadership & awards', Boolean(student.responsibilities?.length || student.accomplishments?.length)],
		['Community & activities', Boolean(student.volunteering?.length || student.extracurriculars?.length)],
		['Resume', Boolean(student.resume_url || student.resume_filename)],
		['College ID verified', Boolean(student.college_id_verified)],
	];
	const completed = sections.filter(([, done]) => done).length;
	const percent = Math.round(completed / sections.length * 100);
	return <section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">Profile completeness</p><p className="mt-1 text-[10px] text-slate-500">Includes experience, projects, documents, and ID verification</p></div><span className="text-lg font-semibold tabular-nums text-cyan-200">{percent}%</span></div><div aria-label={`Profile ${percent}% complete`} className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuemax="100" aria-valuemin="0" aria-valuenow={percent}><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-[width] duration-700" style={{ width: `${percent}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2">{sections.map(([label, done]) => <p className="flex min-w-0 items-center gap-2 text-[10px]" key={label}><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${done ? 'bg-emerald-300' : 'bg-slate-700'}`} /><span className="truncate text-slate-400">{label}</span><span className={`ml-auto shrink-0 ${done ? 'text-emerald-200' : 'text-slate-600'}`}>{done ? 'Done' : label === 'College ID verified' && student.college_id_card_url ? 'Pending' : 'Add'}</span></p>)}</div></section>;
}

function DriveCountdown({ drives, recruiterJds, cgpa }) {
	const [now, setNow] = useState(Date.now());
	useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
	const nextDrives = [...drives].filter((drive) => new Date(drive.drive_date).getTime() >= now)
		.sort((a, b) => new Date(a.drive_date) - new Date(b.drive_date)).slice(0, 4);
	return <section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><PanelHeading icon={CalendarClock} eyebrow="Live placement calendar" title="Eligible drives & countdown" />{nextDrives.length ? <div className="space-y-3">{nextDrives.map((drive) => {
		const jds = recruiterJds.filter((jd) => jd.company_name?.trim().toLowerCase() === drive.company_name?.trim().toLowerCase());
		const eligible = jds.length ? jds.some((jd) => Number(cgpa) >= Number(jd.min_cgpa)) : Number(cgpa) >= 6;
		const hours = Math.max(0, Math.floor((new Date(drive.drive_date).getTime() - now) / 3600000));
		const countdown = hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h remaining`;
		return <article className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3" key={drive.id}><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-100">{drive.company_name}</p><p className="mt-1 truncate text-[10px] text-slate-500">{new Date(drive.drive_date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · {drive.venue}</p></div><div className="flex items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[9px] ${eligible ? 'border-emerald-300/20 text-emerald-200' : jds.length ? 'border-rose-300/20 text-rose-200' : 'border-slate-700 text-slate-400'}`}>{eligible ? 'CGPA eligible' : jds.length ? 'Cutoff not met' : 'Sample eligibility'}</span><span className="whitespace-nowrap text-[10px] font-medium tabular-nums text-amber-200">{countdown}</span></div></article>;
	})}</div> : <p className="rounded-lg border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">No future placement drives are currently scheduled.</p>}<p className="mt-3 text-[10px] text-slate-600">Final eligibility and interview schedules are confirmed by the placement cell.</p></section>;
}

function MatchPipeline({ analytics, error }) {
	const stages = ['Applied', 'Shortlisted', 'Interview Scheduled', 'Offer Extended'];
	const total = analytics?.tracked_match_count || 0;
	const max = Math.max(1, total);
	return <section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><PanelHeading icon={Activity} eyebrow={analytics?.is_demo_data ? "Development preview" : "Placement progress"} title="Application pipeline" />{analytics?.is_demo_data && <p className="mb-3 rounded-lg border border-indigo-300/15 bg-indigo-300/5 p-3 text-[10px] text-indigo-100">Sample pipeline values are shown because this student has no recorded applications yet.</p>}{analytics && total === 0 && !error && <p className="mb-3 rounded-lg border border-dashed border-slate-700 p-3 text-[10px] text-slate-500">No applications or recruiter drive matches have been recorded yet.</p>}{error && <p className="mb-3 text-[10px] text-amber-200">Pipeline unavailable: {error}</p>}<div className="space-y-3">{stages.map((stage, index) => {
		const count = analytics?.pipeline_counts?.[stage] || 0;
		return <div className="grid grid-cols-[minmax(5rem,7rem)_1fr_2rem] items-center gap-3" key={stage}><span className="truncate text-[10px] text-slate-400">{stage}</span><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full transition-[width] duration-700 ${index === 3 ? 'bg-gradient-to-r from-emerald-500 to-teal-300' : 'bg-gradient-to-r from-indigo-500 to-cyan-400'}`} style={{ width: `${count ? Math.max(5, count / max * 100) : 0}%` }} /></div><span className="text-right text-xs font-semibold tabular-nums text-slate-200">{count}</span></div>;
	})}</div><p className="mt-4 text-[10px] leading-4 text-slate-600">{analytics?.is_demo_data ? 'Demo values are only used outside production when this profile has no tracked pipeline records.' : 'Applied counts come from your saved database applications and active recruiter drive matches. Later stages reflect recruiter actions.'}</p></section>;
}

function BenchmarkBars({ student, analytics }) {
	const metrics = [
		{ label: 'Coding score', own: student.coding_score, average: analytics?.branch_average_coding, max: 100 },
		{ label: 'LeetCode rating', own: student.leetcode_rating, average: analytics?.branch_average_leetcode, max: 3000 },
	];
	return <section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><PanelHeading icon={TrendingUp} eyebrow="Branch comparison" title="Batch benchmark" />{metrics.map((metric) => <div className="mb-5 last:mb-0" key={metric.label}><div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs text-slate-300">{metric.label}</span><span className="text-[9px] text-slate-600">{analytics?.branch_student_count || 0} students in branch</span></div>{[{ label: 'You', value: metric.own, color: 'bg-gradient-to-r from-cyan-500 to-indigo-400' }, { label: 'Branch avg.', value: metric.average, color: 'bg-slate-600' }].map((series) => <div className="mb-1.5 grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2" key={series.label}><span className="text-[10px] text-slate-500">{series.label}</span><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${series.color}`} style={{ width: `${series.value == null ? 0 : Math.min(100, Math.max(0, Number(series.value) / metric.max * 100))}%` }} /></div><span className="text-right text-[10px] tabular-nums text-slate-300">{series.value == null ? '—' : Number(series.value).toFixed(0)}</span></div>)}</div>)}{!analytics?.branch_student_count && <p className="mt-3 text-[10px] text-slate-600">Branch benchmark data is not available yet.</p>}</section>;
}

export default function StudentDashboard({ student, drives, recruiterJds, successToast, onDismissToast, nudge, nudgeError, nudgeLoading, onRequestNudge }) {
	const [analytics, setAnalytics] = useState(null);
	const [analyticsError, setAnalyticsError] = useState('');
	const [loadingAnalytics, setLoadingAnalytics] = useState(true);
	useEffect(() => {
		let cancelled = false;
		api.get('/students/me/dashboard-analytics').then(({ data }) => { if (!cancelled) setAnalytics(data); })
			.catch((error) => { if (!cancelled) setAnalyticsError(getApiError(error)); })
			.finally(() => { if (!cancelled) setLoadingAnalytics(false); });
		return () => { cancelled = true; };
	}, []);
	const eligibilityJds = recruiterJds.length ? recruiterJds.filter((jd) => Number(student.cgpa) >= Number(jd.min_cgpa)).length : (Number(student.cgpa) >= 6 ? 12 : 0);
	const academicMetrics = [
		{ label: 'Branch rank', value: student.branch_rank ? `#${student.branch_rank}` : '—', detail: student.branch || 'Branch', icon: Award },
		{ label: 'Branch percentile', value: student.branch_percentile == null ? '—' : `${Number(student.branch_percentile).toFixed(1)}%`, detail: 'Batch standing', icon: TrendingUp },
		{ label: 'Active backlogs', value: student.active_backlogs ?? 0, detail: 'Requires attention', icon: Activity },
		{ label: 'Cleared backlogs', value: student.cleared_backlogs ?? 0, detail: 'Successfully cleared', icon: CheckCircle2 },
		{ label: '10th board', value: student.tenth_percentage == null ? '—' : `${student.tenth_percentage}%`, detail: 'Class X', icon: BookOpenCheck },
		{ label: '12th board', value: student.twelfth_percentage == null ? '—' : `${student.twelfth_percentage}%`, detail: 'Class XII', icon: GraduationCap },
	];
	const topSkills = (student.verified_tech_stack || []).slice(0, 14);
	const readinessColor = Number(student.readiness_score || 0) >= 70 ? 'border-emerald-300/20 bg-emerald-300/5 text-emerald-200' : Number(student.readiness_score || 0) >= 50 ? 'border-amber-300/20 bg-amber-300/5 text-amber-200' : 'border-rose-300/20 bg-rose-300/5 text-rose-200';
	const nextEligibleDrive = useMemo(() => drives.find((drive) => {
		const jds = recruiterJds.filter((jd) => jd.company_name?.trim().toLowerCase() === drive.company_name?.trim().toLowerCase());
		return new Date(drive.drive_date).getTime() >= Date.now() && (jds.length ? jds.some((jd) => Number(student.cgpa) >= Number(jd.min_cgpa)) : Number(student.cgpa) >= 6);
	}), [drives, recruiterJds, student.cgpa]);
	const countdown = nextEligibleDrive ? Math.max(0, Math.floor((new Date(nextEligibleDrive.drive_date).getTime() - Date.now()) / 3600000)) : null;
	return <div className="w-full min-w-0 space-y-6">
		{successToast && <div aria-live="polite" className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-100" role="status"><CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1">{successToast}</span><button aria-label="Dismiss success message" className="text-emerald-200/70 hover:text-white" onClick={onDismissToast} type="button">×</button></div>}
		<section className="relative overflow-hidden rounded-xl border border-blue-400/20 bg-gradient-to-r from-indigo-500/10 via-slate-900 to-cyan-500/[0.07] p-4 transition-all duration-300 hover:border-blue-500/50 sm:p-5"><div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-blue-400/10 blur-3xl" /><div className="relative flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200"><Sparkles aria-hidden="true" className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-white">Welcome back, {student.name}!</p><p className="mt-1 text-xs leading-5 text-slate-400">Your profile is active and synced with live placement feeds.</p></div></div></section>
		<DeadlineBanner drives={drives.filter((drive) => { const hours = (new Date(drive.drive_date).getTime() - Date.now()) / 3600000; return hours >= 0 && hours <= 72; })} />
		<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Placement analytics hub</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Your placement dashboard</h1><p className="mt-2 text-sm text-slate-400">Readiness, academic momentum, active opportunities, and profile progress in one view.</p></div><div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"><ProfileAvatar name={student.name} pictureUrl={student.profile_picture_url} size="sm" /><div className="min-w-0"><p className="max-w-48 truncate text-xs font-medium text-slate-100">{student.name}</p><p className="text-[10px] text-slate-500">{student.branch} · {student.university_roll_number}</p></div></div></header>
		<section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]"><article className="relative overflow-hidden rounded-xl border border-indigo-300/15 bg-gradient-to-br from-indigo-500/10 via-slate-900 to-cyan-500/5 p-5 sm:p-6"><div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" /><div className="relative flex flex-col items-center gap-5 sm:flex-row"><ReadinessRing score={student.readiness_score} /><div className="min-w-0 flex-1 text-center sm:text-left"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Overall placement readiness</p><h2 className="mt-2 text-2xl font-semibold text-white">{student.name}</h2><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] ${readinessColor}`}>{student.readiness_status}</span><p className="mt-3 text-xs leading-5 text-slate-400">Weighted signal across academic standing, verified skills, and mock interview performance.</p></div></div><div className="relative mt-6 border-t border-slate-800/80 pt-5"><ReadinessBreakdown student={student} /></div></article><article className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6"><PanelHeading icon={Target} eyebrow="Five-pillar profile" title="Competency matrix" /><SkillRadar student={student} /></article></section>
		<section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><article className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6"><PanelHeading icon={TrendingUp} eyebrow="Academic momentum" title="Semester CGPA trend" /><AcademicTrend semesterCgpas={student.semester_cgpas} /></article><CompletenessTracker student={student} /></section>
		<section><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Academic & eligibility</p><h2 className="mt-1 text-base font-semibold text-white">At a glance</h2></div><span className="text-[10px] text-slate-500">{eligibilityJds} active role{eligibilityJds === 1 ? '' : 's'} meet your CGPA</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{academicMetrics.map((metric) => <DashboardMetric key={metric.label} {...metric} />)}</div></section>
		<section className="grid gap-5 xl:grid-cols-2"><article className="rounded-xl border border-slate-800 bg-slate-900 p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><PanelHeading icon={Code2} eyebrow="Verified competencies" title="Tech stack & coding badges" /><div className="flex flex-wrap gap-2">{student.leetcode_rating != null && <span className="rounded-full border border-amber-300/20 bg-amber-300/5 px-2.5 py-1 text-[10px] text-amber-100">LeetCode {student.leetcode_rating}</span>}{student.hackerrank_rating != null && <span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-2.5 py-1 text-[10px] text-emerald-100">HackerRank {student.hackerrank_rating}</span>}</div></div>{topSkills.length ? <div className="flex flex-wrap gap-2">{topSkills.map((skill) => <span className="rounded-md border border-cyan-300/15 bg-cyan-300/5 px-2.5 py-1.5 text-xs text-cyan-100" key={skill}>{skill}</span>)}</div> : <p className="text-xs text-slate-500">Add verified skills to your profile to highlight your strengths.</p>}<div className="mt-4 flex flex-wrap gap-4 text-xs">{student.github_url && <a className="text-cyan-300 hover:text-white" href={student.github_url} rel="noreferrer" target="_blank">GitHub profile ↗</a>}{student.portfolio_url && <a className="text-cyan-300 hover:text-white" href={student.portfolio_url} rel="noreferrer" target="_blank">Portfolio ↗</a>}</div></article><BenchmarkBars analytics={analytics} student={student} /></section>
		{onRequestNudge && <section className="rounded-xl border border-indigo-300/15 bg-gradient-to-r from-indigo-500/10 via-slate-900 to-cyan-500/5 p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><PanelHeading icon={Sparkles} eyebrow="Personalized skill plan" title="Turn a gap into a next step" /><p className="text-xs leading-5 text-slate-400">Preview recruiter demanded skills and a focused challenge to strengthen your profile.</p></div><button className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-400/15 px-4 text-sm font-medium text-indigo-100 transition hover:bg-indigo-400/25 disabled:cursor-wait disabled:opacity-60" disabled={nudgeLoading} onClick={onRequestNudge} type="button">{nudgeLoading && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}{nudgeLoading ? 'Preparing plan…' : 'Preview skill challenge'}</button></div>{nudgeError && <p className="mt-3 text-xs text-rose-300">{nudgeError}</p>}{nudge && <div aria-live="polite" className="mt-4 grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-3"><div><p className="text-[10px] uppercase tracking-wide text-slate-500">Forecast readiness</p><p className="mt-1 text-xl font-semibold text-cyan-200">{nudge.forecast_readiness_score}<span className="ml-2 text-xs text-emerald-300">+{nudge.readiness_score_bump}</span></p></div><div><p className="text-[10px] uppercase tracking-wide text-slate-500">Skill gaps</p><p className="mt-1 text-xs text-slate-300">{nudge.missing_skills?.join(', ') || 'No current gaps'}</p></div><div className="space-y-2">{nudge.recommendations?.map((item) => <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-3" key={item.skill}><p className="text-xs font-semibold text-white">{item.skill} <span className="ml-1 font-normal text-cyan-300">+{item.reward_xp} XP</span></p><p className="mt-1 text-xs leading-5 text-slate-400">{item.challenge}</p></div>)}</div></div>}</section>}
		<section className="grid gap-5 xl:grid-cols-2"><MatchPipeline analytics={analytics} error={loadingAnalytics ? '' : analyticsError} /><DriveCountdown cgpa={student.cgpa} drives={drives} recruiterJds={recruiterJds} /></section>
		<DashboardPlacementUpdates />
		{loadingAnalytics && <p className="text-[10px] text-slate-600">Loading anonymized branch benchmarks and recruiter pipeline…</p>}
		{!analyticsError && nextEligibleDrive && <p className="flex items-center gap-2 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3 text-xs text-amber-100"><CalendarClock aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-300" />Next eligible drive: <strong>{nextEligibleDrive.company_name}</strong> in {countdown >= 24 ? `${Math.floor(countdown / 24)} days` : `${countdown} hours`}.</p>}
		<div className="flex items-center gap-2 text-[10px] text-slate-600"><ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />Eligibility estimates use the recruiter CGPA cutoff; the placement cell confirms final eligibility.</div>
	</div>;
}
