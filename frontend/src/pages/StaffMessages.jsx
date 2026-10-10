import { useCallback, useEffect, useMemo, useState } from 'react';
import { LoaderCircle, MessageSquareText, Send } from 'lucide-react';
import api, { getApiError } from '../api/http';

export default function StaffMessages({ session }) {
	const isAdmin = session.role === 'admin';
	const endpoint = isAdmin ? '/v1/admin/messages/threads' : '/v1/recruiter/messages/threads';
	const audience = isAdmin ? 'Admin' : 'Recruiter';
	const [threads, setThreads] = useState([]);
	const [selectedId, setSelectedId] = useState(null);
	const [content, setContent] = useState('');
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState('');

	const loadThreads = useCallback(async (initial = false) => {
		if (initial) setLoading(true);
		try {
			const { data } = await api.get(endpoint);
			setThreads(data);
			setError('');
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			if (initial) setLoading(false);
		}
	}, [endpoint]);

	useEffect(() => {
		let active = true;
		const refresh = (initial) => {
			if (active) void loadThreads(initial);
		};
		refresh(true);
		const interval = window.setInterval(() => refresh(false), 5000);
		return () => {
			active = false;
			window.clearInterval(interval);
		};
	}, [loadThreads]);

	const selectedThread = useMemo(
		() => threads.find((thread) => thread.id === selectedId) || threads[0] || null,
		[selectedId, threads],
	);

	useEffect(() => {
		if (selectedThread && selectedThread.id !== selectedId) setSelectedId(selectedThread.id);
	}, [selectedId, selectedThread]);

	const sendMessage = async (event) => {
		event.preventDefault();
		if (!selectedThread || selectedThread.status !== 'accepted' || !content.trim() || sending) return;
		setSending(true);
		setError('');
		try {
			await api.post('/v1/messages/send', {
				connection_id: selectedThread.id,
				content: content.trim(),
			});
			setContent('');
			await loadThreads(false);
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setSending(false);
		}
	};

	return (
		<div className="w-full min-w-0 space-y-6">
			<header className="rounded-2xl border border-indigo-300/15 bg-gradient-to-br from-indigo-400/10 via-slate-900 to-cyan-300/[0.04] p-6">
				<p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300"><MessageSquareText aria-hidden="true" className="h-4 w-4" />{audience} workspace</p>
				<h1 className="mt-2 text-2xl font-semibold text-white">Candidate Communications</h1>
				<p className="mt-2 text-sm text-slate-400">Track connection requests and message students after they accept.</p>
			</header>
			{error && <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}
			{loading ? <div className="flex min-h-48 items-center justify-center text-sm text-slate-400"><LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin text-cyan-300" />Loading candidate communications…</div>
				: threads.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-500">Connection requests you send will appear here.</div>
					: <section className="grid min-h-[34rem] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 md:grid-cols-[minmax(15rem,0.4fr)_1fr]">
						<aside aria-label="Candidate connection requests" className="border-b border-slate-800 p-3 md:border-b-0 md:border-r">
							<h2 className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Outbox &amp; requests</h2>
							<div className="space-y-1">{threads.map((thread) => <button className={`w-full rounded-lg p-3 text-left transition ${thread.id === selectedThread?.id ? 'bg-indigo-400/10 text-white' : 'text-slate-300 hover:bg-slate-800'}`} key={thread.id} onClick={() => setSelectedId(thread.id)} type="button"><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{thread.other_party_email}</span><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] ${thread.status === 'accepted' ? 'border-emerald-300/20 bg-emerald-300/5 text-emerald-200' : thread.status === 'pending' ? 'border-amber-300/20 bg-amber-300/5 text-amber-200' : 'border-slate-700 text-slate-500'}`}>{thread.status === 'accepted' ? 'Connected' : thread.status === 'pending' ? 'Pending Acceptance' : 'Declined'}</span></span><span className="mt-1 block truncate text-[10px] text-slate-500">{thread.opportunity_title}</span><span className="mt-1 block text-[9px] text-slate-600">{new Date(thread.created_at).toLocaleDateString()}</span></button>)}</div>
						</aside>
						<div className="flex min-h-[34rem] min-w-0 flex-col">
							{selectedThread ? <>
								<div className="border-b border-slate-800 px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="truncate text-sm font-semibold text-white">{selectedThread.other_party_email}</h2><p className="mt-1 truncate text-[10px] text-slate-500">{selectedThread.opportunity_title}</p></div><span className={`rounded-full border px-2.5 py-1 text-[9px] ${selectedThread.status === 'accepted' ? 'border-emerald-300/20 bg-emerald-300/5 text-emerald-200' : selectedThread.status === 'pending' ? 'border-amber-300/20 bg-amber-300/5 text-amber-200' : 'border-slate-700 text-slate-500'}`}>{selectedThread.status === 'accepted' ? 'Connected' : selectedThread.status === 'pending' ? 'Pending Acceptance' : 'Declined'}</span></div></div>
								<div aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-5">
									<div className="flex justify-end"><div className="max-w-[85%] rounded-2xl bg-indigo-500/20 px-4 py-2.5 text-indigo-50"><p className="whitespace-pre-wrap break-words text-xs leading-5">{selectedThread.intro_message}</p><p className="mt-1 text-right text-[9px] text-slate-500">Connection request</p></div></div>
									{selectedThread.status === 'pending' && <p className="py-5 text-center text-xs text-amber-200/70">Messaging unlocks when the student accepts this connection request.</p>}
									{selectedThread.status === 'declined' && <p className="py-5 text-center text-xs text-slate-500">The student declined this connection request.</p>}
									{selectedThread.messages.map((message) => {
										const mine = message.sender_email === session.email;
										return <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`} key={message.id}><div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-indigo-500/20 text-indigo-50' : 'border border-slate-700 bg-slate-950 text-slate-200'}`}><p className="whitespace-pre-wrap break-words text-xs leading-5">{message.content}</p><time className="mt-1 block text-right text-[9px] text-slate-500">{new Date(message.timestamp).toLocaleString()}</time></div></div>;
									})}
								</div>
								{selectedThread.status === 'accepted' ? <form className="flex gap-2 border-t border-slate-800 p-3" onSubmit={sendMessage}><input aria-label="Message" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:border-cyan-300/40 focus:outline-none" maxLength={4000} onChange={(event) => setContent(event.target.value)} placeholder="Write a message…" value={content} /><button aria-label="Send message" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25 disabled:opacity-50" disabled={!content.trim() || sending} type="submit"><Send aria-hidden="true" className="h-4 w-4" /></button></form>
									: <div className="border-t border-slate-800 p-4 text-center text-[10px] text-slate-500">Chat is locked until the request is accepted.</div>}
							</> : null}
						</div>
					</section>}
		</div>
	);
}
