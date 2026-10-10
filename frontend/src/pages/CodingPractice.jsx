import { useEffect, useState } from 'react';
import { ArrowUpRight, Code2, RefreshCw } from 'lucide-react';
import api, { getApiError } from '../api/http';

export default function CodingPractice() {
	const [arenas, setArenas] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [retry, setRetry] = useState(0);
	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		api.get('/v1/coding/practice')
			.then(({ data }) => { if (!cancelled) { setArenas(Array.isArray(data.arenas) ? data.arenas : []); setError(''); } })
			.catch((reason) => { if (!cancelled) { setArenas([]); setError(getApiError(reason)); } })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [retry]);

	return <div className="mx-auto max-w-7xl space-y-6">
		<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><Code2 aria-hidden="true" className="h-3.5 w-3.5" />Competitive Coding</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Practice arena</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Choose a platform and build your problem solving skills with focused practice.</p></div><div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Practice platforms</p><p className="mt-1 text-2xl font-semibold text-white">{loading ? '—' : arenas.length}</p></div></header>
		{error && <div className="rounded-xl border border-rose-300/15 bg-slate-900 p-4"><p className="text-sm text-rose-200">Practice arenas unavailable: {error}</p><button className="mt-2 inline-flex items-center gap-2 text-xs text-cyan-200" onClick={() => setRetry((value) => value + 1)} type="button"><RefreshCw className="h-3.5 w-3.5" />Try again</button></div>}
		{loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4].map((item) => <div className="h-56 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" key={item} />)}</div> : arenas.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-5 py-12 text-center"><Code2 className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-4 text-sm font-medium text-slate-300">No practice arenas available</p><p className="mt-1 text-xs text-slate-500">Try refreshing the listings in a moment.</p></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{arenas.map((arena) => <article className="flex min-w-0 flex-col rounded-xl border border-slate-800 bg-slate-900/80 p-5 transition hover:border-indigo-300/25" key={arena.name}><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-300/10 text-cyan-200"><Code2 aria-hidden="true" className="h-5 w-5" /></span><span className="rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-[9px] font-medium text-slate-300">{arena.difficulty_range}</span></div><h2 className="mt-4 text-sm font-semibold text-white">{arena.name}</h2><p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-cyan-300">{arena.category}</p><p className="mt-3 flex-1 text-xs leading-5 text-slate-400">{arena.description}</p><a className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-indigo-300/20 bg-indigo-300/[0.07] px-4 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-300/15" href={arena.url} rel="noreferrer" target="_blank">Open Arena <ArrowUpRight className="h-3.5 w-3.5" /></a></article>)}</div>}
	</div>;
}
