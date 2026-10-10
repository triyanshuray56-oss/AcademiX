import { useEffect, useState } from 'react';
import { Activity, AlertCircle, ArrowUpRight, BriefcaseBusiness, CalendarClock, CheckCircle2, Clock3, ExternalLink, LoaderCircle, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../api/http';

const STATUS_STYLE = {
	Upcoming: 'border-cyan-300/20 bg-cyan-300/5 text-cyan-100',
	Completed: 'border-emerald-300/20 bg-emerald-300/5 text-emerald-100',
	Shortlisted: 'border-violet-300/20 bg-violet-300/5 text-violet-100',
	'Awaiting recruiter update': 'border-amber-300/20 bg-amber-300/5 text-amber-100',
};

function countdownText(dateString, now) {
	const time = new Date(dateString).getTime();
	const delta = time - now;
	if (delta < 0) return `${Math.floor(Math.abs(delta) / 86400000)} days past estimate`;
	const days = Math.floor(delta / 86400000);
	const hours = Math.floor(delta % 86400000 / 3600000);
	const minutes = Math.floor(delta % 3600000 / 60000);
	return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function InterviewCard({ event, now, index }) {
	const completed = event.status === 'Completed';
	const pending = event.status === 'Awaiting recruiter update';
	return <article className="relative min-w-0 pl-9 sm:pl-11">
		<span aria-hidden="true" className={`absolute left-0 top-1 grid h-7 w-7 place-items-center rounded-full border ${completed ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-indigo-300/20 bg-slate-950 text-cyan-200'}`}>{completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-[10px] font-semibold">{index + 1}</span>}</span>
		<div className="rounded-xl border border-slate-800 bg-slate-950/55 p-4 transition hover:border-indigo-300/20 sm:p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-white">{event.round_name}</h3><span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${STATUS_STYLE[event.status] || 'border-slate-700 text-slate-300'}`}>{event.status}</span></div><p className="mt-1.5 text-xs text-slate-400">{event.company} <span className="px-1 text-slate-700">·</span> {event.role_title}</p></div><div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"><Clock3 aria-hidden="true" className={`h-3.5 w-3.5 ${pending ? 'text-amber-300' : 'text-cyan-300'}`} /><span className="text-[10px] font-medium tabular-nums text-slate-200">{pending ? 'Date needs confirmation' : countdownText(event.scheduled_at, now)}</span></div></div>
			<div className="mt-4 grid gap-3 border-t border-slate-800 pt-3 sm:grid-cols-2"><div><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Estimated time</p><p className="mt-1 text-xs text-slate-300">{new Date(event.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p></div><div><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Venue / platform</p><p className="mt-1 break-words text-xs text-slate-300">{event.venue}</p>{event.platform_url && <a className="mt-2 inline-flex items-center gap-1 text-[10px] text-cyan-300 hover:text-white" href={event.platform_url} rel="noreferrer" target="_blank">{event.platform} practice <ExternalLink aria-hidden="true" className="h-3 w-3" /></a>}{!event.platform_url && <p className="mt-2 text-[10px] text-slate-500">{event.platform} · link pending from employer</p>}</div></div>
		</div>
	</article>;
}

export default function StudentInterviews() {
	const [schedule, setSchedule] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [now, setNow] = useState(Date.now());
	const [retry, setRetry] = useState(0);
	useEffect(() => {
		let cancelled = false;
		setLoading(true); setError('');
		api.get('/v1/interviews/my-schedule')
			.then(({ data }) => { if (!cancelled) setSchedule(data); })
			.catch((requestError) => { if (!cancelled) setError(getApiError(requestError)); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [retry]);
	useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);

	if (loading) return <div className="flex min-h-72 items-center justify-center text-sm text-slate-400"><LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin text-cyan-300" />Loading your interview timeline…</div>;
	if (error) return <div className="mx-auto max-w-3xl rounded-xl border border-rose-300/15 bg-slate-900 p-6"><p className="flex items-center gap-2 text-sm font-medium text-rose-200"><AlertCircle aria-hidden="true" className="h-4 w-4" />Could not load your interview schedule</p><p className="mt-2 text-xs text-slate-400">{error}</p><button className="mt-4 text-xs font-medium text-cyan-300" onClick={() => setRetry((count) => count + 1)} type="button">Try again</button></div>;
	const applications = schedule?.applications || [];
	return <div className="mx-auto max-w-7xl space-y-6">
		<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.17em] text-cyan-300"><Video aria-hidden="true" className="h-3.5 w-3.5" />Applied roles only</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Interview schedule</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">A timeline for the jobs and internships you applied to through CampusLink.</p></div><div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"><CalendarClock aria-hidden="true" className="h-4 w-4 text-indigo-300" /><span className="text-xs text-slate-300">{applications.length} applied {applications.length === 1 ? 'role' : 'roles'}</span></div></header>
		{schedule?.note && <div className="flex items-start gap-2 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3 text-[10px] leading-5 text-amber-100/80"><Activity aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />{schedule.note}</div>}
		{applications.length === 0 ? <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-5 py-12 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-indigo-400/10 text-indigo-200"><BriefcaseBusiness aria-hidden="true" className="h-5 w-5" /></span><h2 className="mt-4 text-sm font-semibold text-white">No applied roles yet</h2><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">Interview timelines appear here after you apply to a job or internship through CampusLink.</p><Link className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-400/15 px-4 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-400/25" to="/student/jobs">Explore jobs and internships <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></Link></section> : <div className="space-y-5">{applications.map((application) => <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900" key={application.application_id}><div className="flex flex-col justify-between gap-3 border-b border-slate-800 bg-gradient-to-r from-indigo-500/[0.07] to-transparent p-5 sm:flex-row sm:items-center"><div className="flex min-w-0 items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-indigo-300/10 bg-indigo-300/[0.05] text-cyan-200"><BriefcaseBusiness aria-hidden="true" className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-[10px] font-semibold uppercase tracking-wider text-cyan-300">{application.company}</p><h2 className="mt-1 break-words text-sm font-semibold text-white">{application.role_title}</h2><p className="mt-1 text-[10px] text-slate-500">Applied {new Date(application.applied_at).toLocaleDateString()}</p></div></div><a className="inline-flex min-h-9 w-fit shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-[10px] text-slate-300 hover:border-slate-500 hover:text-white" href={application.job_url} rel="noreferrer" target="_blank">Application details <ExternalLink aria-hidden="true" className="h-3 w-3" /></a></div><div className="space-y-3 p-5">{application.events.map((event, index) => <InterviewCard event={event} index={index} key={event.id} now={now} />)}</div></section>)}</div>}
		<p className="text-[10px] text-slate-600">Showing schedules only for {applications.length ? 'your saved CampusLink applications' : 'roles applied through CampusLink'}.</p>
	</div>;
}
