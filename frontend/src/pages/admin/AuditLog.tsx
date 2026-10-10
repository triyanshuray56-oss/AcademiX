import { useCallback, useEffect, useState } from 'react';
import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	Filter,
	History,
	Info,
	Lock,
	RefreshCw,
	ShieldAlert,
	ShieldCheck,
} from 'lucide-react';
import { fetchAdminAuditLogs, type AdminAuditSummary } from '../../api/admin';
import { getApiError } from '../../api/http';

export default function AuditLog() {
	const [auditData, setAuditData] = useState<AdminAuditSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	// Filters
	const [category, setCategory] = useState('');
	const [severity, setSeverity] = useState('');

	const loadAuditLogs = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const data = await fetchAdminAuditLogs({
				category: category || undefined,
				severity: severity || undefined,
			});
			setAuditData(data);
		} catch (err) {
			setError(getApiError(err));
		} finally {
			setLoading(false);
		}
	}, [category, severity]);

	useEffect(() => {
		void loadAuditLogs();
	}, [loadAuditLogs]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
						<ShieldCheck className="h-6 w-6 text-indigo-400" />
						Security & Compliance Audit Logs
					</h1>
					<p className="mt-1 text-sm text-slate-400">
						Immutable audit log of administrative events, access rights, drive conflicts, and compliance integrity.
					</p>
				</div>
				<button
					type="button"
					onClick={() => void loadAuditLogs()}
					disabled={loading}
					className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
				>
					<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
					Refresh Audit Stream
				</button>
			</div>

			{/* Error Banner */}
			{error && (
				<div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
					<AlertCircle className="h-4 w-4 shrink-0" />
					<span>{error}</span>
				</div>
			)}

			{/* Security Status Banner */}
			{auditData && (
				<div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-3">
							<div
								className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
									auditData.conflicted_drives > 0
										? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
										: auditData.warnings.length > 0
										? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
										: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
								}`}
							>
								{auditData.conflicted_drives > 0 ? (
									<ShieldAlert className="h-5 w-5" />
								) : auditData.warnings.length > 0 ? (
									<AlertTriangle className="h-5 w-5" />
								) : (
									<ShieldCheck className="h-5 w-5" />
								)}
							</div>
							<div>
								<h2 className="text-sm font-semibold text-white">System Security Health</h2>
								<p className="text-xs text-slate-400">{auditData.security_status}</p>
							</div>
						</div>

						<div className="flex flex-wrap items-center gap-2 text-xs">
							<span className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1 text-slate-300">
								Active Admins: <strong className="text-white">{auditData.active_admins}</strong>
							</span>
							<span className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1 text-slate-300">
								Deactivated Accounts:{' '}
								<strong className="text-amber-300">{auditData.inactive_accounts}</strong>
							</span>
							<span className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1 text-slate-300">
								Unverified Students:{' '}
								<strong className="text-amber-300">{auditData.unverified_students}</strong>
							</span>
							<span className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1 text-slate-300">
								Conflicted Drives:{' '}
								<strong className="text-rose-300">{auditData.conflicted_drives}</strong>
							</span>
						</div>
					</div>

					{/* Warnings list if any */}
					{auditData.warnings.length > 0 && (
						<div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300 space-y-1">
							<p className="font-semibold flex items-center gap-1.5">
								<AlertTriangle className="h-3.5 w-3.5" />
								Compliance Notices Detected:
							</p>
							<ul className="list-disc list-inside space-y-0.5 text-amber-200/90 pl-1">
								{auditData.warnings.map((w, idx) => (
									<li key={idx}>{w}</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}

			{/* Filter Toolbar */}
			<div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-2 text-xs text-slate-400">
						<Filter className="h-3.5 w-3.5" />
						<span className="font-medium text-slate-300">Filter Audit Events</span>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<select
							value={category}
							onChange={(e) => setCategory(e.target.value)}
							className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 focus:border-indigo-400 focus:outline-none"
						>
							<option value="">All Categories</option>
							<option value="Access">Access & Roles</option>
							<option value="Security">Account Security</option>
							<option value="Drive">Drive Operations</option>
							<option value="Compliance">Student Compliance</option>
							<option value="Assessment">Assessment Integrity</option>
							<option value="Announcements">Announcements</option>
						</select>

						<select
							value={severity}
							onChange={(e) => setSeverity(e.target.value)}
							className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 focus:border-indigo-400 focus:outline-none"
						>
							<option value="">All Severities</option>
							<option value="critical">Critical</option>
							<option value="warning">Warning</option>
							<option value="info">Info</option>
						</select>
					</div>
				</div>
			</div>

			{/* Audit Events Table */}
			{loading ? (
				<div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center text-sm text-slate-400">
					Loading security audit events…
				</div>
			) : !auditData || auditData.entries.length === 0 ? (
				<div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center">
					<History className="mx-auto h-10 w-10 text-slate-600 mb-2" />
					<h3 className="text-sm font-semibold text-slate-300">No audit events match filters</h3>
					<p className="mt-1 text-xs text-slate-500">
						No operational or security entries were found for the selected category or severity.
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-800 text-left text-xs">
							<thead className="bg-slate-950/70 text-slate-400">
								<tr>
									<th scope="col" className="px-4 py-3 font-semibold">
										Timestamp
									</th>
									<th scope="col" className="px-4 py-3 font-semibold">
										Severity
									</th>
									<th scope="col" className="px-4 py-3 font-semibold">
										Category
									</th>
									<th scope="col" className="px-4 py-3 font-semibold">
										Event / Actor
									</th>
									<th scope="col" className="px-4 py-3 font-semibold">
										Action Details & Audit State
									</th>
									<th scope="col" className="px-4 py-3 font-semibold text-right">
										Integrity
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-800 text-slate-300">
								{auditData.entries.map((entry, index) => {
									const isCritical = entry.severity === 'critical';
									const isWarning = entry.severity === 'warning';
									return (
										<tr
											key={index}
											className="transition hover:bg-slate-800/40"
										>
											<td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-400">
												{new Date(entry.recorded_at).toLocaleString(undefined, {
													dateStyle: 'short',
													timeStyle: 'medium',
												})}
											</td>
											<td className="whitespace-nowrap px-4 py-3">
												<span
													className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
														isCritical
															? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
															: isWarning
															? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
															: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
													}`}
												>
													{isCritical ? (
														<AlertCircle className="h-3 w-3" />
													) : isWarning ? (
														<AlertTriangle className="h-3 w-3" />
													) : (
														<Info className="h-3 w-3" />
													)}
													{entry.severity.toUpperCase()}
												</span>
											</td>
											<td className="whitespace-nowrap px-4 py-3">
												<span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
													{entry.category}
												</span>
											</td>
											<td className="px-4 py-3 font-medium text-slate-100">
												{entry.label}
											</td>
											<td className="px-4 py-3 text-slate-400 text-[11px] leading-relaxed max-w-md">
												{entry.detail}
											</td>
											<td className="whitespace-nowrap px-4 py-3 text-right">
												<span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
													<Lock className="h-3 w-3" /> Immutable
												</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}