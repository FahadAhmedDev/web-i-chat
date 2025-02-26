import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleGHLCallback } from '../lib/ghl';
import { CheckCircle, XCircle } from 'lucide-react';

export default function GHLCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      // setStatus('error');
      return;
    }

    handleGHLCallback(code).then(success => {
      setStatus(success ? 'success' : 'error');
      setTimeout(() => {
        navigate('/contacts');
      }, 2000);
    });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <h1 className="text-xl font-semibold mt-4">Connecting to GoHighLevel...</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-semibold mt-4">Successfully connected!</h1>
            <p className="text-gray-500 mt-2">Redirecting you back...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            {/* <h1 className="text-xl font-semibold mt-4">Connection failed</h1> */}
            {/* <p className="text-gray-500 mt-2">Please try again</p> */}
            <button
              onClick={() => navigate('/contacts')}
              className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Go back
            </button>
          </>
        )}
      </div>
    </div>
  );
}