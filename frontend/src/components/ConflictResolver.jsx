import { useCallback, useEffect, useState } from 'react';
import {
	AlertTriangle,
	ArrowRight,
	CalendarClock,
	Clock3,
	MapPin,
	RefreshCw,
	ShieldAlert,
	Users,
} from 'lucide-react';
import api, { getApiError } from '../api/http';

const LABELS = {
	same_date: 'Same date',
	same_datetime: 'Time overlap',
	same_venue: 'Venue booking',
	student_overlap: 'Shortlisted student overlap',
};

export default function ConflictResolver({ fullWidth = false }) {
	void fullWidth;
	const [conflicts, setConflicts] = useState([]);
	const [drives, setDrives] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const loadConflicts = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const [conflictResponse, driveResponse] = await Promise.all([
				api.get('/drives/conflicts'),
				api.get('/drives'),
			]);
			setConflicts(conflictResponse.data || []);
			setDrives(driveResponse.data.drives || []);
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { loadConflicts(); }, [loadConflicts]);

	const drivesById = new Map(drives.map((drive) => [drive.id, drive]));

	return (
		<div className="w-full min-w-0 space-y-6">
			<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
				<div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Schedule integrity</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Conflict resolver</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Review active placement-drive clashes and the API's suggested alternative slots.</p></div>
				<button className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-700 px-3 text-sm text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-100 sm:self-auto" onClick={loadConflicts} type="button"><RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh checks</button>
			</header>

			{error && <div className="rounded-lg border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-200" role="alert">{error}</div>}
			{loading ? <div className="flex min-h-64 items-center justify-center text-sm text-slate-400"><RefreshCw aria-hidden="true" className="mr-2 h-4 w-4 animate-spin text-cyan-300" />Scanning active schedules...</div> : conflicts.length === 0 ? <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 px-6 py-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-300/10 text-emerald-200"><CalendarClock aria-hidden="true" className="h-5 w-5" /></span><h2 className="mt-4 text-lg font-semibold text-white">No schedule conflicts detected</h2><p className="mt-2 text-sm text-slate-400">Active drives currently have no overlapping dates, venues, or shortlists.</p></div> : <div className="space-y-4">{conflicts.map((conflict, index) => {
				const first = drivesById.get(conflict.drive_ids[0]);
				const second = drivesById.get(conflict.drive_ids[1]);
				return <article className="overflow-hidden rounded-xl border border-amber-300/20 bg-slate-900" key={conflict.drive_ids.join('-')}>
					<div className="flex flex-col justify-between gap-3 border-b border-slate-800 bg-amber-300/[0.035] px-5 py-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-300/10 text-amber-200"><AlertTriangle aria-hidden="true" className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-white">Schedule clash {String(index + 1).padStart(2, '0')}</p><p className="mt-1 text-xs text-slate-500">{conflict.drive_ids.length} drives require review</p></div></div><div className="flex flex-wrap gap-2">{conflict.conflict_types.map((type) => <span className="rounded-full border border-amber-300/20 bg-amber-300/5 px-2.5 py-1 text-[10px] font-medium text-amber-100" key={type}>{LABELS[type] || type}</span>)}</div></div>
					<div className="grid gap-4 p-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
						{[first, second].map((drive, driveIndex) => <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4" key={conflict.drive_ids[driveIndex]}><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Drive {driveIndex + 1}</p><h3 className="mt-2 text-base font-semibold text-white">{drive?.company_name || `Drive #${conflict.drive_ids[driveIndex]}`}</h3><p className="mt-3 flex items-center gap-2 text-xs text-slate-400"><Clock3 aria-hidden="true" className="h-3.5 w-3.5 text-slate-600" />{drive ? new Date(drive.drive_date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Schedule unavailable'}</p><p className="mt-2 flex items-center gap-2 text-xs text-slate-400"><MapPin aria-hidden="true" className="h-3.5 w-3.5 text-slate-600" />{drive?.venue || 'Venue unavailable'}</p></div>)}
						<div className="hidden text-slate-600 md:block"><ArrowRight aria-hidden="true" className="h-5 w-5" /></div>
					</div>
					{conflict.student_ids?.length > 0 && <div className="mx-5 mb-4 flex items-start gap-2 rounded-lg border border-indigo-300/15 bg-indigo-300/5 px-4 py-3 text-xs text-indigo-100"><Users aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-indigo-200" /><span>Shortlisted students affected: {conflict.student_ids.join(', ')}</span></div>}
					<div className="border-t border-slate-800 px-5 py-5"><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200"><CalendarClock aria-hidden="true" className="h-4 w-4" />Suggested resolutions</p><div className="space-y-2">{(conflict.suggestions || []).map((suggestion) => <div className="flex items-start gap-2 rounded-lg bg-slate-950/60 px-3 py-3 text-sm leading-5 text-slate-300" key={suggestion}><ArrowRight aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />{suggestion}</div>)}</div></div>
				</article>;
			})}</div>}
			{!loading && <p className="flex items-center gap-2 text-xs text-slate-600"><ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" />Conflict suggestions are advisory. Confirm venue and student availability before rescheduling.</p>}
		</div>
	);
}
