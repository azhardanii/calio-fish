'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SettingItem {
  key: string;
  label: string;
  value: number;
}

const SETTING_DEFINITIONS: SettingItem[] = [
  { key: 'offline_target_bulanan', label: 'Target Bulanan Marketing Offline (Konsinyasi)', value: 0 },
  { key: 'shopee_target_mtd', label: 'Target MTD Shopee', value: 0 },
  { key: 'tiktok_target_mtd', label: 'Target MTD TikTok', value: 0 },
];

function formatRupiah(val: number) {
  return 'Rp ' + val.toLocaleString('id-ID');
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingItem[]>(SETTING_DEFINITIONS);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((map: Record<string, number>) => {
        setSettings((prev) =>
          prev.map((s) => ({ ...s, value: map[s.key] ?? s.value }))
        );
      });
  }, []);

  async function handleSave(key: string) {
    setSaving(true);
    const numVal = parseFloat(editValue.replace(/[^0-9.-]/g, ''));
    if (isNaN(numVal)) {
      setToast('❌ Nilai tidak valid');
      setSaving(false);
      return;
    }

    const item = settings.find((s) => s.key === key);
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: numVal }),
    });

    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value: numVal } : s))
    );
    setEditing(null);
    setEditValue('');
    setSaving(false);
    setToast(`✅ ${item?.label} berhasil diupdate!`);
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">⚙️ Pengaturan Target</h1>
      <p className="text-gray-500 text-sm">
        Ubah target bulanan di sini. Perubahan <strong>tidak</strong> akan mengubah data historis yang sudah tercatat — hanya laporan <strong>baru</strong> yang akan menggunakan target terbaru.
      </p>

      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.startsWith('✅') ? '#22c55e' : '#ef4444',
          color: '#fff', padding: '12px 20px', borderRadius: 8, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          {toast}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Target Penjualan</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {settings.map((s) => (
              <div
                key={s.key}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', background: '#f9fafb', borderRadius: 12,
                  border: '1px solid #e5e7eb',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{s.label}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Key: {s.key}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {editing === s.key ? (
                    <>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="contoh: 5000000"
                        style={{
                          padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db',
                          fontSize: 14, width: 180,
                        }}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSave(s.key)}
                      />
                      <button
                        onClick={() => handleSave(s.key)}
                        disabled={saving}
                        style={{
                          padding: '8px 16px', borderRadius: 8, border: 'none',
                          background: '#3b82f6', color: '#fff', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {saving ? '...' : 'Simpan'}
                      </button>
                      <button
                        onClick={() => { setEditing(null); setEditValue(''); }}
                        style={{
                          padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db',
                          background: '#fff', cursor: 'pointer',
                        }}
                      >
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{
                        fontWeight: 700, fontSize: 18, color: '#059669',
                        fontFamily: 'monospace',
                      }}>
                        {formatRupiah(s.value)}
                      </span>
                      <button
                        onClick={() => { setEditing(s.key); setEditValue(String(s.value)); }}
                        style={{
                          padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db',
                          background: '#fff', cursor: 'pointer', fontWeight: 500,
                        }}
                      >
                        ✏️ Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
