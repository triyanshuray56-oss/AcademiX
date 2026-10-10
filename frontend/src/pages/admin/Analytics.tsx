import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
	AlertTriangle,
	BarChart3,
	Building2,
	CheckCircle2,
	Download,
	FileSpreadsheet,
	Filter,
	GraduationCap,
	RefreshCw,
	Search,
	ShieldAlert,
	Users,
} from 'lucide-react';
import {
	exportAdminReport,
	fetchAdminReportSummary,
	type AdminReportSummary,
} from '../../api/admin';
import { getApiError } from '../../api/http';

export default function Analytics() {
	const [summary, setSummary] = useState<AdminReportSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [exporting, setExporting] = useState(false);
	const [error, setError] = useState('');
	const [successNotice, setSuccessNotice] = useState('');

	// Export filter configuration
	const [dataset, setDataset] = useState<
		'students' | 'drives' | 'applications' | 'recruiters' | 'announcements'
	>('students');
	const [exportSearch, setExportSearch] = useState('');
	const [exportBranch, setExportBranch] = useState('');
	const [exportStatus, setExportStatus] = useState('');

	const loadSummary = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const data = await fetchAdminReportSummary();
			setSummary(data);
		} catch (err) {
			setError(getApiError(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadSummary();
	}, [loadSummary]);

	const handleDownloadReport = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setExporting(true);
		setError('');
		setSuccessNotice('');
		try {
			const result = await exportAdminReport({
				dataset,
				search: exportSearch.trim(),
				branch: exportBranch.trim(),
				status: exportStatus.trim(),
			});

			// Trigger file download in browser
			const blob = new Blob([result.content], { type: result.media_type || 'text/csv;charset=utf-8;' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.setAttribute('download', result.filename);
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			setSuccessNotice(`Report exported successfully: ${result.filename}`);
		} catch (err) {
			setError(getApiError(err));
		} finally {
			setExporting(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
						<BarChart3 className="h-6 w-6 text-indigo-400" />
						Reports & Institutional Analytics
					</h1>
					<p className="mt-1 text-sm text-slate-400">
						Real-time institutional metrics, placement pipeline health, and sanitized CSV data exports.
					</p>
				</div>
				<button
					type="button"
					onClick={() => void loadSummary()}
					disabled={loading}
					className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
				>
					<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
					Refresh Metrics
				</button>
			</div>

			{/* Status Feedback */}
			{error && (
				<div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
					{error}
				</div>
			)}
			{successNotice && (
				<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
					<CheckCircle2 className="h-4 w-4 shrink-0" />
					{successNotice}
				</div>
			)}

			{/* Institutional Summary Cards */}
			{loading ? (
				<div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center text-sm text-slate-400">
					Loading institutional reporting data…
				</div>
			) : summary ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
					<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
						<div className="flex items-center gap-2 text-xs font-medium text-slate-400">
							<GraduationCap className="h-4 w-4 text-indigo-400" />
							<span>Students</span>
						</div>
						<p className="mt-2 text-2xl font-bold text-white">{summary.students}</p>
						<p className="mt-1 text-[11px] text-slate-500">Total profiles</p>
					</div>

					<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
						<div className="flex items-center gap-2 text-xs font-medium text-slate-400">
							<Building2 className="h-4 w-4 text-cyan-400" />
							<span>Active Recruiters</span>
						</div>
						<p className="mt-2 text-2xl font-bold text-white">{summary.active_recruiters}</p>
						<p className="mt-1 text-[11px] text-slate-500">Verified companies</p>
					</div>

					<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
						<div className="flex items-center gap-2 text-xs font-medium text-slate-400">
							<FileSpreadsheet className="h-4 w-4 text-emerald-400" />
							<span>Scheduled Drives</span>
						</div>
						<p className="mt-2 text-2xl font-bold text-white">{summary.scheduled_drives}</p>
						<p className="mt-1 text-[11px] text-slate-500">Upcoming calendar</p>
					</div>

					<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
						<div className="flex items-center gap-2 text-xs font-medium text-slate-400">
							<Users className="h-4 w-4 text-purple-400" />
							<span>Applications</span>
						</div>
						<p className="mt-2 text-2xl font-bold text-white">{summary.open_applications}</p>
						<p className="mt-1 text-[11px] text-slate-500">Active pipeline</p>
					</div>

					<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
						<div className="flex items-center gap-2 text-xs font-medium text-slate-400">
							<AlertTriangle className="h-4 w-4 text-amber-400" />
							<span>Conflicts</span>
						</div>
						<p
							className={`mt-2 text-2xl font-bold ${
								summary.conflicted_drives > 0 ? 'text-amber-300' : 'text-slate-300'
							}`}
						>
							{summary.conflicted_drives}
						</p>
						<p className="mt-1 text-[11px] text-slate-500">Drive overlaps</p>
					</div>

					<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
						<div className="flex items-center gap-2 text-xs font-medium text-slate-400">
							<ShieldAlert className="h-4 w-4 text-rose-400" />
							<span>Unverified Students</span>
						</div>
						<p
							className={`mt-2 text-2xl font-bold ${
								summary.unverified_students > 0 ? 'text-rose-300' : 'text-slate-300'
							}`}
						>
							{summary.unverified_students}
						</p>
						<p className="mt-1 text-[11px] text-slate-500">ID / Docs pending</p>
					</div>

					<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
						<div className="flex items-center gap-2 text-xs font-medium text-slate-400">
							<Users className="h-4 w-4 text-slate-400" />
							<span>Active Admins</span>
						</div>
						<p className="mt-2 text-2xl font-bold text-white">{summary.active_admins}</p>
						<p className="mt-1 text-[11px] text-slate-500">System managers</p>
					</div>

					<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
						<div className="flex items-center gap-2 text-xs font-medium text-slate-400">
							<ShieldAlert className="h-4 w-4 text-amber-400" />
							<span>Inactive Accounts</span>
						</div>
						<p className="mt-2 text-2xl font-bold text-white">{summary.inactive_accounts}</p>
						<p className="mt-1 text-[11px] text-slate-500">Deactivated users</p>
					</div>

					<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
						<div className="flex items-center gap-2 text-xs font-medium text-slate-400">
							<BarChart3 className="h-4 w-4 text-cyan-400" />
							<span>Notices</span>
						</div>
						<p className="mt-2 text-2xl font-bold text-white">
							{summary.published_announcements}
						</p>
						<p className="mt-1 text-[11px] text-slate-500">Published bulletins</p>
					</div>
				</div>
			) : null}

			{/* CSV Data Export Section */}
			<section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
				<div className="flex items-center gap-2.5">
					<FileSpreadsheet className="h-5 w-5 text-indigo-400" />
					<h2 className="text-base font-semibold text-white">Export Dataset to CSV</h2>
				</div>
				<p className="mt-1 text-xs text-slate-400">
					Generate sanitized, RFC 4180-compliant CSV exports with spreadsheet formula injection protection.
					Passwords, credentials, and cryptographic secrets are strictly excluded.
				</p>

				<form onSubmit={handleDownloadReport} className="mt-5 space-y-4">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<div>
							<label className="block text-xs font-medium text-slate-300">Dataset Target</label>
							<select
								value={dataset}
								onChange={(e) =>
									setDataset(
										e.target.value as
											| 'students'
											| 'drives'
											| 'applications'
											| 'recruiters'
											| 'announcements'
									)
								}
								className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-400 focus:outline-none"
							>
								<option value="students">Student Directory & Academics</option>
								<option value="drives">Placement Drives & Venues</option>
								<option value="applications">Student Applications & Status</option>
								<option value="recruiters">Recruiter Accounts & Profiles</option>
								<option value="announcements">Institutional Notices & Bulletins</option>
							</select>
						</div>

						<div>
							<label className="block text-xs font-medium text-slate-300">Filter Search</label>
							<div className="relative mt-1">
								<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
								<input
									type="text"
									placeholder="Keyword filter…"
									value={exportSearch}
									onChange={(e) => setExportSearch(e.target.value)}
									className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
								/>
							</div>
						</div>

						<div>
							<label className="block text-xs font-medium text-slate-300">
								Branch (Students / Apps)
							</label>
							<input
								type="text"
								placeholder="e.g. CSE, ECE, MECH"
								value={exportBranch}
								onChange={(e) => setExportBranch(e.target.value)}
								className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
							/>
						</div>

						<div>
							<label className="block text-xs font-medium text-slate-300">Status</label>
							<input
								type="text"
								placeholder="e.g. Scheduled, Applied"
								value={exportStatus}
								onChange={(e) => setExportStatus(e.target.value)}
								className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
							/>
						</div>
					</div>

					<div className="flex items-center justify-between pt-3 border-t border-slate-800">
						<span className="text-[11px] text-slate-500">
							Generated as text/csv format with UTF-8 character encoding.
						</span>
						<button
							type="submit"
							disabled={exporting}
							className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
						>
							{exporting ? (
								<RefreshCw className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Download className="h-3.5 w-3.5" />
							)}
							{exporting ? 'Generating CSV…' : 'Export and Download CSV'}
						</button>
					</div>
				</form>
			</section>
		</div>
	);
}