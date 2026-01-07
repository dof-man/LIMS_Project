'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EnterLabResultPage({ params }) {
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
  const [parameters, setParameters] = useState([]);
  const [existingResult, setExistingResult] = useState(null);
  const [isValidated, setIsValidated] = useState(false);

  // Form state
  const [resultValues, setResultValues] = useState({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchLabParameters();
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

  const fetchLabParameters = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/test-requests/${unwrappedParams.testRequestId}/items/${unwrappedParams.itemId}/lab-parameters`
      );
      const data = await response.json();

      if (response.ok) {
        setTestRequestItem(data.testRequestItem);
        setParameters(data.parameters || []);
        setExistingResult(data.existingResult);
        setIsValidated(data.existingResult?.status === 'validated');

        // Initialize form with existing values
        if (data.existingResult) {
          const values = {};
          data.existingResult.labResultValues.forEach(rv => {
            values[rv.labParameterId] = {
              value: rv.value || '',
              numericValue: rv.numericValue !== null ? rv.numericValue : '',
              textValue: rv.textValue || '',
            };
          });
          setResultValues(values);
          setNotes(data.existingResult.notes || '');
        } else {
          // Initialize empty form
          const values = {};
          data.parameters.forEach(param => {
            values[param.id] = {
              value: '',
              numericValue: '',
              textValue: '',
            };
          });
          setResultValues(values);
        }
      } else {
        setError(data.error || 'Failed to load lab parameters');
      }
    } catch (err) {
      setError('Failed to load lab parameters');
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
          `/api/lab-results/${existingResult.id}/validate`,
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
          setExistingResult({ ...existingResult, status: 'validated', validatedBy: data.result.validatedBy, validatedDate: data.result.validatedDate });
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

    setSubmitting(true);
    setError('');
    setSuccess('');

    // Build result values array
    const resultValuesArray = Object.entries(resultValues)
      .filter(([_, values]) => {
        // Include if any field has a value
        return values.value || values.numericValue !== '' || values.textValue;
      })
      .map(([parameterId, values]) => ({
        labParameterId: parameterId,
        value: values.value || null,
        numericValue: values.numericValue !== '' ? parseFloat(values.numericValue) : null,
        textValue: values.textValue || null,
      }));

    if (resultValuesArray.length === 0) {
      setError('Please enter at least one result value');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/test-requests/${params.testRequestId}/items/${params.itemId}/lab-results`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resultValues: resultValuesArray,
            notes,
            status: 'completed',
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Lab results saved successfully');
        // Refresh to get the new result ID
        await fetchLabParameters();
      } else {
        setError(data.error || 'Failed to save lab results');
      }
    } catch (err) {
      setError('Failed to save lab results');
    } finally {
      setSubmitting(false);
    }
  };

  const getParameterStatus = (parameter, value) => {
    const numericValue = parseFloat(value.numericValue);
    
    if (isNaN(numericValue) || value.numericValue === '') {
      return null;
    }

    if (parameter.referenceRangeMin !== null && numericValue < parameter.referenceRangeMin) {
      return numericValue < (parameter.referenceRangeMin * 0.5) ? 'critically-low' : 'low';
    }
    
    if (parameter.referenceRangeMax !== null && numericValue > parameter.referenceRangeMax) {
      return numericValue > (parameter.referenceRangeMax * 2) ? 'critically-high' : 'high';
    }

    return 'normal';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'critically-low':
      case 'critically-high':
        return 'text-red-600 font-bold';
      case 'low':
      case 'high':
        return 'text-orange-600 font-semibold';
      case 'normal':
        return 'text-green-600';
      default:
        return '';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'critically-low':
        return 'LL - Critically Low';
      case 'critically-high':
        return 'HH - Critically High';
      case 'low':
        return 'L - Low';
      case 'high':
        return 'H - High';
      case 'normal':
        return '✓ Normal';
      default:
        return '';
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
          href="/dashboard/lab-results/pending"
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          ← Back to Lab Results Queue
        </Link>
      </div>
    );
  }

  if (parameters.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Parameters Found</h3>
          <p className="text-yellow-700 mb-4">
            No lab parameters are configured for this test: <strong>{testRequestItem?.inventoryItem?.itemName}</strong>
          </p>
          <p className="text-sm text-yellow-600 mb-4">
            This could be because the test category/subcategory doesn&apos;t match any lab parameters in the system.
          </p>
          <Link
            href="/dashboard/lab-results/pending"
            className="text-blue-600 hover:underline"
          >
            ← Back to Lab Results Queue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/dashboard/lab-results/pending"
          className="text-blue-600 hover:underline mb-2 inline-block"
        >
          ← Back to Lab Results Queue
        </Link>
        <h1 className="text-3xl font-bold text-gray-800">
          {existingResult ? 'View/Edit Lab Results' : 'Enter Lab Results'}
        </h1>
        <p className="text-gray-600 mt-2">
          Test: <strong>{testRequestItem?.inventoryItem?.itemName}</strong>
        </p>

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
                  Validated by {existingResult?.validatedBy} on {existingResult?.validatedDate ? new Date(existingResult.validatedDate).toLocaleString() : 'N/A'}
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
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Test Parameters</h2>

          <div className="space-y-6">
            {parameters.map((parameter) => {
              const value = resultValues[parameter.id] || {};
              const status = getParameterStatus(parameter, value);

              return (
                <div key={parameter.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{parameter.name}</h3>
                      <p className="text-sm text-gray-600">Code: {parameter.code}</p>
                      {parameter.unit && (
                        <p className="text-sm text-gray-500">Unit: {parameter.unit}</p>
                      )}
                    </div>
                    {status && (
                      <span className={`text-sm ${getStatusColor(status)}`}>
                        {getStatusLabel(status)}
                      </span>
                    )}
                  </div>

                  {/* Reference Range */}
                  {(parameter.referenceRangeMin !== null || parameter.referenceRangeMax !== null || parameter.referenceText) && (
                    <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                      <span className="font-medium text-blue-800">Reference Range: </span>
                      {parameter.referenceRangeMin !== null && parameter.referenceRangeMax !== null ? (
                        <span className="text-blue-700">
                          {parameter.referenceRangeMin} - {parameter.referenceRangeMax} {parameter.unit}
                        </span>
                      ) : parameter.referenceText ? (
                        <span className="text-blue-700">{parameter.referenceText}</span>
                      ) : null}
                    </div>
                  )}

                  {/* Numeric Value Input */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Numeric Value {parameter.unit && `(${parameter.unit})`}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={value.numericValue}
                      onChange={(e) => updateResultValue(parameter.id, 'numericValue', e.target.value)}
                      disabled={isValidated}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Enter numeric value"
                    />
                  </div>

                  {/* Text Value Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Text Value / Comments
                    </label>
                    <textarea
                      value={value.textValue}
                      onChange={(e) => updateResultValue(parameter.id, 'textValue', e.target.value)}
                      disabled={isValidated}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Enter text result or additional comments"
                    />
                  </div>

                  {/* Method (if available) */}
                  {parameter.method && (
                    <p className="text-xs text-gray-500 mt-2">Method: {parameter.method}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* General Notes */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              General Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isValidated}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Any additional notes about the test results..."
            />
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-between items-center">
            <div className="flex space-x-3">
              <Link
                href="/dashboard/lab-results/pending"
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                {isValidated ? 'Back' : 'Cancel'}
              </Link>

              {/* Print Button - only show if result exists */}
              {existingResult && (
                <Link
                  href={`/dashboard/lab-results/print/${existingResult.id}`}
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
                  {submitting ? 'Saving...' : existingResult ? 'Update Results' : 'Save Results'}
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
                  {validating ? 'Validating...' : 'Validate Result'}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
