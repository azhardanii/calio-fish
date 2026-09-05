'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function KaryawanErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Karyawan page error caught by boundary:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4 shadow-xs">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        Halaman Karyawan Sedang Menyesuaikan Data
      </h2>
      <p className="text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
        {error?.message || 'Terjadi kendala saat memuat data presensi dan master karyawan. Silakan klik tombol di bawah untuk memuat ulang.'}
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
          <span>Ke Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
