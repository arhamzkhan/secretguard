import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, GitBranch, Calendar, ExternalLink, RefreshCw, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import FindingItem from './FindingItem';
import Disclaimer from './Disclaimer';

export default function ScanResults({ scanData, onNewScan }) {
  const { results, repo_url, scanned_at } = scanData || {};
  const { findings = [], summary = {}, truncated = false, totalFindings = 0 } = results || {};
  
  const [filterSeverity, setFilterSeverity] = useState('all');

  const highCount = summary.high || 0;
  const mediumCount = summary.medium || 0;
  const lowCount = summary.low || 0;
  const totalCount = totalFindings || findings.length;

  const filteredFindings = findings.filter(f => {
    if (filterSeverity === 'high') return f.severity === 'high';
    if (filterSeverity === 'medium') return f.severity === 'medium';
    return true;
  });

  const formattedDate = scanned_at ? new Date(scanned_at).toLocaleString() : new Date().toLocaleString();

  return (
    <div className="w-full max-w-4xl mx-auto my-8 space-y-6">
      {/* Header Info Card */}
      <div className="bg-[#121318] border border-[#222530] rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#222530]">
          <div>
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono mb-1">
              <GitBranch className="w-3.5 h-3.5" />
              <span>Target Repository</span>
            </div>
            <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2 flex-wrap">
              {repo_url}
              <a
                href={repo_url}
                target="_blank"
                rel="noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onNewScan}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors shadow"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New Scan
            </button>
          </div>
        </div>

        {/* Summary Badges & Stats */}
        <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div 
            onClick={() => setFilterSeverity('all')}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              filterSeverity === 'all' 
                ? 'bg-[#1a1c26] border-indigo-500/50 shadow' 
                : 'bg-[#15171e] border-[#222530] hover:border-gray-700'
            }`}
          >
            <div className="text-xs text-gray-400 mb-1">Total Findings</div>
            <div className="text-2xl font-bold text-white flex items-center gap-2">
              {totalCount}
              {totalCount === 0 && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            </div>
          </div>

          <div 
            onClick={() => setFilterSeverity('high')}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              filterSeverity === 'high' 
                ? 'bg-rose-500/10 border-rose-500/50 shadow' 
                : 'bg-[#15171e] border-[#222530] hover:border-gray-700'
            }`}
          >
            <div className="text-xs text-rose-400 font-semibold mb-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              High Severity
            </div>
            <div className="text-2xl font-bold text-rose-300">{highCount}</div>
          </div>

          <div 
            onClick={() => setFilterSeverity('medium')}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              filterSeverity === 'medium' 
                ? 'bg-amber-500/10 border-amber-500/50 shadow' 
                : 'bg-[#15171e] border-[#222530] hover:border-gray-700'
            }`}
          >
            <div className="text-xs text-amber-400 font-semibold mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Medium Severity
            </div>
            <div className="text-2xl font-bold text-amber-300">{mediumCount}</div>
          </div>

          <div className="p-4 rounded-xl border bg-[#15171e] border-[#222530]">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Scanned At
            </div>
            <div className="text-xs font-mono text-gray-300 truncate mt-1">{formattedDate}</div>
          </div>
        </div>
      </div>

      <Disclaimer />

      {/* Truncation Notice */}
      {truncated && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            <strong>Note:</strong> Total findings exceeded 50. Additional findings were truncated for this scan report.
          </span>
        </div>
      )}

      {/* Findings Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white font-serif-title">
            Detected Secret Findings ({filteredFindings.length})
          </h3>
          {filterSeverity !== 'all' && (
            <button 
              onClick={() => setFilterSeverity('all')}
              className="text-xs text-indigo-400 hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>

        {filteredFindings.length === 0 ? (
          <div className="bg-[#121318] border border-[#222530] rounded-2xl p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h4 className="text-base font-semibold text-white mb-1">Clean Scan — No Secrets Detected</h4>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              No matching credentials or sensitive key patterns were found on the default branch of this repository.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFindings.map((finding, idx) => (
              <FindingItem key={`${finding.file}-${finding.line}-${idx}`} finding={finding} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
