'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EnterInvestigationResultPage({ params }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userRole, setUserRole] = useState('');

  // Data
  const [testRequestItem, setTestRequestItem] = useState(null);
  const [existingResult, setExistingResult] = useState(null);
  const [isValidated, setIsValidated] = useState(false);

  // Form state
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchInvestigationResult();
    fetchUserRole();
  }, [unwrappedParams.testRequestId, unwrappedParams.itemId]);

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      if (data && data.user) {
        setUserRole(data.user.role);
      }
    } catch (err) {
      console.error('Failed to fetch user role:', err);
    }
  };

  const fetchInvestigationResult = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/test-requests/${unwrappedParams.testRequestId}/items/${unwrappedParams.itemId}/investigation-results`
      );
      const data = await response.json();

      if (response.ok) {
        setTestRequestItem(data.testRequestItem);
        setExistingResult(data.existingResult);
        setIsValidated(data.existingResult?.status === 'validated');

        // Initialize form with existing values
        if (data.existingResult) {
          setFindings(data.existingResult.findings || '');
          setImpression(data.existingResult.impression || '');
          setRecommendations(data.existingResult.recommendations || '');
          setNotes(data.existingResult.notes || '');
        }
      } else {
        setError(data.error || 'Failed to load investigation result');
      }
    } catch (err) {
      setError('Failed to load investigation result');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!existingResult || !existingResult.id) {
      setError('No result to validate');
      return;
    }

    if (window.confirm('Are you sure you want to validate this result? Once validated, it cannot be modified.')) {
      setValidating(true);
      setError('');
      setSuccess('');

      try {
        const response = await fetch(
          `/api/investigation-results/${existingResult.id}/validate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const data = await response.json();

        if (response.ok) {
          setSuccess('Result validated successfully');
          setIsValidated(true);
          setExistingResult({ 
            ...existingResult, 
            status: 'validated', 
            validatedBy: data.result.validatedBy, 
            validatedDate: data.result.validatedDate 
          });
        } else {
          setError(data.error || 'Failed to validate result');
        }
      } catch (err) {
        setError('Failed to validate result');
      } finally {
        setValidating(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isValidated) {
      setError('Cannot modify validated results');
      return;
    }

    if (!findings.trim()) {
      setError('Findings are required');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `/api/test-requests/${params.testRequestId}/items/${params.itemId}/investigation-results`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            findings,
            impression,
            recommendations,
            notes,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Investigation result saved successfully');
        // Refresh to get the new result ID
        await fetchInvestigationResult();
      } else {
        setError(data.error || 'Failed to save investigation result');
      }
    } catch (err) {
      setError('Failed to save investigation result');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error && !testRequestItem) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
        <Link
          href="/dashboard/investigation-results/pending"
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          ← Back to Investigation Results Queue
        </Link>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/dashboard/investigation-results/pending"
          className="text-blue-600 hover:underline mb-2 inline-block"
        >
          ← Back to Investigation Results Queue
        </Link>
        <h1 className="text-3xl font-bold text-gray-800">
          {existingResult ? 'View/Edit Investigation Result' : 'Enter Investigation Result'}
        </h1>
        <div className="mt-2 text-gray-600">
          <p><strong>Investigation:</strong> {testRequestItem?.inventoryItem?.name} ({testRequestItem?.inventoryItem?.code})</p>
          <p><strong>Request:</strong> {testRequestItem?.testRequest?.requestNumber}</p>
          <p><strong>Patient:</strong> {testRequestItem?.testRequest?.patient?.firstName} {testRequestItem?.testRequest?.patient?.lastName} ({testRequestItem?.testRequest?.patient?.patientNumber})</p>
        </div>

        {/* Validation Status Banner */}
        {isValidated && (
          <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold text-purple-900">Result Validated</p>
                <p className="text-sm text-purple-700">
                  Validated by {existingResult?.validatedBy} on {formatDate(existingResult?.validatedDate)}
                </p>
                <p className="text-sm text-purple-600 mt-1">
                  This result is read-only and cannot be modified.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Investigation Report</h2>

          {/* Findings */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Findings <span className="text-red-600">*</span>
            </label>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              disabled={isValidated}
              rows="8"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-sm"
              placeholder="Describe the investigation findings in detail..."
            />
            <p className="text-xs text-gray-500 mt-1">Required field - detailed observations and findings</p>
          </div>

          {/* Impression */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Impression / Diagnosis
            </label>
            <textarea
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              disabled={isValidated}
              rows="4"
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-sm"
              placeholder="Clinical impression or diagnosis based on findings..."
            />
            <p className="text-xs text-gray-500 mt-1">Summary of findings and clinical interpretation</p>
          </div>

          {/* Recommendations */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recommendations
            </label>
            <textarea
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              disabled={isValidated}
              rows="4"
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-sm"
              placeholder="Clinical recommendations or follow-up actions..."
            />
            <p className="text-xs text-gray-500 mt-1">Suggested next steps or follow-up investigations</p>
          </div>

          {/* Additional Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isValidated}
              rows="3"
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Any additional notes or comments..."
            />
          </div>

          {/* Metadata (if existing) */}
          {existingResult && (
            <div className="mb-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Report Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Reported By:</span>
                  <span className="ml-2 font-medium">{existingResult.reportedBy}</span>
                </div>
                <div>
                  <span className="text-gray-500">Reported Date:</span>
                  <span className="ml-2 font-medium">{formatDate(existingResult.reportedDate)}</span>
                </div>
                {existingResult.validatedBy && (
                  <>
                    <div>
                      <span className="text-gray-500">Validated By:</span>
                      <span className="ml-2 font-medium">{existingResult.validatedBy}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Validated Date:</span>
                      <span className="ml-2 font-medium">{formatDate(existingResult.validatedDate)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex justify-between items-center">
            <div className="flex space-x-3">
              <Link
                href="/dashboard/investigation-results/pending"
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                {isValidated ? 'Back' : 'Cancel'}
              </Link>
              
              {/* Print Button - only show if result exists */}
              {existingResult && (
                <Link
                  href={`/dashboard/investigation-results/print/${existingResult.id}`}
                  target="_blank"
                  className="px-6 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50"
                >
                  🖨️ Print Report
                </Link>
              )}
            </div>
            
            <div className="flex space-x-3">
              {/* Save/Update Button - only show if not validated */}
              {!isValidated && (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {submitting ? 'Saving...' : existingResult ? 'Update Report' : 'Save Report'}
                </button>
              )}

              {/* Validate Button - only show for SUPERUSER on completed results */}
              {!isValidated && existingResult && userRole === 'SUPERUSER' && (
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={validating}
                  className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400"
                >
                  {validating ? 'Validating...' : 'Validate Report'}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
