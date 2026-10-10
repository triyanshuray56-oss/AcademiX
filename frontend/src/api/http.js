import axios from 'axios';

const api = axios.create({
	baseURL: 'http://localhost:8000/api',
	timeout: 15000,
});

api.interceptors.request.use((config) => {
	const token = localStorage.getItem('access_token');
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

api.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response?.status === 401 && localStorage.getItem('access_token')) {
			window.dispatchEvent(new Event('campuslink:unauthorized'));
		}
		return Promise.reject(error);
	},
);

export function getApiError(error) {
	const detail = error.response?.data?.detail;
	if (Array.isArray(detail)) return detail.map((item) => item.msg).filter(Boolean).join(' ');
	if (typeof detail === 'string') return detail;
	if (!error.response) return 'The CampusLink API is unavailable. Confirm that FastAPI is running on port 8000.';
	return 'The request could not be completed. Please try again.';
}

export default api;