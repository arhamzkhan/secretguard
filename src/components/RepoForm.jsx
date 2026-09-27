import React, { useState } from 'react';
import { Search, GitBranch, Loader2, KeyRound } from 'lucide-react';

export default function RepoForm({ onScan, loading }) {
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const trimmed = repoUrl.trim();
    if (!trimmed) {
      setError('Please enter a GitHub repository URL.');
      return;
    }

    const pattern = /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/;
    if (!pattern.test(trimmed)) {
      setError('Invalid format. URL must match: https://github.com/owner/repo');
      return;
    }

    onScan(trimmed);
  };

  const setExample = (url) => {
    setRepoUrl(url);
    setError('');
  };

  return (
    <div className="w-full max-w-2xl mx-auto text-center my-8">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-3">
          <KeyRound className="w-3.5 h-3.5" />
          Automated Git Secret Leak Scanner
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-2 font-serif-title">
          Scan Public Repositories for Leaked Secrets
        </h2>
        <p className="text-sm text-gray-400 max-w-lg mx-auto">
          Paste a public GitHub repo URL to detect accidentally committed API keys, tokens, credentials, and private keys.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
            <GitBranch className="w-5 h-5" />
          </div>
          <input
            type="url"
            disabled={loading}
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/user/repo"
            className="w-full pl-12 pr-32 py-3.5 bg-[#121318] border border-[#222530] rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-lg"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-2 bottom-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors shadow"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Scan Repo
              </>
            )}
          </button>
        </div>

        {error && (
          <p className="text-xs text-rose-400 text-left pl-2 font-medium">{error}</p>
        )}
      </form>

      {loading && (
        <div className="mt-6 p-4 rounded-xl bg-[#121318] border border-[#222530] text-left">
          <div className="flex items-center gap-3 text-sm font-medium text-indigo-300 mb-1">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
            <span>Shallow Cloning Default Branch & Scanning Files...</span>
          </div>
          <p className="text-xs text-gray-400 pl-7">
            Git shallow clones take longer than website page scans. Please hold on while we analyze repository text files for secrets.
          </p>
        </div>
      )}

      {!loading && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-500">
          <span>Try quick example:</span>
          <button
            onClick={() => setExample('https://github.com/octocat/Hello-World')}
            className="text-gray-400 hover:text-indigo-400 underline transition-colors"
          >
            octocat/Hello-World
          </button>
        </div>
      )}
    </div>
  );
}
