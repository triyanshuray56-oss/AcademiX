import { useCallback, useEffect, useState } from 'react';
import {
	Activity,
	CheckCircle2,
	Cpu,
	Database,
	Globe,
	Info,
	Lock,
	RefreshCw,
	Server,
	ShieldCheck,
	Sliders,
	WifiOff,
} from 'lucide-react';
import {
	fetchAdminIntegrations,
	fetchAdminSettings,
	type AdminIntegrationStatus,
	type AdminSettings,
} from '../../api/admin';
import { getApiError } from '../../api/http';

export default function SystemSettings() {
	const [settings, setSettings] = useState<AdminSettings | null>(null);
	const [integrations, setIntegrations] = useState<AdminIntegrationStatus[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const loadData = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const [settingsRes, integrationsRes] = await Promise.all([
				fetchAdminSettings(),
				fetchAdminIntegrations(),
			]);
			setSettings(settingsRes);
			setIntegrations(integrationsRes);
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
						<Sliders className="h-6 w-6 text-indigo-400" />
						System Settings & Integrations
					</h1>
					<p className="mt-1 text-sm text-slate-400">
						Inspected environment parameters, safe application configuration, and live connector health.
					</p>
				</div>
				<button
					type="button"
					onClick={() => void loadData()}
					disabled={loading}
					className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
				>
					<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
					Re-check Integrations
				</button>
			</div>

			{/* Error Banner */}
			{error && (
				<div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
					{error}
				</div>
			)}

			{loading ? (
				<div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center text-sm text-slate-400">
					Inspecting system settings and connectors…
				</div>
			) : (
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					{/* Live Integrations Health Card */}
					<section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2.5">
								<Activity className="h-5 w-5 text-indigo-400" />
								<h2 className="text-base font-semibold text-white">External Service Connectors</h2>
							</div>
							<span className="text-[11px] text-slate-500">Live Health Check</span>
						</div>
						<p className="text-xs text-slate-400">
							Connectors are evaluated against actual service configurations and query health checks.
						</p>

						<div className="space-y-3 pt-2">
							{integrations.map((item, idx) => {
								const isOnline = item.status === 'online';
								const isDegraded = item.status === 'degraded';
								return (
									<div
										key={idx}
										className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-700"
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2.5 font-medium text-slate-200 text-xs">
												{item.name.includes('Database') ? (
													<Database className="h-4 w-4 text-cyan-400" />
												) : item.name.includes('AI') ? (
													<Cpu className="h-4 w-4 text-purple-400" />
												) : (
													<Globe className="h-4 w-4 text-indigo-400" />
												)}
												<span>{item.name}</span>
											</div>
											<span
												className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
													isOnline
														? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
														: isDegraded
														? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
														: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
												}`}
											>
												{isOnline ? (
													<CheckCircle2 className="h-3 w-3" />
												) : (
													<WifiOff className="h-3 w-3" />
												)}
												{item.status.toUpperCase()}
											</span>
										</div>
										<p className="mt-2 text-xs text-slate-400">{item.detail}</p>
									</div>
								);
							})}
						</div>
					</section>

					{/* Organization & Governance Settings Card */}
					<section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2.5">
								<Server className="h-5 w-5 text-indigo-400" />
								<h2 className="text-base font-semibold text-white">Institutional Policies</h2>
							</div>
							<span className="text-[11px] text-slate-500">Read-Only Enforced</span>
						</div>
						<p className="text-xs text-slate-400">
							Institutional deployment boundaries and data export protection standards.
						</p>

						{settings && (
							<div className="space-y-3 pt-2">
								<div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
									<h3 className="text-xs font-semibold text-slate-300">Organization Name</h3>
									<p className="mt-1 text-sm font-medium text-white">
										{settings.organization_name}
									</p>
								</div>

								<div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
									<h3 className="text-xs font-semibold text-slate-300">Active Notice Channels</h3>
									<div className="mt-2 flex flex-wrap gap-1.5">
										{settings.announcement_channels.map((ch, i) => (
											<span
												key={i}
												className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300"
											>
												{ch}
											</span>
										))}
									</div>
								</div>

								<div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
									<h3 className="text-xs font-semibold text-slate-300">Supported Export Standards</h3>
									<div className="mt-2 flex flex-wrap gap-1.5">
										{settings.export_formats.map((fmt, i) => (
											<span
												key={i}
												className="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[11px] text-indigo-300 font-medium"
											>
												{fmt}
											</span>
										))}
									</div>
								</div>

								<div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex items-center justify-between">
									<div>
										<h3 className="text-xs font-semibold text-slate-300">
											Role Modification Approval
										</h3>
										<p className="text-[11px] text-slate-500 mt-0.5">
											Role changes require direct administrator confirmation
										</p>
									</div>
									<span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
										Enforced
									</span>
								</div>
							</div>
						)}
					</section>

					{/* Safe Configuration Table Card */}
					<section className="rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2 space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2.5">
								<ShieldCheck className="h-5 w-5 text-indigo-400" />
								<h2 className="text-base font-semibold text-white">
									Runtime Configuration & Environment Parameters
								</h2>
							</div>
							<div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
								<Lock className="h-3.5 w-3.5" />
								<span>Cryptographic Secrets Masked</span>
							</div>
						</div>
						<p className="text-xs text-slate-400">
							Verified application parameters exposed safely without leaking database credentials, private tokens, or JWT encryption keys.
						</p>

						{settings && (
							<div className="overflow-x-auto pt-2">
								<table className="min-w-full divide-y divide-slate-800 text-left text-xs">
									<thead className="bg-slate-950/70 text-slate-400">
										<tr>
											<th scope="col" className="px-4 py-3 font-semibold">
												Parameter Key
											</th>
											<th scope="col" className="px-4 py-3 font-semibold">
												Configuration Label
											</th>
											<th scope="col" className="px-4 py-3 font-semibold">
												Active Runtime Value
											</th>
											<th scope="col" className="px-4 py-3 font-semibold text-right">
												Protection State
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-800 text-slate-300">
										{settings.settings.map((item, idx) => (
											<tr key={idx} className="hover:bg-slate-800/40">
												<td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-indigo-300">
													{item.key}
												</td>
												<td className="px-4 py-3 font-medium text-slate-200">
													{item.label}
												</td>
												<td className="px-4 py-3 font-mono text-[11px] text-slate-300">
													{Array.isArray(item.value) ? item.value.join(', ') : String(item.value)}
												</td>
												<td className="whitespace-nowrap px-4 py-3 text-right">
													<span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
														<Lock className="h-3 w-3" /> Safe Public
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</section>
				</div>
			)}
		</div>
	);
}

