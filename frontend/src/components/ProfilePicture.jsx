import { useEffect, useState } from 'react';
import { ImagePlus, LoaderCircle } from 'lucide-react';

function initials(name = '') {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'CL';
}

export function ProfileAvatar({ name, pictureUrl, size = 'md', className = '' }) {
	const [imageFailed, setImageFailed] = useState(false);
	useEffect(() => setImageFailed(false), [pictureUrl]);
	const dimensions = size === 'sm' ? 'h-9 w-9 text-xs' : size === 'lg' ? 'h-24 w-24 text-2xl' : 'h-14 w-14 text-base';
	return (
		<span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-indigo-300/25 bg-gradient-to-br from-indigo-400/25 to-cyan-300/15 font-semibold text-cyan-100 shadow-inner shadow-white/5 ${dimensions} ${className}`}>
			{pictureUrl && !imageFailed ? <img alt={`${name || 'Student'} profile`} className="h-full w-full object-cover" onError={() => setImageFailed(true)} src={pictureUrl} /> : <span aria-hidden="true">{initials(name)}</span>}
		</span>
	);
}

export function ProfilePictureEditor({ name, pictureUrl, onChange }) {
	const [urlDraft, setUrlDraft] = useState(pictureUrl?.startsWith('http') ? pictureUrl : '');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');

	useEffect(() => {
		if (!pictureUrl || pictureUrl.startsWith('data:')) setUrlDraft('');
		else setUrlDraft(pictureUrl);
	}, [pictureUrl]);

	const handleFile = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;
		if (!['image/png', 'image/jpeg'].includes(file.type)) {
			setError('Choose a PNG or JPEG image.');
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			setError('Choose an image smaller than 2 MB.');
			return;
		}

		setBusy(true);
		setError('');
		setMessage('Preparing image preview...');
		try {
			const dataUrl = await new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onerror = () => reject(new Error('Unable to read this image.'));
				reader.onload = () => resolve(reader.result);
				reader.readAsDataURL(file);
			});
			await onChange(dataUrl);
			setMessage('Profile picture updated.');
		} catch (uploadError) {
			setError(uploadError.message || 'Could not save this profile picture.');
			setMessage('');
		} finally {
			setBusy(false);
		}
	};

	const applyUrl = async () => {
		const normalizedUrl = urlDraft.trim();
		if (!/^https?:\/\//i.test(normalizedUrl)) {
			setError('Enter a valid image URL beginning with https:// or http://.');
			return;
		}
		setBusy(true);
		setError('');
		setMessage('Saving image link...');
		try {
			await onChange(normalizedUrl);
			setMessage('Profile picture updated.');
		} catch (uploadError) {
			setError(uploadError.message || 'Could not save this image URL.');
			setMessage('');
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/45 p-4 sm:flex-row sm:items-center">
			<div className="flex items-center gap-4 sm:block sm:text-center">
				<ProfileAvatar className="sm:mx-auto" name={name} pictureUrl={pictureUrl} size="lg" />
				<div className="sm:mt-3"><label className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-100 ${busy ? 'pointer-events-none opacity-60' : ''}`}><input accept="image/png,image/jpeg" className="sr-only" disabled={busy} onChange={handleFile} type="file" /><ImagePlus aria-hidden="true" className="h-4 w-4" />{busy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : 'Upload image'}</label><p className="mt-2 text-[10px] text-slate-600">PNG or JPEG · up to 2 MB</p></div>
			</div>
			<div className="min-w-0 flex-1">
				<label className="block space-y-2" htmlFor="profile-picture-url"><span className="text-xs font-medium text-slate-300">Or paste an image URL</span><span className="flex gap-2"><input className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400" disabled={busy} id="profile-picture-url" onChange={(event) => setUrlDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyUrl(); } }} placeholder="https://.../photo.jpg" type="url" value={urlDraft} /><button className="shrink-0 rounded-lg border border-slate-700 px-3 text-xs text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-100 disabled:opacity-50" disabled={busy || !urlDraft.trim()} onClick={applyUrl} type="button">Use URL</button></span></label>
				{error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
				{message && <p className="mt-2 text-xs text-cyan-200" role="status">{message}</p>}
			</div>
		</div>
	);
}