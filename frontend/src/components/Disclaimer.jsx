import React from 'react';
import { Info } from 'lucide-react';

export default function Disclaimer() {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 my-4">
      <Info className="w-4 h-4 text-amber-400 shrink-0" />
      <span>
        <strong>Disclaimer:</strong> Scans the current state of the default branch only — not full commit history.
      </span>
    </div>
  );
}
