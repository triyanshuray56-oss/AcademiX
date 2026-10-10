import { useCallback, useEffect, useState } from 'react';
import {
	CheckCircle,
	CheckCircle2,
	Clock,
	Filter,
	HelpCircle,
	Inbox,
	LifeBuoy,
	MessageSquare,
	RefreshCw,
	Search,
	XCircle,
} from 'lucide-react';
import {
	fetchAdminGrievances,
	updateAdminGrievance,
	type AdminGrievanceItem,
} from '../../api/admin';
import { getApiError } from '../../api/http';

export default function GrievanceManagement() {
	const [items, setItems] = useState<AdminGrievanceItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('');
	const [categoryFilter, setCategoryFilter] = useState('');

	// Selected grievance for review modal
	const [activeGrievance, setActiveGrievance] = useState<AdminGrievanceItem | null>(null);
	const [reviewStatus, setReviewStatus] = useState<'pending' | 'in_review' | 'resolved' | 'dismissed'>('resolved');
	const [resolutionNote, setResolutionNote] = useState('');
	const [updating, setUpdating] = useState(false);
	const [updateSuccess, setUpdateSuccess] = useState('');

	const loadData = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const res = await fetchAdminGrievances({
				search: search || undefined,
				status: statusFilter || undefined,
				category: categoryFilter || undefined,
			});
			setItems(res);
		} catch (err) {
			setError(getApiError(err));
		} finally {
			setLoading(false);
		}
	}, [search, statusFilter, categoryFilter]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const handleStatusUpdate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!activeGrievance) return;
		setUpdating(true);
		setError('');
		setUpdateSuccess('');
		try {
			const updated = await updateAdminGrievance(activeGrievance.id, {
				status: reviewStatus,
				resolution_note: resolutionNote || undefined,
			});
			setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
			setUpdateSuccess(`Support ticket #${updated.id} marked as ${updated.status}.`);
			setActiveGrievance(null);
			setResolutionNote('');
		} catch (err) {
			setError(getApiError(err));
		} finally {
			setUpdating(false);
		}
	};

	const pendingCount = items.filter((i) => i.status === 'pending').length;
	const resolvedCount = items.filter((i) => i.status === 'resolved').length;
	const dismissedCount = items.filter((i) => i.status === 'dismissed').length;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
						<LifeBuoy className="h-6 w-6 text-indigo-400" />
						Grievances & Support Requests
					</h1>
					<p className="mt-1 text-sm text-slate-400">
						Triage student inquiries, venue and schedule assistance tickets, and placement cell grievance threads.
					</p>
				</div>
				<button
					type="button"
					onClick={() => void loadData()}
					disabled={loading}
					className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
				>
					<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
					Refresh Tickets
				</button>
			</div>

			{/* Success and Error Banners */}
			{updateSuccess && (
				<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-center justify-between">
					<span>{updateSuccess}</span>
					<button type="button" onClick={() => setUpdateSuccess('')} className="text-emerald-400 hover:text-white">
						×
					</button>
				</div>
			)}
			{error && (
				<div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
					{error}
				</div>
			)}

			{/* Summary Counters */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">Pending Triage</span>
						<Clock className="h-4 w-4 text-amber-400" />
					</div>
					<div className="mt-3 text-2xl font-bold text-amber-400">{pendingCount}</div>
					<p className="mt-1 text-[11px] text-slate-500">Requires administrative attention</p>
				</div>
				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">Resolved Requests</span>
						<CheckCircle className="h-4 w-4 text-emerald-400" />
					</div>
					<div className="mt-3 text-2xl font-bold text-emerald-400">{resolvedCount}</div>
					<p className="mt-1 text-[11px] text-slate-500">Addressed and closed tickets</p>
				</div>
				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">Dismissed / Closed</span>
						<XCircle className="h-4 w-4 text-slate-400" />
					</div>
					<div className="mt-3 text-2xl font-bold text-slate-300">{dismissedCount}</div>
					<p className="mt-1 text-[11px] text-slate-500">Declined or non-actionable queries</p>
				</div>
			</div>

			{/* Search & Filters */}
			<div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
				<div className="flex flex-wrap items-center gap-4">
					<div className="relative flex-1 min-w-[200px]">
						<Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
						<input
							type="text"
							placeholder="Search by student, email, subject, or message..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="w-full rounded-lg border border-slate-700 bg-slate-800 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
						/>
					</div>
					<div>
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
						>
							<option value="">All Statuses</option>
							<option value="pending">Pending</option>
							<option value="resolved">Resolved</option>
							<option value="dismissed">Dismissed</option>
						</select>
					</div>
					<div>
						<select
							value={categoryFilter}
							onChange={(e) => setCategoryFilter(e.target.value)}
							className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
						>
							<option value="">All Categories</option>
							<option value="Placement Inquiries">Placement Inquiries</option>
							<option value="Student Support">Student Support</option>
						</select>
					</div>
				</div>
			</div>

			{/* Main List */}
			{loading ? (
				<div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center text-sm text-slate-400">
					Loading support tickets and candidate inquiries…
				</div>
			) : items.length === 0 ? (
				<div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center">
					<Inbox className="mx-auto h-8 w-8 text-slate-600 mb-2" />
					<p className="text-sm font-medium text-slate-400">No support requests found</p>
					<p className="text-xs text-slate-500 mt-1">There are currently no matching grievance tickets or inquiry threads.</p>
				</div>
			) : (
				<div className="space-y-3">
					{items.map((item) => (
						<div
							key={item.id}
							className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3 hover:border-slate-700 transition"
						>
							<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
								<div className="flex items-center gap-3">
									<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 font-semibold text-xs">
										#{item.id}
									</div>
									<div>
										<h3 className="text-sm font-semibold text-white">{item.subject}</h3>
										<div className="flex items-center gap-2 text-xs text-slate-400">
											<span>{item.requester_name}</span>
											<span>•</span>
											<span className="font-mono text-slate-500">{item.requester_email}</span>
										</div>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<span className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-400">
										{item.category}
									</span>
									<span
										className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
											item.status === 'resolved'
												? 'bg-emerald-500/10 text-emerald-400'
												: item.status === 'dismissed'
												? 'bg-slate-700 text-slate-400'
												: 'bg-amber-500/10 text-amber-400'
										}`}
									>
										{item.status.toUpperCase()}
									</span>
									<button
										type="button"
										onClick={() => {
											setActiveGrievance(item);
											setReviewStatus(item.status === 'resolved' ? 'resolved' : 'resolved');
										}}
										className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-slate-700"
									>
										Triage
									</button>
								</div>
							</div>

							<div className="rounded-lg bg-slate-950/50 p-3 text-xs text-slate-300 leading-relaxed font-normal">
								{item.message}
							</div>

							<div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
								<span>Submitted {new Date(item.created_at).toLocaleString()}</span>
								<span>Assigned: {item.assigned_to || 'Placement Cell Admin'}</span>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Review / Triage Modal */}
			{activeGrievance && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
					<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
						<div className="flex items-center justify-between border-b border-slate-800 pb-3">
							<h3 className="text-base font-semibold text-white">Triage Support Ticket #{activeGrievance.id}</h3>
							<button
								type="button"
								onClick={() => setActiveGrievance(null)}
								className="text-slate-400 hover:text-white"
							>
								×
							</button>
						</div>

						<form onSubmit={handleStatusUpdate} className="space-y-4">
							<div>
								<label className="block text-xs font-medium text-slate-300 mb-1">Update Status</label>
								<select
									value={reviewStatus}
									onChange={(e) => setReviewStatus(e.target.value as any)}
									className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
								>
									<option value="resolved">Mark Resolved</option>
									<option value="dismissed">Dismiss / Close</option>
									<option value="pending">Keep Pending</option>
								</select>
							</div>

							<div>
								<label className="block text-xs font-medium text-slate-300 mb-1">
									Resolution Note (Optional)
								</label>
								<textarea
									rows={3}
									value={resolutionNote}
									onChange={(e) => setResolutionNote(e.target.value)}
									placeholder="Add internal resolution comments or remarks for records..."
									className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
								/>
							</div>

							<div className="flex justify-end gap-2 pt-2">
								<button
									type="button"
									onClick={() => setActiveGrievance(null)}
									className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={updating}
									className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
								>
									{updating ? 'Updating…' : 'Save Status'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

