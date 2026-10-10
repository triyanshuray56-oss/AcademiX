import api from './http';

export type PlacementAnnouncement = {
	id: string;
	title: string;
	message: string;
	category: string;
	priority: string;
	published_at: string;
	company?: string | null;
	role_title?: string | null;
	logo?: string | null;
	package?: string | null;
	direct_link?: string | null;
};

export type StudentAdminAnnouncement = {
	id: number;
	title: string;
	message: string;
	category: string;
	priority: string;
	published_at: string;
	publisher: string;
	direct_link?: string | null;
};

export type StudentRecruiterNotice = {
	id: number;
	title: string;
	message: string;
	category: string;
	priority: string;
	published_at: string;
	company_name: string;
	logo_url?: string | null;
	direct_link?: string | null;
};

export type JobDeadline = {
	id: string;
	drive_id?: number | null;
	company: string;
	role_title: string;
	deadline: string;
	drive_date?: string | null;
	days_remaining: number;
	hours_remaining: number;
	direct_link: string;
	logo?: string | null;
	location: string;
	urgency: 'closing_today' | 'closing_soon' | 'closing_this_week';
};

export type DeadlineFeed = {
	deadlines: JobDeadline[];
	as_of: string;
	window_days: number;
	note: string;
	is_demo_data: boolean;
};

export async function fetchPlacementAnnouncements(): Promise<PlacementAnnouncement[]> {
	const { data } = await api.get<PlacementAnnouncement[]>('/v1/notices/announcements');
	return Array.isArray(data) ? data : [];
}

export async function fetchAdminAnnouncements(): Promise<StudentAdminAnnouncement[]> {
	const { data } = await api.get<StudentAdminAnnouncement[]>('/v1/notices/admin');
	return Array.isArray(data) ? data : [];
}

export async function fetchRecruiterAnnouncements(): Promise<StudentRecruiterNotice[]> {
	const { data } = await api.get<StudentRecruiterNotice[]>('/v1/notices/recruiter');
	return Array.isArray(data) ? data : [];
}

export async function fetchDeadlines(): Promise<DeadlineFeed> {
	const { data } = await api.get<DeadlineFeed>('/v1/notices/deadlines');
	return data;
}