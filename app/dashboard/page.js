'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { canManageInventory, canCreateOrders } from '@/lib/rbac';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();

      if (!response.ok || !data.authenticated) {
        router.push('/login');
        return;
      }

      setUser(data.user);
      setLoading(false);
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/login');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto',
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem',
          borderBottom: '2px solid #eee',
          paddingBottom: '1rem'
        }}>
          <h1>LIMS Dashboard</h1>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Welcome, {user?.firstName || user?.username}!</h2>
          
          <div style={{ 
            backgroundColor: '#f8f9fa',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            <p><strong>User Information:</strong></p>
            <p>Username: {user?.username}</p>
            <p>Email: {user?.email}</p>
            <p>Role: <span style={{ 
              padding: '0.25rem 0.5rem',
              backgroundColor: getRoleColor(user?.role),
              color: 'white',
              borderRadius: '4px',
              fontSize: '0.9rem'
            }}>{user?.role}</span></p>
            {user?.firstName && <p>Name: {user.firstName} {user.lastName}</p>}
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#e7f3ff',
            borderRadius: '8px',
            border: '1px solid #b8daff'
          }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Patients</h3>
            <p>Manage patient records</p>
            <a href="/dashboard/patients" style={{ color: '#007bff' }}>View Patients →</a>
          </div>

          <div style={{
            padding: '1.5rem',
            backgroundColor: '#fff3cd',
            borderRadius: '8px',
            border: '1px solid #ffeaa7'
          }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Test Requests</h3>
            <p>Create and manage test requests</p>
            <a href="/dashboard/test-requests" style={{ color: '#856404' }}>View Requests →</a>
          </div>

          <div style={{
            padding: '1.5rem',
            backgroundColor: '#d1ecf1',
            borderRadius: '8px',
            border: '1px solid #bee5eb'
          }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Sample Collection</h3>
            <p>Collect samples for lab tests (LAB_STAFF)</p>
            <a href="/dashboard/samples/pending" style={{ color: '#0c5460' }}>Collection Queue →</a>
          </div>

          <div style={{
            padding: '1.5rem',
            backgroundColor: '#d4edda',
            borderRadius: '8px',
            border: '1px solid #c3e6cb'
          }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Lab Results</h3>
            <p>Enter and manage lab test results (LAB_STAFF)</p>
            <a href="/dashboard/lab-results/pending" style={{ color: '#155724', marginRight: '1rem' }}>Results Queue →</a>
            {user?.role === 'SUPERUSER' && (
              <a href="/dashboard/lab-results/validation-queue" style={{ color: '#155724' }}>Validation Queue →</a>
            )}
          </div>

          <div style={{
            padding: '1.5rem',
            backgroundColor: '#e7f3ff',
            borderRadius: '8px',
            border: '1px solid #b3d9ff'
          }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Investigation Results</h3>
            <p>Radiology, pathology, and other investigation reports (LAB_STAFF)</p>
            <a href="/dashboard/investigation-results/pending" style={{ color: '#004085', marginRight: '1rem' }}>Reports Queue →</a>
            {user?.role === 'SUPERUSER' && (
              <a href="/dashboard/investigation-results/validation-queue" style={{ color: '#004085' }}>Validation Queue →</a>
            )}
          </div>

          {canManageInventory(user) && (
            <div style={{
              padding: '1.5rem',
              backgroundColor: '#f8d7da',
              borderRadius: '8px',
              border: '1px solid #f5c6cb'
            }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Inventory</h3>
              <p>Manage inventory and billing</p>
              <a href="/dashboard/inventory" style={{ color: '#721c24' }}>Manage Inventory →</a>
            </div>
          )}

          {canCreateOrders(user) && (
            <div style={{
              padding: '1.5rem',
              backgroundColor: '#e2e3e5',
              borderRadius: '8px',
              border: '1px solid #d6d8db'
            }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Orders</h3>
              <p>Create and manage patient orders</p>
              <a href="/dashboard/orders" style={{ color: '#383d41' }}>View Orders →</a>
            </div>
          )}

          {(user?.role === 'ADMIN' || user?.role === 'SUPERUSER') && (
            <div style={{
              padding: '1.5rem',
              backgroundColor: '#f3e5f5',
              borderRadius: '8px',
              border: '1px solid #e1bee7'
            }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Reports</h3>
              <p>View system reports and analytics (ADMIN)</p>
              <a href="/dashboard/reports" style={{ color: '#4a148c' }}>View Reports →</a>
            </div>
          )}
        </div>

        {(user?.role === 'ADMIN' || user?.role === 'SUPERUSER') && (
          <div style={{ 
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: '#e9ecef',
            borderRadius: '8px'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>Admin Functions</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <a 
                href="/dashboard/users"
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  borderRadius: '4px',
                  textDecoration: 'none'
                }}
              >
                Manage Users
              </a>
              {canManageInventory(user) && (
                <a 
                  href="/dashboard/inventory"
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    borderRadius: '4px',
                    textDecoration: 'none'
                  }}
                >
                  Manage Inventory
                </a>
              )}
              {canCreateOrders(user) && (
                <a 
                  href="/dashboard/orders"
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    borderRadius: '4px',
                    textDecoration: 'none'
                  }}
                >
                  Manage Orders
                </a>
              )}
              <a 
                href="/dashboard/reports"
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  borderRadius: '4px',
                  textDecoration: 'none'
                }}
              >
                Reports
              </a>
              <a 
                href="/dashboard/settings"
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  borderRadius: '4px',
                  textDecoration: 'none'
                }}
              >
                Settings
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getRoleColor(role) {
  switch (role) {
    case 'SUPERUSER':
      return '#dc3545';
    case 'ADMIN':
      return '#007bff';
    case 'LAB_STAFF':
      return '#28a745';
    case 'RECEPTION':
      return '#ffc107';
    default:
      return '#6c757d';
  }
}
