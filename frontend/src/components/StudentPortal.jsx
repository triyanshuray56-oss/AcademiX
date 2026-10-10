import { useCallback, useEffect, useRef, useState } from 'react';
import {
	ArrowLeft,
	ArrowRight,
	ArrowUpRight,
	BellRing,
	BriefcaseBusiness,
	CalendarDays,
	CircleDollarSign,
	CheckCircle2,
	Clock3,
	Cpu,
	Code2,
	ClipboardCheck,
	FileText,
	ExternalLink,
	GraduationCap,
	ImagePlus,
	KeyRound,
	LoaderCircle,
	Mail,
	MessageSquareText,
	Pencil,
	Plus,
	Save,
	Video,
	X,
	RefreshCw,
	Sparkles,
	ShieldCheck,
	Trash2,
	TriangleAlert,
 	Users,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { getApiError } from '../api/http';
import { ProfileAvatar, ProfilePictureEditor } from './ProfilePicture';
import StudentDashboard from './StudentDashboard';
import StudentJobs from './StudentJobs';
import StudentGrowth from './StudentGrowth';
import StudentInterviews from './StudentInterviews';
import StudentNotices from './StudentNotices';
import ProctoringMonitor from './ProctoringMonitor';

const BRANCH_OPTIONS = [
	'CSE', 'ETC', 'Electrical', 'EEE', 'ECE', 'Mechanical', 'Civil', 'IT', 'Other',
];
const TECH_OPTIONS = [
	'Python', 'Java', 'JavaScript', 'React', 'FastAPI', 'SQL', 'C++', 'AWS',
	'Machine Learning', 'Data Structures', 'System Design', 'Git',
];
const ASSESSMENT_INSTRUCTIONS = [
	'AI proctoring is active throughout the assessment. Your camera and assessment activity may be monitored, and integrity events can be recorded.',
	'Use a stable internet connection and keep your device powered so questions, answers, and assessment progress are not interrupted.',
	'Do not switch browser tabs, windows, or applications, and do not leave the assessment page while the test is in progress.',
	'Keep your face visible to the camera, remain in a well-lit space, and ensure no other person is in the assessment area.',
	'Do not use another device, search engine, notes, messaging service, or external assistance to answer assessment questions.',
	'For any coding exercise, use the language and workspace provided in the assessment and do not run or submit code from an external tool.',
	'Read each question and all answer choices carefully; select your response using the controls provided on this page.',
	'Complete and submit the assessment before the displayed timer expires; when time runs out, the test may be submitted automatically.',
	'Answer every question yourself. Proctoring violations may add strikes, and repeated violations can trigger automatic submission.',
	'If a technical issue occurs, stay on the assessment page and contact support rather than refreshing or opening another tab.',
];

const INTERVIEW_STARTERS = {
	Python: {
		arrays: 'def two_sum(nums, target):\n    # Return the indices of the two values that add up to target.\n    pass\n',
		strings: 'def length_of_longest_substring(text):\n    # Return the length of the longest substring without repeated characters.\n    pass\n',
		design: '# Placement notification service\n# 1. Define the API and notification data model.\n# 2. Describe persistence, idempotency, and retry handling.\n# 3. Explain delivery scaling and failure recovery.\n',
	},
	JavaScript: {
		arrays: 'function twoSum(nums, target) {\n  // Return the indices of the two values that add up to target.\n}\n',
		strings: 'function lengthOfLongestSubstring(text) {\n  // Return the length of the longest substring without repeated characters.\n}\n',
		design: '// Placement notification service\n// 1. Define the API and notification data model.\n// 2. Describe persistence, idempotency, and retry handling.\n// 3. Explain delivery scaling and failure recovery.\n',
	},
	'C++': {
		arrays: '#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Return the indices of the two values that add up to target.\n}\n',
		strings: '#include <string>\nusing namespace std;\n\nint lengthOfLongestSubstring(string text) {\n    // Return the length of the longest substring without repeated characters.\n}\n',
		design: '// Placement notification service\n// 1. Define the API and notification data model.\n// 2. Describe persistence, idempotency, and retry handling.\n// 3. Explain delivery scaling and failure recovery.\n',
	},
	Java: {
		arrays: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Return the indices of the two values that add up to target.\n        return new int[]{};\n    }\n}\n',
		strings: 'class Solution {\n    public int lengthOfLongestSubstring(String text) {\n        // Return the length of the longest substring without repeated characters.\n        return 0;\n    }\n}\n',
		design: '// Placement notification service\n// 1. Define the API and notification data model.\n// 2. Describe persistence, idempotency, and retry handling.\n// 3. Explain delivery scaling and failure recovery.\n',
	},
};

const STATUS_STYLE = {
	'Not Ready': 'border-rose-400/20 bg-rose-400/10 text-rose-200',
	Developing: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
	Ready: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
	'Highly Employable': 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
};

function SectionTitle({ icon: Icon, label, title, action }) {
	return (
		<div className="mb-5 flex items-end justify-between gap-4">
			<div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300"><Icon aria-hidden="true" className="h-3.5 w-3.5" />{label}</p><h2 className="mt-1.5 text-lg font-semibold text-white">{title}</h2></div>
			{action}
		</div>
	);
}

function ScoreGauge({ score }) {
	const stroke = 9;
	const radius = 51;
	const circumference = 2 * Math.PI * radius;
	const progress = Math.max(0, Math.min(score, 100)) / 100;
	return (
		<div className="relative grid h-36 w-36 shrink-0 place-items-center">
			<svg aria-hidden="true" className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
				<circle cx="60" cy="60" fill="none" r={radius} stroke="rgb(30 41 59)" strokeWidth={stroke} />
				<circle cx="60" cy="60" fill="none" r={radius} stroke="url(#readiness-gradient)" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} strokeLinecap="round" strokeWidth={stroke} />
				<defs><linearGradient id="readiness-gradient"><stop stopColor="#6366f1" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
			</svg>
			<div className="text-center"><p className="text-4xl font-semibold tabular-nums text-white">{Math.round(score)}</p><p className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-500">out of 100</p></div>
		</div>
	);
}

function StudentPageHeader({ eyebrow, title, description }) {
	return <header className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{title}</h1><p className="mt-2 text-sm text-slate-400">{description}</p></header>;
}

function EmptyView({ icon: Icon, title, description }) {
	return <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-5 py-10 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-400"><Icon aria-hidden="true" className="h-5 w-5" /></span><h2 className="mt-4 text-sm font-semibold text-slate-200">{title}</h2><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">{description}</p></div>;
}

function DeadlineBanner({ drives }) {
	if (!drives.length) return null;
	return <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3"><BellRing aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><div className="min-w-0"><p className="text-xs font-semibold text-amber-100">Upcoming placement deadline</p><p className="mt-1 text-xs leading-5 text-amber-100/70">{drives.map((drive) => `${drive.company_name} · ${new Date(drive.drive_date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`).join('  •  ')}</p></div></div>;
}

export default function StudentPortal({ session, view = 'dashboard' }) {
	const navigate = useNavigate();
	const [student, setStudent] = useState(null);
	const [drives, setDrives] = useState([]);
	const [recruiterJds, setRecruiterJds] = useState([]);
	const [nudge, setNudge] = useState(null);
	const [loading, setLoading] = useState(true);
	const [nudgeLoading, setNudgeLoading] = useState(false);
	const [error, setError] = useState('');
	const [nudgeError, setNudgeError] = useState('');
	const [successToast, setSuccessToast] = useState(() => {
		const message = sessionStorage.getItem('campuslink_onboarding_success') || '';
		if (message) sessionStorage.removeItem('campuslink_onboarding_success');
		return message;
	});
	const [isEditingProfile, setIsEditingProfile] = useState(false);

	const loadPortal = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const [profile, driveResponse, recruiterResponse] = await Promise.all([
				api.get('/students/me').then(({ data }) => data).catch((requestError) => {
					if (requestError.response?.status === 404) return null;
					throw requestError;
				}),
				api.get('/drives'),
				api.get('/recruiters'),
			]);
			setStudent(profile);
			setDrives(driveResponse.data.drives || []);
			setRecruiterJds(recruiterResponse.data || []);
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setLoading(false);
		}
	}, [session.email]);

	useEffect(() => { loadPortal(); }, [loadPortal]);

	const requestNudge = async () => {
		if (!student) return;
		setNudgeLoading(true);
		setNudgeError('');
		try {
			const { data } = await api.post('/students/me/nudge');
			setNudge(data);
		} catch (requestError) {
			setNudgeError(getApiError(requestError));
		} finally {
			setNudgeLoading(false);
		}
	};

	const saveProfilePatch = async (patch) => {
		const techStack = student.verified_tech_stack?.length
			? student.verified_tech_stack
			: (student.skills || '').split(',').map((skill) => skill.trim()).filter(Boolean);
		const payload = {
			name: student.name, branch: student.branch, cgpa: Number(student.cgpa),
			semester_cgpas: student.semester_cgpas || [], active_backlogs: student.active_backlogs || 0,
			cleared_backlogs: student.cleared_backlogs || 0, tenth_percentage: student.tenth_percentage,
			twelfth_percentage: student.twelfth_percentage, university_roll_number: student.university_roll_number,
			verified_tech_stack: techStack.length ? techStack : ['General'], leetcode_rating: student.leetcode_rating,
			hackerrank_rating: student.hackerrank_rating, github_url: student.github_url,
			portfolio_url: student.portfolio_url, resume_url: student.resume_url,
			resume_filename: student.resume_filename, documents_confirmed: student.documents_confirmed,
			profile_picture_url: student.profile_picture_url, college_id_card_url: student.college_id_card_url,
			internship_experiences: student.internship_experiences || [], project_showcase: student.project_showcase || [],
			responsibilities: student.responsibilities || [], accomplishments: student.accomplishments || [],
			volunteering: student.volunteering || [], extracurriculars: student.extracurriculars || [],
			...patch,
		};
		try {
			const { data } = await api.post('/students/profile', payload);
			setStudent(data);
			setSuccessToast(`Profile saved · readiness ${Number(data.readiness_score).toFixed(1)}/100 (${data.readiness_status}).`);
			return data;
		} catch (requestError) {
			throw new Error(getApiError(requestError));
		}
	};

	const saveProfilePicture = async (profilePictureUrl) => {
		try {
			const { data } = await api.put(`/students/${student.id}`, {
				profile_picture_url: profilePictureUrl,
			});
			setStudent(data);
			window.dispatchEvent(new CustomEvent('campuslink:profile-picture-updated', {
				detail: { url: data.profile_picture_url },
			}));
		} catch (requestError) {
			throw new Error(getApiError(requestError));
		}
	};

	const saveCollegeIdCard = async (collegeIdCardUrl) => {
		return saveProfilePatch({ college_id_card_url: collegeIdCardUrl });
	};

	if (loading) {
		return <div className="flex min-h-80 items-center justify-center text-sm text-slate-400"><LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin text-cyan-300" />Loading your placement profile...</div>;
	}

	if (error) {
		return <div className="mx-auto max-w-3xl rounded-xl border border-rose-400/20 bg-rose-400/5 p-6"><p className="flex items-center gap-2 text-sm font-medium text-rose-200"><TriangleAlert aria-hidden="true" className="h-4 w-4" />Could not load your portal</p><p className="mt-2 text-sm text-slate-400">{error}</p><button className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-300" onClick={loadPortal} type="button"><RefreshCw aria-hidden="true" className="h-4 w-4" />Try again</button></div>;
	}

	if (!student) {
		return <StudentOnboardingWizard email={session.email} onComplete={(profile) => { const message = 'Your placement profile is ready. Welcome to CampusLink.'; setStudent(profile); sessionStorage.setItem('campuslink_onboarding_success', message); window.dispatchEvent(new CustomEvent('campuslink:profile-picture-updated', { detail: { url: profile.profile_picture_url } })); navigate('/student/dashboard', { replace: true }); }} />;
	}

	const score = Number(student.readiness_score || 0);
	const status = student.readiness_status || 'Not Ready';
	const badgeClass = STATUS_STYLE[status] || STATUS_STYLE['Not Ready'];
	const upcomingDrives = drives.filter((drive) => drive.status !== 'Completed');
	const approachingDrives = upcomingDrives.filter((drive) => {
		const hoursUntil = (new Date(drive.drive_date).getTime() - Date.now()) / 3600000;
		return hoursUntil >= 0 && hoursUntil <= 72;
	});
	const resumeReady = Boolean(student.resume_filename || student.resume_url);
	const documents = [
		{ title: 'Resume', detail: student.resume_filename || student.resume_url || 'No resume added yet', ready: resumeReady, icon: FileText },
		{ title: 'Official College ID Card', detail: student.college_id_card_url ? (student.college_id_verified ? 'Verified by placement cell' : 'Uploaded · pending verification') : 'No College ID card uploaded', ready: Boolean(student.college_id_verified), icon: GraduationCap },
		{ title: 'Academic & identity records', detail: student.documents_confirmed ? 'Marked ready during onboarding' : 'Keep identity and academic records ready', ready: Boolean(student.documents_confirmed), icon: CheckCircle2 },
		{ title: 'Offer acceptance form', detail: 'Complete after receiving an offer', ready: false, icon: FileText },
	];
	const jobListings = recruiterJds.filter((jd) => !/intern(ship)?/i.test(jd.role_title || ''));
	const requiredSkills = (jd) => (jd.required_skills || '').split(/[,;|]/).map((skill) => skill.trim()).filter(Boolean);
	const studentSkills = new Set([...(student.verified_tech_stack || []), ...(student.skills || '').split(',')].map((skill) => skill.trim().toLowerCase()).filter(Boolean));

	if (view === 'profile') {
		return <StudentProfileManager isEditing={isEditingProfile} onCancelEdit={() => setIsEditingProfile(false)} onEdit={() => setIsEditingProfile(true)} onSavePatch={saveProfilePatch} onSaved={(updated) => { setStudent(updated); setIsEditingProfile(false); setSuccessToast(`Profile updated · readiness ${Number(updated.readiness_score).toFixed(1)}/100 (${updated.readiness_status}).`); }} saveCollegeIdCard={saveCollegeIdCard} saveProfilePicture={saveProfilePicture} student={student} successToast={successToast} />;
	}

	if (view === 'jobs' || view === 'internships') {
		return <><DeadlineBanner drives={approachingDrives} /><StudentJobs isInternship={view === 'internships'} recruiterJds={recruiterJds} student={student} /></>;
	}

	if (view === 'growth') return <StudentGrowth />;

	if (view === 'mock-tests') return <MockTestsView onScoresSaved={(updated, detail) => { setStudent(updated); setSuccessToast(`${detail} Readiness ${Number(updated.readiness_score).toFixed(1)}/100 (${updated.readiness_status}).`); }} session={session} student={student} />;

	if (view === 'interviews') return <StudentInterviews />;

	if (view === 'compatibility') return <div className="mx-auto max-w-7xl"><StudentPageHeader eyebrow="Market alignment" title="Job compatibility" description="Compare your verified skills and CGPA with current recruiter requirements." /><DeadlineBanner drives={approachingDrives} />{jobListings.length === 0 ? <EmptyView icon={Sparkles} title="No active recruiter requirements" description="Role-by-role compatibility appears when recruiters publish job descriptions." /> : <div className="space-y-4">{jobListings.map((jd) => { const required = requiredSkills(jd); const matched = required.filter((skill) => studentSkills.has(skill.toLowerCase())); const missing = required.filter((skill) => !studentSkills.has(skill.toLowerCase())); const eligible = Number(student.cgpa) >= Number(jd.min_cgpa); const overlap = required.length ? Math.round(matched.length / required.length * 100) : 0; return <article className="rounded-xl border border-slate-800 bg-slate-900 p-5" key={jd.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">{jd.company_name}</p><h2 className="mt-1 text-base font-semibold text-white">{jd.role_title}</h2></div><span className={`rounded-full border px-3 py-1 text-xs ${eligible ? 'border-emerald-300/20 bg-emerald-300/5 text-emerald-200' : 'border-rose-300/20 bg-rose-300/5 text-rose-200'}`}>{eligible ? `${overlap}% skill overlap` : 'CGPA cutoff not met'}</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${eligible ? overlap : 0}%` }} /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-[10px] uppercase tracking-wide text-slate-500">Matched skills</p><p className="mt-1 text-xs text-emerald-200">{matched.join(', ') || 'No matches yet'}</p></div><div><p className="text-[10px] uppercase tracking-wide text-slate-500">Skill opportunities</p><p className="mt-1 text-xs text-amber-200">{missing.join(', ') || 'All listed skills matched'}</p></div></div><p className="mt-4 text-[10px] text-slate-600">Skill overlap is an informational profile comparison, not an official AI match result.</p></article>; })}</div>}</div>;

	if (view === 'notices') return <StudentNotices />;

	if (view === 'dashboard') return <StudentDashboard student={student} drives={upcomingDrives} recruiterJds={recruiterJds} successToast={successToast} onDismissToast={() => setSuccessToast('')} nudge={nudge} nudgeError={nudgeError} nudgeLoading={nudgeLoading} onRequestNudge={requestNudge} />;

	return (
		<div className="mx-auto max-w-7xl space-y-8">
			{successToast && <div aria-live="polite" className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-100" role="status"><CheckCircle2 aria-hidden="true" className="h-4 w-4" />{successToast}<button aria-label="Dismiss success message" className="ml-auto text-emerald-200/70 hover:text-white" onClick={() => setSuccessToast('')} type="button">×</button></div>}
			<DeadlineBanner drives={approachingDrives} />
			<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
				<div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Student workspace</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Your placement overview</h1><p className="mt-2 text-sm text-slate-400">A focused view of readiness, upcoming opportunities, and next actions.</p></div>
				<div className="flex items-center gap-3"><div className="flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-400" />Profile synced</div><ProfileAvatar name={student.name} pictureUrl={student.profile_picture_url} size="sm" /></div>
			</header>

			<section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
				<div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
					<div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
					<div className="relative flex flex-col items-center gap-7 sm:flex-row">
						<ScoreGauge score={score} />
						<div className="min-w-0 flex-1 text-center sm:text-left">
							<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Readiness score</p>
							<h2 className="mt-2 truncate text-2xl font-semibold text-white">{student.name}</h2>
							<p className="mt-1 text-sm text-slate-400">{student.branch} · CGPA {Number(student.cgpa).toFixed(2)}</p>
							<span className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${badgeClass}`}>{status}</span>
							<p className="mt-4 max-w-md text-sm leading-6 text-slate-400">Your score combines your academic profile, technical skills, and mock interview performance.</p>
						</div>
					</div>
					<div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-slate-800 pt-5">
						<div><p className="text-xs text-slate-500">Technical skills</p><p className="mt-1 text-sm font-medium text-slate-200">{(student.skills || '').split(',').filter(Boolean).length} listed</p></div>
						<div><p className="text-xs text-slate-500">Mock interview</p><p className="mt-1 text-sm font-medium text-slate-200">{Math.round(student.mock_interview_score || 0)}<span className="text-slate-500"> / 100</span></p></div>
					</div>
				</div>

				<div className="rounded-xl border border-indigo-300/15 bg-gradient-to-br from-indigo-500/10 via-slate-900 to-cyan-500/5 p-6">
					<div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-400/10 text-cyan-200"><Sparkles aria-hidden="true" className="h-5 w-5" /></span><span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-indigo-200/70">Skill plan</span></div>
					<h2 className="mt-5 text-lg font-semibold text-white">Turn a gap into a next step</h2>
					<p className="mt-2 text-sm leading-6 text-slate-400">Find skills commonly requested by recruiters and preview how a focused challenge can improve readiness.</p>
					<button className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-400/15 px-4 text-sm font-medium text-indigo-100 transition hover:bg-indigo-400/25 disabled:cursor-wait disabled:opacity-60" disabled={nudgeLoading} onClick={requestNudge} type="button">
						{nudgeLoading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}{nudgeLoading ? 'Preparing plan...' : 'Preview skill challenge'}
					</button>
					{nudgeError && <p className="mt-3 text-xs text-rose-300">{nudgeError}</p>}
					{nudge && <div aria-live="polite" className="mt-5 border-t border-slate-700/70 pt-4">
						<div className="flex items-end justify-between gap-4"><p className="text-xs text-slate-400">Forecast readiness</p><p className="text-xl font-semibold text-cyan-200">{nudge.forecast_readiness_score}<span className="ml-2 text-xs text-emerald-300">+{nudge.readiness_score_bump}</span></p></div>
						{nudge.missing_skills?.length > 0 && <p className="mt-3 text-xs text-slate-400">Skill gaps: <span className="text-slate-200">{nudge.missing_skills.join(', ')}</span></p>}
						<div className="mt-3 space-y-2">{nudge.recommendations?.map((item) => <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-3" key={item.skill}><p className="text-xs font-semibold text-white">{item.skill} <span className="ml-2 font-normal text-cyan-300">+{item.reward_xp} XP</span></p><p className="mt-1 text-xs leading-5 text-slate-400">{item.challenge}</p></div>)}</div>
					</div>}
				</div>
			</section>

			<section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
					<SectionTitle icon={CalendarDays} label="Recruiter calendar" title="Upcoming placement drives" />
					{upcomingDrives.length === 0 ? <p className="rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-500">No upcoming drives are scheduled right now.</p> : <div className="divide-y divide-slate-800">{upcomingDrives.map((drive) => <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0" key={drive.id}><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-cyan-200"><BriefcaseBusiness aria-hidden="true" className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-100">{drive.company_name}</p><p className="mt-1 truncate text-xs text-slate-500">{drive.venue}</p></div></div><div className="shrink-0 text-right"><p className="text-xs text-slate-300">{new Date(drive.drive_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{drive.status}</p></div></div>)}</div>}
					<p className="mt-5 border-t border-slate-800 pt-4 text-xs text-slate-500">Drive eligibility and shortlist status are confirmed by the placement cell.</p>
				</div>

				<div className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
					<SectionTitle icon={FileText} label="Placement documents" title="Document tracker" />
					<div className="space-y-3">{documents.map(({ title, detail, ready, icon: Icon }) => <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/45 p-4" key={title}><Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-200">{title}</p><p className="mt-1 break-all text-xs leading-5 text-slate-500">{detail}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] ${ready ? 'border-emerald-300/20 text-emerald-200' : 'border-slate-700 text-slate-500'}`}>{ready ? 'Ready' : 'Pending'}</span></div>)}</div>
					<p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-600"><Clock3 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />Document confirmation is self-reported and can be reviewed by the placement cell.</p>
				</div>
			</section>

			<div className="flex items-center gap-2 text-xs text-slate-600"><MessageSquareText aria-hidden="true" className="h-3.5 w-3.5" />Need help? Contact your institute placement cell.</div>
		</div>
	);
}

function readLocalList(key) {
	try {
		const value = JSON.parse(localStorage.getItem(key) || '[]');
		return Array.isArray(value) ? value : [];
	} catch {
		return [];
	}
}

function StudentProfileEditor({ student, onCancel, onSaved }) {
	const [profile, setProfile] = useState(() => ({
		name: student.name || '',
		branch: student.branch || 'CSE',
		roll: student.university_roll_number || '',
		cgpa: String(student.cgpa ?? ''),
		tenth: student.tenth_percentage == null ? '' : String(student.tenth_percentage),
		twelfth: student.twelfth_percentage == null ? '' : String(student.twelfth_percentage),
		activeBacklogs: String(student.active_backlogs ?? 0),
		clearedBacklogs: String(student.cleared_backlogs ?? 0),
		semesters: Array.from({ length: 8 }, (_, index) => student.semester_cgpas?.[index] == null ? '' : String(student.semester_cgpas[index])),
		techStack: [...(student.verified_tech_stack?.length ? student.verified_tech_stack : student.skills?.split(',').map((skill) => skill.trim()).filter(Boolean) || [])],
		leetcode: student.leetcode_rating == null ? '' : String(student.leetcode_rating),
		hackerrank: student.hackerrank_rating == null ? '' : String(student.hackerrank_rating),
		github: student.github_url || '',
		portfolio: student.portfolio_url || '',
		resumeUrl: student.resume_url || '',
		collegeIdUrl: student.college_id_card_url?.startsWith('https://') ? student.college_id_card_url : '',
		documentsConfirmed: Boolean(student.documents_confirmed),
	}));
	const [customSkill, setCustomSkill] = useState('');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const update = (key, value) => setProfile((current) => ({ ...current, [key]: value }));
	const toggleSkill = (skill) => update('techStack', profile.techStack.includes(skill)
		? profile.techStack.filter((item) => item !== skill)
		: [...profile.techStack, skill]);
	const addSkill = () => {
		const skill = customSkill.trim();
		if (skill && !profile.techStack.some((item) => item.toLowerCase() === skill.toLowerCase())) {
			update('techStack', [...profile.techStack, skill]);
		}
		setCustomSkill('');
	};
	const setSemester = (index, value) => update('semesters', profile.semesters.map((item, itemIndex) => itemIndex === index ? value : item));
	const submit = async (event) => {
		event.preventDefault();
		setError('');
		if (!profile.name.trim() || !profile.roll.trim() || !profile.cgpa || profile.techStack.length === 0) {
			setError('Name, roll number, CGPA, and at least one technical skill are required.');
			return;
		}
		if (Number(profile.cgpa) > 10 || [profile.tenth, profile.twelfth].some((value) => value !== '' && Number(value) > 100)
			|| profile.semesters.some((value) => value !== '' && (Number(value) < 0 || Number(value) > 10))) {
			setError('Check CGPA, board percentages, and semester scores against their allowed ranges.');
			return;
		}
		setSaving(true);
		try {
			const payload = {
				name: profile.name.trim(), branch: profile.branch, cgpa: Number(profile.cgpa),
				semester_cgpas: profile.semesters.map((value) => value === '' ? null : Number(value)),
				active_backlogs: Number(profile.activeBacklogs || 0), cleared_backlogs: Number(profile.clearedBacklogs || 0),
				tenth_percentage: profile.tenth === '' ? null : Number(profile.tenth),
				twelfth_percentage: profile.twelfth === '' ? null : Number(profile.twelfth),
				university_roll_number: profile.roll.trim(), verified_tech_stack: profile.techStack,
				leetcode_rating: profile.leetcode === '' ? null : Number(profile.leetcode),
				hackerrank_rating: profile.hackerrank === '' ? null : Number(profile.hackerrank),
				github_url: profile.github.trim() || null, portfolio_url: profile.portfolio.trim() || null,
				resume_url: profile.resumeUrl.trim() || null, resume_filename: student.resume_filename || null,
				documents_confirmed: profile.documentsConfirmed,
				profile_picture_url: student.profile_picture_url || null,
				college_id_card_url: profile.collegeIdUrl.trim() || (student.college_id_card_url?.startsWith('data:') ? student.college_id_card_url : null),
			};
			const { data } = await api.post('/students/profile', payload);
			onSaved(data);
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setSaving(false);
		}
	};
	return <form className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6" onSubmit={submit}>
		{error && <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 px-3 py-2.5 text-sm text-rose-200" role="alert">{error}</p>}
		<section><h2 className="mb-3 text-sm font-semibold text-white">Academic metrics</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<SetupField label="Full name" name="edit-name" onChange={(value) => update('name', value)} required value={profile.name} />
			<label className="block space-y-2" htmlFor="edit-branch"><span className="text-xs font-medium text-slate-300">Branch</span><select className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100" id="edit-branch" onChange={(event) => update('branch', event.target.value)} value={profile.branch}>{BRANCH_OPTIONS.map((branch) => <option className="bg-slate-900" key={branch} value={branch}>{branch}</option>)}</select></label>
			<SetupField label="University roll number" name="edit-roll" onChange={(value) => update('roll', value)} required value={profile.roll} />
			<SetupField label="CGPA / 10" max="10" min="0" name="edit-cgpa" onChange={(value) => update('cgpa', value)} required step="0.01" type="number" value={profile.cgpa} />
			<SetupField label="10th percentage" max="100" min="0" name="edit-tenth" onChange={(value) => update('tenth', value)} step="0.01" type="number" value={profile.tenth} />
			<SetupField label="12th percentage" max="100" min="0" name="edit-twelfth" onChange={(value) => update('twelfth', value)} step="0.01" type="number" value={profile.twelfth} />
			<SetupField label="Active backlogs" min="0" name="edit-active-backlogs" onChange={(value) => update('activeBacklogs', value)} step="1" type="number" value={profile.activeBacklogs} />
			<SetupField label="Cleared backlogs" min="0" name="edit-cleared-backlogs" onChange={(value) => update('clearedBacklogs', value)} step="1" type="number" value={profile.clearedBacklogs} />
		</div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{profile.semesters.map((value, index) => <SetupField key={index} label={`Semester ${index + 1}`} max="10" min="0" name={`edit-semester-${index + 1}`} onChange={(next) => setSemester(index, next)} step="0.01" type="number" value={value} />)}</div></section>
		<section className="border-t border-slate-800 pt-5"><h2 className="mb-3 text-sm font-semibold text-white">Technical stack</h2><div className="flex flex-wrap gap-2">{TECH_OPTIONS.map((skill) => <button aria-pressed={profile.techStack.includes(skill)} className={`rounded-full border px-3 py-2 text-xs transition ${profile.techStack.includes(skill) ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100' : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:border-slate-500'}`} key={skill} onClick={() => toggleSkill(skill)} type="button">{profile.techStack.includes(skill) ? '✓ ' : '+ '}{skill}</button>)}{profile.techStack.filter((skill) => !TECH_OPTIONS.includes(skill)).map((skill) => <button className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100" key={skill} onClick={() => toggleSkill(skill)} type="button">✓ {skill} ×</button>)}</div><div className="mt-3 flex gap-2"><input className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-white" onChange={(event) => setCustomSkill(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSkill(); } }} placeholder="Add another technical skill" value={customSkill} /><button className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 text-xs text-slate-200 hover:border-cyan-300/30" onClick={addSkill} type="button"><Plus aria-hidden="true" className="h-3.5 w-3.5" />Add</button></div></section>
		<section className="border-t border-slate-800 pt-5"><h2 className="mb-3 text-sm font-semibold text-white">Links & documents</h2><div className="grid gap-4 sm:grid-cols-2"><SetupField label="LeetCode rating" max="5000" min="0" name="edit-leetcode" onChange={(value) => update('leetcode', value)} step="1" type="number" value={profile.leetcode} /><SetupField label="HackerRank rating" max="5000" min="0" name="edit-hackerrank" onChange={(value) => update('hackerrank', value)} step="1" type="number" value={profile.hackerrank} /><SetupField label="GitHub URL" name="edit-github" onChange={(value) => update('github', value)} type="url" value={profile.github} /><SetupField label="Portfolio URL" name="edit-portfolio" onChange={(value) => update('portfolio', value)} type="url" value={profile.portfolio} /><SetupField label="Resume URL" name="edit-resume" onChange={(value) => update('resumeUrl', value)} type="url" value={profile.resumeUrl} /><SetupField label="College ID card URL" name="edit-college-id" onChange={(value) => update('collegeIdUrl', value)} placeholder={student.college_id_card_url?.startsWith('data:') ? 'Uploaded card retained; paste a replacement secure URL' : 'https://...'} value={profile.collegeIdUrl} /></div>{student.college_id_card_url?.startsWith('data:') && <p className="mt-2 text-[11px] text-slate-500">Your uploaded ID image/PDF remains attached. To replace it with a file, use the upload control in My Profile after saving.</p>}<label className="mt-4 flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3"><input checked={profile.documentsConfirmed} className="mt-0.5 accent-cyan-400" onChange={(event) => update('documentsConfirmed', event.target.checked)} type="checkbox" /><span className="text-xs leading-5 text-slate-300">My placement documents are ready for review.</span></label></section>
		<div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4"><button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm text-slate-300 hover:text-white" onClick={onCancel} type="button"><X aria-hidden="true" className="h-4 w-4" />Cancel</button><button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">{saving ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}{saving ? 'Saving…' : 'Save profile'}</button></div>
	</form>;
}

function MockTestsView({ student, session, onScoresSaved }) {
	const resultKey = `campuslink_mock_results:${session.email}`;
	const scheduleKey = `campuslink_mock_schedule:${session.email}`;
	const [results, setResults] = useState(() => readLocalList(resultKey));
	const [sessions, setSessions] = useState(() => readLocalList(scheduleKey));
	const [answers, setAnswers] = useState({});
	const [questions, setQuestions] = useState([]);
	const [topic, setTopic] = useState('Core CS');
	const [difficulty, setDifficulty] = useState('Medium');
	const [generating, setGenerating] = useState(false);
	const [timeLeft, setTimeLeft] = useState(null);
	const [violations, setViolations] = useState(0);
	const [assessmentId, setAssessmentId] = useState('');
	const [quizSubmitted, setQuizSubmitted] = useState(true);
	const [quizTimedOut, setQuizTimedOut] = useState(false);
	const [instructionsOpen, setInstructionsOpen] = useState(false);
	const [instructionsConfirmed, setInstructionsConfirmed] = useState(false);
	const submitQuizRef = useRef(null);
	const [speechScore, setSpeechScore] = useState(null);
	const [designScore, setDesignScore] = useState(null);
	const [feedback, setFeedback] = useState('');
	const [interviewLanguages, setInterviewLanguages] = useState({});
	const [interviewCodes, setInterviewCodes] = useState({});
	const [codeEvaluations, setCodeEvaluations] = useState({});
	const [latestCodeEvaluation, setLatestCodeEvaluation] = useState(null);
	const [latestSpeechEvaluation, setLatestSpeechEvaluation] = useState(null);
	const [activeInterviewPrompt, setActiveInterviewPrompt] = useState('arrays');
	const [analyzingProblem, setAnalyzingProblem] = useState('');
	const [evaluatingSpeech, setEvaluatingSpeech] = useState(false);
	const [recording, setRecording] = useState(false);
	const speechRecognitionRef = useRef(null);
	const [practiceTitle, setPracticeTitle] = useState('');
	const [practiceAt, setPracticeAt] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const generateQuiz = useCallback(async () => {
		setGenerating(true);
		setError('');
		setTimeLeft(null);
		setQuizSubmitted(true);
		const nextAssessmentId = crypto.randomUUID();
		setAssessmentId(nextAssessmentId);
		try {
			const { data } = await api.post('/v1/tests/generate-adaptive', { topic, difficulty, count: 3 });
			if (!Array.isArray(data) || data.length === 0) {
				throw new Error('The quiz service returned no questions. Please try again.');
			}
			setQuestions(data);
			setAnswers({});
			setViolations(0);
			setQuizTimedOut(false);
			setQuizSubmitted(false);
			setTimeLeft(data.length * 60);
		} catch (requestError) {
			setQuestions([]);
			setAssessmentId('');
			setError(requestError.message || getApiError(requestError));
		} finally {
			setGenerating(false);
		}
	}, [topic, difficulty]);
	const handleProctorAutoSubmit = useCallback(() => {
		submitQuizRef.current?.(null, true);
	}, []);
	const interviewPrompts = [
		{ id: 'arrays', title: 'Coding • Arrays', category: 'Arrays', prompt: 'Given an integer array nums and a target, return the indices of two distinct elements that sum to target. Assume exactly one solution exists and do not reuse an element. Discuss brute force versus an optimized approach.' },
		{ id: 'strings', title: 'Coding • Strings', category: 'Strings', prompt: 'Given a string, return the length of its longest substring without repeating characters. The input may contain spaces, punctuation, and Unicode characters.' },
		{ id: 'design', title: 'System design', category: 'System design', prompt: `Design a campus placement notification service for ${student.branch} students. Define the API and data model, then explain delivery retries, idempotency, and how the service scales during a placement-drive announcement.` },
	];
	const getInterviewLanguage = (problemId) => interviewLanguages[problemId] || 'Python';
	const getInterviewCode = (problemId) => {
		const language = getInterviewLanguage(problemId);
		return interviewCodes[problemId] ?? INTERVIEW_STARTERS[language][problemId];
	};
	const updateInterviewLanguage = (problemId, language) => {
		setInterviewLanguages((current) => ({ ...current, [problemId]: language }));
		setInterviewCodes((current) => ({ ...current, [problemId]: INTERVIEW_STARTERS[language][problemId] }));
	};
	const analyzeCode = async (item) => {
		const language = getInterviewLanguage(item.id);
		const code = getInterviewCode(item.id);
		if (!code.trim()) {
			setError('Add a code solution before requesting an AI analysis.');
			return;
		}
		setAnalyzingProblem(item.id);
		setError('');
		try {
			const { data } = await api.post('/v1/interviews/evaluate-solution', {
				problem_title: item.title,
				language,
				code,
				category: item.category,
			});
			setCodeEvaluations((current) => ({ ...current, [item.id]: data }));
			if (data.evaluated) {
				setLatestCodeEvaluation(data);
				setDesignScore(data.code_quality_score);
				setNotice('Code analysis complete. Your technical gauge has been updated.');
			}
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setAnalyzingProblem('');
		}
	};
	const startRecording = () => {
		const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!Recognition) {
			setError('Speech recognition is not supported in this browser. Type your explanation instead.');
			return;
		}
		if (speechRecognitionRef.current) {
			speechRecognitionRef.current.stop();
			speechRecognitionRef.current = null;
			setRecording(false);
			return;
		}
		const recognition = new Recognition();
		recognition.lang = 'en-US';
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.onresult = (event) => {
			const finalText = [];
			for (let index = event.resultIndex; index < event.results.length; index += 1) {
				if (event.results[index].isFinal) finalText.push(event.results[index][0].transcript.trim());
			}
			if (finalText.length) {
				setFeedback((current) => `${current}${current.trim() ? ' ' : ''}${finalText.join(' ')}`);
			}
		};
		recognition.onerror = (event) => {
			setError(event.error === 'not-allowed'
				? 'Microphone access was denied. Allow microphone access or type your explanation.'
				: 'Speech recognition stopped unexpectedly. Please try again or type your explanation.');
			setRecording(false);
			speechRecognitionRef.current = null;
		};
		recognition.onend = () => {
			setRecording(false);
			speechRecognitionRef.current = null;
		};
		speechRecognitionRef.current = recognition;
		setError('');
		setRecording(true);
		try {
			recognition.start();
		} catch {
			speechRecognitionRef.current = null;
			setRecording(false);
			setError('Could not start speech recognition. Check microphone access or type your explanation.');
		}
	};
	const evaluateExplanation = async () => {
		if (!feedback.trim()) {
			setError('Record or type an explanation before evaluating it.');
			return;
		}
		const selectedPrompt = interviewPrompts.find((item) => item.id === activeInterviewPrompt) || interviewPrompts[0];
		setEvaluatingSpeech(true);
		setError('');
		try {
			const { data } = await api.post('/v1/interviews/evaluate-speech', {
				topic: selectedPrompt.title,
				transcript: feedback.trim(),
			});
			setLatestSpeechEvaluation(data);
			if (data.evaluated) {
				setSpeechScore(Math.round((data.communication_clarity + data.confidence) / 2));
				setDesignScore(data.technical_depth);
				setNotice('Explanation analysis complete. Your AI gauges have been updated.');
			}
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setEvaluatingSpeech(false);
		}
	};
	const appendResult = (item) => {
		const next = [item, ...results].slice(0, 12);
		setResults(next);
		localStorage.setItem(resultKey, JSON.stringify(next));
	};
	const saveScores = async (scorePatch, result) => {
		setBusy(true);
		setError('');
		setNotice('');
		try {
			const body = {
				mock_interview_score: Number(scorePatch.mock_interview_score ?? student.mock_interview_score ?? 0),
				system_design_score: Number(scorePatch.system_design_score ?? student.system_design_score ?? 0),
				ai_speech_score: Number(scorePatch.ai_speech_score ?? student.ai_speech_score ?? 0),
				aptitude_score: Number(scorePatch.aptitude_score ?? student.aptitude_score ?? 0),
			};
			const { data } = await api.post('/students/me/assessments', body);
			appendResult({ ...result, id: `${Date.now()}`, date: new Date().toISOString() });
			onScoresSaved(data, result.title);
			setNotice(`${result.title} saved successfully.`);
		} catch (requestError) {
			setError(getApiError(requestError));
			if (result.title === 'Aptitude & Core CS quiz') {
				setQuizSubmitted(false);
				setTimeLeft(null);
			}
		} finally {
			setBusy(false);
		}
	};
	const submitQuiz = (event, timedOut = false) => {
		event?.preventDefault();
		if (quizSubmitted || questions.length === 0) return;
		if (!timedOut && !quizTimedOut && Object.keys(answers).length !== questions.length) {
			setError('Answer each question before submitting the quiz.');
			return;
		}
		setQuizSubmitted(true);
		setQuizTimedOut((wasTimedOut) => wasTimedOut || timedOut);
		setTimeLeft(null);
		const correctCount = questions.reduce((total, question, index) => total + (Number(answers[index]) === question.correct_answer ? 1 : 0), 0);
		const score = Math.round(correctCount / questions.length * 100);
		const timingFeedback = timedOut || quizTimedOut ? ' Time expired; unanswered questions count as incorrect.' : '';
		const violationFeedback = violations ? ` ${violations} tab switch${violations === 1 ? '' : 'es'} detected.` : '';
		void saveScores(
			{ aptitude_score: score },
			{ title: 'Aptitude & Core CS quiz', score, feedback: `${correctCount} of ${questions.length} answers correct.${timingFeedback}${violationFeedback}` },
		);
	};
	submitQuizRef.current = submitQuiz;
	useEffect(() => {
		if (timeLeft === null || quizSubmitted) return undefined;
		if (timeLeft === 0) {
			submitQuizRef.current?.(null, true);
			return undefined;
		}
		const timer = window.setTimeout(() => {
			setTimeLeft((current) => current === null ? null : Math.max(0, current - 1));
		}, 1000);
		return () => window.clearTimeout(timer);
	}, [timeLeft, quizSubmitted]);
	useEffect(() => () => speechRecognitionRef.current?.stop(), []);
	const submitInterview = (event) => {
		event.preventDefault();
		const availableScores = [speechScore, designScore].filter((score) => Number.isFinite(score));
		if (!availableScores.length) {
			setError('Analyze a code solution or evaluate an explanation before saving your interview result.');
			return;
		}
		const interviewScore = Math.round(availableScores.reduce((total, score) => total + score, 0) / availableScores.length);
		const analysisFeedback = [
			latestCodeEvaluation?.feedback,
			latestSpeechEvaluation?.evaluated ? latestSpeechEvaluation.feedback : '',
			latestCodeEvaluation?.edge_case_suggestions?.length
				? `Edge cases to consider: ${latestCodeEvaluation.edge_case_suggestions.join('; ')}`
				: '',
		].filter(Boolean).join(' ');
		void saveScores({
			mock_interview_score: interviewScore,
			system_design_score: designScore ?? Number(student.system_design_score || 0),
			ai_speech_score: speechScore ?? Number(student.ai_speech_score || 0),
		}, {
			title: 'AI mock technical interview', score: interviewScore,
			feedback: [feedback.trim(), analysisFeedback].filter(Boolean).join(' · ') || 'AI interview analysis completed.',
		});
	};
	const scheduleSession = (event) => {
		event.preventDefault();
		if (!practiceTitle.trim() || !practiceAt || new Date(practiceAt).getTime() <= Date.now()) {
			setError('Choose a practice type and a future date and time.');
			return;
		}
		const next = [{ id: `${Date.now()}`, title: practiceTitle, at: new Date(practiceAt).toISOString() }, ...sessions].slice(0, 10);
		setSessions(next);
		localStorage.setItem(scheduleKey, JSON.stringify(next));
		setPracticeTitle('');
		setPracticeAt('');
		setNotice('Practice session added to your upcoming plan.');
		setError('');
	};
	const scores = [
		{ label: 'Mock interview', value: Number(student.mock_interview_score || 0), icon: Video },
		{ label: 'System design', value: Number(student.system_design_score || 0), icon: Cpu },
		{ label: 'Speech & confidence', value: Number(student.ai_speech_score || 0), icon: MessageSquareText },
		{ label: 'Aptitude & CS', value: Number(student.aptitude_score || 0), icon: ClipboardCheck },
	];
	const trend = results.slice(0, 6).reverse();
	const formattedTime = timeLeft === null
		? '--:--'
		: `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`;
	return <div className="mx-auto max-w-7xl space-y-6">
		{instructionsOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setInstructionsOpen(false); setInstructionsConfirmed(false); } }}>
			<section aria-labelledby="assessment-instructions-title" aria-modal="true" className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" role="dialog">
				<div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5 sm:p-6">
					<div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300"><ShieldCheck aria-hidden="true" className="h-4 w-4" />Assessment gateway</p><h2 className="mt-2 text-xl font-semibold text-white" id="assessment-instructions-title">Before you begin</h2><p className="mt-1 text-sm text-slate-400">Review all 10 rules to prepare for a fair and uninterrupted assessment.</p></div>
					<button aria-label="Close instructions" className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white" onClick={() => { setInstructionsOpen(false); setInstructionsConfirmed(false); }} type="button"><X aria-hidden="true" className="h-4 w-4" /></button>
				</div>
				<ol className="min-h-0 flex-1 list-decimal space-y-3 overflow-y-auto px-6 py-5 pl-11 text-sm leading-6 text-slate-300 marker:font-semibold marker:text-cyan-300 sm:px-8 sm:pl-14">
					{ASSESSMENT_INSTRUCTIONS.map((instruction) => <li className="pl-1" key={instruction}>{instruction}</li>)}
				</ol>
				<div className="space-y-4 border-t border-slate-800 p-5 sm:p-6">
					<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-3 text-sm leading-5 text-slate-200">
						<input checked={instructionsConfirmed} className="mt-1 accent-cyan-400" onChange={(event) => setInstructionsConfirmed(event.target.checked)} type="checkbox" />
						<span>I hereby confirm that I’ve read all instructions and I am ready to begin my test</span>
					</label>
					<div className="flex justify-end gap-2">
						<button className="min-h-10 rounded-lg border border-slate-700 px-4 text-sm text-slate-300 hover:text-white" onClick={() => { setInstructionsOpen(false); setInstructionsConfirmed(false); }} type="button">Cancel</button>
						<button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50" disabled={!instructionsConfirmed || generating || busy} onClick={() => { if (!instructionsConfirmed) return; setInstructionsOpen(false); setInstructionsConfirmed(false); void generateQuiz(); }} type="button"><ShieldCheck aria-hidden="true" className="h-4 w-4" />Begin Test</button>
					</div>
				</div>
			</section>
		</div>}
		<StudentPageHeader eyebrow="Practice & assessment" title="Mock Tests & Interviews" description="Build interview fluency, practice core concepts, and track your latest assessment scores." />
		{error && <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}{notice && <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-100" role="status">{notice}</p>}
		<section className="grid gap-3 grid-cols-2 xl:grid-cols-4">{scores.map(({ label, value, icon: Icon }) => <article className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5" key={label}><div className="flex items-center gap-2 text-xs text-slate-400"><Icon aria-hidden="true" className="h-4 w-4 text-cyan-300" />{label}</div><p className="mt-3 text-3xl font-semibold tabular-nums text-white">{value}<span className="ml-1 text-xs text-slate-500">/100</span></p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div></article>)}</section>
		<div className="grid gap-5 xl:grid-cols-2"><section className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6"><SectionTitle icon={Video} label="Technical practice" title="AI mock technical interviews" />
			<div className="space-y-3">{interviewPrompts.map((item) => {
				const language = getInterviewLanguage(item.id);
				const evaluation = codeEvaluations[item.id];
				return <details className="rounded-lg border border-slate-800 bg-slate-950/50 p-4" key={item.id} onToggle={(event) => { if (event.currentTarget.open) setActiveInterviewPrompt(item.id); }}>
					<summary className="cursor-pointer text-sm font-medium text-slate-200">{item.title}</summary>
					<p className="mt-3 text-xs leading-5 text-slate-400">{item.prompt}</p>
					<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
						<label className="space-y-1.5 text-xs text-slate-400">Language
							<select className="ml-2 min-h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-100" onChange={(event) => updateInterviewLanguage(item.id, event.target.value)} value={language}>
								{Object.keys(INTERVIEW_STARTERS).map((option) => <option className="bg-slate-900" key={option} value={option}>{option}</option>)}
							</select>
						</label>
						<span className="text-[10px] text-cyan-200">Explain your approach, Big-O, and edge cases.</span>
					</div>
					<label className="mt-3 block space-y-2"><span className="text-xs text-slate-300">Your solution</span>
						<textarea aria-label={`${item.title} solution in ${language}`} className="min-h-48 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400" onChange={(event) => setInterviewCodes((current) => ({ ...current, [item.id]: event.target.value }))} spellCheck="false" value={getInterviewCode(item.id)} />
					</label>
					<button className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-4 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-60" disabled={analyzingProblem === item.id || busy} onClick={() => void analyzeCode(item)} type="button">
						{analyzingProblem === item.id ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}
						{analyzingProblem === item.id ? 'Analyzing solution…' : 'Analyze Code with AI'}
					</button>
					{evaluation && <div aria-live="polite" className={`mt-4 rounded-lg border p-3 ${evaluation.evaluated ? 'border-cyan-300/15 bg-cyan-300/[0.04]' : 'border-amber-300/20 bg-amber-300/[0.04]'}`}>
						{evaluation.evaluated ? <>
							<div className="flex flex-wrap gap-2">
								<span className="rounded-full border border-indigo-300/20 bg-indigo-300/5 px-2.5 py-1 text-[10px] text-indigo-100">Time {evaluation.time_complexity}</span>
								<span className="rounded-full border border-indigo-300/20 bg-indigo-300/5 px-2.5 py-1 text-[10px] text-indigo-100">Space {evaluation.space_complexity}</span>
								<span className={`rounded-full border px-2.5 py-1 text-[10px] ${evaluation.correctness ? 'border-emerald-300/20 bg-emerald-300/5 text-emerald-100' : 'border-rose-300/20 bg-rose-300/5 text-rose-100'}`}>Correctness {evaluation.correctness ? 'Pass' : 'Needs work'}</span>
								<span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2.5 py-1 text-[10px] text-cyan-100">Quality {evaluation.code_quality_score}/100</span>
							</div>
							<p className="mt-3 text-xs leading-5 text-slate-300">{evaluation.feedback}</p>
							{evaluation.edge_case_suggestions.length > 0 && <div className="mt-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Edge cases to test</p><ul className="mt-1 list-inside list-disc space-y-1 text-[11px] leading-5 text-slate-400">{evaluation.edge_case_suggestions.map((suggestion, index) => <li key={`${index}-${suggestion}`}>{suggestion}</li>)}</ul></div>}
						</> : <p className="text-xs leading-5 text-amber-100">{evaluation.feedback}</p>}
					</div>}
				</details>;
			})}</div>
			<form className="mt-5 space-y-4 border-t border-slate-800 pt-5" onSubmit={submitInterview}>
				<div className="grid gap-3 sm:grid-cols-2">{[
					{ label: 'Speech & confidence', value: speechScore },
					{ label: 'System design / Technical', value: designScore },
				].map(({ label, value }) => <div aria-label={`${label} AI metric`} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3" key={label} role="group">
					<div className="flex justify-between gap-2 text-xs text-slate-300"><span>{label}</span><span className="tabular-nums text-cyan-200">{value === null ? '—' : `${value}/100`}</span></div>
					<div aria-label={label} aria-valuemax="100" aria-valuemin="0" aria-valuenow={value ?? 0} className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar">
						<div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-700 ease-out" style={{ width: `${value ?? 0}%` }} />
					</div>
					<p className="mt-1.5 text-[10px] text-slate-500">{value === null ? 'Waiting for an AI analysis' : 'Updated from your latest AI analysis'}</p>
				</div>)}</div>
				<label className="block space-y-2"><span className="text-xs text-slate-300">Reflection / spoken explanation transcript</span>
					<textarea className="min-h-28 w-full resize-y rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400" onChange={(event) => setFeedback(event.target.value)} placeholder="Explain your approach here, or record an answer with your microphone…" value={feedback} />
				</label>
				<div className="flex flex-wrap gap-2">
					<button className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 text-xs font-medium transition disabled:opacity-60 ${recording ? 'border-rose-300/30 bg-rose-300/10 text-rose-100' : 'border-slate-700 bg-slate-950/50 text-slate-200 hover:border-cyan-300/30'}`} onClick={startRecording} type="button">{recording ? 'Stop Recording' : '🎙️ Record Answer / Mic'}</button>
					<button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-4 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-60" disabled={evaluatingSpeech || busy} onClick={() => void evaluateExplanation()} type="button">
						{evaluatingSpeech ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}
						{evaluatingSpeech ? 'Evaluating explanation…' : 'Evaluate Explanation'}
					</button>
				</div>
				{latestSpeechEvaluation && <div aria-live="polite" className={`rounded-lg border p-3 ${latestSpeechEvaluation.evaluated ? 'border-cyan-300/15 bg-cyan-300/[0.04]' : 'border-amber-300/20 bg-amber-300/[0.04]'}`}>
					{latestSpeechEvaluation.evaluated ? <>
						<div className="flex flex-wrap gap-2"><span className="rounded-full border border-indigo-300/20 bg-indigo-300/5 px-2.5 py-1 text-[10px] text-indigo-100">Clarity {latestSpeechEvaluation.communication_clarity}/100</span><span className="rounded-full border border-indigo-300/20 bg-indigo-300/5 px-2.5 py-1 text-[10px] text-indigo-100">Technical depth {latestSpeechEvaluation.technical_depth}/100</span><span className="rounded-full border border-indigo-300/20 bg-indigo-300/5 px-2.5 py-1 text-[10px] text-indigo-100">Confidence {latestSpeechEvaluation.confidence}/100</span></div>
						<p className="mt-3 text-xs leading-5 text-slate-300">{latestSpeechEvaluation.feedback}</p>
					</> : <p className="text-xs leading-5 text-amber-100">{latestSpeechEvaluation.feedback}</p>}
				</div>}
				<button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || (!Number.isFinite(speechScore) && !Number.isFinite(designScore))} type="submit"><Save aria-hidden="true" className="h-4 w-4" />{busy ? 'Saving result…' : 'Save interview result'}</button>
			</form>
		</section>
		<section className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
			{questions.length > 0 && !quizSubmitted && assessmentId && <ProctoringMonitor
				assessmentId={assessmentId}
				onAutoSubmit={handleProctorAutoSubmit}
				onStrikeCountChange={setViolations}
				studentId={student.id}
			/>}
			<div className="mb-5 flex flex-wrap items-start justify-between gap-4">
				<SectionTitle icon={ClipboardCheck} label="Knowledge check" title="Aptitude & Core CS tests" />
				<div className="flex flex-wrap items-center gap-2">
					<span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1.5 text-xs font-semibold tabular-nums text-cyan-100" aria-live="polite">Time: {formattedTime}</span>
					<span className="rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1.5 text-xs text-amber-100" role="status">Proctoring strikes: {violations} / 3</span>
				</div>
			</div>
			<div className="mb-4 flex flex-wrap items-end gap-3">
				<label className="space-y-1.5 text-xs text-slate-300">Topic
					<select className="block min-h-10 rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100" disabled={generating || busy} onChange={(event) => setTopic(event.target.value)} value={topic}>
						<option className="bg-slate-900">Core CS</option><option className="bg-slate-900">Data Structures</option><option className="bg-slate-900">Algorithms</option><option className="bg-slate-900">Quantitative Aptitude</option><option className="bg-slate-900">Logical Reasoning</option>
					</select>
				</label>
				<label className="space-y-1.5 text-xs text-slate-300">Difficulty
					<select className="block min-h-10 rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100" disabled={generating || busy} onChange={(event) => setDifficulty(event.target.value)} value={difficulty}>
						<option className="bg-slate-900">Easy</option><option className="bg-slate-900">Medium</option><option className="bg-slate-900">Hard</option>
					</select>
				</label>
				<button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60" disabled={generating || busy} onClick={() => { setInstructionsConfirmed(false); setInstructionsOpen(true); }} type="button">
					{generating ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ShieldCheck aria-hidden="true" className="h-4 w-4" />}
					{generating ? 'Generating test…' : questions.length > 0 && !quizSubmitted ? 'Configure & Restart Assessment' : 'Configure & Start Assessment'}
				</button>
			</div>
			<form className="space-y-4" onSubmit={submitQuiz}>
				{questions.map((question, index) => <fieldset className="rounded-lg border border-slate-800 bg-slate-950/50 p-4" disabled={quizSubmitted} key={question.id}>
					<legend className="px-1 text-xs font-medium leading-5 text-slate-200">{index + 1}. {question.question}</legend>
					<div className="mt-2 space-y-2">{question.options.map((option, optionIndex) => <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400" key={option}>
						<input checked={Number(answers[index]) === optionIndex} className="accent-cyan-400" name={`question-${index}`} onChange={() => setAnswers((current) => ({ ...current, [index]: optionIndex }))} type="radio" />
						{option}
					</label>)}</div>
				</fieldset>)}
				{questions.length === 0 && <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">{generating ? 'Preparing your adaptive test…' : 'Generate a test to begin your knowledge check.'}</p>}
				<button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-60" disabled={busy || generating || quizSubmitted || questions.length === 0} type="submit">Submit quiz & save score</button>
			</form>
			<div className="mt-5 border-t border-slate-800 pt-4"><p className="text-xs font-medium text-slate-300">Next modules</p><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full border border-slate-700 px-3 py-1.5 text-[10px] text-slate-400">Quantitative aptitude</span><span className="rounded-full border border-slate-700 px-3 py-1.5 text-[10px] text-slate-400">Logical reasoning</span><span className="rounded-full border border-slate-700 px-3 py-1.5 text-[10px] text-slate-400">Core CS fundamentals</span></div></div>
		</section></div>
		<div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]"><section className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6"><SectionTitle icon={Clock3} label="Results & feedback" title="Past mock results" />{results.length === 0 && scores.every((item) => item.value === 0) ? <p className="rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-500">Your saved mock scores and feedback will appear here after a practice session.</p> : <><div className="space-y-2">{results.map((result) => <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-3" key={result.id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-200">{result.title}</p><span className="text-xs font-semibold text-cyan-200">{result.score}/100</span></div><p className="mt-1 text-[10px] text-slate-600">{new Date(result.date).toLocaleString()}</p><p className="mt-2 text-xs leading-5 text-slate-400">{result.feedback}</p></article>)}{scores.filter((item) => item.value > 0).map((item) => <article className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 p-3" key={item.label}><span className="text-xs text-slate-300">Latest {item.label}</span><span className="text-sm font-semibold text-cyan-200">{item.value}/100</span></article>)}</div><div className="mt-5 border-t border-slate-800 pt-4"><p className="mb-3 text-xs font-medium text-slate-300">Recent performance trend</p>{trend.length ? <div className="flex h-28 items-end gap-2">{trend.map((item) => <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" key={item.id}><span className="text-[9px] text-slate-400">{item.score}</span><div className="w-full rounded-t bg-gradient-to-t from-indigo-500 to-cyan-300" style={{ height: `${Math.max(4, item.score)}%` }} /><span className="w-full truncate text-center text-[8px] text-slate-600">{item.title.split(' ')[0]}</span></div>)}</div> : <p className="text-[10px] text-slate-600">Trend bars appear as you save practice results.</p>}</div></>}</section>
		<section className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6"><SectionTitle icon={CalendarDays} label="Practice planner" title="Upcoming mock sessions" /><form className="space-y-3" onSubmit={scheduleSession}><label className="block space-y-2"><span className="text-xs text-slate-300">Practice session</span><select className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" onChange={(event) => setPracticeTitle(event.target.value)} value={practiceTitle}><option value="">Choose a session</option><option>Technical interview</option><option>System design</option><option>Aptitude & Core CS</option></select></label><label className="block space-y-2"><span className="text-xs text-slate-300">Date and time</span><input className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} onChange={(event) => setPracticeAt(event.target.value)} type="datetime-local" value={practiceAt} /></label><button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs text-slate-200 hover:border-cyan-300/30" type="submit"><Plus aria-hidden="true" className="h-4 w-4" />Add to plan</button></form><div className="mt-4 space-y-2">{sessions.filter((item) => new Date(item.at).getTime() > Date.now()).map((item) => <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3" key={item.id}><p className="text-xs font-medium text-slate-200">{item.title}</p><p className="mt-1 text-[10px] text-slate-500">{new Date(item.at).toLocaleString()}</p></div>)}{sessions.filter((item) => new Date(item.at).getTime() > Date.now()).length === 0 && <p className="text-xs text-slate-600">No upcoming practice sessions. Add one above.</p>}</div></section></div>
	</div>;
}

const PROFILE_SECTIONS = [
	{ id: 'basics', label: 'Basic Details' },
	{ id: 'experience', label: 'Experience' },
	{ id: 'projects', label: 'Projects' },
	{ id: 'responsibilities', label: 'POR' },
	{ id: 'accomplishments', label: 'Accomplishments' },
	{ id: 'volunteering', label: 'Volunteering' },
	{ id: 'extracurriculars', label: 'Extracurriculars' },
	{ id: 'profile-picture', label: 'Profile Picture' },
	{ id: 'documents', label: 'Documents' },
];

function StudentProfileManager({ student, isEditing, onEdit, onCancelEdit, onSaved, onSavePatch, saveCollegeIdCard, saveProfilePicture, successToast }) {
	const [searchParams, setSearchParams] = useSearchParams();
	const selected = PROFILE_SECTIONS.some((section) => section.id === searchParams.get('section')) ? searchParams.get('section') : 'basics';
	const collection = {
		experience: { field: 'internship_experiences', title: 'Internship / Work Experience', description: 'Capture roles, duration, technologies, and the work you delivered.', fields: [
			{ key: 'company', label: 'Company name', required: true }, { key: 'role', label: 'Role' }, { key: 'duration_months', label: 'Duration (months)', type: 'number', min: 0, max: 120, required: true }, { key: 'tech_stack', label: 'Tech stack (comma separated)', type: 'tags' }, { key: 'description', label: 'Description / impact bullets', type: 'textarea' },
		] },
		projects: { field: 'project_showcase', title: 'Projects', description: 'Show the work you have built and the tools behind it.', fields: [
			{ key: 'title', label: 'Project title', required: true }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'preview_url', label: 'Live demo URL', type: 'url' }, { key: 'repository_url', label: 'GitHub repository URL', type: 'url' }, { key: 'tech_stack', label: 'Tech tags (comma separated)', type: 'tags' },
		] },
		responsibilities: { field: 'responsibilities', title: 'Positions of Responsibility', description: 'Add leadership roles, clubs, committees, and campus responsibilities.', fields: [
			{ key: 'role', label: 'Role / position', required: true }, { key: 'organization', label: 'Club / organization', required: true }, { key: 'duration', label: 'Duration' }, { key: 'description', label: 'Responsibilities and outcomes', type: 'textarea' },
		] },
		accomplishments: { field: 'accomplishments', title: 'Accomplishments', description: 'Record hackathon results, certifications, awards, and competitive coding milestones.', fields: [
			{ key: 'title', label: 'Award / certification / milestone', required: true }, { key: 'category', label: 'Category (Award, Certification, Hackathon, Coding)' }, { key: 'issuer', label: 'Issuer / event' }, { key: 'date', label: 'Date' }, { key: 'score', label: 'Rating / score (optional)', type: 'number', min: 0, max: 5000 }, { key: 'document_url', label: 'Certificate / proof URL', type: 'url' }, { key: 'description', label: 'Details', type: 'textarea' },
		] },
		volunteering: { field: 'volunteering', title: 'Volunteering', description: 'Highlight community service, NGO work, and social initiatives.', fields: [
			{ key: 'organization', label: 'Organization', required: true }, { key: 'role', label: 'Role' }, { key: 'duration', label: 'Duration' }, { key: 'description', label: 'Contribution and impact', type: 'textarea' },
		] },
		extracurriculars: { field: 'extracurriculars', title: 'Extracurriculars', description: 'Add sports, cultural activities, creative work, and hobbies.', fields: [
			{ key: 'activity', label: 'Activity', required: true }, { key: 'category', label: 'Category (Sports, Cultural, Creative, Other)' }, { key: 'role', label: 'Role / level' }, { key: 'description', label: 'Details' , type: 'textarea' },
		] },
	};
	const entry = collection[selected];
	return <div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-start justify-between gap-4"><StudentPageHeader eyebrow="My profile" title={isEditing ? 'Edit profile' : 'Candidate profile'} description="Manage your academic record, experience, projects, achievements, and documents." />{!isEditing && <button className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-4 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/10" onClick={() => { setSearchParams({ section: 'basics' }); onEdit(); }} type="button"><Pencil aria-hidden="true" className="h-4 w-4" />Edit Profile</button>}</div>
		{successToast && <div aria-live="polite" className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-100" role="status"><CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1">{successToast}</span></div>}
		<nav aria-label="Profile sections" className="mb-5 flex gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 p-2">{PROFILE_SECTIONS.map((section) => <Link aria-current={selected === section.id ? 'page' : undefined} className={`shrink-0 rounded-lg border px-3 py-2 text-xs transition ${selected === section.id ? 'border-indigo-300/20 bg-indigo-400/10 text-cyan-100 shadow-[0_0_16px_rgba(99,102,241,0.10)]' : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'}`} key={section.id} to={`/student/profile?section=${section.id}`}>{section.label}</Link>)}</nav>
		{isEditing ? <StudentProfileEditor onCancel={onCancelEdit} onSaved={onSaved} student={student} /> : entry ? <ProfileCollectionEditor config={entry} key={entry.field} onSavePatch={onSavePatch} rows={student[entry.field] || []} /> : selected === 'documents' ? <StudentDocumentRepository onSavePatch={onSavePatch} saveCollegeIdCard={saveCollegeIdCard} student={student} /> : selected === 'profile-picture' ? <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6"><h2 className="mb-2 text-base font-semibold text-white">Profile picture</h2><p className="mb-4 text-xs text-slate-500">Update the image shown to placement staff and on your student dashboard.</p><ProfilePictureEditor name={student.name} onChange={saveProfilePicture} pictureUrl={student.profile_picture_url} /></section> : <section className="space-y-5"><div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]"><article className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6"><div className="flex flex-wrap items-center gap-4"><ProfileAvatar name={student.name} pictureUrl={student.profile_picture_url} size="lg" /><ScoreGauge score={Number(student.readiness_score || 0)} /><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold text-white">{student.name}</h2><p className="mt-1 text-xs text-slate-400">{student.branch} · Roll {student.university_roll_number || '—'}</p><span className="mt-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2.5 py-1 text-[10px] text-cyan-100">{student.readiness_status}</span></div></div></article><article className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6"><h2 className="mb-4 text-sm font-semibold text-white">Academic core</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['CGPA', `${Number(student.cgpa).toFixed(2)} / 10`], ['Active backlogs', student.active_backlogs ?? 0], ['10th board', student.tenth_percentage == null ? '—' : `${student.tenth_percentage}%`], ['12th board', student.twelfth_percentage == null ? '—' : `${student.twelfth_percentage}%`]].map(([label, value]) => <div className="rounded-lg bg-slate-950/60 p-3" key={label}><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 text-sm text-white">{value}</p></div>)}</div></article></div><section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-3 text-sm font-semibold text-white">Technical profile</h2><div className="flex flex-wrap gap-2">{(student.verified_tech_stack || []).map((skill) => <span className="rounded-md border border-cyan-300/15 bg-cyan-300/5 px-2.5 py-1.5 text-xs text-cyan-100" key={skill}>{skill}</span>)}</div><div className="mt-4 flex flex-wrap gap-4 text-xs">{student.github_url && <a className="text-cyan-300 hover:text-white" href={student.github_url} rel="noreferrer" target="_blank">GitHub profile ↗</a>}{student.portfolio_url && <a className="text-cyan-300 hover:text-white" href={student.portfolio_url} rel="noreferrer" target="_blank">Portfolio ↗</a>}</div></section></section>}
	</div>;
}

function ProfileCollectionEditor({ config, rows, onSavePatch }) {
	const [entries, setEntries] = useState(rows);
	const [draft, setDraft] = useState(null);
	const [editingIndex, setEditingIndex] = useState(-1);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [savedMessage, setSavedMessage] = useState('');
	const blankDraft = () => Object.fromEntries(config.fields.map((field) => [field.key, '']));
	const startAdd = () => { setEditingIndex(-1); setDraft(blankDraft()); setError(''); setSavedMessage(''); };
	const startEdit = (item, index) => { setEditingIndex(index); setDraft(Object.fromEntries(config.fields.map((field) => [field.key, Array.isArray(item[field.key]) ? item[field.key].join(', ') : item[field.key] ?? '']))); setError(''); setSavedMessage(''); };
	const save = async (event) => {
		event.preventDefault();
		const item = {};
		for (const field of config.fields) {
			const value = String(draft[field.key] ?? '').trim();
			if (field.required && !value) { setError(`${field.label} is required.`); return; }
			if (field.type === 'tags') item[field.key] = value.split(',').map((part) => part.trim()).filter(Boolean);
			else if (field.type === 'number') item[field.key] = value === '' ? null : Number(value);
			else item[field.key] = value;
		}
		const next = [...entries];
		if (editingIndex < 0) next.push(item); else next[editingIndex] = item;
		setSaving(true); setError('');
		try { const updated = await onSavePatch({ [config.field]: next }); setEntries(updated[config.field] || next); setDraft(null); setSavedMessage('Changes saved.'); }
		catch (saveError) { setError(saveError.message || 'Could not save this entry.'); }
		finally { setSaving(false); }
	};
	const remove = async (index) => {
		const next = entries.filter((_, itemIndex) => itemIndex !== index);
		setSaving(true); setError('');
		try { const updated = await onSavePatch({ [config.field]: next }); setEntries(updated[config.field] || next); setSavedMessage('Entry deleted.'); }
		catch (saveError) { setError(saveError.message || 'Could not delete this entry.'); }
		finally { setSaving(false); }
	};
	return <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-white">{config.title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{config.description}</p></div><button className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-3 text-xs font-medium text-cyan-100 hover:bg-cyan-300/10" disabled={saving} onClick={startAdd} type="button"><Plus aria-hidden="true" className="h-4 w-4" />Add New Entry</button></div>
		{error && <p className="mt-4 rounded-lg border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-200" role="alert">{error}</p>}{savedMessage && <p className="mt-4 text-xs text-emerald-200" role="status">{savedMessage}</p>}
		{draft && <form className="mt-5 grid gap-4 rounded-lg border border-indigo-300/15 bg-slate-950/55 p-4 sm:grid-cols-2" onSubmit={save}>{config.fields.map((field) => <label className={`block space-y-2 ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`} key={field.key}><span className="text-xs font-medium text-slate-300">{field.label}</span>{field.type === 'textarea' ? <textarea className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} required={field.required} value={draft[field.key]} /> : <input className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400" max={field.max} min={field.min} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} required={field.required} step={field.type === 'number' ? '1' : undefined} type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'} value={draft[field.key]} />}</label>)}<div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><button className="min-h-9 rounded-lg border border-slate-700 px-3 text-xs text-slate-300" onClick={() => setDraft(null)} type="button">Cancel</button><button className="min-h-9 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 text-xs font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">{saving ? 'Saving…' : editingIndex < 0 ? 'Add entry' : 'Save changes'}</button></div></form>}
		<div className="mt-5 space-y-3">{entries.map((item, index) => <article className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/45 p-4 sm:flex-row sm:items-start sm:justify-between" key={`${item.title || item.company || item.organization || item.activity || 'entry'}-${index}`}><div className="min-w-0"><h3 className="break-words text-sm font-semibold text-slate-100">{item.title || item.company || item.role || item.activity || item.organization}</h3><p className="mt-1 text-xs text-cyan-200">{[item.category, item.organization, item.role, item.duration_months != null ? `${item.duration_months} months` : item.duration].filter(Boolean).join(' · ')}</p>{item.description && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-400">{item.description}</p>}{(item.tech_stack || []).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{item.tech_stack.map((tag) => <span className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400" key={tag}>{tag}</span>)}</div>}{item.score != null && <p className="mt-2 text-xs text-slate-400">Score: {item.score}</p>}{item.preview_url && <a className="mt-2 mr-4 inline-block text-xs text-cyan-300" href={item.preview_url} rel="noreferrer" target="_blank">Live demo ↗</a>}{item.repository_url && <a className="mt-2 inline-block text-xs text-cyan-300" href={item.repository_url} rel="noreferrer" target="_blank">Repository ↗</a>}{item.document_url && <a className="mt-2 inline-block text-xs text-cyan-300" href={item.document_url} rel="noreferrer" target="_blank">Certificate / proof ↗</a>}</div><div className="flex shrink-0 gap-2"><button className="min-h-8 rounded-md border border-slate-700 px-2.5 text-[11px] text-slate-300 hover:border-cyan-300/30" disabled={saving} onClick={() => startEdit(item, index)} type="button">Edit</button><button aria-label={`Delete ${item.title || item.company || item.organization || item.activity || 'entry'}`} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-rose-300/15 px-2.5 text-[11px] text-rose-200 hover:bg-rose-300/5" disabled={saving} onClick={() => remove(index)} type="button"><Trash2 aria-hidden="true" className="h-3 w-3" />Delete</button></div></article>)}{entries.length === 0 && !draft && <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">No entries yet. Use “Add New Entry” to add one.</p>}</div>
	</section>;
}

function StudentDocumentRepository({ student, onSavePatch, saveCollegeIdCard }) {
	const [resumeUrl, setResumeUrl] = useState(student.resume_url || '');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');
	useEffect(() => setResumeUrl(student.resume_url || ''), [student.resume_url]);
	const saveResume = async (event) => {
		event.preventDefault(); setSaving(true); setError(''); setMessage('');
		try { await onSavePatch({ resume_url: resumeUrl.trim() || null }); setMessage('Resume link saved.'); }
		catch (saveError) { setError(saveError.message || 'Could not save resume link.'); }
		finally { setSaving(false); }
	};
	const certificates = (student.accomplishments || []).filter((item) => item.document_url);
	return <div className="space-y-5"><section className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6"><div className="mb-4"><h2 className="text-base font-semibold text-white">Centralized document repository</h2><p className="mt-1 text-xs leading-5 text-slate-500">Review submitted files and their current verification status.</p></div><div className="grid gap-4 xl:grid-cols-2"><article className="rounded-lg border border-slate-800 bg-slate-950/45 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-slate-100">Resume</p><p className="mt-1 break-all text-[11px] text-slate-500">{student.resume_filename || student.resume_url || 'No resume linked yet'}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${student.resume_url ? 'border-emerald-300/20 text-emerald-200' : 'border-slate-700 text-slate-500'}`}>{student.resume_url ? 'Uploaded · Pending review' : 'Missing'}</span></div>{student.resume_url && <a className="mt-3 inline-block text-xs text-cyan-300" href={student.resume_url} rel="noreferrer" target="_blank">Open resume ↗</a>}<form className="mt-4 space-y-3 border-t border-slate-800 pt-4" onSubmit={saveResume}><SetupField label="Resume link" name="repository-resume-url" onChange={setResumeUrl} placeholder="https://..." type="url" value={resumeUrl} /><button className="min-h-9 rounded-lg border border-slate-700 px-3 text-xs text-slate-200 hover:border-cyan-300/30 disabled:opacity-50" disabled={saving} type="submit">{saving ? 'Saving…' : student.resume_url ? 'Replace resume link' : 'Add resume link'}</button></form></article><div className="rounded-lg border border-slate-800 bg-slate-950/45 p-4"><CollegeIdCardField name={student.name} onChange={saveCollegeIdCard} value={student.college_id_card_url} verified={student.college_id_verified} /></div></div>{(error || message) && <p className={`mt-4 text-xs ${error ? 'text-rose-200' : 'text-emerald-200'}`} role={error ? 'alert' : 'status'}>{error || message}</p>}<div className="mt-5 border-t border-slate-800 pt-5"><h3 className="text-sm font-semibold text-white">Certificates & supporting files</h3>{certificates.length ? <div className="mt-3 space-y-2">{certificates.map((certificate, index) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/45 p-3" key={`${certificate.title}-${index}`}><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-200">{certificate.title}</p><p className="mt-1 text-[10px] text-slate-500">{certificate.issuer || certificate.category || 'Supporting document'}</p></div><div className="flex items-center gap-3"><span className="rounded-full border border-amber-300/20 px-2 py-1 text-[10px] text-amber-100">Pending review</span><a className="text-xs text-cyan-300" href={certificate.document_url} rel="noreferrer" target="_blank">Open ↗</a></div></div>)}</div> : <p className="mt-2 text-xs text-slate-500">Add a certificate or proof link in Accomplishments to list it here.</p>}</div></section></div>;
}

function SetupField({ label, name, value, onChange, type = 'text', min, max, step, placeholder, required = false }) {
	return (
		<label className="block space-y-2" htmlFor={name}>
			<span className="text-xs font-medium text-slate-300">{label}</span>
			<input className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10" id={name} max={max} min={min} name={name} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} step={step} type={type} value={value} />
		</label>
	);
}

function StudentOnboardingWizard({ email, onComplete }) {
	const [step, setStep] = useState(0);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [customSkill, setCustomSkill] = useState('');
	const [resumeFileName, setResumeFileName] = useState('');
	const [profile, setProfile] = useState({
		name: email?.split('@')[0]?.replace(/[._-]+/g, ' ') || '',
		branch: 'CSE',
		universityRoll: '',
		tenth: '',
		twelfth: '',
		cgpa: '',
		activeBacklogs: '0',
		clearedBacklogs: '0',
		semesters: Array(8).fill(''),
		techStack: ['Python', 'SQL'],
		leetcode: '',
		hackerrank: '',
		github: '',
		portfolio: '',
		resumeUrl: '',
		profilePictureUrl: '',
		collegeIdCardUrl: '',
		documentsConfirmed: false,
	});

	const update = (field, value) => setProfile((current) => ({ ...current, [field]: value }));
	const toggleSkill = (skill) => update(
		'techStack',
		profile.techStack.includes(skill)
			? profile.techStack.filter((item) => item !== skill)
			: [...profile.techStack, skill],
	);
	const addCustomSkill = () => {
		const nextSkill = customSkill.trim();
		if (nextSkill && !profile.techStack.some((skill) => skill.toLowerCase() === nextSkill.toLowerCase())) {
			update('techStack', [...profile.techStack, nextSkill]);
		}
		setCustomSkill('');
	};
	const updateSemester = (index, value) => {
		setProfile((current) => ({
			...current,
			semesters: current.semesters.map((semester, semesterIndex) => semesterIndex === index ? value : semester),
		}));
	};

	const validateStep = () => {
		if (step === 0) {
			if (!profile.name.trim() || !profile.universityRoll.trim() || profile.cgpa === '') {
				return 'Add your name, university roll number, and current CGPA to continue.';
			}
			if (Number(profile.cgpa) < 0 || Number(profile.cgpa) > 10) return 'CGPA must be between 0 and 10.';
			if ([profile.tenth, profile.twelfth].some((value) => value !== '' && (Number(value) < 0 || Number(value) > 100))) {
				return 'Board percentages must be between 0 and 100.';
			}
			if (profile.semesters.some((value) => value !== '' && (Number(value) < 0 || Number(value) > 10))) {
				return 'Semester CGPA values must be between 0 and 10.';
			}
		}
		if (step === 1 && profile.techStack.length === 0) return 'Choose at least one technical skill.';
		if (step === 2 && !profile.documentsConfirmed) return 'Confirm your placement documents are ready to continue.';
		return '';
	};

	const continueStep = () => {
		const validationError = validateStep();
		if (validationError) {
			setError(validationError);
			return;
		}
		setError('');
		setStep((current) => Math.min(2, current + 1));
	};

	const submitProfile = async (event) => {
		event.preventDefault();
		const validationError = validateStep();
		if (validationError) {
			setError(validationError);
			return;
		}
		setSaving(true);
		setError('');
		try {
			const payload = {
				name: profile.name.trim(),
				branch: profile.branch,
				cgpa: Number(profile.cgpa),
				semester_cgpas: profile.semesters.map((value) => value === '' ? null : Number(value)),
				active_backlogs: Number(profile.activeBacklogs || 0),
				cleared_backlogs: Number(profile.clearedBacklogs || 0),
				tenth_percentage: profile.tenth === '' ? null : Number(profile.tenth),
				twelfth_percentage: profile.twelfth === '' ? null : Number(profile.twelfth),
				university_roll_number: profile.universityRoll.trim(),
				verified_tech_stack: profile.techStack,
				leetcode_rating: profile.leetcode === '' ? null : Number(profile.leetcode),
				hackerrank_rating: profile.hackerrank === '' ? null : Number(profile.hackerrank),
				github_url: profile.github.trim() || null,
				portfolio_url: profile.portfolio.trim() || null,
				resume_url: profile.resumeUrl.trim() || null,
				resume_filename: resumeFileName || null,
				documents_confirmed: profile.documentsConfirmed,
				profile_picture_url: profile.profilePictureUrl || null,
				college_id_card_url: profile.collegeIdCardUrl || null,
			};
			const { data } = await api.post('/students/profile', payload);
			onComplete(data);
		} catch (requestError) {
			setError(getApiError(requestError));
		} finally {
			setSaving(false);
		}
	};

	const steps = ['Academic core', 'Technical profile', 'Resume & documents'];

	return (
		<div className="w-full min-w-0 animate-[fadeIn_.25s_ease-out]">
			<div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-400/10 text-cyan-200"><GraduationCap aria-hidden="true" className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.17em] text-cyan-300">Student onboarding</p><h1 className="mt-1 text-xl font-semibold text-white sm:text-2xl">Build your placement profile</h1><p className="mt-1 text-xs text-slate-500">Your account: {email}</p></div></div>
			<div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl shadow-black/25 backdrop-blur-xl">
				<div className="border-b border-slate-800 px-5 py-5 sm:px-7">
					<div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-medium text-slate-400">Step {step + 1} of 3</p><p className="text-xs font-medium text-cyan-200">{steps[step]}</p></div>
					<div aria-label="Onboarding progress" className="grid grid-cols-3 gap-2">{steps.map((label, index) => <div className={`h-1.5 rounded-full transition ${index <= step ? 'bg-gradient-to-r from-indigo-500 to-cyan-400' : 'bg-slate-800'}`} key={label} />)}</div>
				</div>
				<form className="p-5 sm:p-7" onSubmit={submitProfile}>
					{error && <div className="mb-5 flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-200" role="alert"><TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

					{step === 0 && <div className="space-y-6 animate-[fadeIn_.2s_ease-out]">
						<div><h2 className="text-base font-semibold text-white">Academic & institutional details</h2><p className="mt-1 text-xs text-slate-500">These details create your BPUT placement record.</p></div>
						<ProfilePictureEditor name={profile.name || email} onChange={(value) => update('profilePictureUrl', value)} pictureUrl={profile.profilePictureUrl} />
						<div className="grid gap-4 sm:grid-cols-2"><SetupField label="Full name" name="onboard-name" onChange={(value) => update('name', value)} placeholder="Your official name" required value={profile.name} /><label className="block space-y-2" htmlFor="onboard-branch"><span className="text-xs font-medium text-slate-300">Branch</span><select className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3.5 text-sm text-slate-100 outline-none focus:border-cyan-400" id="onboard-branch" onChange={(event) => update('branch', event.target.value)} value={profile.branch}>{BRANCH_OPTIONS.map((branch) => <option className="bg-slate-900" key={branch} value={branch}>{branch}</option>)}</select></label><SetupField label="University roll number" name="onboard-roll" onChange={(value) => update('universityRoll', value)} placeholder="e.g. BPUT-24-CSE-012" required value={profile.universityRoll} /><SetupField label="Current CGPA · 10 point scale" max="10" min="0" name="onboard-cgpa" onChange={(value) => update('cgpa', value)} placeholder="0.00–10.00" required step="0.01" type="number" value={profile.cgpa} /><SetupField label="10th board percentage" max="100" min="0" name="onboard-tenth" onChange={(value) => update('tenth', value)} placeholder="Optional" step="0.01" type="number" value={profile.tenth} /><SetupField label="12th board percentage" max="100" min="0" name="onboard-twelfth" onChange={(value) => update('twelfth', value)} placeholder="Optional" step="0.01" type="number" value={profile.twelfth} /><SetupField label="Active backlogs" min="0" name="onboard-active-backlogs" onChange={(value) => update('activeBacklogs', value)} step="1" type="number" value={profile.activeBacklogs} /><SetupField label="Cleared backlogs" min="0" name="onboard-cleared-backlogs" onChange={(value) => update('clearedBacklogs', value)} step="1" type="number" value={profile.clearedBacklogs} /></div>
						<details className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"><summary className="cursor-pointer text-xs font-medium text-slate-300">Add semester-wise CGPA (optional)</summary><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{profile.semesters.map((value, index) => <SetupField key={index} label={`Semester ${index + 1}`} max="10" min="0" name={`semester-${index + 1}`} onChange={(nextValue) => updateSemester(index, nextValue)} placeholder="—" step="0.01" type="number" value={value} />)}</div></details>
					</div>}

					{step === 1 && <div className="space-y-6 animate-[fadeIn_.2s_ease-out]">
						<div><h2 className="text-base font-semibold text-white">Technical & coding profile</h2><p className="mt-1 text-xs text-slate-500">Select verified skills and add public coding profiles.</p></div>
						<div><p className="mb-3 text-xs font-medium text-slate-300">Primary tech stack <span className="text-cyan-300">({profile.techStack.length} selected)</span></p><div className="flex flex-wrap gap-2">{TECH_OPTIONS.map((skill) => { const selected = profile.techStack.includes(skill); return <button aria-pressed={selected} className={`rounded-full border px-3 py-2 text-xs transition ${selected ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100' : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:border-slate-500'}`} key={skill} onClick={() => toggleSkill(skill)} type="button">{selected ? '✓ ' : '+ '}{skill}</button>; })}</div><div className="mt-3 flex gap-2"><input className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400" onChange={(event) => setCustomSkill(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomSkill(); } }} placeholder="Add another skill" value={customSkill} /><button className="rounded-lg border border-slate-700 px-3 text-xs text-slate-300 hover:border-cyan-400/40 hover:text-cyan-100" onClick={addCustomSkill} type="button">Add skill</button></div></div>
						<div className="grid gap-4 sm:grid-cols-2"><SetupField label="LeetCode rating" max="5000" min="0" name="onboard-leetcode" onChange={(value) => update('leetcode', value)} placeholder="Optional" step="1" type="number" value={profile.leetcode} /><SetupField label="HackerRank rating" max="5000" min="0" name="onboard-hackerrank" onChange={(value) => update('hackerrank', value)} placeholder="Optional" step="1" type="number" value={profile.hackerrank} /><SetupField label="GitHub profile URL" name="onboard-github" onChange={(value) => update('github', value)} placeholder="https://github.com/username" type="url" value={profile.github} /><SetupField label="Portfolio URL" name="onboard-portfolio" onChange={(value) => update('portfolio', value)} placeholder="https://your-portfolio.example" type="url" value={profile.portfolio} /></div>
					</div>}

					{step === 2 && <div className="space-y-6 animate-[fadeIn_.2s_ease-out]">
						<div><h2 className="text-base font-semibold text-white">Resume & document readiness</h2><p className="mt-1 text-xs text-slate-500">File selection is a local preview; use a secure resume URL for placement staff access.</p></div>
						<label className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/45 p-5 transition hover:border-cyan-400/40"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-400/10 text-cyan-200"><FileText aria-hidden="true" className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-200">{resumeFileName || 'Choose resume file'}</span><span className="mt-1 block text-xs text-slate-500">PDF or Word document · upload simulation</span></span><input accept=".pdf,.doc,.docx" className="sr-only" onChange={(event) => setResumeFileName(event.target.files?.[0]?.name || '')} type="file" /></label>
						<SetupField label="Resume URL (optional)" name="onboard-resume-url" onChange={(value) => update('resumeUrl', value)} placeholder="https://..." type="url" value={profile.resumeUrl} />
						<CollegeIdCardField name={profile.name || email} onChange={(value) => update('collegeIdCardUrl', value)} value={profile.collegeIdCardUrl} />
						<div className="space-y-3"><p className="text-xs font-medium text-slate-300">Placement document checklist</p>{['Resume is current and accurate', 'Academic records are available', 'Identity documents are ready'].map((document) => <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3" key={document}><CheckCircle2 aria-hidden="true" className="h-4 w-4 text-cyan-300" /><span className="text-xs text-slate-300">{document}</span><span className="ml-auto text-[10px] uppercase tracking-wide text-slate-600">To verify</span></div>)}</div>
						<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-950/70 p-4"><input checked={profile.documentsConfirmed} className="mt-0.5 h-4 w-4 accent-cyan-400" onChange={(event) => update('documentsConfirmed', event.target.checked)} type="checkbox" /><span><span className="block text-sm font-medium text-slate-200">I confirm these placement documents are ready</span><span className="mt-1 block text-xs leading-5 text-slate-500">This confirms readiness only; documents can be submitted through the placement cell.</span></span></label>
					</div>}

					<div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-800 pt-5"><button className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-slate-400 transition hover:text-white disabled:opacity-30" disabled={step === 0 || saving} onClick={() => { setError(''); setStep((current) => current - 1); }} type="button"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Back</button>{step < 2 ? <button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 text-sm font-semibold text-white transition hover:brightness-110" onClick={continueStep} type="button">Continue <ArrowRight aria-hidden="true" className="h-4 w-4" /></button> : <button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60" disabled={saving} type="submit">{saving ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}{saving ? 'Saving profile...' : 'Save placement profile'}</button>}</div>
				</form>
			</div>
		</div>
	);
}

function CollegeIdCardField({ name, value, verified = false, onChange }) {
	const [urlDraft, setUrlDraft] = useState(value?.startsWith('http') ? value : '');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');
	const [imageFailed, setImageFailed] = useState(false);
	useEffect(() => {
		setImageFailed(false);
		if (!value || value.startsWith('data:')) setUrlDraft('');
		else setUrlDraft(value);
	}, [value]);

	const saveValue = async (nextValue) => {
		setBusy(true);
		setError('');
		setMessage('Saving College ID card...');
		try {
			await onChange(nextValue);
			setMessage('College ID card saved.');
		} catch (saveError) {
			setError(saveError.message || 'Could not save the College ID card.');
			setMessage('');
		} finally {
			setBusy(false);
		}
	};

	const handleFile = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;
		if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) {
			setError('Choose a PNG, JPG, or PDF scan of your BPUT College ID.');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			setError('College ID files must be smaller than 5 MB.');
			return;
		}
		setBusy(true);
		setError('');
		setMessage('Preparing secure preview...');
		try {
			const dataUrl = await new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onerror = () => reject(new Error('Unable to read this College ID file.'));
				reader.onload = () => resolve(reader.result);
				reader.readAsDataURL(file);
			});
			await onChange(dataUrl);
			setMessage('College ID card uploaded; awaiting institutional verification.');
		} catch (saveError) {
			setError(saveError.message || 'Could not upload the College ID card.');
			setMessage('');
		} finally {
			setBusy(false);
		}
	};

	const useUrl = () => {
		const normalized = urlDraft.trim();
		try {
			const parsed = new URL(normalized);
			if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) {
				setError('Use a secure HTTPS link for your College ID card.');
				return;
			}
		} catch {
			setError('Enter a valid secure image or PDF URL.');
			return;
		}
		void saveValue(normalized);
	};

	const isPdf = value?.startsWith('data:application/pdf;') || /\.pdf(?:[?#].*)?$/i.test(value || '');

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
				<div className="flex h-32 w-44 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
					{value && !isPdf && !imageFailed ? <img alt={`${name} College ID card preview`} className="h-full w-full object-contain" onError={() => setImageFailed(true)} src={value} /> : <div className="flex flex-col items-center gap-2 text-center">{isPdf ? <FileText aria-hidden="true" className="h-7 w-7 text-cyan-200" /> : <ImagePlus aria-hidden="true" className="h-7 w-7 text-slate-500" />}<span className="px-2 text-[10px] text-slate-500">{value ? (isPdf ? 'PDF card attached' : 'Preview unavailable') : 'No College ID selected'}</span></div>}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-white">Official College ID Card</p><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] ${verified ? 'border-emerald-300/20 bg-emerald-300/5 text-emerald-200' : value ? 'border-amber-300/20 bg-amber-300/5 text-amber-100' : 'border-slate-700 text-slate-500'}`}>{verified ? <ShieldCheck aria-hidden="true" className="h-3 w-3" /> : null}{verified ? 'Verified ID' : value ? 'ID Uploaded · Pending Verification' : 'ID Not Uploaded'}</span></div>
					<p className="mt-1 text-xs leading-5 text-slate-500">Upload the front of your BPUT ID card. It will be reviewed by the placement cell.</p>
					<div className="mt-3 flex flex-wrap items-center gap-2"><label className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-100 ${busy ? 'pointer-events-none opacity-60' : ''}`}><input accept="image/png,image/jpeg,application/pdf,.jpg,.jpeg,.png,.pdf" className="sr-only" disabled={busy} onChange={handleFile} type="file" />{busy ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus aria-hidden="true" className="h-3.5 w-3.5" />}Choose file</label>{value?.startsWith('http') && <a className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-white" href={value} rel="noreferrer" target="_blank">Open card <ExternalLink aria-hidden="true" className="h-3 w-3" /></a>}</div>
				</div>
			</div>
			<div className="mt-4 flex flex-col gap-2 border-t border-slate-800 pt-4 sm:flex-row"><input className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400" disabled={busy} onChange={(event) => setUrlDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); useUrl(); } }} placeholder="Or enter a secure College ID file URL (https://...)" type="url" value={urlDraft} /><button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 text-xs font-medium text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-100 disabled:opacity-50" disabled={busy || !urlDraft.trim()} onClick={useUrl} type="button">Use secure URL</button></div>
			{error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}{message && <p className="mt-2 text-xs text-cyan-200" role="status">{message}</p>}
		</div>
	);
}
