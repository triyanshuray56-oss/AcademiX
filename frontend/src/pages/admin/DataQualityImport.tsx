import { useState } from 'react';
import {
	AlertCircle,
	AlertTriangle,
	CheckCircle,
	CheckCircle2,
	Download,
	FileSpreadsheet,
	FileText,
	HelpCircle,
	Upload,
	Users,
} from 'lucide-react';
import {
	commitAdminImport,
	previewAdminImport,
	type AdminImportCommitResult,
	type AdminImportPreview,
} from '../../api/admin';
import { getApiError } from '../../api/http';

const SAMPLE_CSV = `Name,Email,Branch,CGPA,Roll Number,Backlogs,Skills
Aditya Sharma,aditya.sharma@example.com,CSE,8.45,BPUT-2024-001,0,React, Node.js, SQL
Priya Patel,priya.patel@example.com,ECE,7.90,BPUT-2024-002,0,Embedded C, Python, IoT
Rahul Verma,rahul.verma@example.com,EE,6.85,BPUT-2024-003,1,MATLAB, Power Systems`;

export default function DataQualityImport() {
	const [csvText, setCsvText] = useState('');
	const [preview, setPreview] = useState<AdminImportPreview | null>(null);
	const [commitResult, setCommitResult] = useState<AdminImportCommitResult | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			const content = event.target?.result as string;
			setCsvText(content);
			setPreview(null);
			setCommitResult(null);
		};
		reader.readAsText(file);
	};

	const handlePreview = async () => {
		if (!csvText.trim()) {
			setError('Please paste or upload CSV data first.');
			return;
		}
		setLoading(true);
		setError('');
		setCommitResult(null);
		try {
			const res = await previewAdminImport(csvText);
			setPreview(res);
		} catch (err) {
			setError(getApiError(err));
		} finally {
			setLoading(false);
		}
	};

	const handleCommit = async () => {
		if (!csvText.trim() || !preview) return;
		setLoading(true);
		setError('');
		try {
			const res = await commitAdminImport(csvText);
			setCommitResult(res);
			// Reset preview after commit
			setPreview(null);
		} catch (err) {
			setError(getApiError(err));
		} finally {
			setLoading(false);
		}
	};

	const loadSampleTemplate = () => {
		setCsvText(SAMPLE_CSV);
		setPreview(null);
		setCommitResult(null);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
						<FileSpreadsheet className="h-6 w-6 text-indigo-400" />
						Data Quality & Import Management
					</h1>
					<p className="mt-1 text-sm text-slate-400">
						Safely validate, audit, and batch-import student cohort records into CampusLink via verified CSV spreadsheets.
					</p>
				</div>
				<button
					type="button"
					onClick={loadSampleTemplate}
					className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
				>
					<Download className="h-3.5 w-3.5" />
					Load Sample Template
				</button>
			</div>

			{/* Commit Success Banner */}
			{commitResult && (
				<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 space-y-2">
					<div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
						<CheckCircle className="h-5 w-5" />
						Batch Import Transaction Committed
					</div>
					<p className="text-xs text-emerald-300">{commitResult.message}</p>
					<div className="flex gap-4 text-xs font-medium text-slate-300 pt-1">
						<span>Imported: {commitResult.imported_count}</span>
						<span>Duplicates Skipped: {commitResult.skipped_count}</span>
						<span>Invalid Rejected: {commitResult.failed_count}</span>
					</div>
				</div>
			)}

			{/* Error Banner */}
			{error && (
				<div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
					{error}
				</div>
			)}

			{/* CSV Input Section */}
			<div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
					<div>
						<h2 className="text-base font-semibold text-white">Student CSV Data Input</h2>
						<p className="text-xs text-slate-400 mt-0.5">
							Upload a .csv file or paste raw comma-separated rows below. Header columns: Name, Email, Branch, CGPA, Roll Number, Backlogs, Skills.
						</p>
					</div>
					<label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700">
						<Upload className="h-3.5 w-3.5 text-indigo-400" />
						Upload .CSV File
						<input
							type="file"
							accept=".csv,text/csv"
							onChange={handleFileUpload}
							className="hidden"
						/>
					</label>
				</div>

				<textarea
					rows={8}
					value={csvText}
					onChange={(e) => {
						setCsvText(e.target.value);
						setPreview(null);
						setCommitResult(null);
					}}
					placeholder="Name,Email,Branch,CGPA,Roll Number,Backlogs,Skills&#10;Aditya Sharma,aditya.sharma@example.com,CSE,8.45,BPUT-2024-001,0,React, Node.js"
					className="w-full font-mono text-xs rounded-lg border border-slate-700 bg-slate-950 p-4 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
				/>

				<div className="flex justify-end gap-3">
					<button
						type="button"
						onClick={handlePreview}
						disabled={loading || !csvText.trim()}
						className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
					>
						{loading ? 'Validating…' : 'Preview & Validate CSV'}
					</button>
				</div>
			</div>

			{/* Validation Preview Card */}
			{preview && (
				<div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-6">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
						<div>
							<h2 className="text-base font-semibold text-white">Validation & Quality Audit</h2>
							<p className="text-xs text-slate-400">
								Audited {preview.total_rows} row(s) against email uniqueness, CGPA bounds, and branch formatting.
							</p>
						</div>
						<button
							type="button"
							onClick={handleCommit}
							disabled={loading || preview.valid_count === 0}
							className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
						>
							Commit Valid Records ({preview.valid_count - preview.duplicate_count})
						</button>
					</div>

					{/* Metrics Counter */}
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 text-center">
							<span className="text-[11px] text-slate-400">Total Scanned Rows</span>
							<div className="mt-1 text-xl font-bold text-white">{preview.total_rows}</div>
						</div>
						<div className="rounded-lg bg-emerald-500/5 p-4 border border-emerald-500/20 text-center">
							<span className="text-[11px] text-emerald-400">Valid Format Rows</span>
							<div className="mt-1 text-xl font-bold text-emerald-400">{preview.valid_count}</div>
						</div>
						<div className="rounded-lg bg-amber-500/5 p-4 border border-amber-500/20 text-center">
							<span className="text-[11px] text-amber-400">Existing Duplicates</span>
							<div className="mt-1 text-xl font-bold text-amber-400">{preview.duplicate_count}</div>
						</div>
						<div className="rounded-lg bg-rose-500/5 p-4 border border-rose-500/20 text-center">
							<span className="text-[11px] text-rose-400">Invalid / Rejected</span>
							<div className="mt-1 text-xl font-bold text-rose-400">{preview.invalid_count}</div>
						</div>
					</div>

					{/* Errors Breakdown */}
					{preview.errors.length > 0 && (
						<div className="space-y-3">
							<h3 className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
								<AlertTriangle className="h-4 w-4" />
								Detected Row Inconsistencies ({preview.errors.length})
							</h3>
							<div className="space-y-1.5 max-h-48 overflow-y-auto">
								{preview.errors.map((err, idx) => (
									<div
										key={idx}
										className="rounded bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-300 flex items-center justify-between"
									>
										<span>
											<strong className="text-white">Row {err.row_number}:</strong> [{err.field}] {err.message}
										</span>
										{err.invalid_value && (
											<span className="font-mono text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
												val: &quot;{err.invalid_value}&quot;
											</span>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{/* Sample Preview Table */}
					{preview.preview_rows.length > 0 && (
						<div className="space-y-3">
							<h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
								Valid Rows Sample Preview
							</h3>
							<div className="overflow-x-auto rounded-lg border border-slate-800">
								<table className="w-full text-left text-xs">
									<thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
										<tr>
											<th className="px-4 py-2 font-medium">Name</th>
											<th className="px-4 py-2 font-medium">Email</th>
											<th className="px-4 py-2 font-medium">Branch</th>
											<th className="px-4 py-2 font-medium">CGPA</th>
											<th className="px-4 py-2 font-medium">Roll No</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
										{preview.preview_rows.slice(0, 5).map((row: any, i) => (
											<tr key={i} className="hover:bg-slate-800/40">
												<td className="px-4 py-2 font-medium text-white">{row.name}</td>
												<td className="px-4 py-2 font-mono text-slate-400">{row.email}</td>
												<td className="px-4 py-2 text-slate-300">{row.branch}</td>
												<td className="px-4 py-2 text-slate-300">{row.cgpa}</td>
												<td className="px-4 py-2 text-slate-400">{row.university_roll_number || '—'}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Database Safety Notice */}
			<div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs text-indigo-300 flex items-start gap-3">
				<CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
				<div>
					<p className="font-semibold text-indigo-200">Non-Destructive Batch Import Protocol</p>
					<p className="mt-0.5 text-indigo-300/80">
						Student batch imports operate in strictly additive mode. Existing student accounts and applications are protected. Duplicate emails are skipped automatically, and invalid rows are rejected without rolling back valid records.
					</p>
				</div>
			</div>
		</div>
	);
}

