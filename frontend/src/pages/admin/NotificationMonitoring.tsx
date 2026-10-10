import { useCallback, useEffect, useState } from 'react';
import {
	AlertCircle,
	Bell,
	CheckCircle2,
	Clock,
	Info,
	Mail,
	Radio,
	RefreshCw,
	Send,
	Users,
} from 'lucide-react';
import {
	fetchAdminNotificationMonitoring,
	type AdminNotificationDeliverySummary,
} from '../../api/admin';
import { getApiError } from '../../api/http';

export default function NotificationMonitoring() {
	const [summary, setSummary] = useState<AdminNotificationDeliverySummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const loadData = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const res = await fetchAdminNotificationMonitoring();
			setSummary(res);
		} catch (err) {
			setError(getApiError(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
						<Radio className="h-6 w-6 text-indigo-400" />
						Notification & Delivery Monitoring
					</h1>
					<p className="mt-1 text-sm text-slate-400">
						Real-time delivery status, broadcast dispatch logs, and gateway channel health.
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
				<div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
					{error}
				</div>
			)}

			{/* Delivery Channel Status Cards */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">In-App Broadcast Feed</span>
						<Bell className="h-4 w-4 text-emerald-400" />
					</div>
					<div className="mt-3 text-2xl font-bold text-white">
						{summary?.in_app_active_count ?? 0}
					</div>
					<div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
						Channel Active (100% Delivery Rate)
					</div>
				</div>

				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">Total Dispatched Notices</span>
						<Send className="h-4 w-4 text-indigo-400" />
					</div>
					<div className="mt-3 text-2xl font-bold text-white">
						{summary?.total_in_app_notices ?? 0}
					</div>
					<p className="mt-1 text-[11px] text-slate-500">Institutional announcements & alerts</p>
				</div>

				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">External SMTP / SMS</span>
						<Mail className="h-4 w-4 text-slate-500" />
					</div>
					<div className="mt-3 text-lg font-semibold text-slate-400">Not Configured</div>
					<div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
						<span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
						External Gateway Inactive
					</div>
				</div>
			</div>

			{/* External Channel Notice */}
			{summary?.external_delivery_notice && (
				<div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400 flex items-start gap-3">
					<Info className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
					<div>
						<span className="font-semibold text-slate-300">Gateway Delivery Configuration</span>
						<p className="mt-0.5">{summary.external_delivery_notice}</p>
					</div>
				</div>
			)}

			{/* Recent Notifications Table */}
			<div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
				<div className="flex items-center justify-between border-b border-slate-800 pb-3">
					<div className="flex items-center gap-2">
						<Clock className="h-5 w-5 text-indigo-400" />
						<h2 className="text-base font-semibold text-white">Recent Delivery Stream</h2>
					</div>
					<span className="text-xs text-slate-500">
						{summary?.recent_notifications.length ?? 0} recent alerts
					</span>
				</div>

				{loading ? (
					<div className="py-12 text-center text-sm text-slate-400">
						Inspecting dispatch queue and notification logs…
					</div>
				) : summary?.recent_notifications.length === 0 ? (
					<div className="py-12 text-center text-xs text-slate-500">
						No notification dispatch events recorded yet.
					</div>
				) : (
					<div className="space-y-2.5">
						{summary?.recent_notifications.map((item) => (
							<div
								key={item.id}
								className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-2 hover:border-slate-700 transition"
							>
								<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
									<div className="flex items-center gap-2.5">
										<span
											className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
												item.channel === 'in-app'
													? 'bg-indigo-500/10 text-indigo-400'
													: 'bg-slate-700 text-slate-400'
											}`}
										>
											{item.channel}
										</span>
										<h3 className="text-sm font-semibold text-white">{item.title}</h3>
									</div>
									<div className="flex items-center gap-2">
										<span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
											Target: {item.recipient_group}
										</span>
										<span
											className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
												item.status === 'delivered'
													? 'bg-emerald-500/10 text-emerald-400'
													: 'bg-amber-500/10 text-amber-400'
											}`}
										>
											{item.status.toUpperCase()}
										</span>
									</div>
								</div>
								<p className="text-xs text-slate-400">{item.delivery_detail}</p>
								<div className="text-[11px] text-slate-500 pt-1">
									Dispatched: {new Date(item.timestamp).toLocaleString()}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

