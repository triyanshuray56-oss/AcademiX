import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
	Archive,
	CheckCircle2,
	Filter,
	Megaphone,
	Plus,
	RefreshCw,
	Search,
	Trash2,
	Upload,
} from 'lucide-react';
import {
	createAdminAnnouncement,
	deleteAdminAnnouncement,
	fetchAdminAnnouncements,
	updateAdminAnnouncement,
	type AdminAnnouncement,
	type AdminAnnouncementCreate,
} from '../../api/admin';
import { getApiError } from '../../api/http';

export default function NotificationCenter() {
	const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');

	// Filters
	const [search, setSearch] = useState('');
	const [searchInput, setSearchInput] = useState('');
	const [category, setCategory] = useState('');
	const [priority, setPriority] = useState('');
	const [statusFilter, setStatusFilter] = useState('');

	// New Announcement Form State
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [formTitle, setFormTitle] = useState('');
	const [formCategory, setFormCategory] = useState('Placement');
	const [formPriority, setFormPriority] = useState<'Low' | 'Normal' | 'High'>('Normal');
	const [formMessage, setFormMessage] = useState('');

	const load = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const data = await fetchAdminAnnouncements({
				search,
				category,
				priority: priority || undefined,
				is_published: statusFilter,
			});
			setAnnouncements(data);
		} catch (err) {
			setError(getApiError(err));
		} finally {
			setLoading(false);
		}
	}, [category, priority, search, statusFilter]);

	useEffect(() => {
		void load();
	}, [load]);

	const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setSearch(searchInput.trim());
	};

	const handleCreateAnnouncement = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!formTitle.trim() || !formMessage.trim()) {
			setError('Title and message are required.');
			return;
		}
		setSubmitting(true);
		setError('');
		setNotice('');
		try {
			const payload: AdminAnnouncementCreate = {
				title: formTitle.trim(),
				message: formMessage.trim(),
				category: formCategory.trim() || 'General',
				priority: formPriority,
			};
			await createAdminAnnouncement(payload);
			setNotice('Institutional announcement published successfully.');
			setShowCreateModal(false);
			setFormTitle('');
			setFormMessage('');
			await load();
		} catch (err) {
			setError(getApiError(err));
		} finally {
			setSubmitting(false);
		}
	};

	const handleTogglePublish = async (announcement: AdminAnnouncement) => {
		const nextState = !announcement.is_published;
		const action = nextState ? 'publish' : 'archive';
		if (!window.confirm(`Are you sure you want to ${action} "${announcement.title}"?`)) return;
		setError('');
		setNotice('');
		try {
			await updateAdminAnnouncement(announcement.id, { is_published: nextState });
			setNotice(`Announcement "${announcement.title}" ${nextState ? 'published' : 'archived'}.`);
			await load();
		} catch (err) {
			setError(getApiError(err));
		}
	};

	const handleDelete = async (announcement: AdminAnnouncement) => {
		if (!window.confirm(`Permanently remove announcement "${announcement.title}"?`)) return;
		setError('');
		setNotice('');
		try {
			await deleteAdminAnnouncement(announcement.id);
			setNotice(`Announcement "${announcement.title}" removed.`);
			await load();
		} catch (err) {
			setError(getApiError(err));
		}
	};

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
						<Megaphone className="h-6 w-6 text-indigo-400" />
						Announcements & Notices
					</h1>
					<p className="mt-1 text-sm text-slate-400">
						Publish, monitor, and moderate campus-wide recruitment notices and institutional bulletins.
					</p>
				</div>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => void load()}
						disabled={loading}
						className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
						Refresh
					</button>
					<button
						type="button"
						onClick={() => setShowCreateModal(true)}
						className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
					>
						<Plus className="h-4 w-4" />
						Create Notice
					</button>
				</div>
			</div>

			{/* Status Feedback Alerts */}
			{error && (
				<div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
					{error}
				</div>
			)}
			{notice && (
				<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
					<CheckCircle2 className="h-4 w-4 shrink-0" />
					{notice}
				</div>
			)}

			{/* Filter Toolbar */}
			<div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
						<div className="relative flex-1 max-w-md">
							<Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
							<input
								type="text"
								placeholder="Search notices by title or content…"
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
							/>
						</div>
						<button
							type="submit"
							className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
						>
							Search
						</button>
					</form>

					<div className="flex flex-wrap items-center gap-2">
						<div className="flex items-center gap-1.5 text-xs text-slate-400">
							<Filter className="h-3.5 w-3.5" />
							<span>Filters:</span>
						</div>
						<select
							value={category}
							onChange={(e) => setCategory(e.target.value)}
							className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-indigo-400 focus:outline-none"
						>
							<option value="">All Categories</option>
							<option value="Placement">Placement</option>
							<option value="Academic">Academic</option>
							<option value="Urgent">Urgent</option>
							<option value="General">General</option>
						</select>

						<select
							value={priority}
							onChange={(e) => setPriority(e.target.value)}
							className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-indigo-400 focus:outline-none"
						>
							<option value="">All Priorities</option>
							<option value="High">High</option>
							<option value="Normal">Normal</option>
							<option value="Low">Low</option>
						</select>

						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-indigo-400 focus:outline-none"
						>
							<option value="">All Statuses</option>
							<option value="true">Published</option>
							<option value="false">Archived</option>
						</select>
					</div>
				</div>
			</div>

			{/* Announcements List */}
			{loading ? (
				<div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center text-sm text-slate-400">
					Loading institutional announcements…
				</div>
			) : announcements.length === 0 ? (
				<div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center">
					<Megaphone className="mx-auto h-10 w-10 text-slate-600 mb-2" />
					<h3 className="text-sm font-semibold text-slate-300">No announcements found</h3>
					<p className="mt-1 text-xs text-slate-500">
						{search || category || priority || statusFilter
							? 'No records matched your search filters.'
							: 'No institutional notices have been created yet.'}
					</p>
				</div>
			) : (
				<div className="grid gap-4">
					{announcements.map((item) => (
						<article
							key={item.id}
							className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 transition hover:border-slate-700"
						>
							<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
								<div className="space-y-1.5">
									<div className="flex flex-wrap items-center gap-2">
										<span
											className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border ${
												item.priority === 'High'
													? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
													: item.priority === 'Normal'
													? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
													: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
											}`}
										>
											{item.priority} Priority
										</span>
										<span className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
											{item.category}
										</span>
										<span
											className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border ${
												item.is_published
													? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
													: 'bg-amber-500/10 text-amber-300 border-amber-500/20'
											}`}
										>
											{item.is_published ? 'Published' : 'Archived'}
										</span>
									</div>
									<h2 className="text-base font-semibold text-slate-100">{item.title}</h2>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<button
										type="button"
										onClick={() => void handleTogglePublish(item)}
										className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
											item.is_published
												? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
												: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
										}`}
									>
										{item.is_published ? (
											<>
												<Archive className="h-3.5 w-3.5" /> Archive
											</>
										) : (
											<>
												<Upload className="h-3.5 w-3.5" /> Publish
											</>
										)}
									</button>
									<button
										type="button"
										onClick={() => void handleDelete(item)}
										className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
									>
										<Trash2 className="h-3.5 w-3.5" />
									</button>
								</div>
							</div>
							<p className="mt-3 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
								{item.message}
							</p>
							<div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
								<span>Author: {item.created_by || 'Administrator'}</span>
								<span>
									Published:{' '}
									{new Date(item.published_at).toLocaleString(undefined, {
										dateStyle: 'medium',
										timeStyle: 'short',
									})}
								</span>
							</div>
						</article>
					))}
				</div>
			)}

			{/* Create Notice Modal */}
			{showCreateModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
					<div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
						<h2 className="text-lg font-bold text-white flex items-center gap-2">
							<Megaphone className="h-5 w-5 text-indigo-400" />
							Publish Institutional Announcement
						</h2>
						<p className="mt-1 text-xs text-slate-400">
							Create a real announcement visible to students and placement coordinators.
						</p>

						<form onSubmit={handleCreateAnnouncement} className="mt-4 space-y-4">
							<div>
								<label className="block text-xs font-medium text-slate-300">Title</label>
								<input
									type="text"
									required
									value={formTitle}
									onChange={(e) => setFormTitle(e.target.value)}
									placeholder="e.g. Mandatory Placement Drive Orientation"
									className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
								/>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-xs font-medium text-slate-300">Category</label>
									<select
										value={formCategory}
										onChange={(e) => setFormCategory(e.target.value)}
										className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-400 focus:outline-none"
									>
										<option value="Placement">Placement</option>
										<option value="Academic">Academic</option>
										<option value="Urgent">Urgent</option>
										<option value="General">General</option>
									</select>
								</div>
								<div>
									<label className="block text-xs font-medium text-slate-300">Priority</label>
									<select
										value={formPriority}
										onChange={(e) =>
											setFormPriority(e.target.value as 'Low' | 'Normal' | 'High')
										}
										className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-400 focus:outline-none"
									>
										<option value="Low">Low</option>
										<option value="Normal">Normal</option>
										<option value="High">High</option>
									</select>
								</div>
							</div>

							<div>
								<label className="block text-xs font-medium text-slate-300">Message Content</label>
								<textarea
									required
									rows={4}
									value={formMessage}
									onChange={(e) => setFormMessage(e.target.value)}
									placeholder="Write detailed notification message instructions…"
									className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
								/>
							</div>

							<div className="mt-6 flex justify-end gap-3 pt-2">
								<button
									type="button"
									onClick={() => setShowCreateModal(false)}
									disabled={submitting}
									className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={submitting}
									className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
								>
									{submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
									{submitting ? 'Publishing…' : 'Publish Announcement'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}