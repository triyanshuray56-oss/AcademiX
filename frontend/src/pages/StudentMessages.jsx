import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, LoaderCircle, MessageSquareText, Send, X } from 'lucide-react';
import api, { getApiError } from '../api/http';

const SECTION_TITLES = {
	admin: 'Admin',
	recruiter: 'HR / Recruiter',
	requests: 'Connection Requests',
};

export default function StudentMessages({ session }) {
	const { section = 'requests' } = useParams();
	const [requests, setRequests] = useState([]);
	const [threads, setThreads] = useState([]);
	const [selectedThreadId, setSelectedThreadId] = useState(null);
	const [content, setContent] = useState('');
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [respondingId, setRespondingId] = useState(null);
	const [error, setError] = useState('');

	const loadMessages = useCallback(async (isInitial = false) => {
		if (isInitial) setLoading(true);
		try {
			if (section === 'requests') {
				const { data } = await api.get('/v1/messages/requests');
				setRequests(data);
			} else {
				const { data } = await api.get('/v1/messages/threads');
				setThreads(data);
			}
			setError('');
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			if (isInitial) setLoading(false);
		}
	}, [section]);

	useEffect(() => {
		let active = true;
		const refresh = async (initial) => {
			if (!active) return;
			await loadMessages(initial);
		};
		void refresh(true);
		const interval = window.setInterval(() => { void refresh(false); }, 5000);
		return () => {
			active = false;
			window.clearInterval(interval);
		};
	}, [loadMessages]);

	const visibleThreads = useMemo(
		() => threads.filter((thread) => thread.sender_role === section),
		[section, threads],
	);
	const selectedThread = visibleThreads.find((thread) => thread.id === selectedThreadId) || visibleThreads[0] || null;

	useEffect(() => {
		if (visibleThreads.length === 0) {
			setSelectedThreadId(null);
			return;
		}
		setSelectedThreadId((current) => visibleThreads.some((thread) => thread.id === current) ? current : visibleThreads[0].id);
	}, [visibleThreads]);

	const respond = async (requestId, decision) => {
		setRespondingId(requestId);
		setError('');
		try {
			await api.post(`/v1/messages/requests/${requestId}/respond`, { status: decision });
			await loadMessages(false);
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setRespondingId(null);
		}
	};

	const sendMessage = async (event) => {
		event.preventDefault();
		if (!selectedThread || !content.trim() || sending) return;
		setSending(true);
		setError('');
		try {
			await api.post('/v1/messages/send', {
				connection_id: selectedThread.id,
				content: content.trim(),
			});
			setContent('');
			await loadMessages(false);
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setSending(false);
		}
	};

	const title = SECTION_TITLES[section] || SECTION_TITLES.requests;

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header className="rounded-2xl border border-indigo-300/15 bg-gradient-to-br from-indigo-400/10 via-slate-900 to-cyan-300/[0.04] p-6">
				<p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300"><MessageSquareText aria-hidden="true" className="h-4 w-4" />Student messages</p>
				<h1 className="mt-2 text-2xl font-semibold text-white">{title}</h1>
				<p className="mt-2 text-sm text-slate-400">Connection requests and conversations with verified CampusLink accounts.</p>
			</header>

			{error && <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}
			{loading ? <div className="flex min-h-48 items-center justify-center text-sm text-slate-400"><LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin text-cyan-300" />Loading messages…</div>
				: section === 'requests' ? (
					requests.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-500">You have no pending connection requests.</div>
						: <div className="grid gap-3 md:grid-cols-2">{requests.map((request) => <article className="rounded-xl border border-slate-800 bg-slate-900 p-5" key={request.id}>
							<div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">{request.sender_role === 'admin' ? 'Admin' : 'HR / Recruiter'}</p><h2 className="mt-1 text-base font-semibold text-white">{request.opportunity_title}</h2><p className="mt-1 text-xs text-slate-500">{request.sender_email}</p></div><time className="text-[10px] text-slate-600">{new Date(request.created_at).toLocaleDateString()}</time></div>
							<p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">{request.message}</p>
							<div className="mt-5 flex flex-wrap gap-2"><button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 text-xs font-semibold text-white disabled:opacity-50" disabled={respondingId === request.id} onClick={() => void respond(request.id, 'accepted')} type="button"><Check aria-hidden="true" className="h-4 w-4" />Accept Connection</button><button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-4 text-xs text-slate-300 hover:border-rose-300/30 hover:text-rose-200 disabled:opacity-50" disabled={respondingId === request.id} onClick={() => void respond(request.id, 'declined')} type="button"><X aria-hidden="true" className="h-4 w-4" />Decline</button></div>
						</article>)}</div>
				) : visibleThreads.length === 0 ? (
					<div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-500">Accepted {section === 'admin' ? 'admin' : 'HR / recruiter'} connections will appear here. Messaging is available after you accept a request.</div>
				) : (
					<section className="grid min-h-[32rem] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 md:grid-cols-[minmax(13rem,0.35fr)_1fr]">
						<aside aria-label="Conversations" className="border-b border-slate-800 p-3 md:border-b-0 md:border-r">
							<h2 className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Accepted connections</h2>
							<div className="space-y-1">{visibleThreads.map((thread) => <button className={`w-full rounded-lg p-3 text-left transition ${thread.id === selectedThread?.id ? 'bg-indigo-400/10 text-white' : 'text-slate-300 hover:bg-slate-800'}`} key={thread.id} onClick={() => setSelectedThreadId(thread.id)} type="button"><span className="block truncate text-xs font-medium">{thread.other_party_email}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{thread.opportunity_title}</span></button>)}</div>
						</aside>
						<div className="flex min-h-[32rem] min-w-0 flex-col">
							<div className="border-b border-slate-800 px-5 py-4"><h2 className="truncate text-sm font-semibold text-white">{selectedThread?.other_party_email}</h2><p className="mt-1 truncate text-[10px] text-slate-500">{selectedThread?.opportunity_title}</p></div>
							<div aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-5">
								{selectedThread?.messages.length === 0 && <p className="py-12 text-center text-xs text-slate-500">Connection accepted. Start the conversation.</p>}
								{selectedThread?.messages.map((message) => {
									const mine = message.sender_email === session.email;
									return <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`} key={message.id}><div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-indigo-500/20 text-indigo-50' : 'border border-slate-700 bg-slate-950 text-slate-200'}`}><p className="whitespace-pre-wrap break-words text-xs leading-5">{message.content}</p><time className="mt-1 block text-right text-[9px] text-slate-500">{new Date(message.timestamp).toLocaleString()}</time></div></div>;
								})}
							</div>
							<form className="flex gap-2 border-t border-slate-800 p-3" onSubmit={sendMessage}><input aria-label="Message" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:border-cyan-300/40 focus:outline-none" maxLength={4000} onChange={(event) => setContent(event.target.value)} placeholder="Write a message…" value={content} /><button aria-label="Send message" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25 disabled:opacity-50" disabled={!content.trim() || sending} type="submit"><Send aria-hidden="true" className="h-4 w-4" /></button></form>
						</div>
					</section>
				)}
		</div>
	);
}
