import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarClock, Code2, RefreshCw, Trophy } from 'lucide-react';
import api, { getApiError } from '../api/http';

function countdown(startSeconds, now) {
	if (!startSeconds) return 'Schedule to be announced';
	const remaining = startSeconds * 1000 - now;
	if (remaining <= 0) return 'Live now';
	const days = Math.floor(remaining / 86400000);
	const hours = Math.floor((remaining % 86400000) / 3600000);
	const minutes = Math.floor((remaining % 3600000) / 60000);
	return days ? `Starts in ${days}d ${hours}h` : `Starts in ${hours}h ${minutes}m`;
}

export default function CodingCompetition() {
	const [competitions, setCompetitions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [retry, setRetry] = useState(0);
	const [now, setNow] = useState(Date.now());
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 60000);
		return () => window.clearInterval(timer);
	}, []);
	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		api.get('/v1/coding/competitions')
			.then(({ data }) => { if (!cancelled) { setCompetitions(Array.isArray(data.competitions) ? data.competitions : []); setError(''); } })
			.catch((reason) => { if (!cancelled) { setCompetitions([]); setError(getApiError(reason)); } })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [retry]);

	const grouped = competitions.reduce((groups, item) => ({ ...groups, [item.platform || 'Other']: [...(groups[item.platform || 'Other'] || []), item] }), {});
	return <div className="mx-auto max-w-7xl space-y-6">
		<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><Trophy aria-hidden="true" className="h-3.5 w-3.5" />Competitive Coding</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Competition arena</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Live and upcoming programming contests from the competitive coding community.</p></div><div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Available contests</p><p className="mt-1 text-2xl font-semibold text-white">{loading ? '—' : competitions.length}</p></div></header>
		{error && <div className="rounded-xl border border-rose-300/15 bg-slate-900 p-4"><p className="text-sm text-rose-200">Competition listings unavailable: {error}</p><button className="mt-2 inline-flex items-center gap-2 text-xs text-cyan-200" onClick={() => setRetry((value) => value + 1)} type="button"><RefreshCw className="h-3.5 w-3.5" />Try again</button></div>}
		{loading ? <div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((item) => <div className="h-40 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" key={item} />)}</div> : competitions.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-5 py-12 text-center"><Code2 className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-4 text-sm font-medium text-slate-300">No live or upcoming contests found</p><p className="mt-1 text-xs text-slate-500">Check back soon for the next contest schedule.</p></div> : <div className="space-y-6">{Object.entries(grouped).map(([platform, items]) => <section className="space-y-3" key={platform}><h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />{platform}<span className="text-slate-600">{items.length}</span></h2><div className="grid gap-4 xl:grid-cols-2">{items.map((contest) => <article className="flex min-w-0 flex-col justify-between gap-5 rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:flex-row sm:items-center sm:p-5" key={contest.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${contest.phase === 'CODING' ? 'bg-emerald-300/10 text-emerald-200' : 'bg-indigo-300/10 text-indigo-200'}`}>{contest.phase === 'CODING' ? 'Live' : 'Upcoming'}</span><span className="text-[10px] text-slate-500">{contest.duration_seconds ? `${Math.round(contest.duration_seconds / 3600)} hour${contest.duration_seconds >= 7200 ? 's' : ''}` : 'Contest'}</span></div><h3 className="mt-3 break-words text-sm font-semibold text-white">{contest.name}</h3><p className="mt-2 flex items-center gap-2 text-xs text-slate-400"><CalendarClock className="h-3.5 w-3.5 text-cyan-300" />{contest.phase === 'CODING' ? 'Contest is in progress' : countdown(contest.start_time_seconds, now)}{contest.start_time_seconds && contest.phase !== 'CODING' && <span className="text-slate-600">· {new Date(contest.start_time_seconds * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>}</p></div><a className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 text-xs font-semibold text-white shadow-lg shadow-indigo-500/10 transition hover:brightness-110" href={contest.url} rel="noreferrer" target="_blank">Participate Now <ArrowUpRight className="h-3.5 w-3.5" /></a></article>)}</div></section>)}</div>}
	</div>;
}
