import { useEffect, useState } from 'react';
import {
	Activity,
	Award,
	BookOpenCheck,
	BriefcaseBusiness,
	Code2,
	ExternalLink,
	FileText,
	GraduationCap,
	LoaderCircle,
	MessageSquareText,
	ShieldCheck,
	ShieldAlert,
	Sparkles,
	X,
} from 'lucide-react';
import api, { getApiError } from '../api/http';
import { ProfileAvatar } from './ProfilePicture';

const TABS = [
	{ id: 'academic', label: 'Academic', icon: GraduationCap },
	{ id: 'technical', label: 'Technical', icon: Code2 },
	{ id: 'soft-skills', label: 'Soft skills', icon: MessageSquareText },
	{ id: 'experience', label: 'Experience', icon: BriefcaseBusiness },
	{ id: 'fit', label: 'AI fit & action', icon: Sparkles },
];

const ACTIONS = ['Not Actioned', 'Shortlisted', 'Interview Scheduled', 'Offer Extended'];

function ProgressMetric({ label, value, max = 100, suffix = '%' }) {
	const normalized = Number(value ?? 0);
	const width = Math.min(100, Math.max(0, normalized / max * 100));
	return (
		<div><div className="mb-1.5 flex items-center justify-between gap-3"><span className="text-xs text-slate-400">{label}</span><span className="text-xs font-medium tabular-nums text-slate-200">{value == null ? 'Not assessed' : `${normalized}${suffix}`}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${width}%` }} /></div></div>
	);
}

function DataTile({ label, value, suffix = '' }) {
	return <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1.5 text-lg font-semibold tabular-nums text-white">{value == null || value === '' ? '—' : `${value}${suffix}`}</p></div>;
}

export default function CandidateModal({ studentId, onClose, canVerify = false }) {
	const [profile, setProfile] = useState(null);
	const [tab, setTab] = useState('academic');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [savingAction, setSavingAction] = useState(null);
	const [verifyingCollegeId, setVerifyingCollegeId] = useState(false);
	const [feedback, setFeedback] = useState('');

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError('');
		api.get(`/students/${studentId}/deep-profile`)
			.then(({ data }) => { if (!cancelled) setProfile(data); })
			.catch((requestError) => { if (!cancelled) setError(getApiError(requestError)); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [studentId]);

	useEffect(() => {
		const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [onClose]);

	const student = profile?.student;

	const updateAction = async (factor, status) => {
		if (!factor.match_record_id) {
			setFeedback('Run matching for this drive before recording a recruiter action.');
			return;
		}
		setSavingAction(factor.match_record_id);
		setFeedback('');
		try {
			const { data } = await api.patch(`/matching/${factor.match_record_id}/recruiter-action`, { status });
			setProfile((current) => ({
				...current,
				active_drive_match_factors: current.active_drive_match_factors.map((item) => item.match_record_id === data.id ? { ...item, recruiter_action_status: data.recruiter_action_status } : item),
			}));
			setFeedback(`Recruiter action saved: ${status}.`);
		} catch (requestError) {
			setFeedback(getApiError(requestError));
		} finally {
			setSavingAction(null);
		}
	};

	const updateCollegeIdVerification = async () => {
		if (!student?.college_id_card_url || !canVerify) return;
		setVerifyingCollegeId(true);
		setFeedback('');
		try {
			const { data } = await api.patch(`/students/${student.id}/college-id-verification`, {
				college_id_verified: !student.college_id_verified,
			});
			setProfile((current) => ({ ...current, student: data }));
			setFeedback(data.college_id_verified ? 'College ID verified.' : 'College ID verification removed.');
		} catch (requestError) {
			setFeedback(getApiError(requestError));
		} finally {
			setVerifyingCollegeId(false);
		}
	};

	const renderAcademic = () => {
		const semesterValues = student.semester_cgpas || [];
		const collegeCard = student.college_id_card_url;
		const collegeIdIsPdf = collegeCard?.startsWith('data:application/pdf;') || /\.pdf(?:[?#].*)?$/i.test(collegeCard || '');
		return <div className="space-y-6"><section><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><BookOpenCheck aria-hidden="true" className="h-4 w-4 text-cyan-300" />Semester performance</h3>{semesterValues.length === 0 ? <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">Semester CGPA details have not been provided.</p> : <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">{Array.from({ length: 8 }, (_, index) => { const score = semesterValues[index]; return <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-center" key={index}><p className="text-[10px] text-slate-500">S{index + 1}</p><p className="mt-1 text-sm font-semibold text-slate-100">{score == null ? '—' : Number(score).toFixed(1)}</p><div className="mx-auto mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, Math.max(0, Number(score || 0) * 10))}%` }} /></div></div>; })}</div>}</section><section><h3 className="mb-3 text-sm font-semibold text-white">Academic standing</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><DataTile label="Overall CGPA" value={Number(student.cgpa).toFixed(2)} suffix=" / 10" /><DataTile label="Branch rank" value={student.branch_rank} /><DataTile label="Branch percentile" value={student.branch_percentile} suffix="%" /><DataTile label="University roll" value={student.university_roll_number} /></div></section><section><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-white">Institutional identity</h3><span className={`rounded-full border px-2.5 py-1 text-[10px] ${student.college_id_verified ? 'border-emerald-300/20 bg-emerald-300/5 text-emerald-200' : collegeCard ? 'border-amber-300/20 bg-amber-300/5 text-amber-100' : 'border-slate-700 text-slate-500'}`}>{student.college_id_verified ? 'Verified ID' : collegeCard ? 'ID Uploaded · Pending Verification' : 'ID Not Uploaded'}</span></div><div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 sm:flex-row sm:items-center">{collegeCard && !collegeIdIsPdf ? <img alt={`${student.name} College ID card`} className="h-28 w-full rounded-md border border-slate-700 bg-slate-900 object-contain sm:w-44" src={collegeCard} /> : <div className="flex h-28 w-full items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-400 sm:w-44">{collegeCard ? <span className="flex flex-col items-center gap-2 text-xs"><FileText aria-hidden="true" className="h-6 w-6 text-cyan-200" />PDF College ID</span> : <span className="text-xs">No card on file</span>}</div>}<div className="min-w-0 flex-1"><p className="text-xs leading-5 text-slate-400">{collegeCard ? 'College ID card attached to this student profile.' : 'The student has not uploaded a College ID card.'}</p>{collegeCard && <a className="mt-2 inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-white" href={collegeCard} rel="noreferrer" target="_blank">Open ID card <ExternalLink aria-hidden="true" className="h-3 w-3" /></a>}{canVerify && collegeCard && <button className="mt-3 flex min-h-9 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-3 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/10 disabled:opacity-60" disabled={verifyingCollegeId} onClick={updateCollegeIdVerification} type="button">{verifyingCollegeId ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />}{student.college_id_verified ? 'Remove verification' : 'Verify College ID'}</button>}</div></div></section><section><h3 className="mb-3 text-sm font-semibold text-white">Board scores & backlogs</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><DataTile label="10th board" value={student.tenth_percentage} suffix="%" /><DataTile label="12th board" value={student.twelfth_percentage} suffix="%" /><DataTile label="Active backlogs" value={student.active_backlogs} /><DataTile label="Cleared backlogs" value={student.cleared_backlogs} /></div></section></div>;
	};

	const renderTechnical = () => <div className="space-y-6"><div className="grid gap-3 sm:grid-cols-2"><a className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 p-4 transition hover:border-cyan-400/30" href={student.github_url || undefined} rel="noreferrer" target="_blank"><span className="flex items-center gap-3"><Code2 aria-hidden="true" className="h-5 w-5 text-slate-300" /><span><span className="block text-xs text-slate-500">GitHub profile</span><span className="mt-1 block max-w-56 truncate text-sm text-slate-200">{student.github_url || 'Not provided'}</span></span></span>{student.github_url && <ExternalLink aria-hidden="true" className="h-4 w-4 text-cyan-300" />}</a><a className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 p-4 transition hover:border-cyan-400/30" href={student.portfolio_url || undefined} rel="noreferrer" target="_blank"><span className="flex items-center gap-3"><ExternalLink aria-hidden="true" className="h-5 w-5 text-slate-300" /><span><span className="block text-xs text-slate-500">Portfolio</span><span className="mt-1 block max-w-56 truncate text-sm text-slate-200">{student.portfolio_url || 'Not provided'}</span></span></span>{student.portfolio_url && <ExternalLink aria-hidden="true" className="h-4 w-4 text-cyan-300" />}</a></div><section><h3 className="mb-3 text-sm font-semibold text-white">Coding & design assessment</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><DataTile label="LeetCode rating" value={student.leetcode_rating} /><DataTile label="HackerRank rating" value={student.hackerrank_rating} /><DataTile label="Coding score" value={student.coding_score} suffix=" / 100" /><DataTile label="System design" value={student.system_design_score} suffix=" / 100" /></div></section><section><h3 className="mb-3 text-sm font-semibold text-white">Verified tech stack</h3>{student.verified_tech_stack?.length ? <div className="flex flex-wrap gap-2">{student.verified_tech_stack.map((skill) => <span className="rounded-md border border-cyan-300/15 bg-cyan-300/5 px-2.5 py-1.5 text-xs text-cyan-100" key={skill}>{skill}</span>)}</div> : <p className="text-sm text-slate-500">No verified skills have been added.</p>}</section></div>;

	const renderSoftSkills = () => <div className="space-y-6"><section><h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white"><MessageSquareText aria-hidden="true" className="h-4 w-4 text-cyan-300" />Communication & aptitude</h3><div className="space-y-4"><ProgressMetric label="AI speech clarity" value={student.ai_speech_score} /><ProgressMetric label="Mock interview" value={student.mock_interview_score} /><ProgressMetric label="Aptitude & logical reasoning" value={student.aptitude_score} /></div></section><section className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Leadership & participation</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{student.leadership_notes || 'No leadership or club participation notes provided.'}</p></section></div>;

	const renderExperience = () => <div className="space-y-7"><section><h3 className="mb-3 text-sm font-semibold text-white">Internship experience</h3>{student.internship_experiences?.length ? <div className="space-y-3">{student.internship_experiences.map((internship, index) => <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-4" key={`${internship.company}-${index}`}><div className="flex flex-col justify-between gap-2 sm:flex-row"><div><h4 className="text-sm font-semibold text-white">{internship.company}</h4><p className="mt-1 text-xs text-cyan-200">{internship.role} · {internship.duration_months} months</p></div><p className="text-xs text-slate-400">Mentor rating: {internship.mentor_rating ?? '—'}</p></div>{internship.description && <p className="mt-3 text-sm leading-5 text-slate-400">{internship.description}</p>}</article>)}</div> : <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">No internship experience listed.</p>}</section><section><h3 className="mb-3 text-sm font-semibold text-white">Project showcase</h3>{student.project_showcase?.length ? <div className="grid gap-3 md:grid-cols-2">{student.project_showcase.map((project, index) => <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-4" key={`${project.title}-${index}`}><h4 className="text-sm font-semibold text-white">{project.title}</h4><p className="mt-2 text-xs leading-5 text-slate-400">{project.description || 'Project details are available in the portfolio links.'}</p>{project.tech_stack?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{project.tech_stack.map((tech) => <span className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400" key={tech}>{tech}</span>)}</div>}<div className="mt-4 flex gap-4">{project.preview_url && <a className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-200 hover:text-white" href={project.preview_url} rel="noreferrer" target="_blank">Live preview <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /></a>}{project.repository_url && <a className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white" href={project.repository_url} rel="noreferrer" target="_blank">Source <Code2 aria-hidden="true" className="h-3.5 w-3.5" /></a>}</div></article>)}</div> : <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">No projects have been added to the showcase.</p>}</section><DataTile label="Overall mentor rating" value={student.mentor_rating} suffix=" / 100" /></div>;

	const renderFit = () => <div className="space-y-4">{profile.active_drive_match_factors?.length ? profile.active_drive_match_factors.map((factor) => <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-4" key={`${factor.drive_id}-${factor.jd_id}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">{factor.company_name} · {factor.role_title}</p><h3 className="mt-1 text-xl font-semibold tabular-nums text-white">{Number(factor.fit_score).toFixed(1)}% fit</h3><p className={`mt-1 text-xs ${factor.cgpa_eligible ? 'text-emerald-300' : 'text-rose-300'}`}>{factor.cgpa_eligible ? 'CGPA cutoff met' : `Below minimum CGPA ${factor.min_cgpa}`}</p></div><label className="grid gap-1 text-[10px] uppercase tracking-wider text-slate-500">Recruiter action<select className="min-h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs normal-case tracking-normal text-slate-200 focus:border-cyan-400" disabled={savingAction === factor.match_record_id} onChange={(event) => updateAction(factor, event.target.value)} value={factor.recruiter_action_status || 'Not Actioned'}>{ACTIONS.map((action) => <option className="bg-slate-900" key={action} value={action}>{action}</option>)}</select></label></div><div className="mt-4 rounded-lg border border-indigo-300/10 bg-indigo-300/[0.035] p-3"><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-200"><Sparkles aria-hidden="true" className="h-3.5 w-3.5" />Explainable match</p><p className="mt-2 text-sm leading-5 text-slate-300">{factor.reason}</p></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-[10px] uppercase tracking-wider text-slate-600">Matched skills</p><p className="mt-1 text-xs text-emerald-200">{factor.matched_skills?.join(', ') || 'No required skills matched'}</p></div><div><p className="text-[10px] uppercase tracking-wider text-slate-600">Skill gaps</p><p className="mt-1 text-xs text-amber-200">{factor.missing_skills?.join(', ') || 'No skill gaps'}</p></div></div>{!factor.match_record_id && <p className="mt-3 text-[11px] text-slate-500">Run drive matching from the command dashboard to persist this candidate match before recording recruiter actions.</p>}</article>) : <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center"><Activity aria-hidden="true" className="mx-auto h-5 w-5 text-slate-600" /><p className="mt-3 text-sm text-slate-300">No active recruiter matches</p><p className="mt-1 text-xs text-slate-500">No active drives have a linked recruiter job description.</p></div>}{feedback && <p className="rounded-md border border-cyan-300/15 bg-cyan-300/5 px-3 py-2 text-xs text-cyan-100" role="status">{feedback}</p>}</div>;

	const tabContent = {
		academic: renderAcademic,
		technical: renderTechnical,
		'soft-skills': renderSoftSkills,
		experience: renderExperience,
		fit: renderFit,
	};

	return (
		<div aria-label="Candidate deep-dive" className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="candidate-modal-title">
			<button aria-label="Close candidate profile" className="absolute inset-0 cursor-default bg-slate-950/75 backdrop-blur-sm" onClick={onClose} type="button" />
			<section className="relative flex h-full w-full max-w-3xl flex-col border-l border-slate-700 bg-slate-950 shadow-2xl shadow-black/60">
				<header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-5 sm:px-7"><div className="flex min-w-0 items-center gap-3"><ProfileAvatar name={student?.name || 'Candidate'} pictureUrl={student?.profile_picture_url} size="lg" /><div className="min-w-0"><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300"><ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" />Recruiter deep dive</p><h2 className="mt-2 truncate text-xl font-semibold text-white" id="candidate-modal-title">{student?.name || 'Candidate profile'}</h2><p className="mt-1 truncate text-xs text-slate-500">{student ? `${student.email} · ${student.branch} · Roll ${student.university_roll_number || '—'}` : `Candidate #${studentId}`}</p></div></div><button aria-label="Close" className="rounded-lg border border-slate-800 p-2 text-slate-400 transition hover:border-slate-600 hover:text-white" onClick={onClose} type="button"><X aria-hidden="true" className="h-4 w-4" /></button></header>
				{student && <div className="grid grid-cols-3 gap-2 border-b border-slate-800 px-5 py-4 sm:px-7"><div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"><p className="text-[9px] uppercase tracking-wider text-slate-500">Readiness</p><p className="mt-1 text-sm font-semibold text-cyan-100">{Number(student.readiness_score).toFixed(1)} · {student.readiness_status}</p></div><div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"><p className="text-[9px] uppercase tracking-wider text-slate-500">CGPA</p><p className="mt-1 text-sm font-semibold text-white">{Number(student.cgpa).toFixed(2)} / 10</p></div><div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"><p className="text-[9px] uppercase tracking-wider text-slate-500">Mock interview</p><p className="mt-1 text-sm font-semibold text-white">{student.mock_interview_score} / 100</p></div></div>}
				<nav aria-label="Candidate profile sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-800 px-4 py-2 sm:px-6" role="tablist">{TABS.map(({ id, label, icon: Icon }) => <button aria-controls={`panel-${id}`} aria-selected={tab === id} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium transition ${tab === id ? 'bg-indigo-400/10 text-cyan-100' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-200'}`} id={`tab-${id}`} key={id} onClick={() => setTab(id)} role="tab" type="button"><Icon aria-hidden="true" className="h-3.5 w-3.5" />{label}</button>)}</nav>
				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
					{loading && <div className="flex min-h-52 items-center justify-center text-sm text-slate-400"><LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin text-cyan-300" />Loading candidate profile...</div>}
					{error && <div className="rounded-lg border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200" role="alert">{error}</div>}
					{student && <div aria-labelledby={`tab-${tab}`} id={`panel-${tab}`} role="tabpanel">{tabContent[tab]()}</div>}
				</div>
				<footer className="flex items-center justify-between border-t border-slate-800 px-5 py-3 text-[10px] text-slate-600 sm:px-7"><span className="flex items-center gap-1.5"><Award aria-hidden="true" className="h-3.5 w-3.5" />CampusLink candidate assessment</span><span>Profile ID {studentId}</span></footer>
			</section>
		</div>
	);
}