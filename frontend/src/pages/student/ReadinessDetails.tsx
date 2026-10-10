import React from 'react';
import { CounterfactualDelta } from '../../components/matching/CounterfactualDelta';
import { ReadinessScoreCard } from '../../components/readiness/ReadinessScoreCard';

export const ReadinessDetails: React.FC = () => {
    const mockDeltaPayload = {
        skill_missing: "AWS",
        cgpa_delta: 0.0
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Your Readiness Details</h1>
            
            <ReadinessScoreCard /> 

            <CounterfactualDelta delta={mockDeltaPayload} />
            
            <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Detailed Metrics</h3>
                <p className="text-gray-600">Additional readiness breakdowns would go here...</p>
            </div>
        </div>
    );
};

export default ReadinessDetails;
