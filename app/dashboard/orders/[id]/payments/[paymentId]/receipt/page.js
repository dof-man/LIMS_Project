'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PaymentReceiptPage() {
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const params = useParams();
  const router = useRouter();
  const orderId = params.id;
  const paymentId = params.paymentId;

  useEffect(() => {
    if (orderId && paymentId) {
      fetchData();
    }
  }, [orderId, paymentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch order details
      const orderRes = await fetch(`/api/orders/${orderId}`);
      const orderData = await orderRes.json();
      
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to fetch order');
      }
      
      // Fetch payment details
      const paymentsRes = await fetch(`/api/orders/${orderId}/payments`);
      const paymentsData = await paymentsRes.json();
      
      if (!paymentsRes.ok) {
        throw new Error(paymentsData.error || 'Failed to fetch payments');
      }
      
      const foundPayment = paymentsData.payments.find(p => p.id === paymentId);
      
      if (!foundPayment) {
        throw new Error('Payment not found');
      }
      
      setOrder(orderData.order);
      setPayment(foundPayment);
      setError('');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Loading receipt...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <Link
          href={`/dashboard/orders/${orderId}`}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Order
        </Link>
      </div>
    );
  }

  if (!order || !payment) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8 text-gray-500">Receipt not found</div>
        <Link
          href={`/dashboard/orders/${orderId}`}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Order
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Print/Action Buttons - Hidden when printing */}
      <div className="mb-6 print:hidden flex justify-between items-center">
        <Link
          href={`/dashboard/orders/${orderId}`}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Order
        </Link>
        <button
          onClick={handlePrint}
          className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Receipt
        </button>
      </div>

      {/* Receipt Content */}
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pb-6 border-b-2 border-gray-300">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">PAYMENT RECEIPT</h1>
          <p className="text-gray-600">Laboratory Information Management System</p>
        </div>

        {/* Receipt Details */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Receipt Information</h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Payment Number</p>
                <p className="font-semibold text-gray-900">{payment.paymentNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Date</p>
                <p className="font-semibold text-gray-900">{formatDate(payment.paymentDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Method</p>
                <p className="font-semibold text-gray-900">{payment.paymentMethod.replace('_', ' ')}</p>
              </div>
              {payment.reference && (
                <div>
                  <p className="text-xs text-gray-500">Reference</p>
                  <p className="font-semibold text-gray-900">{payment.reference}</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Order Information</h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Order Number</p>
                <p className="font-semibold text-gray-900">{order.orderNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Order Date</p>
                <p className="font-semibold text-gray-900">{formatDate(order.orderDate)}</p>
              </div>
              {order.patient && (
                <div>
                  <p className="text-xs text-gray-500">Patient</p>
                  <p className="font-semibold text-gray-900">
                    {order.patient.firstName} {order.patient.lastName}
                  </p>
                  <p className="text-xs text-gray-600">{order.patient.patientNumber}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Amount - Highlighted */}
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-8">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Amount Paid</p>
            <p className="text-4xl font-bold text-green-700">{formatCurrency(payment.amount)}</p>
            <div className="mt-4 pt-4 border-t border-green-200">
              <p className="text-sm font-semibold text-gray-700">
                Status: <span className="text-green-600">{payment.status}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Payment Summary for Order */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Order Payment Summary</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Order Total:</span>
              <span className="font-semibold">{formatCurrency(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Amount Paid:</span>
              <span className="font-semibold">{formatCurrency(order.amountPaid)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-300">
              <span className="font-semibold text-gray-700">Balance Due:</span>
              <span className="font-bold text-lg">{formatCurrency(order.balance)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {payment.notes && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Notes</h3>
            <p className="text-gray-700">{payment.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-300">
          <div className="text-center text-sm text-gray-600">
            <p className="mb-2">Thank you for your payment!</p>
            <p className="text-xs">This is an official receipt. Please keep it for your records.</p>
            {payment.receivedBy && (
              <p className="text-xs mt-2">Received by: {payment.receivedBy}</p>
            )}
          </div>
        </div>

        {/* Print timestamp */}
        <div className="mt-4 text-center text-xs text-gray-400 print:block hidden">
          Printed on: {new Date().toLocaleString('en-NG')}
        </div>
      </div>
    </div>
  );
}
