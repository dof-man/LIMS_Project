'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function PrintInvestigationResultPage({ params }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchResult();
  }, [params.id]);

  const fetchResult = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/investigation-results/${params.id}/print`);
      const data = await response.json();

      if (response.ok) {
        setResult(data.result);
        // Auto-print after data loads
        setTimeout(() => {
          window.print();
        }, 500);
      } else {
        setError(data.error || 'Failed to load result');
      }
    } catch (err) {
      setError('Failed to load result');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const age = Math.floor((new Date() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
    return `${age} years`;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      radiology: 'Radiology Report',
      pathology: 'Pathology Report',
      other_investigations: 'Investigation Report'
    };
    return labels[category] || 'Investigation Report';
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading report...</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: 'red' }}>{error || 'Report not found'}</p>
      </div>
    );
  }

  const patient = result.testRequestItem.testRequest.patient;
  const testRequest = result.testRequestItem.testRequest;
  const investigation = result.testRequestItem.inventoryItem;

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 20mm;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
          
          .no-print {
            display: none !important;
          }
          
          .page-break {
            page-break-after: always;
          }
        }
        
        @media screen {
          .print-container {
            max-width: 210mm;
            margin: 20px auto;
            padding: 20mm;
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
        }
        
        body {
          font-family: Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.6;
          color: #000;
        }
        
        .header {
          border-bottom: 3px solid #333;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        
        .header h1 {
          margin: 0;
          font-size: 24pt;
          color: #333;
        }
        
        .header .subtitle {
          margin: 5px 0 0 0;
          font-size: 12pt;
          color: #666;
        }
        
        .section {
          margin-bottom: 20px;
        }
        
        .section-title {
          font-size: 14pt;
          font-weight: bold;
          color: #333;
          border-bottom: 2px solid #ddd;
          padding-bottom: 5px;
          margin-bottom: 10px;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: 150px 1fr;
          gap: 8px;
          margin-bottom: 10px;
        }
        
        .info-label {
          font-weight: bold;
          color: #555;
        }
        
        .info-value {
          color: #000;
        }
        
        .report-content {
          padding: 15px;
          background-color: #fafafa;
          border: 1px solid #ddd;
          border-radius: 5px;
          white-space: pre-wrap;
          font-family: 'Courier New', monospace;
          font-size: 10pt;
          line-height: 1.5;
        }
        
        .subsection {
          margin-top: 15px;
        }
        
        .subsection-title {
          font-size: 12pt;
          font-weight: bold;
          color: #444;
          margin-bottom: 8px;
        }
        
        .validation-badge {
          display: inline-block;
          padding: 5px 15px;
          border-radius: 5px;
          font-weight: bold;
          margin-top: 5px;
        }
        
        .validation-validated {
          background-color: #d4edda;
          color: #155724;
          border: 2px solid #c3e6cb;
        }
        
        .validation-completed {
          background-color: #fff3cd;
          color: #856404;
          border: 2px solid #ffeeba;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #ddd;
          font-size: 9pt;
          color: #666;
        }
        
        .signature-section {
          margin-top: 40px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }
        
        .signature-box {
          border-top: 1px solid #333;
          padding-top: 10px;
        }
        
        .signature-label {
          font-weight: bold;
          font-size: 10pt;
        }
        
        .no-print-button {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 10px 20px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14pt;
        }
        
        .no-print-button:hover {
          background-color: #0056b3;
        }
      `}</style>

      <div className="no-print">
        <button onClick={() => window.print()} className="no-print-button">
          🖨️ Print
        </button>
        <button 
          onClick={() => router.back()} 
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14pt'
          }}
        >
          ← Back
        </button>
      </div>

      <div className="print-container">
        {/* Header */}
        <div className="header">
          <h1>{getCategoryLabel(investigation.category)}</h1>
          <p className="subtitle">Clinical Investigation Services</p>
        </div>

        {/* Patient Information */}
        <div className="section">
          <div className="section-title">Patient Information</div>
          <div className="info-grid">
            <div className="info-label">Patient Name:</div>
            <div className="info-value">{patient.firstName} {patient.lastName}</div>
            
            <div className="info-label">MRN:</div>
            <div className="info-value">{patient.patientNumber}</div>
            
            <div className="info-label">Date of Birth:</div>
            <div className="info-value">{new Date(patient.dateOfBirth).toLocaleDateString()}</div>
            
            <div className="info-label">Age:</div>
            <div className="info-value">{calculateAge(patient.dateOfBirth)}</div>
            
            <div className="info-label">Gender:</div>
            <div className="info-value">{patient.gender}</div>
            
            {patient.phoneNumber && (
              <>
                <div className="info-label">Phone:</div>
                <div className="info-value">{patient.phoneNumber}</div>
              </>
            )}
          </div>
        </div>

        {/* Investigation Information */}
        <div className="section">
          <div className="section-title">Investigation Information</div>
          <div className="info-grid">
            <div className="info-label">Request Number:</div>
            <div className="info-value">{testRequest.requestNumber}</div>
            
            <div className="info-label">Investigation:</div>
            <div className="info-value">{investigation.name}</div>
            
            <div className="info-label">Code:</div>
            <div className="info-value">{investigation.code}</div>
            
            <div className="info-label">Category:</div>
            <div className="info-value">{investigation.category}</div>
            
            <div className="info-label">Priority:</div>
            <div className="info-value">{testRequest.priority}</div>
            
            {result.sample && (
              <>
                <div className="info-label">Sample Number:</div>
                <div className="info-value">{result.sample.sampleNumber}</div>
                
                <div className="info-label">Sample Type:</div>
                <div className="info-value">{result.sample.sampleType}</div>
                
                <div className="info-label">Collection Date:</div>
                <div className="info-value">{formatDate(result.sample.collectionDate)}</div>
              </>
            )}
            
            <div className="info-label">Report Date:</div>
            <div className="info-value">{formatDate(result.reportedDate)}</div>
            
            <div className="info-label">Reported By:</div>
            <div className="info-value">{result.reportedBy}</div>
          </div>
        </div>

        {/* Findings */}
        <div className="section">
          <div className="section-title">Findings</div>
          <div className="report-content">
            {result.findings}
          </div>
        </div>

        {/* Impression */}
        {result.impression && (
          <div className="section">
            <div className="section-title">Impression / Diagnosis</div>
            <div className="report-content">
              {result.impression}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {result.recommendations && (
          <div className="section">
            <div className="section-title">Recommendations</div>
            <div className="report-content">
              {result.recommendations}
            </div>
          </div>
        )}

        {/* Additional Notes */}
        {result.notes && (
          <div className="section">
            <div className="section-title">Additional Notes</div>
            <div className="report-content">
              {result.notes}
            </div>
          </div>
        )}

        {/* Validation Status */}
        <div className="section">
          <div className="section-title">Report Status</div>
          <div className={`validation-badge validation-${result.status}`}>
            {result.status === 'validated' ? '✓ VALIDATED REPORT' : '⚠ PRELIMINARY REPORT'}
          </div>
          
          {result.status === 'validated' && result.validatedBy && (
            <div style={{ marginTop: '10px' }}>
              <div className="info-grid">
                <div className="info-label">Validated By:</div>
                <div className="info-value">{result.validatedBy}</div>
                
                <div className="info-label">Validation Date:</div>
                <div className="info-value">{formatDate(result.validatedDate)}</div>
              </div>
            </div>
          )}
          
          {result.status !== 'validated' && (
            <div style={{ marginTop: '10px', color: '#856404', fontSize: '10pt' }}>
              <strong>Note:</strong> This is a preliminary report and has not been validated yet.
            </div>
          )}
        </div>

        {/* Signatures */}
        <div className="signature-section">
          <div className="signature-box">
            <div className="signature-label">Reported By</div>
            <div style={{ marginTop: '5px' }}>{result.reportedBy}</div>
            <div style={{ marginTop: '5px', fontSize: '9pt', color: '#666' }}>
              {formatDate(result.reportedDate)}
            </div>
          </div>
          
          {result.status === 'validated' && (
            <div className="signature-box">
              <div className="signature-label">Validated By</div>
              <div style={{ marginTop: '5px' }}>{result.validatedBy}</div>
              <div style={{ marginTop: '5px', fontSize: '9pt', color: '#666' }}>
                {formatDate(result.validatedDate)}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="footer">
          <div>Report generated on: {new Date().toLocaleString()}</div>
          <div style={{ marginTop: '5px' }}>
            This report is confidential and intended for medical use only.
          </div>
        </div>
      </div>
    </>
  );
}
