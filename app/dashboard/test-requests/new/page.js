'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BackToDashboard from '../../components/BackToDashboard';

export default function NewTestRequestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Patients data
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');

  // Investigation items data
  const [investigationItems, setInvestigationItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Form state
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedItems, setSelectedItems] = useState([]); // Array of inventory item IDs
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [requestedBy, setRequestedBy] = useState('');

  // Fetch patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Fetch investigation items on mount
  useEffect(() => {
    fetchInvestigationItems();
  }, []);

  const fetchPatients = async (search = '') => {
    setLoadingPatients(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('limit', '100');

      const response = await fetch(`/api/patients?${params}`);
      const data = await response.json();

      if (response.ok) {
        setPatients(data.patients || []);
      } else {
        setError(data.error || 'Failed to load patients');
      }
    } catch (err) {
      setError('Failed to load patients');
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchInvestigationItems = async () => {
    setLoadingItems(true);
    try {
      const response = await fetch('/api/inventory');
      const data = await response.json();

      if (response.ok) {
        // Filter to only investigation categories
        const investigations = (data.items || []).filter(item =>
          ['LAB_TEST', 'RADIOLOGY', 'PROCEDURE'].includes(item.category) && item.isActive
        );
        setInvestigationItems(investigations);
      } else {
        setError(data.error || 'Failed to load investigation items');
      }
    } catch (err) {
      setError('Failed to load investigation items');
    } finally {
      setLoadingItems(false);
    }
  };

  const handlePatientSearch = (e) => {
    const value = e.target.value;
    setPatientSearch(value);
    if (value.length >= 2 || value.length === 0) {
      fetchPatients(value);
    }
  };

  const toggleInvestigation = (itemId) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  const calculateTotal = () => {
    let total = 0;
    selectedItems.forEach(itemId => {
      const inventoryItem = investigationItems.find(inv => inv.id === itemId);
      if (inventoryItem) {
        total += Number(inventoryItem.unitPrice);
      }
    });
    return total;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validate
    if (!selectedPatient) {
      setError('Please select a patient');
      setLoading(false);
      return;
    }

    if (selectedItems.length === 0) {
      setError('Please select at least one investigation');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/test-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: selectedPatient,
          items: selectedItems.map(itemId => ({
            inventoryItemId: itemId,
            quantity: 1,
            urgency: 'ROUTINE',
            notes: '',
          })),
          clinicalNotes,
          requestedBy,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Test request created successfully');
        setTimeout(() => {
          router.push('/dashboard/test-requests');
        }, 2000);
      } else {
        setError(data.error || 'Failed to create test request');
      }
    } catch (err) {
      setError('Failed to create test request');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedPatient = () => {
    return patients.find(p => p.id === selectedPatient);
  };

  const getCategoryBadge = (category) => {
    const colors = {
      LAB_TEST: 'bg-blue-100 text-blue-800',
      RADIOLOGY: 'bg-purple-100 text-purple-800',
      PROCEDURE: 'bg-green-100 text-green-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">New Test Request</h1>
        <p className="text-gray-600 mt-2">Create a new test request for a patient</p>
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

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        {/* Patient Selection */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Patient Information</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Patient
            </label>
            <input
              type="text"
              value={patientSearch}
              onChange={handlePatientSearch}
              placeholder="Search by MRN, name, phone..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Patient <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loadingPatients}
            >
              <option value="">-- Select Patient --</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.patientNumber} - {patient.firstName} {patient.lastName} ({patient.gender}, {patient.phone || 'No phone'})
                </option>
              ))}
            </select>
          </div>

          {getSelectedPatient() && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h3 className="font-semibold text-blue-900">Selected Patient:</h3>
              <p className="text-blue-800">
                {getSelectedPatient().firstName} {getSelectedPatient().lastName} ({getSelectedPatient().patientNumber})
              </p>
              <p className="text-sm text-blue-700">
                {getSelectedPatient().gender} • {getSelectedPatient().phone || 'No phone'}
              </p>
              {getSelectedPatient().allergies && (
                <p className="text-sm text-red-600 mt-1">
                  ⚠️ Allergies: {getSelectedPatient().allergies}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Investigations Selection */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Select Investigations ({selectedItems.length} selected)
          </h2>

          {loadingItems ? (
            <div className="p-8 text-center text-gray-600">
              Loading investigations...
            </div>
          ) : investigationItems.length === 0 ? (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-center text-gray-600">
              No investigations available
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {investigationItems.map((inv) => (
                <div
                  key={inv.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedItems.includes(inv.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                  onClick={() => toggleInvestigation(inv.id)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(inv.id)}
                      onChange={() => toggleInvestigation(inv.id)}
                      className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{inv.itemName}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded ${getCategoryBadge(inv.category)}`}>
                          {inv.category.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">[{inv.itemCode}]</p>
                      {inv.description && (
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{inv.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-blue-600">
                          ${Number(inv.unitPrice).toFixed(2)}
                        </span>
                        {inv.requiresSample && (
                          <span className="text-xs text-gray-500">📋 Sample required</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clinical Information */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Clinical Information</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clinical Notes (Optional)
            </label>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Clinical indication, symptoms, diagnosis..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Requested By (Optional)
            </label>
            <input
              type="text"
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Doctor or clinician name..."
            />
          </div>
        </div>

        {/* Summary */}
        {selectedItems.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
            <h3 className="font-semibold text-gray-800 mb-2">Summary</h3>
            <div className="space-y-1 text-sm text-gray-700">
              <p>Total Investigations: <span className="font-semibold">{selectedItems.length}</span></p>
              <p>Total Cost: <span className="font-semibold text-green-600">${calculateTotal().toFixed(2)}</span></p>
              <p className="text-xs text-gray-500 mt-2">
                * An order will be automatically created for billing purposes
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/test-requests')}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            disabled={loading || selectedItems.length === 0 || !selectedPatient}
          >
            {loading ? 'Creating...' : 'Create Test Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
