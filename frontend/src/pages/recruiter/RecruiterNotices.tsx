import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, CheckCircle2, Eye, Megaphone, Plus, Send, X } from 'lucide-react';
import api, { getApiError } from '../../api/http';

type RecruiterNotice = {
	id: number;
	title: string;
	message: string;
	category: string;
	priority: 'Low' | 'Normal' | 'High';
	published_at: string;
	is_published: boolean;
	audience: 'All Students';
};

type NoticeDraft = Pick<RecruiterNotice, 'title' | 'message' | 'category' | 'priority'>;

const INITIAL_DRAFT: NoticeDraft = {
	title: '',
	message: '',
	category: 'General',
	priority: 'Normal',
};

const FIELD_CLASS = 'mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-70';

export default function RecruiterNotices() {
	const [notices, setNotices] = useState<RecruiterNotice[]>([]);
	const [draft, setDraft] = useState<NoticeDraft>(INITIAL_DRAFT);
	const [selectedNotice, setSelectedNotice] = useState<RecruiterNotice | null>(null);
	const [loading, setLoading] = useState(true);
	const [publishing, setPublishing] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	const loadNotices = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const { data } = await api.get<RecruiterNotice[]>('/v1/recruiter-notices');
			if (!Array.isArray(data)) {
				throw new Error('The notices response was not in the expected format.');
			}
			setNotices(data);
		} catch (loadError) {
			setError(getApiError(loadError));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { void loadNotices(); }, [loadNotices]);

	const publishNotice = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setPublishing(true);
		setError('');
		setSuccess('');
		try {
			const { data } = await api.post<RecruiterNotice>('/v1/recruiter-notices', draft);
			setNotices((current) => [data, ...current]);
			setDraft(INITIAL_DRAFT);
			setSuccess('Your notice has been published to all students.');
		} catch (publishError) {
			setError(getApiError(publishError));
		} finally {
			setPublishing(false);
		}
	};

	const updateDraft = (field: keyof NoticeDraft, value: string) => {
		setDraft((current) => ({ ...current, [field]: value }));
		setSuccess('');
	};

	return <div className="w-full min-w-0 space-y-6">
		<header className="flex flex-wrap items-end justify-between gap-4">
			<div>
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Recruiter workspace</p>
				<h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Notices &amp; Announcements</h1>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Publish company updates and hiring announcements to the student community.</p>
			</div>
			<div className="inline-flex items-center gap-2 rounded-lg border border-indigo-300/20 bg-indigo-300/[0.05] px-3 py-2 text-sm text-indigo-100">
				<Megaphone aria-hidden="true" className="h-4 w-4" />
				Student audience
			</div>
		</header>

		{error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.05] p-4 text-sm text-rose-200" role="alert"><span>{error}</span><button className="underline" onClick={() => void loadNotices()} type="button">Retry</button></div>}
		{success && <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] px-4 py-3 text-sm text-emerald-200" role="status">{success}</p>}

		<div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
			<section aria-labelledby="create-notice-heading" className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
				<div className="flex items-start gap-3">
					<div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Plus aria-hidden="true" className="h-5 w-5" /></div>
					<div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Create announcement</p><h2 className="mt-1 text-xl font-bold text-white" id="create-notice-heading">Share with students</h2><p className="mt-1 text-sm leading-6 text-slate-400">Notices publish immediately and appear in the existing student announcements feed.</p></div>
				</div>
				<form className="mt-5 space-y-4" onSubmit={publishNotice}>
					<label className="block text-xs font-medium text-slate-400">Title<input className={FIELD_CLASS} maxLength={200} minLength={3} onChange={(event) => updateDraft('title', event.target.value)} placeholder="e.g. Graduate hiring applications are open" required value={draft.title} /></label>
					<label className="block text-xs font-medium text-slate-400">Message<textarea className={`${FIELD_CLASS} min-h-36 resize-y py-3`} maxLength={10000} minLength={3} onChange={(event) => updateDraft('message', event.target.value)} placeholder="Share the announcement details with students." required value={draft.message} /></label>
					<div className="grid gap-4 sm:grid-cols-2">
						<label className="block text-xs font-medium text-slate-400">Notice type<select className={FIELD_CLASS} onChange={(event) => updateDraft('category', event.target.value)} value={draft.category}><option>General</option><option>Recruitment drive</option><option>Job posting</option><option>Internship</option></select></label>
						<label className="block text-xs font-medium text-slate-400">Priority<select className={FIELD_CLASS} onChange={(event) => updateDraft('priority', event.target.value)} value={draft.priority}><option value="Low">Low</option><option value="Normal">Normal</option><option value="High">High</option></select></label>
					</div>
					<div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
						<p className="text-xs font-semibold text-slate-200">Audience: All Students</p>
						<p className="mt-1 text-xs leading-5 text-slate-500">The existing announcement feed does not support branch or batch targeting. This notice will be visible to all students.</p>
					</div>
					<div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
						<span className="text-xs text-slate-500">Publish immediately · no expiry date supported</span>
						<button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60" disabled={publishing} type="submit">{publishing ? <><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Publishing…</> : <><Send aria-hidden="true" className="h-4 w-4" />Publish notice</>}</button>
					</div>
				</form>
			</section>

			<section aria-labelledby="published-notices-heading" className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Notice library</p><h2 className="mt-1 text-xl font-bold text-white" id="published-notices-heading">Your published notices</h2><p className="mt-1 text-sm text-slate-400">Only notices published from your recruiter account are listed here.</p></div>
					<span className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-xs text-slate-300">{notices.length} total</span>
				</div>
				{loading ? <div aria-label="Loading notices" className="mt-5 space-y-3"><div className="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-950/50" /><div className="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-950/50" /></div>
					: notices.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-700 px-5 py-10 text-center"><Megaphone aria-hidden="true" className="mx-auto h-8 w-8 text-slate-600" /><h3 className="mt-3 text-sm font-semibold text-slate-200">No notices yet</h3><p className="mt-1 text-xs leading-5 text-slate-500">Published announcements from this recruiter account will appear here.</p></div>
						: <div className="mt-5 space-y-3">{notices.map((notice) => <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/50 p-4" key={notice.id}>
							<div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold text-white">{notice.title}</h3><div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-full border border-indigo-300/15 bg-indigo-300/5 px-2 py-1 text-xs text-indigo-100">{notice.category}</span><span className={`rounded-full px-2 py-1 text-xs ${notice.is_published ? 'bg-emerald-300/10 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>{notice.is_published ? 'Published' : 'Unpublished'}</span></div></div><button aria-label={`View ${notice.title}`} className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:text-white" onClick={() => setSelectedNotice(notice)} type="button"><Eye aria-hidden="true" className="h-4 w-4" />View</button></div>
							<p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-slate-400">{notice.message}</p>
							<div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3 text-xs text-slate-500"><span>{notice.audience}</span><time className="inline-flex items-center gap-1.5" dateTime={notice.published_at}><CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />{new Date(notice.published_at).toLocaleString()}</time></div>
						</article>)}</div>}
			</section>
		</div>

		{selectedNotice && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedNotice(null); }}>
			<section aria-labelledby="notice-detail-heading" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6" role="dialog">
				<div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Published notice</p><h2 className="mt-2 break-words text-2xl font-bold text-white" id="notice-detail-heading">{selectedNotice.title}</h2></div><button aria-label="Close notice details" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setSelectedNotice(null)} type="button"><X aria-hidden="true" className="h-4 w-4" /></button></div>
				<div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-indigo-300/15 bg-indigo-300/5 px-2.5 py-1 text-xs text-indigo-100">{selectedNotice.category}</span><span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">Priority: {selectedNotice.priority}</span><span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.05] px-2.5 py-1 text-xs text-emerald-200">{selectedNotice.is_published ? 'Published' : 'Unpublished'}</span></div>
				<div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><p className="text-xs text-slate-500">Audience</p><p className="mt-1 text-sm text-slate-200">{selectedNotice.audience}</p></div><div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><p className="text-xs text-slate-500">Published</p><p className="mt-1 text-sm text-slate-200">{new Date(selectedNotice.published_at).toLocaleString()}</p></div></div>
				<p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">{selectedNotice.message}</p>
				<div className="mt-5 flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500"><CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-300" />Expires: Not supported by the current announcement model</div>
			</section>
		</div>}
	</div>;
}
