import { useCallback, useEffect, useState } from 'react';
import {
	AlertTriangle,
	CheckCircle,
	CheckCircle2,
	Clock,
	Copy,
	Database,
	Download,
	HardDrive,
	Layers,
	Lock,
	RefreshCw,
	Save,
	ShieldCheck,
} from 'lucide-react';
import {
	createAdminSnapshot,
	fetchAdminDatabaseStatus,
	type AdminDatabaseStatus,
	type AdminSnapshotResult,
} from '../../api/admin';
import { getApiError } from '../../api/http';

export default function BackupRecovery() {
	const [status, setStatus] = useState<AdminDatabaseStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState('');
	const [snapshotSuccess, setSnapshotSuccess] = useState<AdminSnapshotResult | null>(null);

	const loadData = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const res = await fetchAdminDatabaseStatus();
			setStatus(res);
		} catch (err) {
			setError(getApiError(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const handleCreateSnapshot = async () => {
		setCreating(true);
		setError('');
		setSnapshotSuccess(null);
		try {
			const res = await createAdminSnapshot();
			setSnapshotSuccess(res);
			await loadData();
		} catch (err) {
			setError(getApiError(err));
		} finally {
			setCreating(false);
		}
	};

	const formatBytes = (bytes: number) => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
						<Database className="h-6 w-6 text-indigo-400" />
						Backup & Recovery Management
					</h1>
					<p className="mt-1 text-sm text-slate-400">
						Database health monitoring, table row counts, and point-in-time SQLite snapshot generation.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => void loadData()}
						disabled={loading}
						className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
						Refresh Status
					</button>
					<button
						type="button"
						onClick={handleCreateSnapshot}
						disabled={creating || loading}
						className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 shadow-sm"
					>
						<Save className={`h-3.5 w-3.5 ${creating ? 'animate-pulse' : ''}`} />
						{creating ? 'Creating Snapshot…' : 'Create Snapshot Backup'}
					</button>
				</div>
			</div>

			{/* Success Alert */}
			{snapshotSuccess && (
				<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 space-y-2">
					<div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
						<CheckCircle className="h-5 w-5" />
						Snapshot Created Successfully
					</div>
					<p className="text-xs text-emerald-300">{snapshotSuccess.message}</p>
					<div className="flex gap-4 text-xs font-mono text-slate-300 pt-1">
						<span>Artifact: {snapshotSuccess.filename}</span>
						<span>Size: {formatBytes(snapshotSuccess.size_bytes)}</span>
					</div>
				</div>
			)}

			{/* Error Banner */}
			{error && (
				<div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
					{error}
				</div>
			)}

			{/* SQLite Core Status Cards */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">Database Engine</span>
						<HardDrive className="h-4 w-4 text-blue-400" />
					</div>
					<div className="mt-3 text-2xl font-bold text-white">SQLite 3</div>
					<p className="mt-1 font-mono text-[11px] text-slate-500 truncate" title={status?.database_path}>
						{status?.database_path ? status.database_path.split('\\').pop() : 'campuslink.db'}
					</p>
				</div>

				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">File Size</span>
						<Database className="h-4 w-4 text-indigo-400" />
					</div>
					<div className="mt-3 text-2xl font-bold text-white">
						{status ? formatBytes(status.database_size_bytes) : '—'}
					</div>
					<p className="mt-1 text-[11px] text-slate-500">Live on-disk allocation</p>
				</div>

				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">Journal Mode</span>
						<Layers className="h-4 w-4 text-emerald-400" />
					</div>
					<div className="mt-3 text-2xl font-bold text-emerald-400">
						{status?.wal_mode_enabled ? 'WAL' : 'DELETE'}
					</div>
					<p className="mt-1 text-[11px] text-slate-500">Concurrency & locking state</p>
				</div>

				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">Last Modified</span>
						<Clock className="h-4 w-4 text-amber-400" />
					</div>
					<div className="mt-3 text-base font-semibold text-white">
						{status ? new Date(status.last_modified).toLocaleTimeString() : '—'}
					</div>
					<p className="mt-1 text-[11px] text-slate-500">
						{status ? new Date(status.last_modified).toLocaleDateString() : '—'}
					</p>
				</div>
			</div>

			{/* Main Grid: Record Inventory & Available Backups */}
			{loading ? (
				<div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center text-sm text-slate-400">
					Inspecting database tables and backup artifacts…
				</div>
			) : (
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					{/* Table Record Counts */}
					<section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
						<div className="flex items-center justify-between border-b border-slate-800 pb-3">
							<div className="flex items-center gap-2">
								<Layers className="h-5 w-5 text-indigo-400" />
								<h2 className="text-base font-semibold text-white">Table Record Inventory</h2>
							</div>
							<span className="text-xs text-slate-500">Live Row Counts</span>
						</div>

						<div className="space-y-2">
							{status?.record_counts &&
								Object.entries(status.record_counts).map(([table, count]) => (
									<div
										key={table}
										className="flex items-center justify-between rounded-lg bg-slate-950/60 px-4 py-2.5 text-xs border border-slate-800/80"
									>
										<span className="font-mono text-slate-300">{table}</span>
										<span className="font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-full">
											{count.toLocaleString()}
										</span>
									</div>
								))}
						</div>
					</section>

					{/* Available Snapshot Backups */}
					<section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
						<div className="flex items-center justify-between border-b border-slate-800 pb-3">
							<div className="flex items-center gap-2">
								<HardDrive className="h-5 w-5 text-emerald-400" />
								<h2 className="text-base font-semibold text-white">Snapshot Artifacts</h2>
							</div>
							<span className="text-xs text-slate-500">
								{status?.available_backups.length ?? 0} saved
							</span>
						</div>

						{status?.available_backups.length === 0 ? (
							<div className="py-12 text-center text-xs text-slate-500">
								No snapshot backups found. Click &quot;Create Snapshot Backup&quot; to generate an instant point-in-time backup.
							</div>
						) : (
							<div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
								{status?.available_backups.map((bk, idx) => (
									<div
										key={idx}
										className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-1 hover:border-slate-700 transition"
									>
										<div className="flex items-center justify-between">
											<span className="font-mono text-xs font-semibold text-slate-200">
												{bk.filename}
											</span>
											<span className="text-[11px] font-medium text-emerald-400">
												{formatBytes(bk.size_bytes)}
											</span>
										</div>
										<div className="text-[11px] text-slate-500">
											Created: {new Date(bk.created_at).toLocaleString()}
										</div>
									</div>
								))}
							</div>
						)}
					</section>
				</div>
			)}

			{/* Non-Destructive Protection Notice */}
			<div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs text-indigo-300 flex items-start gap-3">
				<ShieldCheck className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
				<div>
					<p className="font-semibold text-indigo-200">Database Safety & Zero-Loss Guarantee</p>
					<p className="mt-0.5 text-indigo-300/80">
						{status?.safety_disclaimer ||
							'CampusLink strictly preserves the active campuslink.db file. Automated snapshots utilize non-blocking SQLite online backup APIs without mutating schemas or terminating active connections.'}
					</p>
				</div>
			</div>
		</div>
	);
}

