import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { Award, BriefcaseBusiness, Crown, Flame, Medal, RefreshCw, Send, ShieldCheck, Sparkles, Trophy, Users } from 'lucide-react';

import {

    fetchLeaderboard,

    fetchTalentPool,

    sendDirectInvite,

    type StudentRankItem,

} from '../api/communityApi';

import api, { getApiError } from '../api/http';



const DOMAINS = ['All Domains', 'DSA Masters', 'React / Frontend', 'Aptitude'];

const PODIUM_STYLES = [

    'border-amber-300/35 bg-gradient-to-b from-amber-300/10 to-slate-900',

    'border-slate-300/25 bg-gradient-to-b from-slate-300/10 to-slate-900',

    'border-orange-400/25 bg-gradient-to-b from-orange-400/10 to-slate-900',

];

const MEDALS = [Crown, Medal, Award];



type StudentSummary = {

    id: number;

    name: string;

    readiness_score: number;

};



type AuthenticatedSession = {

    email: string;

    role: 'student' | 'recruiter' | 'admin';

};



export default function CommunityLeaderboard() {

    const [session, setSession] = useState<AuthenticatedSession | null>(null);

    const [domain, setDomain] = useState(DOMAINS[0]);

    const [timeframe, setTimeframe] = useState<'weekly' | 'all_time'>('all_time');

    const [recruiterMode, setRecruiterMode] = useState(false);

    const [ranks, setRanks] = useState<StudentRankItem[]>([]);

    const [student, setStudent] = useState<StudentSummary | null>(null);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState('');

    const [notice, setNotice] = useState('');

    const [inviteTarget, setInviteTarget] = useState<StudentRankItem | null>(null);

    const [opportunity, setOpportunity] = useState('');

    const [message, setMessage] = useState('');

    const [sendingInvite, setSendingInvite] = useState(false);

    const canScout = session?.role === 'recruiter' || session?.role === 'admin';

    const showRecruiterView = canScout && recruiterMode;



    useEffect(() => {

        let cancelled = false;

        api.get<AuthenticatedSession>('/auth/me')

            .then(({ data }) => {

                if (!cancelled) setSession(data);

            })

            .catch((requestError) => {

                if (!cancelled) {

                    setSession(null);

                    setError(getApiError(requestError));

                }

            });

        return () => { cancelled = true; };

    }, []);



    useEffect(() => {

        setRecruiterMode(canScout);

    }, [canScout]);



    const loadRanks = useCallback(async () => {

        setLoading(true);

        setError('');

        try {

            if (showRecruiterView) {

                const candidates = await fetchTalentPool({

                    domain: domain === DOMAINS[0] ? undefined : domain,

                    hire_ready_only: false,

                    limit: 50,

                });

                setRanks(candidates);

            } else {

                const leaderboard = await fetchLeaderboard({

                    domain: domain === DOMAINS[0] ? 'All' : domain,

                    timeframe,

                    limit: 50,

                });

                setRanks(leaderboard);

            }

        } catch (requestError) {

            setError(getApiError(requestError));

            setRanks([]);

        } finally {

            setLoading(false);

        }

    }, [domain, showRecruiterView, timeframe]);



    useEffect(() => {

        void loadRanks();

    }, [loadRanks]);



    useEffect(() => {

        if (session?.role !== 'student') return undefined;

        let cancelled = false;

        api.get<StudentSummary>('/students/me')

            .then(({ data }) => { if (!cancelled) setStudent(data); })

            .catch((requestError) => { if (!cancelled) setError(getApiError(requestError)); });

        return () => { cancelled = true; };

    }, [session?.role]);



    const currentStudentRank = useMemo(

        () => ranks.find((item) => item.student_id === String(student?.id)),

        [ranks, student?.id],

    );

    const podium = ranks.filter((item) => item.rank <= 3).sort((left, right) => left.rank - right.rank);

    const openInvite = (candidate: StudentRankItem) => {

        if (!canScout || !showRecruiterView) return;

        setInviteTarget(candidate);

        setOpportunity(candidate.target_role);

        setMessage(`Hi ${candidate.name}, your verified skills and community ranking caught our attention. Would you be available for a conversation about this opportunity?`);

        setNotice('');

    };

    const submitInvite = async (event: FormEvent<HTMLFormElement>) => {

        event.preventDefault();

        if (!session || !canScout || !showRecruiterView || !inviteTarget || !opportunity.trim() || !message.trim()) return;

        setSendingInvite(true);

        setError('');

        try {

            const result = await sendDirectInvite({

                recruiter_id: session.email,

                student_id: inviteTarget.student_id,

                opportunity_title: opportunity.trim(),

                message: message.trim(),

            });

            setInviteTarget(null);

            setNotice(result.message);

        } catch (requestError) {

            setError(getApiError(requestError));

        } finally {

            setSendingInvite(false);

        }

    };



    return (

        <div className="w-full min-w-0 space-y-6">

            <section className="overflow-hidden rounded-2xl border border-indigo-300/20 bg-gradient-to-br from-indigo-500/15 via-slate-900 to-cyan-500/10 p-6 sm:p-8">

                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">

                    <div>

                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><ShieldCheck className="h-4 w-4" /> Verified AI Proctoring</p>

                        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Direct Merit League</h1>

                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">A student-first community where consistent practice, verified assessments, and demonstrated skills make talent visible.</p>

                    </div>

                    <div className="flex flex-wrap items-center gap-3">

                        {canScout && <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 text-xs text-slate-200">

                            <span>Recruiter mode</span>

                            <input checked={recruiterMode} className="h-4 w-4 accent-cyan-400" onChange={(event) => setRecruiterMode(event.target.checked)} type="checkbox" />

                        </label>}

                        <button aria-label="Refresh leaderboard" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60 text-slate-300 hover:border-cyan-300/30 hover:text-white" onClick={() => void loadRanks()} type="button"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>

                    </div>

                </div>

                {showRecruiterView && <p className="mt-5 flex items-center gap-2 rounded-lg border border-cyan-300/15 bg-cyan-300/5 px-3 py-2.5 text-xs text-cyan-100"><BriefcaseBusiness className="h-4 w-4 shrink-0" />Recruiter scouting view is active. Direct invitations are available for verified student accounts.</p>}

            </section>



            {error && <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}

            {notice && <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-100" role="status">{notice}</p>}



            {session?.role === 'student' && <section className="grid gap-3 sm:grid-cols-3">

                <article className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="flex items-center gap-2 text-xs text-slate-400"><Trophy className="h-4 w-4 text-amber-300" />Your league rank</p><p className="mt-3 text-3xl font-bold text-white">{currentStudentRank ? `#${currentStudentRank.rank}` : '--'}</p><p className="mt-1 text-[11px] text-slate-500">{student ? `${student.name} · Score ${currentStudentRank?.global_score ?? Math.round(student.readiness_score)}` : 'Sign in as a student to see your rank.'}</p></article>

                <article className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="flex items-center gap-2 text-xs text-slate-400"><Flame className="h-4 w-4 text-orange-300" />Practice streak</p><p className="mt-3 text-3xl font-bold text-white">{currentStudentRank?.streak_days ?? 0}<span className="ml-1 text-sm font-normal text-slate-500">days</span></p><p className="mt-1 text-[11px] text-slate-500">Keep showing up to climb the league.</p></article>

                <article className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="flex items-center gap-2 text-xs text-slate-400"><Award className="h-4 w-4 text-cyan-300" />Your badges</p><div className="mt-3 flex flex-wrap gap-1.5">{currentStudentRank?.badges.length ? currentStudentRank.badges.map((badge) => <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2.5 py-1 text-[10px] text-cyan-100" key={badge}>{badge}</span>) : <span className="text-sm text-slate-500">Complete practice to earn badges.</span>}</div></article>

            </section>}



            <section className="space-y-4">

                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">

                    <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Open leaderboard</p><h2 className="mt-1 text-xl font-semibold text-white">{showRecruiterView ? 'Scout verified talent' : 'Community rankings'}</h2></div>

                    {!showRecruiterView && <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1" role="group" aria-label="Leaderboard timeframe">

                        {(['weekly', 'all_time'] as const).map((value) => <button aria-pressed={timeframe === value} className={`rounded-md px-3 py-1.5 text-xs ${timeframe === value ? 'bg-indigo-400/15 text-cyan-100' : 'text-slate-400 hover:text-white'}`} key={value} onClick={() => setTimeframe(value)} type="button">{value === 'weekly' ? 'This week' : 'All time'}</button>)}

                    </div>}

                </div>

                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by domain">

                    {DOMAINS.map((item) => <button aria-selected={domain === item} className={`rounded-full border px-4 py-2 text-xs font-medium transition ${domain === item ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100' : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`} key={item} onClick={() => setDomain(item)} role="tab" type="button">{item}</button>)}

                </div>



                {!loading && podium.length > 0 && <div className="grid gap-3 md:grid-cols-3">

                    {podium.map((candidate) => {

                        const MedalIcon = MEDALS[candidate.rank - 1] || Award;

                        return <article className={`rounded-xl border p-5 ${PODIUM_STYLES[candidate.rank - 1]}`} key={candidate.student_id}>

                            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-semibold text-slate-200"><MedalIcon className={`h-5 w-5 ${candidate.rank === 1 ? 'text-amber-300' : candidate.rank === 2 ? 'text-slate-300' : 'text-orange-300'}`} />Rank #{candidate.rank}</span><Sparkles className="h-4 w-4 text-cyan-300" /></div>

                            <div className="mt-4 flex items-center gap-3">{candidate.avatar_url ? <img alt="" className="h-11 w-11 rounded-full object-cover" src={candidate.avatar_url} /> : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-cyan-100">{candidate.name.slice(0, 1)}</div>}<div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{candidate.name}</p><p className="truncate text-[11px] text-slate-400">{candidate.college_name}{candidate.student_id.startsWith('demo-') && ' · Sample profile'}</p></div></div>

                            <div className="mt-4 flex items-end justify-between"><p className="text-xs text-slate-400">{candidate.target_role}</p><p className="text-xl font-bold tabular-nums text-white">{candidate.global_score}<span className="ml-1 text-[10px] font-normal text-slate-500">score</span></p></div>

                        </article>;

                    })}

                </div>}



                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">

                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[760px] text-left text-xs">

                            <thead className="border-b border-slate-800 bg-slate-950/60 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">College</th><th className="px-4 py-3">Solved</th><th className="px-4 py-3">Trust score</th><th className="px-4 py-3">Badges</th>{showRecruiterView && <th className="px-4 py-3">Recruiter action</th>}</tr></thead>

                            <tbody className="divide-y divide-slate-800/80">

                                {ranks.map((candidate) => <tr className="transition hover:bg-slate-800/30" key={candidate.student_id}>

                                    <td className="px-4 py-3 font-semibold tabular-nums text-cyan-100">#{candidate.rank}<span className="ml-2 text-slate-500">· {candidate.global_score}</span></td>

                                    <td className="px-4 py-3"><div className="flex items-center gap-2.5">{candidate.avatar_url ? <img alt="" className="h-8 w-8 rounded-full object-cover" src={candidate.avatar_url} /> : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-cyan-100">{candidate.name.slice(0, 1)}</div>}<span><span className="block font-medium text-slate-100">{candidate.name}</span><span className="mt-0.5 block text-[10px] text-slate-500">{candidate.target_role}{candidate.student_id.startsWith('demo-') && ' · Sample profile'}</span></span></div></td>

                                    <td className="px-4 py-3 text-slate-300">{candidate.college_name}</td>

                                    <td className="px-4 py-3 tabular-nums text-slate-300">{candidate.problems_solved}<span className="ml-1 text-slate-500">problems</span></td>

                                    <td className="px-4 py-3"><span className={`font-semibold tabular-nums ${candidate.proctoring_avg_trust >= 90 ? 'text-emerald-300' : 'text-amber-200'}`}>{candidate.proctoring_avg_trust}%</span></td>

                                    <td className="px-4 py-3"><div className="flex max-w-56 flex-wrap gap-1">{candidate.badges.length ? candidate.badges.map((badge) => <span className="rounded-full border border-slate-700 bg-slate-950/50 px-2 py-1 text-[9px] text-slate-300" key={badge}>{badge}</span>) : <span className="text-[10px] text-slate-600">No badges yet</span>}</div></td>

                                    {showRecruiterView && <td className="px-4 py-3"><button className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-3 text-[10px] font-medium text-cyan-100 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-40" disabled={!canScout || candidate.student_id.startsWith('demo-')} onClick={() => openInvite(candidate)} type="button"><Send className="h-3.5 w-3.5" />Direct Shortlist / Connect</button></td>}

                                </tr>)}

                                {!loading && ranks.length === 0 && <tr><td className="px-4 py-12 text-center text-sm text-slate-500" colSpan={showRecruiterView ? 7 : 6}>No candidates match this domain yet.</td></tr>}

                                {loading && <tr><td className="px-4 py-12 text-center text-sm text-slate-500" colSpan={showRecruiterView ? 7 : 6}>Loading community rankings…</td></tr>}

                            </tbody>

                        </table>

                    </div>

                </div>

                <p className="text-[10px] leading-5 text-slate-500"><Users className="mr-1 inline h-3.5 w-3.5" />Demo profiles are clearly non-contactable; recruiter invitations can only be sent to real student accounts. Proctoring trust is shown as a transparent metric, not an endorsement.</p>

            </section>



            {canScout && showRecruiterView && inviteTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={() => setInviteTarget(null)} role="presentation">

                <form aria-labelledby="invite-title" aria-modal="true" className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()} onSubmit={submitInvite} role="dialog">

                    <div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Direct recruiter connect</p><h2 className="mt-1 text-lg font-semibold text-white" id="invite-title">Invite {inviteTarget.name}</h2></div>

                    <label className="block space-y-1.5 text-xs text-slate-300">Opportunity title<input className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white" maxLength={160} onChange={(event) => setOpportunity(event.target.value)} required value={opportunity} /></label>

                    <label className="block space-y-1.5 text-xs text-slate-300">Message<textarea className="min-h-28 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white" maxLength={2000} onChange={(event) => setMessage(event.target.value)} required value={message} /></label>

                    <div className="flex justify-end gap-2"><button className="min-h-10 rounded-lg border border-slate-700 px-4 text-xs text-slate-300 hover:text-white" onClick={() => setInviteTarget(null)} type="button">Cancel</button><button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 text-xs font-semibold text-white disabled:opacity-60" disabled={sendingInvite} type="submit">{sendingInvite ? 'Sending…' : 'Send interview invite'}</button></div>

                </form>

            </div>}

        </div>

    );

}
