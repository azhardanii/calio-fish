import { NextResponse } from 'next/server';
import { GowaPayload, sendMessage, sendChatPresence, readMessage } from '@/lib/whatsapp';
import { parseWhatsAppReport } from '@/lib/ai-parser';
import { prisma } from '@/lib/prisma';

const ADMIN_PHONE = process.env.WA_ADMIN_PHONE || '6285157991798';
const TARGET_GROUP_ID = process.env.WA_GROUP_ID || '120363293055467760@g.us';

async function updateStock(productKey: string, qty: number, type: string, flow: "IN" | "OUT", description: string, dateStr: string) {
  if (!qty || qty <= 0) return;
  const product = await prisma.product.findUnique({ where: { sku: productKey } });
  if (!product) return;
  
  const newBalance = flow === "IN" ? product.stok + qty : product.stok - qty;
  
  await prisma.product.update({
    where: { id: product.id },
    data: { stok: newBalance }
  });
  
  await prisma.stockTransaction.create({
    data: {
      product_id: product.id,
      type,
      flow,
      qty,
      balance: newBalance,
      description,
      date: new Date(dateStr)
    }
  });
}

const processedMessageIds = new Set<string>();

export async function POST(req: Request) {
  try {
    const body: GowaPayload = await req.json();

    if (body.event !== 'message') {
      return NextResponse.json({ status: 'ignored', reason: 'not a message event' });
    }

    const payload = body.payload;
    if (!payload) return NextResponse.json({ status: 'ignored', reason: 'no payload' });

    const textBody = (payload.body || '').trim().toLowerCase();
    const isTriggered = textBody.startsWith('/lapor') || textBody.startsWith('!lapor') || textBody.startsWith('#lapor') || textBody.startsWith('lapor');
    
    if (!isTriggered) {
      return NextResponse.json({ status: 'ignored', reason: 'no trigger prefix' });
    }

    if (payload.is_from_me) {
      return NextResponse.json({ status: 'ignored', reason: 'message from self' });
    }

    const senderNumber = payload.from || '';
    const sender = payload.from_name || senderNumber || 'Unknown';
    const groupId = payload.chat_id || 'Personal Chat';

    // 1. Cek apakah grup ini dicentang (diizinkan)
    const groupSetting = await prisma.systemSetting.findUnique({ where: { key: 'WA_GROUP_ID' } });
    let allowedGroups = (process.env.WA_GROUP_ID || '120363293055467760@g.us').split(',').map(g => g.trim());
    if (groupSetting && groupSetting.value) {
      allowedGroups = groupSetting.value.split(',').map(g => g.trim()).filter(Boolean);
    }

    if (!allowedGroups.includes(payload.chat_id) && payload.chat_id !== 'TEST_CHAT_ID') {
      return NextResponse.json({ status: 'ignored', reason: 'unauthorized sender, not target group' });
    }

    // Jika sampai di sini, berarti grupnya DICENTANG. Kita cetak log-nya:
    console.log(`\n[Webhook - GRUP TERDAFTAR] Pesan dari: ${sender} (${senderNumber})\nDi Grup ID: ${groupId}\nIsi Pesan:\n${payload.body}\n`);

    // 2. Cek apakah pengirim adalah nomor bot/admin itu sendiri (mencegah infinite loop)
    if (senderNumber.includes(ADMIN_PHONE)) {
      console.log(`[Webhook - DIBATALKAN] Pesan dikirim oleh nomor Admin/Bot sendiri, proses dihentikan.`);
      return NextResponse.json({ status: 'ignored', reason: 'message from bot/admin' });
    }

    if (processedMessageIds.has(payload.id)) {
      return NextResponse.json({ status: 'ignored', reason: 'duplicate message id' });
    }
    processedMessageIds.add(payload.id);
    
    if (processedMessageIds.size > 1000) {
      const firstItem = processedMessageIds.values().next().value;
      if (firstItem) processedMessageIds.delete(firstItem);
    }

    // Lookup employee by phone number
    const cleanPhone = (payload.from || '').replace(/\D/g, '');
    const phoneKey = cleanPhone.length > 8 ? cleanPhone.slice(-8) : cleanPhone;
    const employee = await prisma.employee.findFirst({
      where: { no_hp: { contains: phoneKey } }
    });
    const employeeId = employee ? employee.id : null;

    // Read the message first for a humanized feel
    await readMessage(payload.chat_id, payload.id);
    await sendChatPresence(payload.chat_id, 'composing');
    const parsedData = await parseWhatsAppReport(payload.body);

    if (!parsedData || !parsedData.report_type || parsedData.report_type === 'NONE') {
      await sendChatPresence(payload.chat_id, 'paused');
      console.log('[Webhook - DIABAIKAN] Pesan terdeteksi sebagai obrolan biasa (Bukan Laporan).');
      return NextResponse.json({ status: 'ignored', reason: 'unparseable or casual chat' });
    }

    if (parsedData.is_ambiguous && parsedData.clarification_message) {
      await sendChatPresence(payload.chat_id, 'paused');
      const msg = `⚠️ *Laporan Kurang Jelas*\n\n${parsedData.clarification_message}`;
      await sendMessage(payload.chat_id, msg, payload.id);
      return NextResponse.json({ status: 'clarified', reason: 'requested user clarification', clarification_message: msg });
    }

    let replyMsg = `✅ Laporan *${parsedData.report_type}* tanggal ${parsedData.date} berhasil dicatat!`;
    const data = parsedData.data;

    try {
      if (parsedData.report_type === 'PRODUKSI_HASIL') {
        await prisma.$transaction(async (tx) => {
          await tx.produksi.create({
            data: {
              date: new Date(parsedData.date),
              kegiatan: data.kegiatan || 'Produksi',
              jenis_produksi: data.jenis_produksi || null,
              bahan_baku: data.bahan_baku_kg || null,
              bahan_jadi: data.hasil_kg || null,
              total_hasil_pcs: data.hasil_pcs || null,
              hpp_batch: data.hpp_batch || null,
              employee_id: employeeId
            },
          });

          if (data.kegiatan === 'Mengemas' && data.hasil_pcs > 0 && data.product_key) {
             const product = await tx.product.findUnique({ where: { sku: data.product_key } });
             if (product) {
               const newBalance = product.stok + data.hasil_pcs;
               await tx.product.update({ where: { id: product.id }, data: { stok: newBalance } });

               let destId = null;
               const w = await tx.warehouse.findFirst({ where: { name: { contains: 'Banyuwangi', mode: 'insensitive' } }});
               if (w) {
                 destId = w.id;
                 const ws = await tx.warehouseStock.findUnique({ where: { warehouse_id_product_id: { warehouse_id: w.id, product_id: product.id } }});
                 if (ws) {
                   await tx.warehouseStock.update({ where: { id: ws.id }, data: { quantity: ws.quantity + data.hasil_pcs } });
                 } else {
                   await tx.warehouseStock.create({ data: { warehouse_id: w.id, product_id: product.id, quantity: data.hasil_pcs } });
                 }
               }

               await tx.stockTransaction.create({
                 data: {
                   product_id: product.id,
                   type: 'PRODUKSI',
                   flow: 'IN',
                   qty: data.hasil_pcs,
                   balance: newBalance,
                   description: `Hasil Produksi (${data.kegiatan})`,
                   date: new Date(parsedData.date),
                   destination_type: 'WAREHOUSE',
                   destination_id: destId
                 }
               });
               replyMsg = `✅ *Produksi Hasil* ${parsedData.date} dicatat!\nStok ${product.short_name} bertambah ${data.hasil_pcs} pcs.\n📦 Sisa Stok saat ini: *${newBalance.toLocaleString('id-ID')} pcs*`;
             } else {
               replyMsg = `✅ *Produksi Hasil* ${parsedData.date} dicatat! (SKU Produk tidak ditemukan untuk penambahan stok)`;
             }
          } else {
            replyMsg = `✅ *Produksi Hasil* ${parsedData.date} berhasil dicatat!`;
          }
        });

      } else if (parsedData.report_type === 'STOK_BAHAN') {
        await prisma.stokBahan.create({
          data: {
            tanggal: new Date(parsedData.date),
            kategori: data.kategori || '-',
            jenis_ukuran: data.jenis_ukuran || '-',
            masuk: data.masuk || 0,
            keluar: data.keluar || 0,
            employee_id: employeeId
          }
        });
        replyMsg = `✅ *Stok Bahan* (${data.kategori}) berhasil diperbarui!`;

      } else if (parsedData.report_type === 'MARKETING_OFFLINE') {
        await prisma.$transaction(async (tx) => {
          await tx.marketingOffline.create({
            data: {
              date: new Date(parsedData.date),
              jenis_penjualan: data.jenis_penjualan || 'B2B',
              target_bulanan: data.target_bulanan || 0,
              target_new_outlet: data.target_new_outlet || 0,
              jumlah_outlet_aktif: data.jumlah_outlet_aktif || 0,
              total_outlet_baru: data.total_outlet_baru || 0,
              target_omset_harian: data.target_omset_harian || 0,
              omset_harian: data.omset_harian || 0,
              omset_mtd: data.omset_mtd || 0,
              persentase: data.persentase || 0,
              gap: data.gap || 0,
              employee_id: employeeId,
            },
          });

          const items = data.items || [];
          if (items.length > 0) {
            const outletName = data.outlet_name || '-';
            const o = await tx.outlet.findFirst({ where: { nama: { contains: outletName, mode: 'insensitive' } }});
            if (o) {
              for (const item of items) {
                if (item.product_key && item.qty > 0) {
                  const product = await tx.product.findUnique({ where: { sku: item.product_key } });
                  if (product) {
                    const os = await tx.outletStock.findUnique({ where: { outlet_id_product_id: { outlet_id: o.id, product_id: product.id } }});
                    if (os) await tx.outletStock.update({ where: { id: os.id }, data: { quantity: os.quantity - item.qty }});
                    
                    const newBalance = product.stok - item.qty;
                    await tx.product.update({ where: { id: product.id }, data: { stok: newBalance }});
                    
                    await tx.stockTransaction.create({
                      data: {
                        product_id: product.id,
                        type: 'PENJUALAN',
                        flow: 'OUT',
                        qty: item.qty,
                        balance: newBalance,
                        description: `Penjualan Offline dari Outlet ${o.nama}`,
                        date: new Date(parsedData.date),
                        source_type: 'OUTLET',
                        source_id: o.id,
                        destination_type: 'ENDUSER',
                      }
                    });
                  }
                }
              }
            }
          }
        });
        const tDate = new Date(parsedData.date);
        const startOfMonth = new Date(tDate.getFullYear(), tDate.getMonth(), 1);
        const endOfMonth = new Date(tDate.getFullYear(), tDate.getMonth() + 1, 0, 23, 59, 59, 999);
        const agg = await prisma.marketingOffline.aggregate({
           _sum: { omset_harian: true },
           where: { date: { gte: startOfMonth, lte: endOfMonth } }
        });
        const currentMtd = Number(agg._sum.omset_harian ?? 0);
        const targetObj = await prisma.systemSetting.findUnique({ where: { key: 'offline_target_bulanan' }});
        const targetVal = Number(targetObj?.value ?? 0);
        const gap = Number(targetVal) - Number(currentMtd);
        const percentage = Number(targetVal) > 0 ? ((Number(currentMtd) / Number(targetVal)) * 100).toFixed(1) : 0;

        replyMsg = `✅ *Marketing Offline* ${parsedData.date} tercatat.\n` + 
                   `💰 Omset Hari Ini: Rp ${(data.omset_harian || 0).toLocaleString('id-ID')}\n` +
                   `📈 Total MTD: Rp ${currentMtd.toLocaleString('id-ID')}\n` +
                   `🎯 Kekurangan Target: Rp ${gap > 0 ? gap.toLocaleString('id-ID') : '0 (Tercapai!)'} (${percentage}%)`;

      } else if (parsedData.report_type === 'MARKETING_ONLINE') {
        await prisma.$transaction(async (tx) => {
          await tx.marketingOnline.create({
            data: {
              date: new Date(parsedData.date),
              platform: data.platform || '-',
              target_bulanan: data.target_bulanan || 0,
              target_harian: data.target_harian || 0,
              target_mtd: data.target_mtd || 0,
              omset_harian: data.omset_harian || 0,
              total_omset_mtd: data.total_omset_mtd || 0,
              persentase: data.persentase || 0,
              gap: data.gap || 0,
              employee_id: employeeId,
            }
          });

          const items = data.items || [];
          if (items.length > 0) {
            const srcName = data.source_name || 'Banyuwangi';
            const w = await tx.warehouse.findFirst({ where: { name: { contains: srcName, mode: 'insensitive' } }});
            if (w) {
              for (const item of items) {
                if (item.product_key && item.qty > 0) {
                  const product = await tx.product.findUnique({ where: { sku: item.product_key } });
                  if (product) {
                    const ws = await tx.warehouseStock.findUnique({ where: { warehouse_id_product_id: { warehouse_id: w.id, product_id: product.id } }});
                    if (ws) await tx.warehouseStock.update({ where: { id: ws.id }, data: { quantity: ws.quantity - item.qty }});
                    
                    const newBalance = product.stok - item.qty;
                    await tx.product.update({ where: { id: product.id }, data: { stok: newBalance }});
                    
                    await tx.stockTransaction.create({
                      data: {
                        product_id: product.id,
                        type: 'PENJUALAN',
                        flow: 'OUT',
                        qty: item.qty,
                        balance: newBalance,
                        description: `Penjualan Online (${data.platform}) dari ${w.name}`,
                        date: new Date(parsedData.date),
                        source_type: 'WAREHOUSE',
                        source_id: w.id,
                        destination_type: 'ENDUSER',
                      }
                    });
                  }
                }
              }

              // Create OutboundShipment for unified tracking
              const shipment = await tx.outboundShipment.create({
                data: {
                  date: new Date(parsedData.date),
                  shipment_type: 'ONLINE',
                  source_type: 'WAREHOUSE',
                  source_name: w.name,
                  destination_type: 'E-Commerce',
                  destination_name: data.platform || '-',
                  status: 'SHIPPED',
                  employee_id: employeeId
                }
              });

              for (const item of items) {
                if (item.product_key && item.qty > 0) {
                  const product = await tx.product.findUnique({ where: { sku: item.product_key } });
                  if (product) {
                    await tx.outboundItem.create({
                      data: { shipment_id: shipment.id, product_id: product.id, qty: item.qty }
                    });
                  }
                }
              }

            }
          }
        });
        const tDate = new Date(parsedData.date);
        const startOfMonth = new Date(tDate.getFullYear(), tDate.getMonth(), 1);
        const endOfMonth = new Date(tDate.getFullYear(), tDate.getMonth() + 1, 0, 23, 59, 59, 999);
        const pf = (data.platform || '').toLowerCase();
        const agg = await prisma.marketingOnline.aggregate({
           _sum: { omset_harian: true },
           where: { platform: data.platform, date: { gte: startOfMonth, lte: endOfMonth } }
        });
        const currentMtd = Number(agg._sum.omset_harian ?? 0);
        
        let targetKey = 'shopee_target_mtd';
        if (pf.includes('tiktok')) targetKey = 'tiktok_target_mtd';
        const targetObj = await prisma.systemSetting.findUnique({ where: { key: targetKey }});
        const targetVal = Number(targetObj?.value ?? 0);
        const gap = Number(targetVal) - Number(currentMtd);
        const percentage = Number(targetVal) > 0 ? ((Number(currentMtd) / Number(targetVal)) * 100).toFixed(1) : 0;

        replyMsg = `✅ *Marketing Online (${data.platform})* ${parsedData.date} tercatat.\n` + 
                   `💰 Omset Hari Ini: Rp ${(data.omset_harian || 0).toLocaleString('id-ID')}\n` +
                   `📈 Total MTD: Rp ${currentMtd.toLocaleString('id-ID')}\n` +
                   `🎯 Kekurangan Target: Rp ${gap > 0 ? gap.toLocaleString('id-ID') : '0 (Tercapai!)'} (${percentage}%)`;
      
      } else if (parsedData.report_type === 'MARKETING_ONLINE_MULTI') {
        await prisma.$transaction(async (tx) => {
          for (const entry of data) {
             await tx.marketingOnline.create({
              data: {
                date: new Date(parsedData.date),
                platform: entry.platform || '-',
                target_bulanan: entry.target_bulanan || 0,
                target_harian: entry.target_harian || 0,
                target_mtd: entry.target_mtd || 0,
                omset_harian: entry.omset_harian || 0,
                total_omset_mtd: entry.total_omset_mtd || 0,
                persentase: entry.persentase || 0,
                gap: entry.gap || 0,
                employee_id: employeeId,
              }
            });

            const items = entry.items || [];
            if (items.length > 0) {
              const srcName = entry.source_name || 'Banyuwangi';
              const w = await tx.warehouse.findFirst({ where: { name: { contains: srcName, mode: 'insensitive' } }});
              if (w) {
                for (const item of items) {
                  if (item.product_key && item.qty > 0) {
                    const product = await tx.product.findUnique({ where: { sku: item.product_key } });
                    if (product) {
                      const ws = await tx.warehouseStock.findUnique({ where: { warehouse_id_product_id: { warehouse_id: w.id, product_id: product.id } }});
                      if (ws) await tx.warehouseStock.update({ where: { id: ws.id }, data: { quantity: ws.quantity - item.qty }});
                      
                      const newBalance = product.stok - item.qty;
                      await tx.product.update({ where: { id: product.id }, data: { stok: newBalance }});
                      
                      await tx.stockTransaction.create({
                        data: {
                          product_id: product.id,
                          type: 'PENJUALAN',
                          flow: 'OUT',
                          qty: item.qty,
                          balance: newBalance,
                          description: `Penjualan Online Multi (${entry.platform}) dari ${w.name}`,
                          date: new Date(parsedData.date),
                          source_type: 'WAREHOUSE',
                          source_id: w.id,
                          destination_type: 'ENDUSER',
                        }
                      });
                    }
                  }
                }
              }
            }
          }
        });
        replyMsg = `✅ *Marketing Online Multi-Platform* ${parsedData.date} berhasil dicatat!`;

      } else if (parsedData.report_type === 'JADWAL_KOL') {
        let affiliate = await prisma.affiliate.findFirst({
           where: { nama: { contains: data.nama_kol, mode: 'insensitive' } }
        });
        if (!affiliate) {
           affiliate = await prisma.affiliate.create({
              data: { nama: data.nama_kol, akun_medsos: data.nama_kol }
           });
        }
        await prisma.jadwalKOL.create({
           data: {
              affiliate_id: affiliate.id,
              jadwal_kirim: data.jadwal_kirim ? new Date(data.jadwal_kirim) : null,
              jadwal_pengerjaan: data.jadwal_pengerjaan,
              estimasi_upload: data.estimasi_upload ? new Date(data.estimasi_upload) : null,
              employee_id: employeeId
           }
        });
        replyMsg = `✅ *Jadwal KOL* untuk ${data.nama_kol} berhasil dicatat!`;

      } else if (parsedData.report_type === 'PENGIRIMAN') {
        const srcType = data.source_type?.toUpperCase() || 'WAREHOUSE';
        const srcName = data.source_name || '-';
        const destType = data.destination_type?.toUpperCase() || 'LAINNYA';
        const destName = data.destination_name || '-';
        const items = data.items || [];
        
        await prisma.$transaction(async (tx) => {
          // 1. Resolve Source
          let sourceId = null;
          if (srcType === 'WAREHOUSE') {
            const w = await tx.warehouse.findFirst({ where: { name: { contains: srcName, mode: 'insensitive' } }});
            if (w) sourceId = w.id;
          } else if (srcType === 'OUTLET') {
            const o = await tx.outlet.findFirst({ where: { nama: { contains: srcName, mode: 'insensitive' } }});
            if (o) sourceId = o.id;
          }

          // 2. Resolve Destination
          let destId = null;
          let outletId = null;
          let affiliateId = null;
          if (destType === 'WAREHOUSE') {
            const w = await tx.warehouse.findFirst({ where: { name: { contains: destName, mode: 'insensitive' } }});
            if (w) destId = w.id;
          } else if (destType === 'OUTLET') {
            const o = await tx.outlet.findFirst({ where: { nama: { contains: destName, mode: 'insensitive' } }});
            if (o) { destId = o.id; outletId = o.id; }
          } else if (destType === 'AFFILIATE') {
            const a = await tx.affiliate.findFirst({ where: { nama: { contains: destName, mode: 'insensitive' } }});
            if (a) affiliateId = a.id;
          }
          
          const shipment = await tx.outboundShipment.create({
            data: {
              date: new Date(parsedData.date),
              shipment_type: 'PENGIRIMAN',
              source_type: srcType,
              source_name: srcName,
              destination_type: destType,
              destination_name: destName,
              outlet_id: outletId,
              affiliate_id: affiliateId,
              status: 'SHIPPED',
              employee_id: employeeId
            }
          });

          for (const item of items) {
             if (item.product_key && item.qty > 0) {
               const product = await tx.product.findUnique({ where: { sku: item.product_key } });
               if (product) {
                 await tx.outboundItem.create({
                   data: { shipment_id: shipment.id, product_id: product.id, qty: item.qty }
                 });
                 
                 // Decrement Source Stock
                 if (srcType === 'WAREHOUSE' && sourceId) {
                   const ws = await tx.warehouseStock.findUnique({ where: { warehouse_id_product_id: { warehouse_id: sourceId, product_id: product.id } }});
                   if (ws) await tx.warehouseStock.update({ where: { id: ws.id }, data: { quantity: ws.quantity - item.qty }});
                 } else if (srcType === 'OUTLET' && sourceId) {
                   const os = await tx.outletStock.findUnique({ where: { outlet_id_product_id: { outlet_id: sourceId, product_id: product.id } }});
                   if (os) await tx.outletStock.update({ where: { id: os.id }, data: { quantity: os.quantity - item.qty }});
                 }

                 // Increment Destination Stock
                 if (destType === 'WAREHOUSE' && destId) {
                   const ws = await tx.warehouseStock.findUnique({ where: { warehouse_id_product_id: { warehouse_id: destId, product_id: product.id } }});
                   if (ws) await tx.warehouseStock.update({ where: { id: ws.id }, data: { quantity: ws.quantity + item.qty }});
                 } else if (destType === 'OUTLET' && destId) {
                   const os = await tx.outletStock.findUnique({ where: { outlet_id_product_id: { outlet_id: destId, product_id: product.id } }});
                   if (os) await tx.outletStock.update({ where: { id: os.id }, data: { quantity: os.quantity + item.qty }});
                 }
                 
                 // Note: We DO NOT decrement global product.stok here for internal transfers.
                 // We only decrement it if destination is external (consumptive like Shopee/Enduser)
                 let newBalance = product.stok;
                 if (!['WAREHOUSE', 'OUTLET'].includes(destType)) {
                   newBalance -= item.qty;
                   await tx.product.update({ where: { id: product.id }, data: { stok: newBalance }});
                 }
                 
                 await tx.stockTransaction.create({
                   data: {
                     product_id: product.id,
                     type: 'DISTRIBUSI',
                     flow: 'OUT',
                     qty: item.qty,
                     balance: newBalance,
                     description: `Dari ${srcName} ke ${destName}`,
                     date: new Date(parsedData.date),
                     source_type: srcType,
                     source_id: sourceId,
                     destination_type: destType,
                     destination_id: destId
                   }
                 });
               }
             }
          }
        });
        
        replyMsg = `✅ *Distribusi Logistik* ${parsedData.date}\nDari: ${data.source_name}\nKe: ${destName}\nBerhasil dicatat!`;

      } else if (parsedData.report_type === 'RETUR') {
        const srcName = data.source_name || '-';
        const destName = data.destination_name || 'Banyuwangi';
        const items = data.items || [];
        
        await prisma.$transaction(async (tx) => {
          const w = await tx.warehouse.findFirst({ where: { name: { contains: destName, mode: 'insensitive' } }});
          const o = await tx.outlet.findFirst({ where: { nama: { contains: srcName, mode: 'insensitive' } }});
          
          for (const item of items) {
             if (item.product_key && item.qty > 0) {
               const product = await tx.product.findUnique({ where: { sku: item.product_key } });
               if (product) {
                 // Decrement from Outlet Stock
                 if (o) {
                   const os = await tx.outletStock.findUnique({ where: { outlet_id_product_id: { outlet_id: o.id, product_id: product.id } }});
                   if (os) await tx.outletStock.update({ where: { id: os.id }, data: { quantity: os.quantity - item.qty }});
                 }

                 // Increment Returned Qty in Warehouse
                 if (w) {
                   const ws = await tx.warehouseStock.findUnique({ where: { warehouse_id_product_id: { warehouse_id: w.id, product_id: product.id } }});
                   if (ws) await tx.warehouseStock.update({ where: { id: ws.id }, data: { returned_qty: ws.returned_qty + item.qty }});
                 }
                 
                 // Decrement global active stock
                 const newBalance = product.stok - item.qty;
                 await tx.product.update({ where: { id: product.id }, data: { stok: newBalance }});
                 
                 await tx.stockTransaction.create({
                   data: {
                     product_id: product.id,
                     type: 'RETUR',
                     flow: 'OUT',
                     qty: item.qty,
                     balance: newBalance,
                     description: `Retur dari ${srcName} ke ${destName}`,
                     date: new Date(parsedData.date),
                     source_type: 'OUTLET',
                     source_id: o ? o.id : null,
                     destination_type: 'WAREHOUSE_RETURN',
                     destination_id: w ? w.id : null
                   }
                 });
               }
             }
          }
            // Create OutboundShipment for Retur
            await tx.outboundShipment.create({
              data: {
                date: new Date(parsedData.date),
                shipment_type: 'RETUR',
                source_type: 'OUTLET',
                source_name: o ? o.nama : srcName,
                destination_type: 'WAREHOUSE',
                destination_name: w ? w.name : destName,
                outlet_id: o ? o.id : null,
                notes: 'Retur Kerusakan/Stok Sisa',
                status: 'SHIPPED',
                employee_id: employeeId
              }
            });
        });
        
        replyMsg = `✅ *Retur Produk* ${parsedData.date}\nDari: ${srcName}\nBerhasil dicatat sebagai Estimasi Kerugian!`;

      } else if (parsedData.report_type === 'PEMBERSIHAN') {
        await prisma.pembersihanKulit.create({
          data: {
            date: new Date(parsedData.date),
            bahan_beku_kg: data.bahan_beku_kg || null,
            bahan_bersih_kg: data.bahan_bersih_kg || null,
            employee_id: employeeId
          },
        });
        replyMsg = `✅ *Pembersihan Kulit* ${parsedData.date} berhasil dicatat!`;

      } else if (parsedData.report_type === 'DATABASE_AFFILIATE') {
        await prisma.affiliate.create({
          data: {
            nama: data.nama || '-',
            akun_medsos: data.akun_medsos || '-',
            no_hp: data.no_hp || null,
            alamat: data.alamat || null,
            jenis_postingan: data.jenis_postingan || null,
            media_upload: data.media_upload || null,
            ratecard: data.ratecard || null,
            link_unggahan: data.link_unggahan || null,
          },
        });

      } else if (parsedData.report_type === 'DISTRIBUSI_SAMPLE') {
        await prisma.$transaction(async (tx) => {
          await tx.distribusiSample.create({
            data: {
              date: new Date(parsedData.date),
              jenis_sample: data.jenis_sample || '-',
              total_produk: data.total_produk || 0,
              biaya_ekspedisi: data.biaya_ekspedisi || 0,
              employee_id: employeeId
            },
          });

          await tx.outboundShipment.create({
            data: {
              date: new Date(parsedData.date),
              shipment_type: 'SAMPLE',
              source_type: 'WAREHOUSE',
              source_name: 'Banyuwangi',
              destination_type: 'Sample',
              destination_name: data.jenis_sample || '-',
              notes: `Total Produk: ${data.total_produk} | Biaya Ekspedisi: Rp ${data.biaya_ekspedisi || 0}`,
              status: 'SHIPPED',
              employee_id: employeeId
            }
          });
        });

      } else if (parsedData.report_type === 'PRESENSI') {
        if (!employee) {
          replyMsg = `❌ *Presensi Gagal*\nNomor HP Anda belum terdaftar di Database Karyawan.`;
        } else {
          await prisma.attendance.create({
            data: {
              date: new Date(parsedData.date),
              employee: { connect: { id: employee.id } },
              status_kehadiran: data.status_kehadiran || 'HADIR',
              alasan: data.alasan || null,
            }
          });
          replyMsg = `✅ *Presensi Berhasil*\nNama: ${employee.nama}\nStatus: ${data.status_kehadiran}`;
        }
      }
    } catch (dbError) {
      console.error('Database insertion error:', dbError);
      replyMsg = `❌ Gagal mencatat laporan ${parsedData.report_type} ke database.`;
    }

    await sendChatPresence(payload.chat_id, 'paused');
    await sendMessage(payload.chat_id, replyMsg);

    return NextResponse.json({ status: 'success', parsedData, replyMsg });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ status: 'error', message: 'Internal Server Error' }, { status: 500 });
  }
}
