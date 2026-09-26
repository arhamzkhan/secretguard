import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function Header() {
  return (
    <header className="border-b border-[#222530] bg-[#0d0e12]/80 backdrop-blur sticky top-0 z-50 py-4 px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-serif-title text-2xl">SecretGuard</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono">v1</span>
            </div>
            <p className="text-xs text-gray-400">Git Secret Leak Detector for Public Repositories</p>
          </div>
        </div>

        <a 
          href="/"
          className="text-xs flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors bg-[#181a22] border border-[#262936] px-3 py-1.5 rounded-lg"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Portfolio
        </a>
      </div>
    </header>
  );
}
