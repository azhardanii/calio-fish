'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard route error caught by boundary:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4 shadow-xs">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        Terjadi Kendala Memuat Halaman
      </h2>
      <p className="text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
        {error?.message || 'Halaman ini sedang memperbarui komponen sistem. Silakan klik tombol muat ulang di bawah.'}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Muat Ulang Halaman</span>
        </button>
        <Link
          href="/overview"
          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          <span>Kembali ke Overview</span>
        </Link>
      </div>
    </div>
  );
}
