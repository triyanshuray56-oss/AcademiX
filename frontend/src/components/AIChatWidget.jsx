import { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, MessageCircle, Send, Sparkles, UserRound, X } from 'lucide-react';
import api, { getApiError } from '../api/http';

const ROLE_LABELS = {
	student: 'Student AI Hub',
	admin: 'Admin AI Hub',
	recruiter: 'Recruiter AI Hub',
};

const roleGreetings = {
	student: 'Hi! I can help you make sense of readiness, compatibility, applications, and interview preparation.',
	admin: 'Welcome. Ask me about coordinating drives, student verification, notices, or placement analytics.',
	recruiter: 'Welcome. I can help with candidate filters, job posts, and applicant pipeline planning.',
};

export default function AIChatWidget({ userRole }) {
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState([]);
	const [draft, setDraft] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const scrollRef = useRef(null);
	const roleLabel = ROLE_LABELS[userRole] || 'CampusLink AI Hub';

	useEffect(() => {
		setMessages([{ role: 'assistant', content: roleGreetings[userRole] || 'Hi! How can I help with your CampusLink workflow?' }]);
		setDraft(''); setError(''); setLoading(false);
	}, [userRole]);

	useEffect(() => {
		if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
	}, [messages, loading, open]);

	const sendMessage = async (event) => {
		event.preventDefault();
		const message = draft.trim();
		if (!message || loading) return;
		const nextMessages = [...messages, { role: 'user', content: message }];
		setMessages(nextMessages); setDraft(''); setError(''); setLoading(true);
		try {
			const history = nextMessages.slice(1, -1).slice(-10).map(({ role, content }) => ({ role, content }));
			const { data } = await api.post('/v1/ai/chat', { message, user_role: userRole, history });
			setMessages((current) => [...current, { role: 'assistant', content: data.reply }]);
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setLoading(false);
		}
	};

	return <div className="fixed bottom-4 right-4 z-[60] sm:bottom-6 sm:right-6">
		{open && <section aria-label={roleLabel} className="mb-3 flex max-h-[min(72vh,38rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-indigo-300/20 bg-slate-900/95 shadow-2xl shadow-indigo-950/50 backdrop-blur-xl">
			<header className="flex items-center justify-between border-b border-slate-700/80 bg-gradient-to-r from-indigo-500/15 via-slate-900/70 to-cyan-400/10 px-4 py-3">
				<div className="flex min-w-0 items-center gap-3"><span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 text-cyan-200"><Bot aria-hidden="true" className="h-5 w-5" /><span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-300" /></span><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{roleLabel}</p><p className="mt-0.5 flex items-center gap-1 text-[9px] text-indigo-200"><Sparkles aria-hidden="true" className="h-3 w-3" />CampusLink assistant</p></div></div>
				<button aria-label="Close AI chat" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white" onClick={() => setOpen(false)} type="button"><X aria-hidden="true" className="h-4 w-4" /></button>
			</header>
			<div aria-live="polite" className="min-h-44 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4" ref={scrollRef}>
				{messages.map((item, index) => { const fromUser = item.role === 'user'; const Icon = fromUser ? UserRound : Bot; return <div className={`flex items-start gap-2 ${fromUser ? 'flex-row-reverse' : ''}`} key={`${item.role}-${index}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${fromUser ? 'bg-cyan-400/10 text-cyan-200' : 'bg-indigo-400/10 text-indigo-200'}`}><Icon aria-hidden="true" className="h-3.5 w-3.5" /></span><p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2.5 text-[11px] leading-5 ${fromUser ? 'rounded-tr-sm border border-cyan-300/10 bg-cyan-400/10 text-cyan-50' : 'rounded-tl-sm border border-slate-700 bg-slate-800/80 text-slate-200'}`}>{item.content}</p></div>; })}
				{loading && <div className="flex items-center gap-2 text-[10px] text-slate-400"><span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-400/10 text-indigo-200"><Bot aria-hidden="true" className="h-3.5 w-3.5" /></span><span className="inline-flex items-center gap-1.5"><LoaderCircle aria-hidden="true" className="h-3 w-3 animate-spin text-cyan-300" />Thinking...</span></div>}
				{error && <p role="alert" className="ml-9 rounded-lg border border-rose-300/15 bg-rose-300/5 px-3 py-2 text-[10px] leading-4 text-rose-200">{error}</p>}
			</div>
			<form className="border-t border-slate-700/80 bg-slate-950/60 p-3" onSubmit={sendMessage}><label className="sr-only" htmlFor={`campuslink-chat-${userRole}`}>Message CampusLink AI</label><div className="flex items-end gap-2 rounded-xl border border-slate-700 bg-slate-900 px-2 py-2 focus-within:border-indigo-300/40"><textarea autoComplete="off" className="max-h-24 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-xs leading-4 text-white outline-none placeholder:text-slate-600" id={`campuslink-chat-${userRole}`} maxLength={3000} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(event); } }} placeholder="Ask your placement assistant..." rows={1} value={draft} /><button aria-label="Send message" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40" disabled={!draft.trim() || loading} type="submit"><Send aria-hidden="true" className="h-4 w-4" /></button></div><p className="mt-1.5 px-1 text-[8px] text-slate-600">AI can make mistakes. Verify role and placement details in CampusLink.</p></form>
		</section>}
		<button aria-expanded={open} aria-label={open ? 'Close AI assistant' : `Open ${roleLabel}`} className={`group relative grid h-14 w-14 place-items-center rounded-2xl border border-indigo-200/30 bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-600 text-white shadow-xl shadow-indigo-950/50 transition hover:scale-105 hover:shadow-indigo-800/30 focus:outline-none focus:ring-2 focus:ring-cyan-200 ${open ? '' : 'animate-pulse'}`} onClick={() => setOpen((value) => !value)} type="button"><span className="absolute inset-0 rounded-2xl bg-cyan-300/10 opacity-0 blur-lg transition group-hover:opacity-100" />{open ? <X aria-hidden="true" className="relative h-5 w-5" /> : <><MessageCircle aria-hidden="true" className="relative h-5 w-5" /><span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-indigo-700 bg-emerald-300" /></>}</button>
	</div>;
}
