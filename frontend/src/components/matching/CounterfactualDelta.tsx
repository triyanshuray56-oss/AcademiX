import React from 'react';

interface DeltaPayload {
    cgpa_delta?: number;
    skill_missing?: string;
    status?: string;
}

interface Props {
    delta: DeltaPayload;
}

export const CounterfactualDelta: React.FC<Props> = ({ delta }) => {
    if (delta.status === "Shortlisted") {
        return (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">You meet the shortlisting threshold for this role!</p>
            </div>
        );
    }

    const missingVariable = delta.skill_missing ? `Skill: ${delta.skill_missing}` : (delta.cgpa_delta ? `CGPA: +${delta.cgpa_delta}` : 'experience');

    return (
        <div className="p-5 bg-white border border-gray-200 shadow-sm rounded-xl mt-4">
            <h4 className="text-gray-800 font-semibold mb-2">Shortlisting Gap Analysis</h4>
            <p className="text-gray-600 text-sm mb-4">
                To reach the <span className="font-bold text-gray-800">75% Shortlisted threshold</span>, you need: <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">{missingVariable}</span>
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '65%' }}></div>
            </div>
            <p className="text-xs text-gray-500 text-right">Currently at 65%</p>
        </div>
    );
};
