import api from './http';

export type StudentRankItem = {
	student_id: string;
	name: string;
	college_name: string;
	avatar_url: string | null;
	target_role: string;
	global_score: number;
	rank: number;
	streak_days: number;
	problems_solved: number;
	badges: string[];
	proctoring_avg_trust: number;
};

export type RecruiterTalentItem = {
	student_id: string;
	name: string;
	branch: string;
	target_role: string;
	talent_score: number;
	global_rank: number;
	technical_score: number | null;
	skills: string[];
	badges: string[];
	project_count: number;
	summary: string;
	previous_readiness: number | null;
	current_readiness: number | null;
	readiness_change: number | null;
	previous_snapshot_date: string | null;
	current_snapshot_date: string | null;
};

export type LeaderboardFilters = {
	domain?: string;
	timeframe?: 'weekly' | 'all_time';
	limit?: number;
};

export type TalentPoolFilters = {
	domain?: string;
	min_score?: number;
	hire_ready_only?: boolean;
	limit?: number;
};

export type DirectInvitePayload = {
	recruiter_id: string;
	student_id: string;
	opportunity_title: string;
	message: string;
};

export async function fetchLeaderboard(filters: LeaderboardFilters = {}): Promise<StudentRankItem[]> {
	const { data } = await api.get<StudentRankItem[]>('/v1/community/leaderboard', { params: filters });
	return data;
}

export async function fetchTalentPool(filters: TalentPoolFilters = {}): Promise<StudentRankItem[]> {
	const { data } = await api.get<StudentRankItem[]>('/v1/community/talent-pool', { params: filters });
	return data;
}

export async function fetchRecruiterDiscovery(): Promise<RecruiterTalentItem[]> {
	const { data } = await api.get<RecruiterTalentItem[]>('/v1/community/recruiter-discovery');
	return data;
}

export async function sendDirectInvite(payload: DirectInvitePayload): Promise<{ invite_id: string; status: string; message: string }> {
	const { data } = await api.post('/v1/community/direct-connect', payload);
	return data;
}
