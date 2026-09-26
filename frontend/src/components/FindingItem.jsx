import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileCode, AlertCircle, AlertTriangle, ShieldCheck, Copy, Check } from 'lucide-react';

export default function FindingItem({ finding }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isHigh = finding.severity === 'high';

  const copyMasked = () => {
    navigator.clipboard.writeText(finding.matchPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#121318] border border-[#222530] rounded-xl overflow-hidden hover:border-gray-700/60 transition-colors">
      <div 
        onClick={() => setExpanded(!expanded)}
        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none bg-[#15171e]"
      >
        <div className="flex items-start md:items-center gap-3">
          <FileCode className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5 md:mt-0" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-white">{finding.file}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#1c1f2b] text-gray-400 border border-[#2b2f42]">
                Line {finding.line}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
              <span>Pattern: <strong className="text-gray-200 font-medium">{finding.pattern}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {/* Severity Badge */}
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
            isHigh 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            {isHigh ? <AlertCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {finding.severity.toUpperCase()}
          </span>

          {/* Masked Preview Badge */}
          <div className="flex items-center gap-1 bg-[#0d0e12] border border-[#262936] rounded-md px-2.5 py-1">
            <span className="font-mono text-xs text-gray-300">{finding.matchPreview}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyMasked();
              }}
              title="Copy masked preview"
              className="text-gray-400 hover:text-white p-0.5"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          <button className="text-gray-400 hover:text-white p-1">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expandable Remediation Section */}
      {expanded && (
        <div className="p-4 border-t border-[#222530] bg-[#0d0e12] text-xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#121318] p-3 rounded-lg border border-[#222530]">
              <div className="font-semibold text-gray-300 mb-1 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"></span>
                What is this?
              </div>
              <p className="text-gray-400 leading-relaxed">{finding.what}</p>
            </div>

            <div className="bg-[#121318] p-3 rounded-lg border border-[#222530]">
              <div className="font-semibold text-amber-300 mb-1 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                Why is it dangerous?
              </div>
              <p className="text-gray-400 leading-relaxed">{finding.why}</p>
            </div>

            <div className="bg-[#121318] p-3 rounded-lg border border-[#222530]">
              <div className="font-semibold text-emerald-300 mb-1 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline" />
                How to fix
              </div>
              <p className="text-gray-400 leading-relaxed">{finding.fix}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
