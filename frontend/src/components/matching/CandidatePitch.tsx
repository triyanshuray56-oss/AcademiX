import React from 'react';

interface PitchProps {
    pitch: string;
}

export const CandidatePitch: React.FC<PitchProps> = ({ pitch }) => {
    return (
        <div className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center space-x-2 mb-3">
                <span className="text-blue-500">✨</span>
                <h4 className="font-semibold text-gray-800">AI Auto-Generated Pitch</h4>
            </div>
            <div className="p-4 bg-gray-50 border-l-4 border-blue-500 rounded text-gray-700 italic text-sm leading-relaxed">
                "{pitch}"
            </div>
            <div className="mt-3 flex justify-end">
                <button className="text-xs text-blue-600 hover:underline">Copy to Clipboard</button>
            </div>
        </div>
    );
};
