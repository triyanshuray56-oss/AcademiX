import { useCallback, useEffect, useState } from 'react';
import {
	Award,
	BookOpen,
	CheckCircle,
	CheckCircle2,
	Clock,
	Compass,
	Cpu,
	FileText,
	GraduationCap,
	HelpCircle,
	Layers,
	Lock,
	RefreshCw,
	ShieldCheck,
	Sliders,
	Users,
} from 'lucide-react';
import {
	fetchAdminEligibilityPolicies,
	type AdminEligibilityPolicies,
} from '../../api/admin';
import { getApiError } from '../../api/http';

export default function EligibilityRules() {
	const [policies, setPolicies] = useState<AdminEligibilityPolicies | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const loadData = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const res = await fetchAdminEligibilityPolicies();
			setPolicies(res);
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
						<Compass className="h-6 w-6 text-indigo-400" />
						Policy & Eligibility Rules
					</h1>
					<p className="mt-1 text-sm text-slate-400">
						Deterministic scoring formulas, readiness evaluation thresholds, and placement verification policies.
					</p>
				</div>
				<button
					type="button"
					onClick={() => void loadData()}
					disabled={loading}
					className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
				>
					<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
					Refresh Policies
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
					Evaluating eligibility policy formulas and cohort distributions…
				</div>
			) : (
				<>
					{/* Readiness Score Breakdown Rules */}
					<section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
						<div className="flex items-center justify-between border-b border-slate-800 pb-3">
							<div className="flex items-center gap-2">
								<Cpu className="h-5 w-5 text-indigo-400" />
								<h2 className="text-base font-semibold text-white">Student Readiness Calculation Formula</h2>
							</div>
							<span className="text-xs text-indigo-400 font-mono">100% Aggregate Weight</span>
						</div>

						<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
							{policies?.readiness_rules.map((rule, idx) => (
								<div
									key={idx}
									className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-3 flex flex-col justify-between"
								>
									<div>
										<div className="flex items-center justify-between">
											<span className="text-sm font-semibold text-white">{rule.name}</span>
											<span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-bold text-indigo-400">
												{rule.weight_percent}%
											</span>
										</div>
										<p className="mt-2 text-xs text-slate-400 leading-relaxed">{rule.description}</p>
									</div>
									<div className="mt-3 rounded bg-slate-900 px-3 py-2 font-mono text-[11px] text-slate-300 border border-slate-800">
										{rule.formula}
									</div>
								</div>
							))}
						</div>
					</section>

					{/* Readiness Tiers & Cohort Distribution */}
					<section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
						<div className="flex items-center justify-between border-b border-slate-800 pb-3">
							<div className="flex items-center gap-2">
								<Award className="h-5 w-5 text-amber-400" />
								<h2 className="text-base font-semibold text-white">Readiness Tiers & Cohort Distribution</h2>
							</div>
							<span className="text-xs text-slate-500">Live Student Distribution</span>
						</div>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
							{policies?.readiness_tiers.map((tier, idx) => (
								<div
									key={idx}
									className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-2 hover:border-slate-700 transition"
								>
									<div className="flex items-center justify-between">
										<span className="text-sm font-semibold text-white">{tier.tier_name}</span>
										<span className="text-xs font-mono text-slate-400">{tier.score_range}</span>
									</div>
									<div className="text-2xl font-bold text-white pt-1">
										{tier.current_student_count}
										<span className="text-xs font-normal text-slate-500 ml-1.5">students</span>
									</div>
									<p className="text-xs text-slate-400 pt-1">{tier.description}</p>
								</div>
							))}
						</div>
					</section>

					{/* Verification Policies */}
					<section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
						<div className="flex items-center justify-between border-b border-slate-800 pb-3">
							<div className="flex items-center gap-2">
								<ShieldCheck className="h-5 w-5 text-emerald-400" />
								<h2 className="text-base font-semibold text-white">Drive Participation Verification Policies</h2>
							</div>
							<span className="text-xs text-emerald-400">Enforced by Core Engine</span>
						</div>

						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							{policies?.verification_policies.map((vPol, idx) => (
								<div
									key={idx}
									className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-3"
								>
									<div className="flex items-center justify-between">
										<span className="text-sm font-semibold text-white">{vPol.rule_name}</span>
										<span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
											MANDATORY
										</span>
									</div>
									<p className="text-xs text-slate-400 leading-relaxed">{vPol.description}</p>
									<div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
										<span className="text-emerald-400 font-medium">
											{vPol.compliant_student_count} Verified
										</span>
										<span className="text-amber-400 font-medium">
											{vPol.pending_student_count} Pending Review
										</span>
									</div>
								</div>
							))}
						</div>
					</section>

					{/* Matching & Branch Criteria Formulas */}
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
						<div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-3">
							<div className="flex items-center gap-2 text-white font-semibold text-sm">
								<Layers className="h-4 w-4 text-indigo-400" />
								JD Match Fit Calculation Model
							</div>
							<div className="rounded bg-slate-950 p-3 font-mono text-xs text-slate-300 border border-slate-800">
								{policies?.jd_scoring_formula}
							</div>
							<p className="text-xs text-slate-400">
								The matching engine computes a deterministic affinity score combining academic achievement with normalized technical skill token overlap.
							</p>
						</div>

						<div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-3">
							<div className="flex items-center gap-2 text-white font-semibold text-sm">
								<BookOpen className="h-4 w-4 text-emerald-400" />
								Academic Branch Matching Standard
							</div>
							<div className="rounded bg-slate-950 p-3 text-xs text-slate-300 border border-slate-800">
								{policies?.branch_policy_explanation}
							</div>
							<p className="text-xs text-slate-400">
								Candidate applications are evaluated against recruiter job requirements with exact branch token matching.
							</p>
						</div>
					</div>

					{/* Policy Governance Notice */}
					<div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs text-indigo-300 flex items-start gap-3">
						<Lock className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
						<div>
							<p className="font-semibold text-indigo-200">Algorithmic Governance Policy</p>
							<p className="mt-0.5 text-indigo-300/80">
								{policies?.policy_governance_notice ||
									'Readiness and eligibility formulas are executed deterministically by the AIPlacementEngine. Runtime editing of calculation formulas is disabled to preserve evaluation integrity.'}
							</p>
						</div>
					</div>
				</>
			)}
		</div>
	);
}

