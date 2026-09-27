import React from 'react';
import { AlertTriangle, Lock, Clock, HardDrive, RefreshCw } from 'lucide-react';

export default function ErrorBanner({ message, onReset }) {
  if (!message) return null;

  let title = "Scan Failed";
  let icon = <AlertTriangle className="w-5 h-5 text-rose-400" />;

  if (message.includes("not found or private")) {
    title = "Repository Unavailable";
    icon = <Lock className="w-5 h-5 text-amber-400" />;
  } else if (message.includes("200MB limit") || message.includes("too large")) {
    title = "Repository Exceeds Size Limit";
    icon = <HardDrive className="w-5 h-5 text-amber-400" />;
  } else if (message.includes("unreachable") || message.includes("timeout")) {
    title = "Clone Timeout";
    icon = <Clock className="w-5 h-5 text-rose-400" />;
  }

  return (
    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-left max-w-2xl mx-auto my-6">
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-rose-500/20 shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-rose-200 mb-1">{title}</h3>
          <p className="text-sm text-gray-300 leading-relaxed">{message}</p>
          
          {onReset && (
            <button
              onClick={onReset}
              className="mt-4 text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Another Repository
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
