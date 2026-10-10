import { useEffect } from 'react';
import { Code2, Cpu, HeartHandshake, X } from 'lucide-react';

export default function AboutUs({ onClose }) {
	useEffect(() => {
		const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
		window.addEventListener('keydown', closeOnEscape);
		return () => window.removeEventListener('keydown', closeOnEscape);
	}, [onClose]);

	return <div aria-label="About CampusLink" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} role="dialog">
		<section className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/50 sm:p-8">
			<button aria-label="Close about CampusLink" className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-white" onClick={onClose} type="button"><X className="h-4 w-4" /></button>
			<p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">About the platform</p>
			<h2 className="mt-2 pr-8 text-2xl font-semibold text-white">A clearer connection between campus and career</h2>
			<p className="mt-3 text-sm leading-6 text-slate-400">CampusLink supports BPUT’s placement community with one coordinated workspace for student readiness, recruiter engagement, placement drives, and hiring operations.</p>
			<div className="mt-6 grid gap-3 sm:grid-cols-2">
				<article className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><HeartHandshake className="h-5 w-5 text-cyan-300" /><h3 className="mt-3 text-sm font-semibold text-white">Our mission</h3><p className="mt-2 text-xs leading-5 text-slate-400">Make placement information easier to access, help students prepare with confidence, and give recruiters a consistent way to connect with campus talent.</p></article>
				<article className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><Cpu className="h-5 w-5 text-indigo-300" /><h3 className="mt-3 text-sm font-semibold text-white">How it is built</h3><p className="mt-2 text-xs leading-5 text-slate-400">A FastAPI service provides authenticated APIs and data workflows. The React interface uses Tailwind CSS to deliver responsive workspaces for every role.</p></article>
			</div>
			<div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4"><div className="flex items-center gap-2"><Code2 className="h-4 w-4 text-cyan-300" /><h3 className="text-sm font-semibold text-white">Acknowledgements</h3></div><p className="mt-2 text-xs leading-5 text-slate-400">Created by the CampusLink project team for the BPUT placement ecosystem. With thanks to BPUT students, placement coordinators, recruiters, and hackathon mentors whose needs and feedback shape the project.</p></div>
		</section>
	</div>;
}
