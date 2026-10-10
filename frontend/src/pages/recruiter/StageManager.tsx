import React, { useState } from 'react';
import { QRScanner } from '../../components/scheduling/QRScanner';

export const StageManager: React.FC = () => {
    const [panels, setPanels] = useState([
        { id: 1, status: 'busy', delay_minutes: 20, queue_size: 4 },
        { id: 2, status: 'idle', delay_minutes: 0, queue_size: 0 }
    ]);

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Drive Stage Manager</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h2 className="text-xl font-semibold mb-4">Attendance</h2>
                    <QRScanner driveId={101} />
                </div>
                
                <div>
                    <h2 className="text-xl font-semibold mb-4">Live Panel Queue Monitor</h2>
                    <div className="space-y-4">
                        {panels.map(panel => (
                            <div key={panel.id} className="p-4 border rounded-lg shadow-sm bg-white flex justify-between items-center">
                                <div>
                                    <h3 className="font-semibold">Panel {panel.id}</h3>
                                    <p className="text-sm text-gray-500">Status: <span className={panel.status === 'idle' ? 'text-green-500' : 'text-amber-500'}>{panel.status}</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-red-600">
                                        {panel.delay_minutes > 15 && `Delayed: ${panel.delay_minutes} mins`}
                                    </p>
                                    <p className="text-sm text-gray-600">Queue: {panel.queue_size} candidates</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {panels.some(p => p.delay_minutes > 15) && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
                            ⚠️ Load balancer action required: Reallocating queue from delayed panels.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StageManager;
