'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

type Channel = { name: string; mtd: number; target: number };
type FeedItem = { type: string; title: string; sub: string; time: string; color: string };
type ProductStock = { name: string; stok: number };

interface OverviewData {
  filterState: { filter: string; month: string; year: string; filterLabel: string };
  highlightOmset: { title: string; value: number; note: string; isUp: boolean };
  totalOmset: number;
  totalTarget: number;
  totalGap: number;
  totalPersentase: number;
  channels: Channel[];
  chartData: { date: string; displayDate: string; offline: number; online: number }[];
  totalOutlets: number;
  totalSisaTagihan: number;
  totalEmployees: number;
  hadirToday: number;
  attendanceTodayCount: number;
  lowStockProducts: ProductStock[];
  allProducts: ProductStock[];
  recentFeed: FeedItem[];
}

function formatRp(val: number): string {
  if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}M`;
  if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}jt`;
  if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}rb`;
  const str = Math.round(Math.abs(val)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (val < 0 ? '-Rp ' : 'Rp ') + str;
}

function formatRpFull(val: number): string {
  const str = Math.round(Math.abs(val)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (val < 0 ? '-Rp ' : 'Rp ') + str;
}

// Custom tooltip for chart
function ChartTooltip({ active, payload, label, data }: any) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
      boxShadow: '0 4px 20px rgba(10,30,61,0.1)'
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
        {item.displayDate || label}
      </div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: 'var(--muted)' }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{formatRpFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function OverviewClient({ data, isValidating }: { data: OverviewData, isValidating?: boolean }) {
  const router = useRouter();
  const {
    filterState, 
    highlightOmset = { title: 'Omset', value: 0, note: '', isUp: false }, 
    totalOmset, totalTarget, totalGap, totalPersentase,
    channels, chartData, totalOutlets, totalSisaTagihan,
    totalEmployees, hadirToday, attendanceTodayCount,
    lowStockProducts, allProducts, recentFeed,
  } = data as any;
  
  const [customMonth, setCustomMonth] = useState(filterState.month || (new Date().getMonth() + 1).toString());
  const [customYear, setCustomYear] = useState(filterState.year || new Date().getFullYear().toString());
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const handleFilter = (f: string) => {
    if (f === 'custom') {
      router.push(`/overview?filter=custom&month=${customMonth}&year=${customYear}`);
    } else {
      router.push(`/overview?filter=${f}`);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      
      {/* ── FILTER TOOLBAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Overview</h2>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Menampilkan data untuk: <b>{filterState.filterLabel}</b>
          </div>
        </div>
        
        <div style={{ 
          display: 'flex', gap: 8, alignItems: 'center', 
          overflowX: 'auto', whiteSpace: 'nowrap', 
          paddingBottom: 4, 
          WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none',
          maxWidth: '100%'
        }} className="filter-container">
          <style>{`.filter-container::-webkit-scrollbar { display: none; }
          @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
          
          <button 
            onClick={() => handleFilter('this_month')}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid', cursor: 'pointer', flexShrink: 0,
              background: filterState.filter === 'this_month' ? 'var(--ocean-500)' : 'white',
              color: filterState.filter === 'this_month' ? 'white' : 'var(--text)',
              borderColor: filterState.filter === 'this_month' ? 'var(--ocean-500)' : 'var(--border)'
            }}
          >
            Bulan Ini
          </button>

          <button 
            onClick={() => handleFilter('last_month')}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid', cursor: 'pointer', flexShrink: 0,
              background: filterState.filter === 'last_month' ? 'var(--ocean-500)' : 'white',
              color: filterState.filter === 'last_month' ? 'white' : 'var(--text)',
              borderColor: filterState.filter === 'last_month' ? 'var(--ocean-500)' : 'var(--border)'
            }}
          >
            Bulan Lalu
          </button>
          
          <button 
            onClick={() => handleFilter('this_year')}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid', cursor: 'pointer', flexShrink: 0,
              background: filterState.filter === 'this_year' ? 'var(--ocean-500)' : 'white',
              color: filterState.filter === 'this_year' ? 'white' : 'var(--text)',
              borderColor: filterState.filter === 'this_year' ? 'var(--ocean-500)' : 'var(--border)'
            }}
          >
            Tahun Ini
          </button>
          
          <button 
            onClick={() => handleFilter('last_year')}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid', cursor: 'pointer', flexShrink: 0,
              background: filterState.filter === 'last_year' ? 'var(--ocean-500)' : 'white',
              color: filterState.filter === 'last_year' ? 'white' : 'var(--text)',
              borderColor: filterState.filter === 'last_year' ? 'var(--ocean-500)' : 'var(--border)'
            }}
          >
            Tahun Lalu
          </button>

          <button 
            onClick={() => handleFilter('lifetime')}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid', cursor: 'pointer', flexShrink: 0,
              background: filterState.filter === 'lifetime' ? 'var(--ocean-500)' : 'white',
              color: filterState.filter === 'lifetime' ? 'white' : 'var(--text)',
              borderColor: filterState.filter === 'lifetime' ? 'var(--ocean-500)' : 'var(--border)'
            }}
          >
            Lifetime
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'white', padding: '4px 6px', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }}>
            <select 
              value={customMonth} 
              onChange={e => setCustomMonth(e.target.value)}
              style={{ padding: '4px 8px', border: 'none', background: 'transparent', fontSize: 13, outline: 'none', cursor: 'pointer' }}
            >
              {[...Array(12)].map((_, i) => (
                <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', { month: 'short' })}</option>
              ))}
            </select>
            <select 
              value={customYear} 
              onChange={e => setCustomYear(e.target.value)}
              style={{ padding: '4px 8px', border: 'none', background: 'transparent', fontSize: 13, outline: 'none', cursor: 'pointer' }}
            >
              {[2024, 2025, 2026, 2027, 2028].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button 
              onClick={() => handleFilter('custom')}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: filterState.filter === 'custom' ? 'var(--ocean-500)' : 'var(--surface)',
                color: filterState.filter === 'custom' ? 'white' : 'var(--text)'
              }}
            >
              Go
            </button>
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <div className="stat-card">
          <div className="stat-icon si-blue">💰</div>
          <div>
            <div className="stat-val">{formatRp(highlightOmset.value)}</div>
            <div className="stat-lbl">{highlightOmset.title}</div>
            <div className={`stat-delta ${highlightOmset.isUp ? 'delta-up' : 'delta-nt'}`}>
              {highlightOmset.note}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon si-cyan">📊</div>
          <div>
            <div className="stat-val">{formatRp(totalOmset)}</div>
            <div className="stat-lbl">Total Omset</div>
            <div className="stat-delta delta-nt">
              Berdasarkan filter aktif
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon si-sea">🎯</div>
          <div>
            <div className="stat-val">{totalPersentase}%</div>
            <div className="stat-lbl">Progress Target</div>
            <div className={`stat-delta ${totalPersentase >= 100 ? 'delta-up' : totalPersentase >= 70 ? 'delta-nt' : 'delta-dn'}`}>
              {totalPersentase >= 100 ? '🎉 Target Tercapai!' : `Target: ${formatRp(totalTarget)}`}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className={`stat-icon ${totalGap >= 0 ? 'si-sea' : 'si-red'}`}>
            {totalGap >= 0 ? '✅' : '⚠️'}
          </div>
          <div>
            <div className="stat-val" style={{ color: totalGap >= 0 ? 'var(--seafoam)' : 'var(--coral)' }}>
              {formatRp(Math.abs(totalGap))}
            </div>
            <div className="stat-lbl">{totalGap >= 0 ? 'Surplus dari Target' : 'Kurang dari Target'}</div>
            <div className={`stat-delta ${totalGap >= 0 ? 'delta-up' : 'delta-dn'}`}>
              {totalGap >= 0 ? '↑ Ahead of target' : '↓ Gap yang harus dikejar'}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: CHART + PROGRESS ── */}
      <div className="grid-2" style={{ marginBottom: 18 }}>
        {/* Omset Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">📈 Tren Omset</div>
              <div className="card-sub">Perbandingan omset offline vs online ({filterState.filterLabel})</div>
            </div>
          </div>
          <div className="card-body" style={{ height: 280, width: '100%', minHeight: 280 }}>
            {isMounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOffline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--ocean-400)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--ocean-400)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--cyan-400)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--cyan-400)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="displayDate" tick={{ fontSize: 10, fill: 'var(--hint)' }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--hint)' }} tickFormatter={(v) => formatRp(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }} />
                  <Area
                    type="monotone" dataKey="offline" name="Offline" stackId="1"
                    stroke="var(--ocean-400)" fill="url(#colorOffline)" strokeWidth={2}
                  />
                  <Area
                    type="monotone" dataKey="online" name="Online" stackId="1"
                    stroke="var(--cyan-400)" fill="url(#colorOnline)" strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--hint)', fontSize: 13 }}>
                Belum ada data omset
              </div>
            )}
          </div>
        </div>

        {/* Target Progress */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🎯 Progress Target</div>
              <div className="card-sub">Performa per channel ({filterState.filterLabel})</div>
            </div>
          </div>
          <div className="card-body">
            {channels.map((ch: Channel, i: number) => {
              const pct = ch.target > 0 ? Math.min((ch.mtd / ch.target) * 100, 100) : 0;
              const pctDisplay = ch.target > 0 ? ((ch.mtd / ch.target) * 100).toFixed(1) : '0';
              return (
                <div className="pbar-wrap" key={i}>
                  <div className="pbar-top">
                    <span className="pbar-label">{ch.name}</span>
                    <span className="pbar-val">{pctDisplay}%</span>
                  </div>
                  <div className="pbar" style={{ height: 8, marginBottom: 4 }}>
                    <div className="pbar-fill" style={{
                      width: `${pct}%`,
                      background: pct >= 100
                        ? 'linear-gradient(90deg, var(--seafoam), #34D399)'
                        : pct >= 60
                          ? 'linear-gradient(90deg, var(--ocean-400), var(--cyan-400))'
                          : 'linear-gradient(90deg, var(--sand), #FBBF24)',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--hint)' }}>
                    <span>{formatRp(ch.mtd)} tercapai</span>
                    <span>Target: {formatRp(ch.target)}</span>
                  </div>
                </div>
              );
            })}

            {/* Separator */}
            <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0 12px' }} />

            {/* Total */}
            <div className="pbar-wrap">
              <div className="pbar-top">
                <span className="pbar-label" style={{ fontWeight: 700 }}>Total Semua Channel</span>
                <span className="pbar-val" style={{ fontWeight: 700 }}>{totalPersentase}%</span>
              </div>
              <div className="pbar" style={{ height: 10 }}>
                <div className="pbar-fill" style={{
                  width: `${Math.min(totalPersentase, 100)}%`,
                  background: totalPersentase >= 100
                    ? 'linear-gradient(90deg, var(--seafoam), #34D399)'
                    : 'linear-gradient(90deg, var(--ocean-500), var(--cyan-400))',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--hint)', marginTop: 4 }}>
                <span>{formatRp(totalOmset)} dari {formatRp(totalTarget)}</span>
                <span>Gap: <b style={{ color: totalGap >= 0 ? 'var(--seafoam)' : 'var(--coral)' }}>
                  {totalGap >= 0 ? '+' : ''}{formatRp(totalGap)}
                </b></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: MINI STATS + STOCK + FEED ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 14 }}>

        {/* Mini stat cards */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📋 Status Hari Ini</div>
          </div>
          <div className="card-body">
            {/* Outlets */}
            <div className="kpi-block">
              <div className="kpi-label">🏪 Outlet Terdaftar</div>
              <div className="kpi-value" style={{ fontSize: 28 }}>{totalOutlets}</div>
              {totalSisaTagihan > 0 && (
                <div className="kpi-note" style={{ color: 'var(--coral)' }}>
                  ⚠️ Total sisa tagihan: {formatRp(totalSisaTagihan)}
                </div>
              )}
            </div>

            {/* Attendance */}
            <div className="kpi-block">
              <div className="kpi-label">👥 Kehadiran Hari Ini</div>
              <div className="kpi-value" style={{ fontSize: 28 }}>
                {hadirToday}<span style={{ fontSize: 14, color: 'var(--muted)' }}> / {totalEmployees}</span>
              </div>
              <div className="kpi-note">
                {attendanceTodayCount === 0
                  ? 'Belum ada yang absen hari ini'
                  : `${attendanceTodayCount} karyawan sudah lapor presensi`}
              </div>
            </div>
            
            {/* Pengiriman */}
            <div className="kpi-block">
              <div className="kpi-label">🚚 Total Pengiriman</div>
              <div className="kpi-value" style={{ fontSize: 28 }}>
                {(data as any).totalShipments || 0}
              </div>
              <div className="kpi-note" style={{ color: 'var(--ocean-600)' }}>
                📦 {(data as any).totalItemsSent?.toLocaleString('id-ID') || 0} pcs produk terkirim
              </div>
            </div>
          </div>
        </div>

        {/* Stock visualization */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">📦 Sebaran Stok Produk</div>
              <div className="card-sub">
                {lowStockProducts.length > 0
                  ? <span style={{ color: 'var(--coral)' }}>⚠️ {lowStockProducts.length} produk stok rendah di Gudang</span>
                  : 'Populasi produk di Warehouse & Outlet'}
              </div>
            </div>
          </div>
          <div className="card-body">
            {(data as any).stockDistribution && (
              <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>Pabrik (Banyuwangi)</div>
                  <div style={{ fontSize: 16, color: '#1d4ed8', fontWeight: 700 }}>{(data as any).stockDistribution.factoryStok} pcs</div>
                </div>
                <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Cabang (Malang)</div>
                  <div style={{ fontSize: 16, color: '#15803d', fontWeight: 700 }}>{(data as any).stockDistribution.storageStok} pcs</div>
                </div>
                <div style={{ flex: 1, background: '#fdf4ff', border: '1px solid #fbcfe8', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#d946ef', fontWeight: 600 }}>Semua Outlet</div>
                  <div style={{ fontSize: 16, color: '#a21caf', fontWeight: 700 }}>{(data as any).stockDistribution.outletStok} pcs</div>
                </div>
              </div>
            )}
            
            {(data as any).stockDistribution?.totalKerugian > 0 && (
              <div style={{ marginBottom: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>⚠️ Estimasi Kerugian (Retur)</div>
                <div style={{ fontSize: 16, color: '#991b1b', fontWeight: 700 }}>{formatRp((data as any).stockDistribution.totalKerugian)}</div>
              </div>
            )}
            
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
              Total Stok Aktif (Sistem)
            </div>

            {allProducts.map((p: ProductStock, i: number) => {
              const maxStok = Math.max(...allProducts.map((x: ProductStock) => x.stok), 1);
              const pct = (p.stok / maxStok) * 100;
              const isLow = p.stok <= 50;
              return (
                <div className="wh-row" key={i} style={{ padding: '6px 0' }}>
                  <span className="wh-name" style={{ fontSize: 11, color: isLow ? 'var(--coral)' : 'var(--text)' }}>
                    {p.name}
                  </span>
                  <div className="wh-bar-wrap">
                    <div className="wh-bar">
                      <div
                        className={`wh-bar-fill ${isLow ? 'fill-low' : pct > 60 ? 'fill-full' : 'fill-mid'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)',
                    color: isLow ? 'var(--coral)' : 'var(--muted)', minWidth: 40, textAlign: 'right',
                  }}>
                    {p.stok}
                  </span>
                </div>
              );
            })}
            {allProducts.length === 0 && (
              <div style={{ color: 'var(--hint)', fontSize: 12, textAlign: 'center', padding: 20 }}>
                Belum ada produk terdaftar
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🔔 Aktivitas Terbaru</div>
              <div className="card-sub">Log otomatis dari semua modul</div>
            </div>
          </div>
          <div className="card-body">
            {recentFeed.length > 0 ? (
              recentFeed.map((item: FeedItem, i: number) => (
                <div className="feed-item" key={i}>
                  <div className={`feed-icon ${item.color}`}>{item.type}</div>
                  <div className="feed-text">
                    <div className="feed-title">{item.title}</div>
                    <div className="feed-sub">{item.sub}</div>
                  </div>
                  <div className="feed-time">{item.time}</div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--hint)', fontSize: 12, textAlign: 'center', padding: 20 }}>
                Belum ada aktivitas tercatat
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
