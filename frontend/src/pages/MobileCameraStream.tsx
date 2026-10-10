import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/http';

function mobilePingUrl(): string {
	const configuredApi = new URL(api.defaults.baseURL || '/api', window.location.origin);
	if (['localhost', '127.0.0.1', '0.0.0.0'].includes(configuredApi.hostname)) {
		configuredApi.hostname = window.location.hostname;
	}
	return new URL(`${configuredApi.pathname.replace(/\/$/, '')}/v1/assessments/mobile-ping`, configuredApi).toString();
}

export default function MobileCameraStream() {
	const [searchParams] = useSearchParams();
	const sessionId = searchParams.get('sessionId') || '';
	const videoRef = useRef<HTMLVideoElement>(null);
	const [cameraError, setCameraError] = useState('');
	const [connectionState, setConnectionState] = useState<'connecting' | 'live' | 'error'>('connecting');

	useEffect(() => {
		if (!sessionId) {
			setConnectionState('error');
			setCameraError('This pairing link is missing its session ID. Scan the QR code again.');
			return undefined;
		}

		let disposed = false;
		let pingTimer: number | undefined;
		let stream: MediaStream | null = null;
		const stopCamera = () => {
			stream?.getTracks().forEach((track) => track.stop());
			stream = null;
			if (videoRef.current) videoRef.current.srcObject = null;
			if (pingTimer !== undefined) {
				window.clearInterval(pingTimer);
				pingTimer = undefined;
			}
		};
		const ping = async (): Promise<boolean> => {
			try {
				const response = await fetch(mobilePingUrl(), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ session_id: sessionId }),
				});
				if (!response.ok) throw new Error('The pairing session is no longer available.');
				if (!disposed) setConnectionState('live');
				return true;
			} catch (error) {
				if (!disposed) {
					setConnectionState('error');
					setCameraError(error instanceof Error ? error.message : 'Could not reach the assessment.');
					stopCamera();
				}
				return false;
			}
		};

		const startCamera = async () => {
			if (!navigator.mediaDevices?.getUserMedia) {
				setConnectionState('error');
				setCameraError('This browser does not support camera access. Open this page over HTTPS or localhost.');
				return;
			}
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
				});
				if (disposed) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}
				if (videoRef.current) videoRef.current.srcObject = stream;
				const connected = await ping();
				if (!connected) {
					stopCamera();
					return;
				}
				pingTimer = window.setInterval(() => void ping(), 3000);
			} catch {
				if (!disposed) {
					setConnectionState('error');
					setCameraError('Camera access was denied or the phone camera is unavailable. Allow camera access and retry.');
				}
			}
		};

		void startCamera();
		return () => {
			disposed = true;
			if (pingTimer !== undefined) window.clearInterval(pingTimer);
			stopCamera();
		};
	}, [sessionId]);

	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
			<section className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-7">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">CampusLink · Assessment proctoring</p>
					<h1 className="mt-2 text-2xl font-semibold text-white">360° Secondary Cam Active</h1>
					<p className="mt-2 text-sm leading-6 text-slate-400">Position phone at a 45° angle showing keyboard and desk.</p>
				</div>
				<div className="overflow-hidden rounded-xl border border-slate-700 bg-black">
					<video autoPlay className="aspect-video w-full object-cover" muted playsInline ref={videoRef} />
				</div>
				<div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5">
					<span className={`h-2.5 w-2.5 rounded-full ${connectionState === 'live' ? 'animate-pulse bg-emerald-400' : connectionState === 'error' ? 'bg-rose-400' : 'bg-amber-300'}`} />
					<p className={`text-xs font-medium ${connectionState === 'live' ? 'text-emerald-200' : connectionState === 'error' ? 'text-rose-200' : 'text-amber-100'}`}>
						{connectionState === 'live' ? 'Mobile camera connected' : connectionState === 'error' ? 'Connection needs attention' : 'Connecting mobile camera…'}
					</p>
				</div>
				{cameraError && <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 px-3 py-2.5 text-xs leading-5 text-rose-200" role="alert">{cameraError}</p>}
				<p className="text-[11px] leading-5 text-slate-500">Keep this page open and the phone steady until the assessment is submitted. The camera stays on this device; only pairing status pings are sent.</p>
			</section>
		</main>
	);
}
