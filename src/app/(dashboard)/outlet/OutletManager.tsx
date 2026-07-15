'use client';

import React, { useState } from 'react';
import { createOutlet, updateOutlet, deleteOutlet } from '@/app/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function OutletManager({ outlets }: { outlets: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);

  const openDetailModal = (outlet: any) => {
    setSelectedOutlet(outlet);
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedOutlet(null);
  };

  const openModal = (outlet?: any) => {
    if (outlet) {
      setFormData(outlet);
      setIsEditing(true);
    } else {
      setFormData({ status: 'Active', order_baru: 0, tagihan: 0, payment: 0, sisa_tagihan: 0 });
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      await updateOutlet(formData.id, formData);
    } else {
      await createOutlet(formData);
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus outlet ini?')) {
      await deleteOutlet(id);
      return true;
    }
    return false;
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Daftar Outlet ({outlets.length})</h2>
        <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow transition-colors">
          + Tambah Outlet
        </button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Nama Outlet</TableHead>
              <TableHead>Kontak & Alamat</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sisa Stok</TableHead>
              <TableHead>Sisa Tagihan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {outlets.map((o) => (
              <TableRow key={o.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openDetailModal(o)}>
                <TableCell className="font-bold">{o.nama}</TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{o.tlp || '-'}</div>
                  <div className="text-xs text-gray-500">{o.alamat || '-'}</div>
                </TableCell>
                <TableCell>
                  {o.status && (
                    <span style={{
                      background: o.status.toLowerCase() === 'non-active' ? '#fee2e2' : '#dcfce7',
                      color: o.status.toLowerCase() === 'non-active' ? '#991b1b' : '#15803d',
                      padding: '2px 8px', borderRadius: 12, fontWeight: 600, fontSize: 12, textTransform: 'uppercase'
                    }}>
                      {o.status}
                    </span>
                  )}
                </TableCell>
                <TableCell>{o.stocks?.reduce((acc: number, s: any) => acc + s.quantity, 0) || 0} pcs</TableCell>
                <TableCell style={{ color: Number(o.sisa_tagihan) > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                  Rp {Number(o.sisa_tagihan).toLocaleString('id-ID')}
                </TableCell>
                <TableCell className="text-right space-x-3">
                  <button onClick={(e) => { e.stopPropagation(); openModal(o); }} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(o.id); }} className="text-red-600 hover:text-red-800 font-medium">Hapus</button>
                </TableCell>
              </TableRow>
            ))}
            {outlets.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  Belum ada data outlet. Silakan tambah data baru.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {isDetailModalOpen && selectedOutlet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">{selectedOutlet.nama}</h3>
              <button onClick={closeDetailModal} className="text-gray-500 hover:text-gray-800 text-xl font-bold">&times;</button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2 space-y-6">
              <div className="rounded-lg overflow-hidden border border-gray-200 h-[400px]">
                <iframe 
                  width="100%" 
                  height="100%" 
                  frameBorder="0" 
                  scrolling="no" 
                  marginHeight={0} 
                  marginWidth={0} 
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedOutlet.alamat || selectedOutlet.nama)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                ></iframe>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <div className="text-xs text-gray-500 font-medium mb-1">Status</div>
                  <div className="font-bold">
                    <span className="px-2 py-1 rounded-full text-xs font-bold uppercase" style={{
                      background: selectedOutlet.status?.toLowerCase() === 'active' ? '#dcfce7' : '#fee2e2',
                      color: selectedOutlet.status?.toLowerCase() === 'active' ? '#15803d' : '#991b1b',
                    }}>
                      {selectedOutlet.status || 'Non-Active'}
                    </span>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <div className="text-xs text-gray-500 font-medium mb-1">PIC Outlet</div>
                  <div className="font-bold">{selectedOutlet.pic || '-'}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <div className="text-xs text-gray-500 font-medium mb-1">No Telepon</div>
                  <div className="font-bold">{selectedOutlet.tlp || '-'}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <div className="text-xs text-gray-500 font-medium mb-1">Sisa Stok (Total)</div>
                  <div className="font-bold text-blue-700">{selectedOutlet.stocks?.reduce((acc: number, s: any) => acc + s.quantity, 0) || 0} pcs</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <div className="text-xs text-gray-500 font-medium mb-1">Order Baru</div>
                  <div className="font-bold text-orange-600">{selectedOutlet.order_baru}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <div className="text-xs text-gray-500 font-medium mb-1">Sisa Tagihan</div>
                  <div className={`font-bold ${Number(selectedOutlet.sisa_tagihan) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Rp {Number(selectedOutlet.sisa_tagihan).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Alamat Lengkap</div>
                <div className="bg-gray-50 p-3 rounded-lg border text-sm">
                  {selectedOutlet.alamat || 'Tidak ada alamat tercatat.'}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-500 mb-2">Rincian Stok Varian</div>
                {selectedOutlet.stocks && selectedOutlet.stocks.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {selectedOutlet.stocks.map((stock: any) => (
                      <div key={stock.id} className={`${stock.quantity > 0 ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100 opacity-70'} p-3 rounded-lg border text-center`}>
                        <div className={`text-xs font-medium mb-1 ${stock.quantity > 0 ? 'text-blue-600' : 'text-gray-500'}`}>{stock.product.short_name || stock.product.name}</div>
                        <div className={`font-bold text-lg ${stock.quantity > 0 ? 'text-blue-900' : 'text-gray-400'}`}>
                          {stock.quantity} <span className="text-xs font-normal">pcs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg border text-center text-sm text-gray-500 italic">
                    Stok varian kosong (Belum ada data stok).
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-6 mt-4 border-t border-gray-100">
              <button onClick={() => { closeDetailModal(); openModal(selectedOutlet); }} className="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium transition-colors">
                Edit Data
              </button>
              <button onClick={async () => {
                const deleted = await handleDelete(selectedOutlet.id);
                if (deleted) closeDetailModal();
              }} className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2 rounded-lg font-medium transition-colors">
                Hapus Outlet
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{isEditing ? 'Edit Outlet' : 'Tambah Outlet'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Outlet</label>
                <input required type="text" className="w-full border rounded p-2" value={formData.nama || ''} onChange={e => setFormData({...formData, nama: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select className="w-full border rounded p-2" value={formData.status || 'Active'} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="Active">Active</option>
                    <option value="Non-Active">Non-Active</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">No Telp</label>
                  <input type="text" className="w-full border rounded p-2" value={formData.tlp || ''} onChange={e => setFormData({...formData, tlp: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alamat</label>
                <textarea className="w-full border rounded p-2" value={formData.alamat || ''} onChange={e => setFormData({...formData, alamat: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Sisa Tagihan (Rp)</label>
                  <input type="number" className="w-full border rounded p-2" value={formData.sisa_tagihan || 0} onChange={e => setFormData({...formData, sisa_tagihan: Number(e.target.value)})} />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} className="px-4 py-2 border rounded hover:bg-gray-50">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
