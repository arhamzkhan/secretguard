import React, { useState } from 'react';
import Header from './components/Header';
import RepoForm from './components/RepoForm';
import ScanResults from './components/ScanResults';
import ErrorBanner from './components/ErrorBanner';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [scanData, setScanData] = useState(null);
  const [error, setError] = useState(null);

  const handleScan = async (repoUrl) => {
    setLoading(true);
    setError(null);
    setScanData(null);

    try {
      const response = await fetch('/api/scan-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete repository scan.');
      }

      setScanData(data);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred while communicating with the server.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setScanData(null);
    setError(null);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0c] text-gray-200">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {error && (
          <ErrorBanner message={error} onReset={handleReset} />
        )}

        {!scanData ? (
          <RepoForm onScan={handleScan} loading={loading} />
        ) : (
          <ScanResults scanData={scanData} onNewScan={handleReset} />
        )}
      </main>

      <footer className="border-t border-[#222530] py-6 px-6 text-center text-xs text-gray-500">
        <p>SecretGuard v1 — Git Secret Leak Detector • Built for Security Portfolios</p>
      </footer>
    </div>
  );
}
