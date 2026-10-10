import React, { useState } from 'react';

export const QRScanner: React.FC<{ driveId: number }> = ({ driveId }) => {
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleMockScan = async () => {
        const mockToken = "qr_abc123";
        setScanResult(mockToken);
        
        try {
            const response = await fetch('/api/v1/attendance/scan-qr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qr_auth_token: mockToken, drive_id: driveId })
            });
            
            if (response.ok) {
                setStatus('success');
                setMessage('Attendance verified successfully!');
            } else {
                setStatus('error');
                setMessage('Failed to verify attendance.');
            }
        } catch (err) {
            setStatus('error');
            setMessage('Network error occurred.');
        }
    };

    return (
        <div className="p-4 border rounded-lg shadow-sm bg-white">
            <h3 className="text-lg font-semibold mb-4">Drive Attendance Scanner</h3>
            <div className="bg-gray-100 h-48 flex items-center justify-center rounded-md mb-4 border-2 border-dashed border-gray-300">
                <span className="text-gray-500">Camera Feed Placeholder (requires html5-qrcode)</span>
            </div>
            <button 
                onClick={handleMockScan}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
            >
                Simulate QR Scan
            </button>
            
            {status !== 'idle' && (
                <div className={`mt-4 p-3 rounded ${status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message}
                </div>
            )}
        </div>
    );
};
