import React, { useState } from 'react';
import axios from 'axios';
import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	Briefcase,
	Check,
	CheckCircle2,
	Copy,
	Eye,
	EyeOff,
	GraduationCap,
	KeyRound,
	Link2,
	LoaderCircle,
	LockKeyhole,
	Mail,
	ShieldCheck,
	Sparkles,
} from 'lucide-react';

const AUTH_API = 'http://localhost:8000/api/auth';
const ROLE_OPTIONS = [
	{ value: 'student', label: 'Student', icon: GraduationCap },
	{ value: 'recruiter', label: 'HR / Recruiter', icon: Briefcase },
	{ value: 'admin', label: 'Admin', icon: ShieldCheck },
];
const ROLE_DESTINATIONS = {
	student: '/student/dashboard',
	recruiter: '/recruiter/command',
	admin: '/admin/command',
};

function errorMessage(error) {
	const detail = error?.response?.data?.detail;
	if (Array.isArray(detail)) return detail.map((item) => item.msg).filter(Boolean).join(' ');
	if (typeof detail === 'string') return detail;
	if (!error?.response) return 'Cannot reach CampusLink. Check that the backend is running at localhost:8000.';
	return 'Something went wrong. Please try again.';
}

function RolePicker({ value, onChange, disabled }) {
	return (
		<div aria-label="Choose account role" className="grid grid-cols-3 gap-1 rounded-xl border border-slate-700 bg-slate-950/70 p-1.5" role="group">
			{ROLE_OPTIONS.map(({ value: option, label, icon: Icon }) => (
				<button
					aria-pressed={value === option}
					className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition sm:flex-row sm:gap-2 sm:text-xs ${value === option ? 'bg-gradient-to-r from-indigo-500/25 to-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
					disabled={disabled}
					key={option}
					onClick={() => onChange(option)}
					type="button"
				>
					<Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
					{label}
				</button>
			))}
		</div>
	);
}

function Input({
	label,
	name,
	value,
	onChange,
	icon: Icon,
	type = 'text',
	placeholder,
	autoComplete,
	minLength,
	maxLength,
	trailing,
	disabled = false,
}) {
	return (
		<label className="block space-y-2" htmlFor={name}>
			<span className="text-sm font-medium text-slate-200">{label}</span>
			<span className="relative block">
				<Icon aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
				<input
					autoComplete={autoComplete}
					className="block min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950/70 py-3 pl-11 pr-11 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/80 focus:ring-2 focus:ring-cyan-400/15 disabled:opacity-60"
					disabled={disabled}
					id={name}
					maxLength={maxLength}
					minLength={minLength}
					name={name}
					onChange={(event) => onChange(event.target.value)}
					placeholder={placeholder}
					required
					type={type}
					value={value}
				/>
				{trailing && (
					<button
						aria-label={trailing.label}
						className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
						onClick={trailing.onClick}
						type="button"
					>
						<trailing.icon aria-hidden="true" className="h-4 w-4" />
					</button>
				)}
			</span>
		</label>
	);
}

function Notice({ notice }) {
	if (!notice) return null;
	const failed = notice.type === 'error';
	const Icon = failed ? AlertCircle : CheckCircle2;
	return (
		<div
			aria-live="polite"
			className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${failed ? 'border-rose-400/25 bg-rose-400/10 text-rose-100' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'}`}
			role={failed ? 'alert' : 'status'}
		>
			<Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
			<span>{notice.message}</span>
		</div>
	);
}

function SubmitButton({ busy, children }) {
	return (
		<button
			className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-300/60 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-wait disabled:opacity-70"
			disabled={busy}
		type="submit"
		>
			{busy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : children}
			{busy ? 'Working...' : <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
		</button>
	);
}

export default function AuthPages({ onAuthenticated, initialView = 'login', initialRole = 'student' }) {
	const [view, setView] = useState(initialView);
	const [role, setRole] = useState(initialRole);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [resetToken, setResetToken] = useState('');
	const [invitationKey, setInvitationKey] = useState('');
	const [notice, setNotice] = useState(null);
	const [busy, setBusy] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [copied, setCopied] = useState(false);

	const navigate = (nextView) => {
		setNotice(null);
		setView(nextView);
		setCopied(false);
	};

	const handleLogin = async (event) => {
		event.preventDefault();
		setBusy(true);
		setNotice(null);
		try {
			const { data } = await axios.post(`${AUTH_API}/login`, { email, password, expected_role: role }, { timeout: 12000 });
			const userEmail = email.trim().toLowerCase();
			localStorage.setItem('access_token', data.access_token);
			localStorage.setItem('role', data.role);
			localStorage.setItem('email', userEmail);
			setNotice({ type: 'success', message: 'Signed in. Your workspace is ready.' });
			if (typeof onAuthenticated === 'function') {
				onAuthenticated({ access_token: data.access_token, role: data.role, email: userEmail });
			} else {
				window.setTimeout(() => window.location.assign(ROLE_DESTINATIONS[data.role] || '/'), 550);
			}
		} catch (error) {
			setNotice({ type: 'error', message: errorMessage(error) });
		} finally {
			setBusy(false);
		}
	};

	const handleSignup = async (event) => {
		event.preventDefault();
		setBusy(true);
		setNotice(null);
		try {
			const headers = role === 'student' ? {} : { 'X-Role-Registration-Key': invitationKey };
			await axios.post(`${AUTH_API}/signup`, { email, password, role }, { headers, timeout: 12000 });
			setPassword('');
			setInvitationKey('');
			setView('login');
			setNotice({ type: 'success', message: `Account created for ${role}. Sign in to continue.` });
		} catch (error) {
			setNotice({ type: 'error', message: errorMessage(error) });
		} finally {
			setBusy(false);
		}
	};

	const handleForgot = async (event) => {
		event.preventDefault();
		setBusy(true);
		setNotice(null);
		setResetToken('');
		try {
			const { data } = await axios.post(`${AUTH_API}/forgot-password`, { email }, { timeout: 12000 });
			if (data.reset_token) setResetToken(data.reset_token);
			setNotice({ type: 'success', message: data.detail || 'Check your reset instructions.' });
		} catch (error) {
			setNotice({ type: 'error', message: errorMessage(error) });
		} finally {
			setBusy(false);
		}
	};

	const handleReset = async (event) => {
		event.preventDefault();
		setBusy(true);
		setNotice(null);
		try {
			const { data } = await axios.post(
				`${AUTH_API}/reset-password`,
				{ email, reset_token: resetToken, new_password: newPassword },
				{ timeout: 12000 },
			);
			setPassword('');
			setNewPassword('');
			setResetToken('');
			setView('login');
			setNotice({ type: 'success', message: data.detail || 'Password updated. Sign in with your new password.' });
		} catch (error) {
			setNotice({ type: 'error', message: errorMessage(error) });
		} finally {
			setBusy(false);
		}
	};

	const copyResetToken = async () => {
		try {
			await navigator.clipboard.writeText(resetToken);
			setCopied(true);
		} catch {
			setNotice({ type: 'error', message: 'Clipboard unavailable. Select and copy the token manually.' });
		}
	};

	const roleView = view === 'login' || view === 'signup';
	const pageCopy = {
		login: ['WELCOME BACK', 'Sign in to your space', 'Pick up where your placement journey left off.'],
		signup: ['GET STARTED', 'Create your account', 'Bring your next opportunity into focus.'],
		forgot: ['ACCOUNT RECOVERY', 'Reset your password', 'Generate a secure reset token for your account.'],
		reset: ['NEW CREDENTIALS', 'Choose a new password', 'Set a fresh password to get back to CampusLink.'],
	}[view] || ['WELCOME', 'CampusLink', 'Sign in to continue.'];

	return (
		<main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
			<style>{'@keyframes campus-auth-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }'}</style>
			<div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_8%,rgba(79,70,229,0.2),transparent_34%),radial-gradient(ellipse_at_94%_86%,rgba(8,145,178,0.14),transparent_30%)]" />
			<div className="relative grid w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl shadow-black/40 backdrop-blur-xl lg:min-h-[680px] lg:grid-cols-[0.95fr_1.05fr]">
				<aside className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-800 bg-slate-900 p-10 lg:flex xl:p-14">
					<div aria-hidden="true" className="absolute -right-24 -top-20 h-72 w-72 rounded-full border border-indigo-400/10" />
					<div aria-hidden="true" className="absolute -right-10 -top-6 h-44 w-44 rounded-full border border-cyan-300/10" />
					<div className="relative">
						<div className="flex items-center gap-3">
							<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white shadow-lg shadow-indigo-950/50"><Link2 aria-hidden="true" className="h-5 w-5" /></div>
							<div><p className="text-lg font-semibold text-white">CampusLink</p><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">BPUT placement network</p></div>
						</div>
						<div className="mt-24 max-w-md">
							<div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-xs font-medium text-cyan-200"><Sparkles aria-hidden="true" className="h-3.5 w-3.5" />A clearer path to your next role</div>
							<h1 className="text-4xl font-semibold leading-tight text-white xl:text-5xl">Build momentum.<span className="mt-2 block bg-gradient-to-r from-indigo-300 via-cyan-200 to-cyan-400 bg-clip-text text-transparent">Meet opportunity.</span></h1>
							<p className="mt-6 max-w-sm text-sm leading-6 text-slate-400">One secure workspace for student readiness, recruiter access, and placement operations across BPUT.</p>
						</div>
					</div>
					<div className="relative grid grid-cols-2 gap-3">
						<div className="rounded-xl border border-slate-800 bg-slate-950/55 p-4"><p className="text-xs font-medium text-slate-500">STUDENT ACCESS</p><p className="mt-2 text-sm font-medium text-slate-200">Readiness to opportunity</p></div>
						<div className="rounded-xl border border-slate-800 bg-slate-950/55 p-4"><p className="text-xs font-medium text-slate-500">RECRUITER ACCESS</p><p className="mt-2 text-sm font-medium text-slate-200">Talent, matched with intent</p></div>
						<p className="col-span-2 mt-2 text-xs text-slate-600">Secure access for the CampusLink placement community</p>
					</div>
				</aside>

				<section className="flex min-w-0 items-center justify-center px-5 py-8 sm:px-10 lg:px-12 xl:px-16">
					<div className="w-full max-w-md" key={view} style={{ animation: 'campus-auth-enter 280ms ease-out' }}>
						<div className="mb-8 flex items-center gap-3 lg:hidden">
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white"><Link2 aria-hidden="true" className="h-5 w-5" /></div>
							<div><p className="font-semibold text-white">CampusLink</p><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">BPUT placement network</p></div>
						</div>
						{!roleView && <button className="mb-7 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-200" onClick={() => navigate('login')} type="button"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Back to sign in</button>}
						<div className="mb-6"><p className="text-[11px] font-semibold tracking-[0.2em] text-cyan-300">{pageCopy[0]}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{pageCopy[1]}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{pageCopy[2]}</p></div>
						{notice && <div className="mb-5"><Notice notice={notice} /></div>}
						{roleView && <div className="mb-6"><p className="mb-2.5 text-xs font-medium text-slate-400">Continue as</p><RolePicker value={role} onChange={setRole} disabled={busy} /></div>}

						{view === 'login' && <form className="space-y-5" onSubmit={handleLogin}>
							<Input autoComplete="email" icon={Mail} label="Email address" name="login-email" onChange={setEmail} placeholder="you@university.edu" type="email" value={email} />
											<div className="space-y-2">
												<Input autoComplete="current-password" icon={LockKeyhole} label="Password" name="login-password" onChange={setPassword} placeholder="Enter your password" trailing={{ icon: showPassword ? EyeOff : Eye, label: showPassword ? 'Hide password' : 'Show password', onClick: () => setShowPassword((value) => !value) }} type={showPassword ? 'text' : 'password'} value={password} />
												<div className="flex justify-end"><button className="text-xs font-medium text-cyan-300 transition hover:text-cyan-200" onClick={() => navigate('forgot')} type="button">Forgot password?</button></div>
							</div>
							<SubmitButton busy={busy}>Sign in</SubmitButton>
							<p className="text-center text-sm text-slate-500">New to CampusLink? <button className="font-medium text-cyan-300 transition hover:text-cyan-200" onClick={() => navigate('signup')} type="button">Create an account</button></p>
						</form>}

						{view === 'signup' && <form className="space-y-5" onSubmit={handleSignup}>
							<Input autoComplete="email" icon={Mail} label="Email address" name="signup-email" onChange={setEmail} placeholder="you@university.edu" type="email" value={email} />
							<Input autoComplete="new-password" icon={LockKeyhole} label="Password" maxLength={72} minLength={8} name="signup-password" onChange={setPassword} placeholder="At least 8 characters" trailing={{ icon: showPassword ? EyeOff : Eye, label: showPassword ? 'Hide password' : 'Show password', onClick: () => setShowPassword((value) => !value) }} type={showPassword ? 'text' : 'password'} value={password} />
							{role !== 'student' && <Input autoComplete="off" icon={KeyRound} label={`${role === 'admin' ? 'Admin' : 'Recruiter'} invitation key`} name="invitation-key" onChange={setInvitationKey} placeholder="Enter your invite key" type="password" value={invitationKey} />}
							<SubmitButton busy={busy}>Create account</SubmitButton>
							<p className="text-center text-sm text-slate-500">Already registered? <button className="font-medium text-cyan-300 transition hover:text-cyan-200" onClick={() => navigate('login')} type="button">Sign in</button></p>
						</form>}

						{view === 'forgot' && <form className="space-y-5" onSubmit={handleForgot}>
							<Input autoComplete="email" icon={Mail} label="Account email" name="forgot-email" onChange={setEmail} placeholder="you@university.edu" type="email" value={email} />
							<SubmitButton busy={busy}>Generate reset token</SubmitButton>
							{resetToken && <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4"><div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Local demo reset token</p><button aria-label="Copy reset token" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-800" onClick={copyResetToken} type="button">{copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}</button></div><code className="block break-all rounded-md bg-slate-950/80 px-3 py-2 font-mono text-xs text-cyan-100">{resetToken}</code><button className="mt-3 text-xs font-medium text-cyan-300 hover:text-cyan-100" onClick={() => navigate('reset')} type="button">Continue to password reset</button></div>}
						</form>}

						{view === 'reset' && <form className="space-y-5" onSubmit={handleReset}>
							<Input autoComplete="email" icon={Mail} label="Account email" name="reset-email" onChange={setEmail} placeholder="you@university.edu" type="email" value={email} />
							<Input autoComplete="one-time-code" icon={KeyRound} label="Reset token" name="reset-token" onChange={setResetToken} placeholder="Paste your reset token" value={resetToken} />
							<Input autoComplete="new-password" icon={LockKeyhole} label="New password" maxLength={72} minLength={8} name="new-password" onChange={setNewPassword} placeholder="At least 8 characters" trailing={{ icon: showNewPassword ? EyeOff : Eye, label: showNewPassword ? 'Hide password' : 'Show password', onClick: () => setShowNewPassword((value) => !value) }} type={showNewPassword ? 'text' : 'password'} value={newPassword} />
							<SubmitButton busy={busy}>Update password</SubmitButton>
						</form>}

						<div className="mt-8 flex items-center justify-center gap-2 border-t border-slate-800 pt-5 text-[11px] text-slate-600"><ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />Secure access for the BPUT placement community</div>
					</div>
				</section>
			</div>
		</main>
	);
}
