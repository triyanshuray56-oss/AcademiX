import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, BadgeCheck, BookOpen, CheckCircle2, Clock3, LoaderCircle, RefreshCw, Star, TriangleAlert } from 'lucide-react';
import api, { getApiError } from '../api/http';

const FILTERS = ['All', 'Coursera', 'edX', 'Internshala', 'Enrolled', 'Completed'];
const COURSE_PROGRESS_KEY = `campuslink_course_progress:${(localStorage.getItem('email') || 'anonymous').toLowerCase()}`;
const PROVIDER_STYLES = {
	Coursera: 'border-blue-300/20 bg-blue-300/10 text-blue-200',
	edX: 'border-rose-300/20 bg-rose-300/10 text-rose-200',
	Internshala: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200',
};

function readProgress() {
	try {
		const saved = JSON.parse(localStorage.getItem(COURSE_PROGRESS_KEY) || '{}');
		return Object.fromEntries(Object.entries(saved).filter(([, status]) => status === 'enrolled' || status === 'completed'));
	} catch {
		return {};
	}
}

function CertificateDownload({ course }) {
	const downloadCertificate = () => {
		const text = `Certificate of Completion\n\nThis certificate recognizes completion of:\n${course.title}\nProvider: ${course.provider}\n\nCompleted via CampusLink course tracking.`;
		const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = `${course.id}-certificate.txt`;
		link.click();
		URL.revokeObjectURL(url);
	};
	return <button className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-300/20 px-3 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-300/10" onClick={downloadCertificate} type="button"><ArrowDownToLine aria-hidden="true" className="h-3.5 w-3.5" />Download certificate</button>;
}

export default function StudentCourses() {
	const [courses, setCourses] = useState([]);
	const [filter, setFilter] = useState('All');
	const [progress, setProgress] = useState(readProgress);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const loadCourses = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const { data } = await api.get('/v1/courses');
			if (!Array.isArray(data)) throw new Error('The course catalog returned an unexpected response.');
			setCourses(data);
		} catch (requestError) {
			setError(requestError.message && !requestError.response ? requestError.message : getApiError(requestError));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { void loadCourses(); }, [loadCourses]);
	const visibleCourses = useMemo(() => {
		if (filter === 'Enrolled') return courses.filter((course) => progress[course.id] === 'enrolled');
		if (filter === 'Completed') return courses.filter((course) => progress[course.id] === 'completed');
		return filter === 'All' ? courses : courses.filter((course) => course.provider === filter);
	}, [courses, filter, progress]);
	const updateProgress = (courseId, status) => {
		const updated = { ...progress, [courseId]: status };
		try {
			localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify(updated));
			setProgress(updated);
		} catch {
			setError('Could not save course progress in this browser. Check that local storage is available, then try again.');
		}
	};

	return (
		<div className="mx-auto max-w-7xl">
			<header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
				<div>
					<p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><BookOpen aria-hidden="true" className="h-3.5 w-3.5" />Student learning</p>
					<h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Courses</h1>
					<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Explore curated courses from established learning platforms and build skills that support your next career step.</p>
				</div>
				{!loading && !error && <p className="text-xs text-slate-500">{visibleCourses.length} {visibleCourses.length === 1 ? 'course' : 'courses'}{filter === 'Enrolled' || filter === 'Completed' ? ` ${filter.toLowerCase()}` : filter !== 'All' ? ` from ${filter}` : ' in catalog'}</p>}
			</header>

			<div aria-label="Filter courses" className="mb-6 flex flex-wrap gap-2" role="group">
				{FILTERS.map((item) => <button aria-pressed={filter === item} className={`min-h-9 rounded-lg border px-4 text-xs font-medium transition ${filter === item ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100' : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'}`} key={item} onClick={() => setFilter(item)} type="button">{item}{item === 'Enrolled' ? ` (${Object.values(progress).filter((status) => status === 'enrolled').length})` : item === 'Completed' ? ` (${Object.values(progress).filter((status) => status === 'completed').length})` : ''}</button>)}
			</div>

			{loading ? <div aria-live="polite" className="flex min-h-64 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-sm text-slate-400" role="status"><LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin text-cyan-300" />Loading courses...</div>
				: error ? <section className="rounded-xl border border-rose-300/20 bg-rose-300/[0.04] p-6 text-center"><TriangleAlert aria-hidden="true" className="mx-auto h-5 w-5 text-rose-200" /><h2 className="mt-3 text-sm font-semibold text-rose-100">Could not load courses</h2><p className="mt-2 text-xs text-slate-400">{error}</p><button className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100" onClick={() => void loadCourses()} type="button"><RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />Try again</button></section>
					: visibleCourses.length === 0 ? <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-5 py-12 text-center"><BookOpen aria-hidden="true" className="mx-auto h-6 w-6 text-slate-500" /><h2 className="mt-3 text-sm font-semibold text-slate-200">{filter === 'Enrolled' ? "You haven't enrolled in any courses yet" : filter === 'Completed' ? 'No completed courses yet' : 'No courses found'}</h2><p className="mt-2 text-xs text-slate-500">{filter === 'Enrolled' ? 'Explore the catalog to get started. When you enroll, your course will appear here.' : filter === 'Completed' ? 'Finish a course you have enrolled in and mark it complete to unlock your certificate.' : 'There are no courses available for this provider right now.'}</p>{(filter === 'Enrolled' || filter === 'Completed') && <button className="mt-4 rounded-lg bg-indigo-400/15 px-4 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-400/25" onClick={() => setFilter('All')} type="button">Explore all courses</button>}</section>
						: <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleCourses.map((course) => <article className="flex min-h-[286px] flex-col rounded-xl border border-slate-800 bg-slate-900/80 p-5 transition hover:border-indigo-300/25 hover:bg-slate-900" key={course.id}>
							<div className="flex items-start justify-between gap-3"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${PROVIDER_STYLES[course.provider] || 'border-slate-700 bg-slate-800 text-slate-300'}`}>{course.provider}</span><span className="rounded-full bg-slate-800/80 px-2.5 py-1 text-[10px] text-slate-400">{course.category}</span></div>
							{progress[course.id] && <span className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${progress[course.id] === 'completed' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-indigo-300/20 bg-indigo-300/10 text-indigo-200'}`}>{progress[course.id] === 'completed' ? <><CheckCircle2 aria-hidden="true" className="h-3 w-3" />Completed · certificate unlocked</> : 'Enrolled'}</span>}
							<h2 className="mt-4 text-base font-semibold leading-6 text-white">{course.title}</h2>
							<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400"><span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" />{course.duration}</span><span className="inline-flex items-center gap-1.5"><Star aria-hidden="true" className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />{Number(course.rating).toFixed(1)}</span></div>
							<div className="mt-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Skills covered</p><div className="mt-2 flex flex-wrap gap-1.5">{(course.skills || []).map((skill) => <span className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1 text-[10px] text-slate-300" key={skill}>{skill}</span>)}</div></div>
							<div className="mt-auto border-t border-slate-800 pt-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className={`inline-flex items-center gap-1.5 text-[10px] ${course.certificate_offered ? 'text-emerald-200' : 'text-slate-500'}`}>{course.certificate_offered && <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />}{course.certificate_offered ? 'Provider certificate offered' : 'No provider certificate listed'}</span><a className="inline-flex items-center gap-1 text-[10px] font-medium text-cyan-300 hover:text-cyan-100" href={course.enroll_url} rel="noopener noreferrer" target="_blank">{progress[course.id] === 'completed' ? 'View provider course' : progress[course.id] === 'enrolled' ? 'Continue at provider' : 'Explore provider'}<ArrowUpRight aria-hidden="true" className="h-3 w-3" /></a></div><div className="flex flex-wrap gap-2">{!progress[course.id] && <button className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-indigo-400/15 px-3 text-[11px] font-semibold text-indigo-100 transition hover:bg-indigo-400/25" onClick={() => updateProgress(course.id, 'enrolled')} type="button">Enroll now</button>}{progress[course.id] === 'enrolled' && <button className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-300/10 px-3 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-300/20" onClick={() => updateProgress(course.id, 'completed')} type="button">Mark as completed</button>}{progress[course.id] === 'completed' && <CertificateDownload course={course} />}</div></div>
						</article>)}</div>}
		</div>
	);
}
