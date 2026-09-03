'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { 
  Users, 
  Store, 
  Factory, 
  CalendarCheck, 
  Clock, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Calendar,
  X
} from 'lucide-react';
import { EmployeeManager } from './EmployeeManager';

export default function KaryawanPage() {
  const { data, isLoading } = useSWR('/api/data/employees');
  const { data: currentUser, isLoading: isUserLoading } = useSWR('/api/auth/me');
  
  // Default to 'karyawan' tab so employee database is immediately visible!
  const [activeTab, setActiveTab] = useState<'karyawan' | 'presensi'>('karyawan');
  
  // Presensi search & filter states
  const [presensiSearch, setPresensiSearch] = useState('');
  const [presensiStatusFilter, setPresensiStatusFilter] = useState('ALL');

  if ((isLoading && !data) || (isUserLoading && !currentUser)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14, fontWeight: 600 }}>Memuat data karyawan &amp; presensi...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const employees = data?.employees || [];
  const attendances = data?.attendances || [];

  // Summary KPI Calculations
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e: any) => e.status_aktif).length;
  const marketingCount = employees.filter((e: any) => 
    (e.role || '').toUpperCase().includes('MARKETING') || (e.posisi || '').toUpperCase().includes('MARKETING')
  ).length;
  const produksiCount = employees.filter((e: any) => 
    (e.role || '').toUpperCase().includes('PRODUKSI') || (e.posisi || '').toUpperCase().includes('PRODUKSI')
  ).length;

  const todayStr = new Date().toDateString();
  const todayAttendances = attendances.filter((a: any) => new Date(a.waktu).toDateString() === todayStr);
  const hadirTodayCount = todayAttendances.filter((a: any) => (a.status_kehadiran || '').toUpperCase() === 'HADIR').length;

  // Filtered attendances
  const filteredAttendances = attendances.filter((a: any) => {
    if (presensiSearch.trim()) {
      const q = presensiSearch.toLowerCase();
      const matchName = (a.employee?.nama || '').toLowerCase().includes(q);
      const matchReason = (a.alasan || '').toLowerCase().includes(q);
      if (!matchName && !matchReason) return false;
    }

    if (presensiStatusFilter !== 'ALL') {
      if ((a.status_kehadiran || '').toUpperCase() !== presensiStatusFilter) return false;
    }

    return true;
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── HEADER TITLE ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
              Database &amp; Tim Karyawan
            </h1>
          </div>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            Direktori master seluruh karyawan internal Calio Fish, penugasan outlet marketing, serta rekap presensi via WhatsApp.
          </p>
        </div>
      </div>

      {/* ── TOP KPI SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Total Karyawan */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
              Total Karyawan
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-gray-900 mt-0.5">
            {totalEmployees} <span className="text-xs font-semibold text-gray-400">Orang</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>{activeEmployees} Karyawan Aktif</span>
          </div>
        </div>

        {/* Card 2: Tim Marketing */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
              Tim Marketing
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-blue-900 mt-0.5">
            {marketingCount} <span className="text-xs font-semibold text-gray-400">Personel</span>
          </div>
          <div className="text-[11px] text-blue-700 font-bold mt-1 truncate">
            Pengelola Outlet Mitra &amp; Booth
          </div>
        </div>

        {/* Card 3: Tim Produksi */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
              Tim Produksi
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Factory className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-indigo-900 mt-0.5">
            {produksiCount} <span className="text-xs font-semibold text-gray-400">Personel</span>
          </div>
          <div className="text-[11px] text-indigo-700 font-bold mt-1 truncate">
            Pabrik &amp; Gudang Penyimpanan
          </div>
        </div>

        {/* Card 4: Presensi Hari Ini */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
              Hadir Hari Ini
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-emerald-700 mt-0.5">
            {hadirTodayCount} <span className="text-xs font-semibold text-gray-400">Hadir</span>
          </div>
          <div className="text-[11px] text-gray-500 font-medium mt-1 truncate">
            {todayAttendances.length} Laporan Presensi Masuk
          </div>
        </div>
      </div>

      {/* ── NAVIGATION PILL TOGGLE (DATABASE KARYAWAN ACTIVE BY DEFAULT) ── */}
      <div className="flex items-center gap-2 p-1.5 bg-gray-100/90 border border-gray-200/80 rounded-2xl w-fit max-w-full">
        <button
          onClick={() => setActiveTab('karyawan')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer select-none ${
            activeTab === 'karyawan'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Database Karyawan</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === 'karyawan' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
          }`}>
            {employees.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('presensi')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer select-none ${
            activeTab === 'presensi'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Riwayat Presensi WA</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === 'presensi' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
          }`}>
            {attendances.length}
          </span>
        </button>
      </div>

      {/* ── TAB CONTENT 1: DATABASE KARYAWAN (DEFAULT DIRECT ACCESS) ── */}
      {activeTab === 'karyawan' && (
        <div className="animate-in fade-in duration-200">
          <EmployeeManager employees={employees} currentUser={currentUser} />
        </div>
      )}

      {/* ── TAB CONTENT 2: RIWAYAT PRESENSI WA ── */}
      {activeTab === 'presensi' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Presensi Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200/90 shadow-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari nama karyawan atau keterangan..."
                value={presensiSearch}
                onChange={(e) => setPresensiSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              {presensiSearch && (
                <button
                  onClick={() => setPresensiSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={presensiStatusFilter}
              onChange={(e) => setPresensiStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">Semua Status Presensi</option>
              <option value="HADIR">Hadir</option>
              <option value="IZIN">Izin</option>
              <option value="SAKIT">Sakit</option>
            </select>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">TANGGAL &amp; WAKTU</th>
                    <th className="py-3.5 px-4">NAMA KARYAWAN</th>
                    <th className="py-3.5 px-4 text-center">STATUS KEHADIRAN</th>
                    <th className="py-3.5 px-4">ALASAN / KETERANGAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAttendances.map((a: any) => {
                    const status = (a.status_kehadiran || '').toUpperCase();
                    const isHadir = status === 'HADIR';
                    const isIzin = status === 'IZIN';

                    return (
                      <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900">
                            {new Date(a.waktu).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span>{new Date(a.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900">{a.employee?.nama || 'Karyawan'}</div>
                          <div className="text-[11px] text-gray-400">{a.employee?.posisi || a.employee?.role || ''}</div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isHadir 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : isIzin 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-gray-600">
                          {a.alasan || <span className="text-gray-400 italic">-</span>}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAttendances.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-gray-400">
                        <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <div className="font-semibold text-gray-600">Belum ada riwayat presensi</div>
                        <div className="text-xs text-gray-400 mt-1">Presensi dikirimkan oleh karyawan melalui bot WhatsApp Calio Fish</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (Zero Overlap) */}
          <div className="block md:hidden space-y-3">
            {filteredAttendances.map((a: any) => {
              const status = (a.status_kehadiran || '').toUpperCase();
              const isHadir = status === 'HADIR';
              const isIzin = status === 'IZIN';

              return (
                <div key={a.id} className="bg-white rounded-2xl border border-gray-200/90 p-3.5 shadow-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{a.employee?.nama || 'Karyawan'}</div>
                      <div className="text-[11px] text-gray-400">{a.employee?.posisi || a.employee?.role || ''}</div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      isHadir 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : isIzin 
                        ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>{new Date(a.waktu).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span>•</span>
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>{new Date(a.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                  </div>

                  {a.alasan && (
                    <div className="bg-gray-50 p-2 rounded-xl text-xs text-gray-600">
                      <span className="font-semibold text-gray-500">Alasan: </span>
                      <span>{a.alasan}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredAttendances.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200/90 p-8 text-center text-gray-400">
                <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <div className="font-semibold text-gray-600 text-sm">Belum ada riwayat presensi</div>
                <div className="text-xs text-gray-400 mt-1">Presensi dikirimkan oleh karyawan melalui bot WhatsApp Calio Fish</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
