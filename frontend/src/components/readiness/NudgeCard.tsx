import React from 'react';

interface NudgeProps {
    skill: string;
    nudge: string;
    points_potential: number;
}

export const NudgeCard: React.FC<{ data: NudgeProps }> = ({ data }) => {
    return (
        <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl flex items-start space-x-4 shadow-sm">
            <div className="bg-indigo-100 text-indigo-600 p-2 rounded-full mt-1">
                🎯
            </div>
            <div className="flex-1">
                <h4 className="font-semibold text-indigo-900 mb-1">Level Up: {data.skill}</h4>
                <p className="text-sm text-indigo-800 mb-2">{data.nudge}</p>
                <span className="inline-block bg-white text-indigo-700 text-xs font-bold px-2 py-1 rounded shadow-sm">
                    +{data.points_potential} Readiness Points
                </span>
            </div>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                Start
            </button>
        </div>
    );
};
