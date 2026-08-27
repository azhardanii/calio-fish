'use client';

import React, { useState } from 'react';
import { createOutlet, updateOutlet, deleteOutlet, addPiutang, addPelunasan, adjustOutletStock } from '@/app/actions';
import { mutate } from 'swr';
import { updateOutletProductPrice } from './actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function OutletManager({ outlets, currentUser, employees }: { outlets: any[], currentUser: any, employees: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('STOK');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [newStockQty, setNewStockQty] = useState<number>(0);
  const [stockNote, setStockNote] = useState<string>('');

  const [wilayahFilter, setWilayahFilter] = useState<string>('');

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'PIUTANG' | 'PELUNASAN'>('PIUTANG');
  const [txAmount, setTxAmount] = useState<number | ''>('');
  const [txDesc, setTxDesc] = useState('');
  const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);

  const filteredOutlets = outlets.filter((o) => {
    if (wilayahFilter && o.wilayah !== wilayahFilter) return false;
    return true;
  });

  const uniqueWilayah = Array.from(new Set(outlets.map((o) => o.wilayah).filter(Boolean))) as string[];

  const openDetailModal = (outlet: any) => {
    setSelectedOutlet(outlet);
    setActiveTab('STOK');
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
      setFormData({ status: 'Active', order_baru: 0, tagihan: 0, payment: 0, sisa_tagihan: 0, wilayah: '', pengelola_id: '' });
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
    mutate('/api/data/outlets');
    closeModal();
    if (isDetailModalOpen) closeDetailModal(); // close detail to refresh properly
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus outlet ini?')) {
      await deleteOutlet(id);
      mutate('/api/data/outlets');
      return true;
    }
    return false;
  };

  const openTxModal = (type: 'PIUTANG' | 'PELUNASAN') => {
    setTxType(type);
    setTxAmount('');
    setTxDesc('');
    setTxDate(new Date().toISOString().split('T')[0]);
    setIsTxModalOpen(true);
  };

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutlet || !txAmount) return;
    
    if (txType === 'PIUTANG') {
      await addPiutang(selectedOutlet.id, Number(txAmount), txDesc, txDate);
      
      const newTagihan = Number(selectedOutlet.tagihan) + Number(txAmount);
      const newSisa = newTagihan - Number(selectedOutlet.payment);
      
      setSelectedOutlet({
        ...selectedOutlet,
        tagihan: newTagihan,
        sisa_tagihan: newSisa,
        transactions: [
          {
            id: 'temp-' + Date.now(),
            date: new Date(txDate).toISOString(),
            type: 'PIUTANG',
            amount: Number(txAmount),
            description: txDesc
          },
          ...(selectedOutlet.transactions || [])
        ]
      });
      
    } else {
      await addPelunasan(selectedOutlet.id, Number(txAmount), txDesc, txDate);
      
      const newPayment = Number(selectedOutlet.payment) + Number(txAmount);
      const newSisa = Number(selectedOutlet.tagihan) - newPayment;
      
      setSelectedOutlet({
        ...selectedOutlet,
        payment: newPayment,
        sisa_tagihan: newSisa,
        transactions: [
          {
            id: 'temp-' + Date.now(),
            date: new Date(txDate).toISOString(),
            type: 'PELUNASAN',
            amount: Number(txAmount),
            description: txDesc
          },
          ...(selectedOutlet.transactions || [])
        ]
      });
    }
    
    setIsTxModalOpen(false);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
        <h2 className="text-xl font-bold">Daftar Outlet ({filteredOutlets.length})</h2>
        <div className="flex items-center gap-3">
          <select 
            className="border border-gray-300 rounded-lg p-2 text-sm bg-white min-w-[150px]"
            value={wilayahFilter} 
            onChange={e => setWilayahFilter(e.target.value)}
          >
            <option value="">Semua Wilayah</option>
            {uniqueWilayah.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          {(currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'MITRA') && (
            <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow transition-colors whitespace-nowrap">
              + Tambah Outlet
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Nama Outlet</TableHead>
              <TableHead>Kontak & Alamat</TableHead>
              <TableHead>Pengelola</TableHead>
              <TableHead>Sisa Stok</TableHead>
              <TableHead>Sisa Tagihan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOutlets.map((o) => (
              <TableRow key={o.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openDetailModal(o)}>
                <TableCell>
                  <div className="font-bold">{o.nama}</div>
                  {o.wilayah && <div className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full inline-block mt-1 font-medium">{o.wilayah}</div>}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{o.tlp || '-'}</div>
                  <div className="text-xs text-gray-500">{o.alamat || '-'}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{o.pengelola?.nama || 'Pusat'}</div>
                </TableCell>
                <TableCell>{o.stocks?.reduce((acc: number, s: any) => acc + s.quantity, 0) || 0} pcs</TableCell>
                <TableCell style={{ color: Number(o.sisa_tagihan) > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                  Rp {Number(o.sisa_tagihan).toLocaleString('id-ID')}
                </TableCell>
                <TableCell className="text-right space-x-3">
                  <button onClick={(e) => { e.stopPropagation(); openModal(o); }} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                </TableCell>
              </TableRow>
            ))}
            {filteredOutlets.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  Belum ada data outlet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedOutlet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start md:items-center mb-4 border-b pb-4">
              <div>
                <h3 className="text-2xl font-bold">{selectedOutlet.nama}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {selectedOutlet.wilayah && <span className="text-sm text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-medium">{selectedOutlet.wilayah}</span>}
                  <span className="text-xs text-gray-500 font-medium">Pengelola: {selectedOutlet.pengelola?.nama || 'Pusat'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { openModal(selectedOutlet); }} className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors">
                  Edit Data
                </button>
                {(currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN') && (
                  <button onClick={async () => {
                    const deleted = await handleDelete(selectedOutlet.id);
                    if (deleted) closeDetailModal();
                  }} className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors">
                    Hapus
                  </button>
                )}
                <button onClick={closeDetailModal} className="text-gray-400 hover:text-gray-800 ml-1 text-2xl font-light">&times;</button>
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  <div className="text-xs text-gray-500 font-medium mb-1">No Telepon</div>
                  <div className="font-bold text-sm">{selectedOutlet.tlp || '-'}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <div className="text-xs text-gray-500 font-medium mb-1">Total Tagihan</div>
                  <div className="font-bold text-sm text-slate-700">Rp {Number(selectedOutlet.tagihan).toLocaleString('id-ID')}</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="text-xs text-blue-700 font-medium mb-1">Sisa Tagihan</div>
                  <div className={`font-bold text-sm ${Number(selectedOutlet.sisa_tagihan) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Rp {Number(selectedOutlet.sisa_tagihan).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg overflow-x-auto">
                <button onClick={() => setActiveTab('STOK')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'STOK' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>Stok & Harga</button>
                <button onClick={() => setActiveTab('PENGIRIMAN')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'PENGIRIMAN' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>Riwayat Pengiriman</button>
                <button onClick={() => setActiveTab('KEUANGAN')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'KEUANGAN' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>Keuangan & Tagihan</button>
              </div>

              {activeTab === 'STOK' && (
                <div>
                  {selectedOutlet.stocks && selectedOutlet.stocks.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedOutlet.stocks.map((stock: any) => (
                        <div key={stock.id} className="bg-white p-3 rounded-lg border shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-bold text-slate-800 text-sm">{stock.product.name}</div>
                          </div>
                          
                          {/* Stock Section */}
                          <div className="mb-3 pb-3 border-b border-gray-100">
                            {editingStockId === stock.id ? (
                              <div className="space-y-2 bg-slate-50 p-2 rounded border">
                                <div className="text-xs font-semibold text-slate-600">Sesuaikan Stok</div>
                                <div className="flex gap-2">
                                  <input type="number" className="border rounded px-2 py-1 text-sm w-20" value={newStockQty} onChange={e => setNewStockQty(Number(e.target.value))} />
                                  <input type="text" className="border rounded px-2 py-1 text-sm flex-1" placeholder="Catatan..." value={stockNote} onChange={e => setStockNote(e.target.value)} />
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <button onClick={async () => {
                                    await adjustOutletStock(stock.id, newStockQty, stockNote);
                                    const updated = { ...selectedOutlet };
                                    const sIdx = updated.stocks.findIndex((s: any) => s.id === stock.id);
                                    if(sIdx > -1) updated.stocks[sIdx].quantity = newStockQty;
                                    setSelectedOutlet(updated);
                                    setEditingStockId(null);
                                  }} className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-medium">Simpan Stok</button>
                                  <button onClick={() => setEditingStockId(null)} className="text-xs text-gray-500">Batal</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-500">Stok Tersedia: <span className="font-bold text-slate-700 text-sm">{stock.quantity} pcs</span></div>
                                {(currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN') && (
                                  <button onClick={() => { setEditingStockId(stock.id); setNewStockQty(stock.quantity); setStockNote(''); }} className="text-xs text-blue-600 font-medium hover:underline">✎ Edit Stok</button>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Price Section */}
                          <div>
                            {editingPriceId === stock.id ? (
                              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border">
                                <input type="number" className="border rounded px-2 py-1 text-sm w-full" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} />
                                <button onClick={async () => {
                                  await updateOutletProductPrice(stock.id, newPrice);
                                  const updated = { ...selectedOutlet };
                                  const sIdx = updated.stocks.findIndex((s: any) => s.id === stock.id);
                                  if(sIdx > -1) updated.stocks[sIdx].harga_beli = newPrice;
                                  setSelectedOutlet(updated);
                                  setEditingPriceId(null);
                                }} className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-medium">Simpan</button>
                                <button onClick={() => setEditingPriceId(null)} className="text-xs text-gray-500">Batal</button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-500">Harga Khusus Jual</div>
                                <div className="font-bold text-blue-700 text-sm flex items-center gap-2">
                                  Rp {Number(stock.harga_beli || stock.product.base_price).toLocaleString('id-ID')}
                                  <button onClick={() => { setEditingPriceId(stock.id); setNewPrice(Number(stock.harga_beli || stock.product.base_price)); }} className="text-blue-500 hover:text-blue-700">✎</button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-6 rounded-lg border text-center text-sm text-gray-500 italic">
                      Belum ada stok produk di outlet ini.
                    </div>
                  )}

                  <div className="mt-6">
                    <div className="text-sm font-medium text-gray-500 mb-2">Riwayat Penyesuaian Stok</div>
                    <div className="bg-white border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-xs">Tanggal</TableHead>
                            <TableHead className="text-xs">Produk</TableHead>
                            <TableHead className="text-xs">Penyesuaian</TableHead>
                            <TableHead className="text-xs">Stok Akhir</TableHead>
                            <TableHead className="text-xs">Keterangan & PIC</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOutlet.stock_history?.map((tx: any) => (
                            <TableRow key={tx.id}>
                              <TableCell className="text-xs">{new Date(tx.date).toLocaleDateString('id-ID')}</TableCell>
                              <TableCell className="text-xs font-medium">{tx.product.name}</TableCell>
                              <TableCell className="text-xs">
                                <span className={`font-bold ${tx.flow === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                  {tx.flow === 'IN' ? '+' : '-'}{tx.qty}
                               </span>
                              </TableCell>
                              <TableCell className="text-xs font-bold">{tx.balance}</TableCell>
                              <TableCell className="text-xs">
                                <div className="text-gray-600">{tx.description}</div>
                                {tx.employee && <div className="text-[10px] text-indigo-500 font-medium mt-0.5">PIC: {tx.employee.nama}</div>}
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!selectedOutlet.stock_history || selectedOutlet.stock_history.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-xs text-gray-400 py-6">Belum ada riwayat penyesuaian stok.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'PENGIRIMAN' && (
                <div>
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-xs">Tanggal</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Produk Dikirim</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOutlet.shipments?.map((ship: any) => (
                          <TableRow key={ship.id}>
                            <TableCell className="text-xs">{new Date(ship.date).toLocaleDateString('id-ID')}</TableCell>
                            <TableCell className="text-xs font-bold text-blue-600">{ship.status}</TableCell>
                            <TableCell className="text-xs">
                              <ul className="list-disc pl-4 space-y-1">
                                {ship.items?.map((item: any) => (
                                  <li key={item.id}>{item.product.name} ({item.qty} pcs)</li>
                                ))}
                              </ul>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!selectedOutlet.shipments || selectedOutlet.shipments.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-xs text-gray-400 py-6">Belum ada riwayat pengiriman.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {activeTab === 'KEUANGAN' && (
                <div className="space-y-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openTxModal('PIUTANG')} className="bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors border border-red-100 flex items-center gap-1">
                      <span className="text-lg leading-none">+</span> Input Piutang
                    </button>
                    <button onClick={() => openTxModal('PELUNASAN')} className="bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors border border-green-100 flex items-center gap-1">
                      <span className="text-lg leading-none">+</span> Input Pelunasan
                    </button>
                  </div>
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-xs">Tanggal</TableHead>
                          <TableHead className="text-xs">Jenis</TableHead>
                          <TableHead className="text-xs">Keterangan</TableHead>
                          <TableHead className="text-right text-xs">Jumlah</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOutlet.transactions?.map((tx: any) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-xs">{new Date(tx.date).toLocaleDateString('id-ID')}</TableCell>
                            <TableCell className="text-xs">
                              <span className={`px-2 py-0.5 rounded-md font-medium text-[11px] uppercase tracking-wider ${tx.type === 'PIUTANG' || tx.type === 'BILLING' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                {tx.type}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-gray-600">{tx.description || '-'}</TableCell>
                            <TableCell className={`text-right text-sm font-bold ${tx.type === 'PIUTANG' || tx.type === 'BILLING' ? 'text-red-600' : 'text-green-600'}`}>
                              Rp {Number(tx.amount).toLocaleString('id-ID')}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!selectedOutlet.transactions || selectedOutlet.transactions.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-xs text-gray-400 py-6">Belum ada riwayat transaksi keuangan.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {isTxModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${txType === 'PIUTANG' ? 'bg-red-500' : 'bg-green-500'}`}></span>
              {txType === 'PIUTANG' ? 'Input Piutang Baru' : 'Input Pelunasan'}
            </h3>
            <form onSubmit={handleTxSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">Tanggal</label>
                  <input required type="date" className="w-full border rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-400 outline-none transition-all text-sm" value={txDate} onChange={e => setTxDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">Nominal (Rp)</label>
                  <input required type="number" min="0" className="w-full border rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-400 outline-none transition-all text-sm" value={txAmount} onChange={e => setTxAmount(e.target.value ? Number(e.target.value) : '')} placeholder="Contoh: 150000" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Keterangan (Opsional)</label>
                <textarea className="w-full border rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-400 outline-none transition-all" value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="Catatan transaksi..." rows={3} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsTxModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium transition-colors">Batal</button>
                <button type="submit" className={`px-4 py-2 text-white rounded-lg font-medium transition-colors ${txType === 'PIUTANG' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{isEditing ? 'Edit Outlet' : 'Tambah Outlet'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Outlet</label>
                <input required type="text" className="w-full border rounded p-2" value={formData.nama || ''} onChange={e => setFormData({...formData, nama: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Wilayah</label>
                  <input type="text" className="w-full border rounded p-2" value={formData.wilayah || ''} onChange={e => setFormData({...formData, wilayah: e.target.value})} placeholder="Cth: Bandung" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select className="w-full border rounded p-2" value={formData.status || 'Active'} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="Active">Active</option>
                    <option value="Non-Active">Non-Active</option>
                  </select>
                </div>
              </div>
              
              {(currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN') && (
                <div>
                  <label className="block text-sm font-medium mb-1">Pengelola (Mitra)</label>
                  <select className="w-full border rounded p-2" value={formData.pengelola_id || ''} onChange={e => setFormData({...formData, pengelola_id: e.target.value})}>
                    <option value="">-- Dikelola Pusat --</option>
                    {employees.filter(e => e.role === 'MITRA').map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.nama}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">No Telp</label>
                  <input type="text" className="w-full border rounded p-2" value={formData.tlp || ''} onChange={e => setFormData({...formData, tlp: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">PIC</label>
                  <input type="text" className="w-full border rounded p-2" value={formData.pic || ''} onChange={e => setFormData({...formData, pic: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alamat</label>
                <textarea className="w-full border rounded p-2" value={formData.alamat || ''} onChange={e => setFormData({...formData, alamat: e.target.value})} />
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
