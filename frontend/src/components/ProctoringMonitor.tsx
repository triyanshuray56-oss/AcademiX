import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import type { FaceDetection as FaceDetectionApi } from '@mediapipe/face_detection';
import { QRCodeSVG } from 'qrcode.react';
import api, { getApiError } from '../api/http';

declare global {
	interface Window {
		FaceDetection?: new (config?: { locateFile?: (file: string) => string }) => FaceDetectionApi;
	}
}

type ViolationType =
	| 'NO_FACE'
	| 'MULTIPLE_FACES'
	| 'TAB_SWITCH'
	| 'FULLSCREEN_EXIT'
	| 'SECONDARY_CAM_DISCONNECTED'
	| 'LOOKING_AWAY';

type PairingSession = {
	session_id: string;
	mobile_connected: boolean;
	last_ping: string;
};

type ViolationResponse = {
	current_strikes: number;
	max_strikes: number;
	auto_submit_triggered: boolean;
	trust_score: number;
	penalty_reason: string;
};

type SessionStatus = PairingSession & {
	trust_score: number;
	current_strikes: number;
	assessment_id: string;
};

type Props = {
	assessmentId: string;
	studentId: string | number;
	onAutoSubmit: () => void;
	onStrikeCountChange?: (strikes: number) => void;
};

const FACE_ASSETS_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229/';
const LOOKING_AWAY_DETECTION_CYCLES = 3;
const LOOKING_AWAY_REPORT_INTERVAL_CYCLES = 3;
const YAW_THRESHOLD = 0.28;
const DOWNWARD_PITCH_THRESHOLD = 0.95;
let faceDetectionScript: Promise<void> | null = null;

function loadFaceDetectionScript(): Promise<void> {
	if (window.FaceDetection) return Promise.resolve();
	if (faceDetectionScript) return faceDetectionScript;
	faceDetectionScript = new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = `${FACE_ASSETS_URL}face_detection.js`;
		script.async = true;
		script.onload = () => window.FaceDetection
			? resolve()
			: reject(new Error('MediaPipe face detection did not initialize.'));
		script.onerror = () => reject(new Error('MediaPipe face detection assets could not be loaded.'));
		document.head.appendChild(script);
	}).catch((error: unknown) => {
		faceDetectionScript = null;
		throw error;
	});
	return faceDetectionScript;
}

export default function ProctoringMonitor({
	assessmentId,
	studentId,
	onAutoSubmit,
	onStrikeCountChange,
}: Props) {
	const webcamRef = useRef<Webcam>(null);
	const sessionRef = useRef<PairingSession | null>(null);
	const trustRef = useRef(100);
	const strikesRef = useRef(0);
	const autoSubmitRef = useRef(false);
	const detectorRef = useRef<FaceDetectionApi | null>(null);
	const lastFaceViolationRef = useRef<ViolationType | null>(null);
	const lookingAwayCyclesRef = useRef(0);
	const lastLookingAwayReportCycleRef = useRef(0);
	const mobileWasConnectedRef = useRef(false);
	const fullscreenRequiredRef = useRef(false);
	const [pairing, setPairing] = useState<PairingSession | null>(null);
	const [mobileConnected, setMobileConnected] = useState(false);
	const [trustScore, setTrustScore] = useState(100);
	const [strikes, setStrikes] = useState(0);
	const [faceCount, setFaceCount] = useState<number | null>(null);
	const [lookingAway, setLookingAway] = useState(false);
	const [cameraError, setCameraError] = useState('');
	const [error, setError] = useState('');
	const [toast, setToast] = useState('');
	const [pairingOpen, setPairingOpen] = useState(false);
	const [fullscreenRequired, setFullscreenRequired] = useState(false);

	const triggerAutoSubmit = useCallback(() => {
		if (autoSubmitRef.current) return;
		autoSubmitRef.current = true;
		onAutoSubmit();
	}, [onAutoSubmit]);

	const logViolation = useCallback(async (eventType: ViolationType) => {
		const activePairing = sessionRef.current;
		if (!activePairing || autoSubmitRef.current) return;

		const penalty = eventType === 'TAB_SWITCH' ? 50 : eventType === 'LOOKING_AWAY' ? 15 : 10;
		const nextTrust = Math.max(0, trustRef.current - penalty);
		const nextStrikes = strikesRef.current + 1;
		trustRef.current = nextTrust;
		strikesRef.current = nextStrikes;
		setTrustScore(nextTrust);
		setStrikes(nextStrikes);
		onStrikeCountChange?.(nextStrikes);

		if (eventType === 'TAB_SWITCH') {
			setToast('Critical Violation: Tab switch detected! -50 Trust Score Penalty Applied.');
		} else if (eventType === 'LOOKING_AWAY') {
			setToast('Warning: Looking Away Detected! Keep your eyes on the screen.');
		} else {
			setToast(`${eventType.replaceAll('_', ' ')} detected. Strike ${nextStrikes} of 3.`);
		}

		try {
			const { data } = await api.post<ViolationResponse>('/v1/assessments/log-violation', {
				student_id: String(studentId),
				assessment_id: assessmentId,
				event_type: eventType,
				timestamp: new Date().toISOString(),
				strike_count: nextStrikes,
			});
			trustRef.current = data.trust_score;
			strikesRef.current = data.current_strikes;
			setTrustScore(data.trust_score);
			setStrikes(data.current_strikes);
			onStrikeCountChange?.(data.current_strikes);
			if (data.auto_submit_triggered) triggerAutoSubmit();
		} catch (requestError) {
			setError(getApiError(requestError));
			if (nextStrikes >= 3 || nextTrust <= 0) triggerAutoSubmit();
		}
	}, [assessmentId, onStrikeCountChange, studentId, triggerAutoSubmit]);

	useEffect(() => {
		let cancelled = false;
		setPairing(null);
		setMobileConnected(false);
		setTrustScore(100);
		setStrikes(0);
		trustRef.current = 100;
		strikesRef.current = 0;
		autoSubmitRef.current = false;
		mobileWasConnectedRef.current = false;
		lastFaceViolationRef.current = null;
		lookingAwayCyclesRef.current = 0;
		lastLookingAwayReportCycleRef.current = 0;
		setLookingAway(false);
		onStrikeCountChange?.(0);
		api.post<PairingSession>('/v1/assessments/sessions', { assessment_id: assessmentId })
			.then(({ data }) => {
				if (cancelled) return;
				sessionRef.current = data;
				setPairing(data);
				setError('');
			})
			.catch((requestError) => {
				if (!cancelled) setError(getApiError(requestError));
			});
		return () => {
			cancelled = true;
			sessionRef.current = null;
		};
	}, [assessmentId, onStrikeCountChange]);

	useEffect(() => {
		if (!pairing) return undefined;
		let cancelled = false;
		const refreshStatus = async () => {
			try {
				const { data } = await api.get<SessionStatus>(
					`/v1/assessments/session-status/${encodeURIComponent(pairing.session_id)}`,
				);
				if (cancelled) return;
				setError('');
				setMobileConnected(data.mobile_connected);
				trustRef.current = data.trust_score;
				strikesRef.current = data.current_strikes;
				setTrustScore(data.trust_score);
				setStrikes(data.current_strikes);
				onStrikeCountChange?.(data.current_strikes);
				if (mobileWasConnectedRef.current && !data.mobile_connected) {
					void logViolation('SECONDARY_CAM_DISCONNECTED');
				}
				mobileWasConnectedRef.current = data.mobile_connected;
				if (data.current_strikes >= 3 || data.trust_score <= 0) triggerAutoSubmit();
			} catch (requestError) {
				if (!cancelled) setError(getApiError(requestError));
			}
		};
		void refreshStatus();
		const timer = window.setInterval(() => void refreshStatus(), 3000);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [logViolation, onStrikeCountChange, pairing, triggerAutoSubmit]);

	useEffect(() => {
		if (!pairing) return undefined;
		const activeSessionId = pairing.session_id;
		return () => {
			void api.post(`/v1/assessments/sessions/${encodeURIComponent(activeSessionId)}/close`)
				.catch((closeError) => console.error('Failed to close the assessment proctoring session.', closeError));
		};
	}, [pairing]);

	useEffect(() => {
		if (!pairing) return undefined;
		let cancelled = false;
		let detectionTimer: number | undefined;
		let detectionRunning = false;
		let detector: FaceDetectionApi | null = null;
		const startFaceDetection = async () => {
			await loadFaceDetectionScript();
			if (cancelled) return;
			if (!window.FaceDetection) throw new Error('MediaPipe face detection is unavailable.');
			detector = new window.FaceDetection({ locateFile: (file) => `${FACE_ASSETS_URL}${file}` });
			detectorRef.current = detector;
			detector.setOptions({ model: 'short', minDetectionConfidence: 0.6 });
			detector.onResults((results) => {
				if (cancelled) return;
				const count = results.detections.length;
				setFaceCount(count);
				if (count !== 1) {
					lookingAwayCyclesRef.current = 0;
					lastLookingAwayReportCycleRef.current = 0;
					setLookingAway(false);
					const eventType: ViolationType = count === 0 ? 'NO_FACE' : 'MULTIPLE_FACES';
					if (lastFaceViolationRef.current !== eventType) {
						lastFaceViolationRef.current = eventType;
						void logViolation(eventType);
					}
					return;
				}

				lastFaceViolationRef.current = null;
				const landmarks = results.detections[0]?.landmarks;
				if (!landmarks || landmarks.length < 3) return;
				const [rightEye, leftEye, noseTip] = landmarks;
				const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
				if (eyeDistance < 0.01) return;
				const eyeMidpointX = (rightEye.x + leftEye.x) / 2;
				const eyeMidpointY = (rightEye.y + leftEye.y) / 2;
				const yawRatio = Math.abs(noseTip.x - eyeMidpointX) / eyeDistance;
				const pitchRatio = (noseTip.y - eyeMidpointY) / eyeDistance;
				const awayFromCenter = yawRatio > YAW_THRESHOLD || pitchRatio > DOWNWARD_PITCH_THRESHOLD;

				if (!awayFromCenter) {
					lookingAwayCyclesRef.current = 0;
					lastLookingAwayReportCycleRef.current = 0;
					setLookingAway(false);
					return;
				}

				lookingAwayCyclesRef.current += 1;
				const awayCycles = lookingAwayCyclesRef.current;
				if (awayCycles < LOOKING_AWAY_DETECTION_CYCLES) return;
				setLookingAway(true);
				if (
					lastLookingAwayReportCycleRef.current === 0
					|| awayCycles - lastLookingAwayReportCycleRef.current >= LOOKING_AWAY_REPORT_INTERVAL_CYCLES
				) {
					lastLookingAwayReportCycleRef.current = awayCycles;
					void logViolation('LOOKING_AWAY');
				}
			});
			await detector.initialize();
		};

		const startDetection = async () => {
			if (cancelled || detectionRunning || !detector) return;
			const video = webcamRef.current?.video;
			if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
			detectionRunning = true;
			try {
				await detector.send({ image: video });
			} catch {
				if (!cancelled) setCameraError('Face detection is temporarily unavailable.');
			} finally {
				detectionRunning = false;
			}
		};
		void startFaceDetection().catch((detectionError: unknown) => {
			if (!cancelled) {
				setCameraError(detectionError instanceof Error ? detectionError.message : 'Face detection is unavailable.');
				lastFaceViolationRef.current = 'NO_FACE';
				lookingAwayCyclesRef.current = 0;
				lastLookingAwayReportCycleRef.current = 0;
				setLookingAway(false);
				void logViolation('NO_FACE');
			}
		});
		detectionTimer = window.setInterval(() => void startDetection(), 1000);
		return () => {
			cancelled = true;
			if (detectionTimer !== undefined) window.clearInterval(detectionTimer);
			if (detectorRef.current === detector) detectorRef.current = null;
			if (detector) void detector.close().catch(() => undefined);
		};
	}, [logViolation, pairing]);

	useEffect(() => {
		let tabSwitchLogged = false;
		const handleVisibilityChange = () => {
			if (document.hidden && !tabSwitchLogged) {
				tabSwitchLogged = true;
				void logViolation('TAB_SWITCH');
			} else if (!document.hidden) {
				tabSwitchLogged = false;
			}
		};
		const handleWindowBlur = () => {
			if (document.hidden && !tabSwitchLogged) {
				tabSwitchLogged = true;
				void logViolation('TAB_SWITCH');
			}
		};
		const handleFullscreenChange = () => {
			if (fullscreenRequiredRef.current && !document.fullscreenElement) {
				void logViolation('FULLSCREEN_EXIT');
			}
		};
		document.addEventListener('visibilitychange', handleVisibilityChange);
		document.addEventListener('fullscreenchange', handleFullscreenChange);
		window.addEventListener('blur', handleWindowBlur);
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			window.removeEventListener('blur', handleWindowBlur);
		};
	}, [logViolation]);

	useEffect(() => {
		if (!toast) return undefined;
		const timer = window.setTimeout(() => setToast(''), 5000);
		return () => window.clearTimeout(timer);
	}, [toast]);

	const toggleFullscreen = async () => {
		try {
			if (document.fullscreenElement) {
				fullscreenRequiredRef.current = false;
				setFullscreenRequired(false);
				await document.exitFullscreen();
				return;
			}
			await document.documentElement.requestFullscreen();
			fullscreenRequiredRef.current = true;
			setFullscreenRequired(true);
		} catch {
			setError('Fullscreen is unavailable in this browser or was denied.');
		}
	};

	const qrUrl = pairing
		? `${window.location.origin}/proctor/mobile-stream?sessionId=${encodeURIComponent(pairing.session_id)}`
		: '';

	return (
		<>
			<div className="fixed right-3 top-3 z-40 w-[min(20rem,calc(100vw-1.5rem))] space-y-2 rounded-xl border border-slate-700 bg-slate-950/95 p-3 shadow-2xl backdrop-blur sm:right-5 sm:top-5">
				<div className="flex items-center justify-between gap-3">
					<p className="text-xs font-semibold uppercase tracking-wide text-slate-200">360° AI proctoring</p>
					<span className={`h-2.5 w-2.5 rounded-full ${trustScore <= 50 ? 'animate-pulse bg-rose-400' : 'bg-emerald-400'}`} />
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="relative overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
						<Webcam
							audio={false}
							className="h-[90px] w-full object-cover sm:h-[120px]"
							mirrored
							onUserMediaError={(cameraFailure) => {
								setCameraError(typeof cameraFailure === 'string' ? cameraFailure : 'Camera permission is required.');
								if (lastFaceViolationRef.current !== 'NO_FACE') {
									lastFaceViolationRef.current = 'NO_FACE';
									void logViolation('NO_FACE');
								}
							}}
							videoConstraints={{ facingMode: 'user', width: 320, height: 240 }}
							ref={webcamRef}
						/>
						<div className="absolute bottom-1 left-1 right-1 flex items-center justify-between rounded bg-slate-950/75 px-1.5 py-1 text-[9px] text-slate-200">
							<span>Laptop cam</span>
							<span className={`h-2 w-2 rounded-full ${faceCount === 1 ? 'bg-emerald-400' : faceCount === null ? 'bg-amber-300' : 'bg-rose-400'}`} />
						</div>
					</div>
					<div className="flex min-h-[90px] flex-col justify-between rounded-lg border border-slate-700 bg-slate-900 p-2 sm:min-h-[120px]">
						<div>
							<p className="text-[10px] text-slate-400">Secondary workspace cam</p>
							<p className={`mt-1 text-xs font-semibold ${mobileConnected ? 'text-emerald-300' : 'text-amber-200'}`}>
								Mobile Cam: {mobileConnected ? 'Live' : 'Pair via QR Code'}
							</p>
						</div>
						<button
							className="rounded-md border border-cyan-300/20 px-2 py-1.5 text-[10px] text-cyan-100 hover:bg-cyan-300/10 disabled:opacity-50"
							disabled={!pairing}
							onClick={() => setPairingOpen(true)}
							type="button"
						>
							{mobileConnected ? 'View pairing QR' : 'Pair mobile cam'}
						</button>
					</div>
				</div>
				{faceCount !== null && faceCount !== 1 && (
					<p className="rounded-md border border-rose-300/20 bg-rose-300/10 px-2 py-1.5 text-[10px] text-rose-100" role="status">
						{faceCount === 0 ? 'Warning: No Face Detected' : 'Warning: Multiple Faces Detected'}
					</p>
				)}
				{lookingAway && (
					<p className="animate-pulse rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-2 text-[10px] font-semibold text-amber-100" role="alert">
						Warning: Looking Away Detected! Keep your eyes on the screen.
					</p>
				)}
				{cameraError && <p className="text-[10px] text-amber-200">{cameraError}</p>}
				<div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-2">
					<div>
						<p className={`text-xs font-semibold ${trustScore <= 50 ? 'animate-pulse text-rose-300' : 'text-cyan-100'}`}>Trust Score: {trustScore}%</p>
						<p className="mt-0.5 text-[10px] text-slate-400">Strikes: {strikes} / 3</p>
					</div>
					<button className="rounded-md border border-slate-700 px-2 py-1.5 text-[10px] text-slate-300 hover:border-slate-500" onClick={() => void toggleFullscreen()} type="button">
						{fullscreenRequired ? 'Exit fullscreen' : 'Enter fullscreen'}
					</button>
				</div>
				{error && <p className="text-[10px] text-rose-200" role="alert">{error}</p>}
			</div>
			{toast && <div className="fixed right-3 top-60 z-50 max-w-sm rounded-lg border border-rose-300/30 bg-rose-950/95 px-4 py-3 text-xs font-semibold text-rose-100 shadow-xl sm:right-5" role="alert">{toast}</div>}
			{pairingOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="presentation" onClick={() => setPairingOpen(false)}>
					<section aria-labelledby="pairing-title" aria-modal="true" className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog">
						<h2 className="text-lg font-semibold text-white" id="pairing-title">Pair your mobile workspace camera</h2>
						<p className="mt-2 text-xs leading-5 text-slate-400">Scan this code on your phone and allow camera access. Position the phone to show your keyboard and desk.</p>
						{qrUrl && <div className="mx-auto mt-5 inline-block rounded-xl bg-white p-3"><QRCodeSVG value={qrUrl} size={208} includeMargin /></div>}
						<button className="mt-5 min-h-10 w-full rounded-lg border border-slate-700 text-sm text-slate-200 hover:bg-slate-800" onClick={() => setPairingOpen(false)} type="button">Close</button>
					</section>
				</div>
			)}
		</>
	);
}
