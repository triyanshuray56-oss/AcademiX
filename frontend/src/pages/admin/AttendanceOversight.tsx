import { useCallback, useEffect, useState } from 'react';
import {
	Activity,
	AlertTriangle,
	Calendar,
	CheckCircle2,
	Eye,
	Filter,
	GraduationCap,
	RefreshCw,
	Search,
	ShieldAlert,
	Smartphone,
	Users,
} from 'lucide-react';
import {
	fetchAdminOversight,
	type AdminOversightSummary,
} from '../../api/admin';
import { getApiError } from '../../api/http';

export default function AttendanceOversight() {
	const [data, setData] = useState<AdminOversightSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [statusFilter, setStatusFilter] = useState('');
	const [searchQuery, setSearchQuery] = useState('');

	const loadData = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const res = await fetchAdminOversight({
				status: statusFilter || undefined,
				search: searchQuery || undefined,
			});
			setData(res);
		} catch (err) {
			setError(getApiError(err));
		} finally {
			setLoading(false);
		}
	}, [statusFilter, searchQuery]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const drivesList = data?.drives || [];
	const sessionsList = data?.sessions || [];
	const violationsList = data?.violations || [];

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
						<Eye className="h-6 w-6 text-indigo-400" />
						Attendance & Assessment Oversight
					</h1>
					<p className="mt-1 text-sm text-slate-400">
						Read-only oversight of placement session attendance, online assessment telemetry, and proctoring violation logs.
					</p>
				</div>
				<button
					type="button"
					onClick={() => void loadData()}
					disabled={loading}
					className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
				>
					<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
					Refresh Telemetry
				</button>
			</div>

			{/* Error Banner */}
			{error && (
				<div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center justify-between">
					<span>Could not load oversight telemetry: {error}</span>
					<button
						type="button"
						onClick={() => void loadData()}
						className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-1 font-medium text-rose-200 hover:bg-rose-500/30"
					>
						<RefreshCw className="h-3 w-3" /> Retry
					</button>
				</div>
			)}

			{/* Filters */}
			<div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
				<div className="flex flex-wrap items-center gap-4">
					<div className="flex items-center gap-2 text-xs font-medium text-slate-400">
						<Filter className="h-4 w-4 text-slate-500" />
						Filters:
					</div>
					<div>
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
						>
							<option value="">All Session Statuses</option>
							<option value="Active">Active</option>
							<option value="Scheduled">Scheduled</option>
							<option value="Closed">Closed</option>
							<option value="Terminated">Terminated</option>
						</select>
					</div>
					<div className="relative min-w-[220px]">
						<Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
						<input
							type="text"
							placeholder="Search student, email, or session ID..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full rounded-lg border border-slate-700 bg-slate-800 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
						/>
					</div>
					{(statusFilter || searchQuery) && (
						<button
							type="button"
							onClick={() => {
								setStatusFilter('');
								setSearchQuery('');
							}}
							className="text-xs text-indigo-400 hover:text-indigo-300"
						>
							Reset Filters
						</button>
					)}
				</div>
			</div>

			{/* Metrics Summary */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">Active Drive Sessions</span>
						<Calendar className="h-4 w-4 text-blue-400" />
					</div>
					<div className="mt-3 flex items-baseline gap-2">
						<span className="text-2xl font-bold text-white">
							{data?.active_drive_sessions ?? 0}
						</span>
					</div>
					<p className="mt-1 text-[11px] text-slate-500">Scheduled / live placement drives</p>
				</div>

				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">Average Trust Score</span>
						<Activity className="h-4 w-4 text-emerald-400" />
					</div>
					<div className="mt-3 flex items-baseline gap-2">
						<span className="text-2xl font-bold text-white">
							{data?.average_trust_score != null ? data.average_trust_score.toFixed(1) : '100.0'}%
						</span>
					</div>
					<p className="mt-1 text-[11px] text-slate-500">Proctoring integrity index</p>
				</div>

				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">Monitored Assessments</span>
						<GraduationCap className="h-4 w-4 text-indigo-400" />
					</div>
					<div className="mt-3 flex items-baseline gap-2">
						<span className="text-2xl font-bold text-white">
							{data?.total_assessment_sessions ?? 0}
						</span>
					</div>
					<p className="mt-1 text-[11px] text-slate-500">Recorded proctoring sessions</p>
				</div>

				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">Proctoring Violations</span>
						<ShieldAlert className="h-4 w-4 text-amber-400" />
					</div>
					<div className="mt-3 flex items-baseline gap-2">
						<span className="text-2xl font-bold text-amber-400">
							{data?.total_violations ?? 0}
						</span>
						<span className="text-xs text-slate-500">({data?.flagged_sessions ?? 0} flagged)</span>
					</div>
					<p className="mt-1 text-[11px] text-slate-500">Integrity infractions detected</p>
				</div>
			</div>

			{/* Main Content Sections */}
			{loading && !data ? (
				<div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center text-sm text-slate-400">
					<RefreshCw className="mx-auto h-6 w-6 animate-spin text-indigo-400 mb-2" />
					Loading attendance and assessment telemetry…
				</div>
			) : (
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					{/* Placement Drive Attendance Sessions */}
					<section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
						<div className="flex items-center justify-between border-b border-slate-800 pb-3">
							<div className="flex items-center gap-2">
								<Users className="h-5 w-5 text-indigo-400" />
								<h2 className="text-base font-semibold text-white">Placement Drive Sessions</h2>
							</div>
							<span className="text-xs text-slate-500">{drivesList.length} drives</span>
						</div>

						{drivesList.length === 0 ? (
							<div className="py-8 text-center text-xs text-slate-500">
								No placement drive sessions recorded yet.
							</div>
						) : (
							<div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
								{drivesList.map((drive) => (
									<div
										key={drive.drive_id}
										className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-2 hover:border-slate-700 transition"
									>
										<div className="flex items-center justify-between">
											<span className="text-sm font-semibold text-white">{drive.company_name}</span>
											<span
												className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
													drive.status === 'Completed'
														? 'bg-emerald-500/10 text-emerald-400'
														: drive.status === 'Scheduled'
														? 'bg-blue-500/10 text-blue-400'
														: 'bg-slate-700 text-slate-300'
												}`}
											>
												{drive.status}
											</span>
										</div>
										<div className="flex flex-wrap gap-y-1 gap-x-4 text-xs text-slate-400">
											<span>
												Date: {drive.drive_date ? new Date(drive.drive_date).toLocaleDateString() : 'TBD'}
											</span>
											{drive.venue && <span>Venue: {drive.venue}</span>}
										</div>
										<div className="flex items-center justify-between pt-1 text-xs">
											<span className="text-slate-400">Panel Throughput:</span>
											<span className="font-semibold text-emerald-400">
												{drive.panel_throughput_rate != null ? `${drive.panel_throughput_rate}/hr` : 'Standard'}
											</span>
										</div>
									</div>
								))}
							</div>
						)}
					</section>

					{/* Assessment Sessions & Proctoring */}
					<section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
						<div className="flex items-center justify-between border-b border-slate-800 pb-3">
							<div className="flex items-center gap-2">
								<ShieldAlert className="h-5 w-5 text-amber-400" />
								<h2 className="text-base font-semibold text-white">Assessment Integrity & Proctoring</h2>
							</div>
							<span className="text-xs text-slate-500">{sessionsList.length} monitored</span>
						</div>

						{sessionsList.length === 0 ? (
							<div className="py-8 text-center text-xs text-slate-500">
								No proctored assessment sessions recorded yet.
							</div>
						) : (
							<div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
								{sessionsList.map((sess) => {
									const trust = sess.trust_score != null ? Number(sess.trust_score) : 100;
									return (
										<div
											key={sess.session_id}
											className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-2 hover:border-slate-700 transition"
										>
											<div className="flex items-center justify-between">
												<div>
													<span className="text-sm font-semibold text-white">{sess.student_name}</span>
													<span className="ml-2 text-xs text-slate-400">({sess.assessment_id})</span>
												</div>
												<span
													className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
														trust >= 80
															? 'bg-emerald-500/10 text-emerald-400'
															: trust >= 50
															? 'bg-amber-500/10 text-amber-400'
															: 'bg-rose-500/10 text-rose-400'
													}`}
												>
													Trust Score: {trust.toFixed(0)}%
												</span>
											</div>
											<div className="flex flex-wrap gap-y-1 gap-x-4 text-xs text-slate-400">
												<span className="flex items-center gap-1">
													<AlertTriangle className="h-3 w-3 text-amber-400" />
													Strikes: {sess.current_strikes ?? 0}
												</span>
												<span className="flex items-center gap-1">
													<Smartphone className="h-3 w-3 text-blue-400" />
													Mobile: {sess.mobile_connected ? 'Connected' : 'Offline'}
												</span>
												{sess.auto_submit_triggered && (
													<span className="text-rose-400 font-medium">Auto-Submit Triggered</span>
												)}
												<span className="text-slate-500">Status: {sess.status}</span>
											</div>
											<div className="text-[11px] text-slate-500">
												Session ID: {sess.session_id} • Started{' '}
												{sess.created_at ? new Date(sess.created_at).toLocaleString() : '—'}
											</div>
										</div>
									);
								})}
							</div>
						)}

						{/* Violations Log */}
						{violationsList.length > 0 && (
							<div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
								<h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
									Recent Proctoring Violations
								</h3>
								<div className="space-y-1.5 max-h-36 overflow-y-auto">
									{violationsList.map((v) => (
										<div
											key={v.id}
											className="flex items-center justify-between rounded bg-slate-800/60 px-3 py-1.5 text-xs"
										>
											<div className="flex items-center gap-2">
												<AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
												<span className="font-mono text-slate-300">{v.event_type}</span>
												<span className="text-[11px] text-slate-500">({v.session_id})</span>
											</div>
											<span className="text-[11px] text-slate-400">
												{v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : '—'}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</section>
				</div>
			)}

			{/* Read-Only Oversight Notice */}
			<div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs text-indigo-300 flex items-start gap-3">
				<CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
				<div>
					<p className="font-semibold text-indigo-200">Read-Only Monitoring Policy</p>
					<p className="mt-0.5 text-indigo-300/80">
						This oversight portal strictly observes attendance statistics and proctoring telemetry. Administrative operations do not alter candidate quiz scores or mutate proctoring session records.
					</p>
				</div>
			</div>
		</div>
	);
}
