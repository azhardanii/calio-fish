'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResetDataSection } from './ResetDataSection';

interface SettingItem {
  key: string;
  label: string;
  value: number;
  unit?: 'currency' | 'pcs' | 'kg';
}

const SETTING_DEFINITIONS: SettingItem[] = [
  { key: 'shopee_target_mtd', label: 'Target MTD Shopee', value: 0, unit: 'currency' },
  { key: 'tiktok_target_mtd', label: 'Target MTD TikTok', value: 0, unit: 'currency' },
  { key: 'target_produksi_pcs', label: 'Target Harian Produksi (Pcs)', value: 200, unit: 'pcs' },
  { key: 'target_produksi_kg', label: 'Target Harian Barang Setengah Jadi (Kg)', value: 50, unit: 'kg' },
];

function formatSettingValue(val: number, unit?: 'currency' | 'pcs' | 'kg') {
  if (unit === 'pcs') {
    return `${val.toLocaleString('id-ID')} Pcs`;
  }
  if (unit === 'kg') {
    return `${val.toLocaleString('id-ID')} Kg`;
  }
  return 'Rp ' + val.toLocaleString('id-ID');
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingItem[]>(SETTING_DEFINITIONS);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((map: Record<string, number>) => {
        setSettings((prev) =>
          prev.map((s) => ({ ...s, value: map[s.key] ?? s.value }))
        );
        setIsLoadingSettings(false);
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
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">⚙️ Pengaturan Sistem</h1>
      <p className="text-gray-500 text-sm">
        Ubah target operasional dan e-commerce di sini. Perubahan <strong>tidak</strong> akan mengubah data historis yang sudah tercatat — hanya laporan <strong>baru</strong> yang akan menggunakan target terbaru.
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
          <CardTitle>Target E-Commerce &amp; Operasional Produksi</CardTitle>
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
                        placeholder={s.unit === 'pcs' ? 'contoh: 200' : s.unit === 'kg' ? 'contoh: 50' : 'contoh: 5000000'}
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
                      {isLoadingSettings ? (
                        <div style={{ width: 22, height: 22, border: '3px solid #e5e7eb', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      ) : (
                        <span style={{
                          fontWeight: 700, fontSize: 18, color: '#059669',
                          fontFamily: 'monospace',
                        }}>
                          {formatSettingValue(s.value, s.unit)}
                        </span>
                      )}
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
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Integrasi WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ padding: '16px 20px', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 600, color: '#111827', marginBottom: 12 }}>Grup WhatsApp yang Dipantau</div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Pilih satu atau lebih grup WhatsApp untuk diproses laporannya oleh sistem (pastikan bot sudah diundang ke dalam grup tersebut).</p>
            <WaGroupSelector />
          </div>
        </CardContent>
      </Card>

      <ResetDataSection />
    </div>
  );
}

function WaGroupSelector() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [groupsRes, settingsRes] = await Promise.all([
          fetch(`/api/whatsapp/groups?t=${Date.now()}`).then(r => r.json()),
          fetch('/api/system-settings').then(r => r.json())
        ]);

        if (groupsRes?.results?.data) {
          setGroups(groupsRes.results.data);
        } else if (groupsRes?.data) {
          setGroups(groupsRes.data);
        } else if (Array.isArray(groupsRes)) {
          setGroups(groupsRes);
        }

        if (settingsRes?.WA_GROUP_ID) {
          setSelectedIds(settingsRes.WA_GROUP_ID.split(',').map((id: string) => id.trim()));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleToggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'WA_GROUP_ID', value: selectedIds.join(',') }),
      });
      setToast('✅ Grup WhatsApp berhasil disimpan!');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setToast('❌ Gagal menyimpan grup');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', marginBottom: 16 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: 14, color: '#6b7280', fontWeight: 500 }}>Memuat daftar grup dari WhatsApp...</div>
    </div>
  );

  return (
    <div>
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
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Cari nama grup..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }}
          onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
          onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
        />
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', marginBottom: 16 }}>
        {groups.length === 0 ? (
          <div style={{ padding: 16, fontSize: 14, color: '#6b7280', textAlign: 'center' }}>Tidak ada grup ditemukan atau GOWA belum terkoneksi.</div>
        ) : (
          groups
            .filter(g => {
              const jid = g.jid || g.id || g.JID;
              const name = g.Name || g.name || g.subject || g.DisplayName || jid;
              return name.toLowerCase().includes(searchQuery.toLowerCase());
            })
            .sort((a, b) => {
              const aJid = a.jid || a.id || a.JID;
              const bJid = b.jid || b.id || b.JID;
              const aChecked = selectedIds.includes(aJid);
              const bChecked = selectedIds.includes(bJid);
              if (aChecked && !bChecked) return -1;
              if (!aChecked && bChecked) return 1;
              return 0;
            })
            .map(g => {
              const jid = g.jid || g.id || g.JID;
              const name = g.Name || g.name || g.subject || g.DisplayName || jid;
            
            // Create initials avatar
            const initials = name.substring(0, 2).toUpperCase();
            const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
            const colorIndex = jid.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % colors.length;
            const bgColor = colors[colorIndex];

            return (
              <label key={jid} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(jid)}
                  onChange={() => handleToggle(jid)}
                  style={{ width: 20, height: 20, accentColor: '#3b82f6', cursor: 'pointer', flexShrink: 0 }}
                />
                
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: bgColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  {initials}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                  <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{jid}</div>
                </div>
              </label>
            );
          })
        )}
      </div>
      <button
        onClick={handleSave}
        disabled={saving || loading}
        style={{
          padding: '10px 24px', borderRadius: 8, border: 'none',
          background: '#3b82f6', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          width: '100%', fontSize: 15, transition: 'background 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
        onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
      >
        {saving ? 'Menyimpan...' : 'Simpan Pengaturan Grup'}
      </button>
    </div>
  );
}
