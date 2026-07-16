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
    const isLapor = textBody.startsWith('/lapor') || textBody.startsWith('!lapor') || textBody.startsWith('#lapor') || textBody.startsWith('lapor');
    const isMasuk = textBody.startsWith('/masuk') || textBody.startsWith('!masuk') || textBody.startsWith('#masuk') || textBody.startsWith('masuk');
    const isIzin = textBody.startsWith('/izin') || textBody.startsWith('!izin') || textBody.startsWith('#izin') || textBody.startsWith('izin');
    
    const isTriggered = isLapor || isMasuk || isIzin;
    
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

    try {
      if (payload.id) {
        await prisma.systemSetting.create({
          data: {
            key: `msg_${payload.id}`,
            value: 'processed'
          }
        });
      }
    } catch (e) {
      // If unique constraint fails, it means it's already being processed!
      return NextResponse.json({ status: 'ignored', reason: 'duplicate message id (db lock)' });
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

    if (isMasuk || isIzin) {
        if (!employeeId) {
            await sendMessage(payload.chat_id, "⚠️ Maaf, nomor HP Anda belum terdaftar di Database Karyawan. Silakan hubungi admin.", payload.id);
            return NextResponse.json({ status: 'success', reason: 'employee not found' });
        }
        
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const existingPresensi = await prisma.attendance.findFirst({
            where: {
                employee_id: employeeId,
                date: { gte: today }
            }
        });
        
        if (existingPresensi) {
            await sendMessage(payload.chat_id, `Halo ${employee?.nama}, Anda sudah tercatat melakukan presensi hari ini (${existingPresensi.status_kehadiran}).`, payload.id);
            return NextResponse.json({ status: 'success', reason: 'already presensi' });
        }
        
        let status: 'HADIR' | 'IZIN' | 'SAKIT' = isMasuk ? 'HADIR' : 'IZIN';
        let notes = isIzin ? (payload.body || '').replace(/^\/?izin\s*/i, '').trim() : '';
        
        await prisma.attendance.create({
            data: {
                employee_id: employeeId,
                date: new Date(),
                status_kehadiran: status,
                alasan: notes || null
            }
        });
        
        await sendMessage(payload.chat_id, `✅ Terima kasih ${employee?.nama}, presensi *${status}* hari ini berhasil dicatat!`, payload.id);
        return NextResponse.json({ status: 'success', reason: 'presensi recorded' });
    }

    const parsedData = await parseWhatsAppReport(payload.body);

    if (!parsedData || !parsedData.report_type || parsedData.report_type === 'NONE') {
      await sendChatPresence(payload.chat_id, 'paused');
      console.log('[Webhook - DIABAIKAN] Pesan terdeteksi sebagai obrolan biasa (Bukan Laporan).');
      if (isLapor) {
        const errorMsg = `⚠️ Maaf, format laporan Anda tidak dipahami oleh sistem.\n\nContoh format yang benar:\n1. /lapor tim produksi mengemas...\n2. /lapor outlet malang omset...\n\nSilakan cek kembali *SOP & Template WhatsApp Report*.`;
        await sendMessage(payload.chat_id, errorMsg, payload.id);
      }
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
        const activities = Array.isArray(data) ? data : [data];
        let totalStokAdded = 0;
        let lastProductShortName = '';

        await prisma.$transaction(async (tx) => {
          for (const activity of activities) {
            await tx.produksi.create({
              data: {
                date: new Date(parsedData.date),
                kegiatan: activity.kegiatan || 'Produksi',
                jenis_produksi: activity.jenis_produksi || null,
                bahan_baku: activity.bahan_baku_kg || null,
                bahan_jadi: activity.hasil_kg || null,
                total_hasil_pcs: activity.hasil_pcs || null,
                hpp_batch: activity.hpp_batch || null,
                employee_id: employeeId
              },
            });

            if (activity.kegiatan === 'Mengemas' && activity.hasil_pcs > 0 && activity.product_key) {
               const product = await tx.product.findUnique({ where: { sku: activity.product_key } });
               if (product) {
                 const newBalance = product.stok + activity.hasil_pcs;
                 await tx.product.update({ where: { id: product.id }, data: { stok: newBalance } });

                 let destId = null;
                 const w = await tx.warehouse.findFirst({ where: { name: { contains: 'Banyuwangi', mode: 'insensitive' } }});
                 if (w) {
                   destId = w.id;
                   const ws = await tx.warehouseStock.findUnique({ where: { warehouse_id_product_id: { warehouse_id: w.id, product_id: product.id } }});
                   if (ws) {
                     await tx.warehouseStock.update({ where: { id: ws.id }, data: { quantity: ws.quantity + activity.hasil_pcs } });
                   } else {
                     await tx.warehouseStock.create({ data: { warehouse_id: w.id, product_id: product.id, quantity: activity.hasil_pcs } });
                   }
                 }

                 await tx.stockTransaction.create({
                   data: {
                     product_id: product.id,
                     type: 'PRODUKSI',
                     flow: 'IN',
                     qty: activity.hasil_pcs,
                     balance: newBalance,
                     description: `Hasil Produksi (${activity.kegiatan})`,
                     date: new Date(parsedData.date),
                     destination_type: 'WAREHOUSE',
                     destination_id: destId,
                     employee_id: employeeId
                   }
                 });
                 totalStokAdded += activity.hasil_pcs;
                 lastProductShortName = product.short_name;
               }
            }
          }
        });
        
        replyMsg = `✅ *${activities.length} Kegiatan Produksi* tanggal ${parsedData.date} dicatat!`;
        if (totalStokAdded > 0) {
          replyMsg += `\nStok ${lastProductShortName || 'Produk'} bertambah ${totalStokAdded} pcs.`;
        }

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
                        employee_id: employeeId
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
                        employee_id: employeeId
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
                          employee_id: employeeId
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

      } else if (parsedData.report_type === 'LOGISTIK_MULTI') {
        const activities = Array.isArray(data) ? data : [data];
        let totalShipments = 0;
        
        await prisma.$transaction(async (tx) => {
          for (const route of activities) {
            const kategori = route.kategori_logistik || 'LAINNYA';
            const srcType = route.source_type?.toUpperCase() || 'WAREHOUSE';
            const srcName = route.source_name || '-';
            const destType = route.destination_type?.toUpperCase() || 'LAINNYA';
            const destName = route.destination_name || '-';
            const items = route.items || [];
            
            // 1. Resolve Source
            let sourceId = null;
            if (srcType === 'WAREHOUSE') {
              const ws = await tx.warehouse.findMany({ where: { name: { contains: srcName, mode: 'insensitive' } }});
              if (ws.length > 1) {
                const names = ws.map(w => w.name).slice(0, 3).join(', ');
                throw new Error(`AMBIGUOUS:Ada lebih dari 1 warehouse dengan kata kunci '${srcName}' (${names}). Mohon copy-paste dan kirim ulang laporan Anda dengan nama yang lebih spesifik.`);
              }
              if (ws.length === 1) sourceId = ws[0].id;
            } else if (srcType === 'OUTLET') {
              const os = await tx.outlet.findMany({ where: { nama: { contains: srcName, mode: 'insensitive' }, OR: [{ status: 'Aktif' }, { status: null }] }});
              if (os.length > 1) {
                const names = os.map(o => o.nama).slice(0, 3).join(', ');
                throw new Error(`AMBIGUOUS:Ada lebih dari 1 outlet aktif dengan kata kunci '${srcName}' (${names}). Mohon copy-paste dan kirim ulang laporan Anda dengan nama yang lebih spesifik.`);
              }
              if (os.length === 1) sourceId = os[0].id;
            }

            // 2. Resolve Destination
            let destId = null;
            let outletId = null;
            let affiliateId = null;
            if (destType === 'WAREHOUSE') {
              const ws = await tx.warehouse.findMany({ where: { name: { contains: destName, mode: 'insensitive' } }});
              if (ws.length > 1) {
                const names = ws.map(w => w.name).slice(0, 3).join(', ');
                throw new Error(`AMBIGUOUS:Ada lebih dari 1 warehouse dengan kata kunci '${destName}' (${names}). Mohon copy-paste dan kirim ulang laporan Anda dengan nama yang lebih spesifik.`);
              }
              if (ws.length === 1) destId = ws[0].id;
            } else if (destType === 'OUTLET') {
              const os = await tx.outlet.findMany({ where: { nama: { contains: destName, mode: 'insensitive' }, OR: [{ status: 'Aktif' }, { status: null }] }});
              if (os.length > 1) {
                const names = os.map(o => o.nama).slice(0, 3).join(', ');
                throw new Error(`AMBIGUOUS:Ada lebih dari 1 outlet aktif dengan kata kunci '${destName}' (${names}). Mohon copy-paste dan kirim ulang laporan Anda dengan nama yang lebih spesifik.`);
              }
              if (os.length === 1) { destId = os[0].id; outletId = os[0].id; }
            } else if (destType === 'AFFILIATE') {
              const as = await tx.affiliate.findMany({ where: { nama: { contains: destName, mode: 'insensitive' } }});
              if (as.length > 1) {
                const names = as.map(a => a.nama).slice(0, 3).join(', ');
                throw new Error(`AMBIGUOUS:Ada lebih dari 1 affiliator dengan kata kunci '${destName}' (${names}). Mohon copy-paste dan kirim ulang laporan Anda dengan nama yang lebih spesifik.`);
              }
              if (as.length === 1) affiliateId = as[0].id;
            }
            
            // 3. Create Shipment Record
            const shipment = await tx.outboundShipment.create({
              data: {
                date: parsedData.date ? new Date(parsedData.date) : new Date(),
                shipment_type: kategori,
                source_type: srcType,
                source_name: srcName,
                destination_type: destType,
                destination_name: destName,
                outlet_id: outletId,
                affiliate_id: affiliateId,
                status: 'SHIPPED',
                employee_id: employeeId,
                notes: kategori === 'SAMPLE' ? `Total Produk: ${route.total_produk || 0} | Biaya Ekspedisi: Rp ${route.biaya_ekspedisi || 0}` : null
              }
            });
            totalShipments++;

            // Optional: If it's a sample, record to distribusiSample table
            if (kategori === 'SAMPLE') {
              await tx.distribusiSample.create({
                data: {
                  date: parsedData.date ? new Date(parsedData.date) : new Date(),
                  jenis_sample: destName,
                  total_produk: route.total_produk || 0,
                  biaya_ekspedisi: route.biaya_ekspedisi || 0,
                  employee_id: employeeId
                }
              });
            }

            // 4. Process Items and Stocks
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

                   // Increment Destination Stock (If internal transfer)
                   if (destType === 'WAREHOUSE' && destId) {
                     const ws = await tx.warehouseStock.findUnique({ where: { warehouse_id_product_id: { warehouse_id: destId, product_id: product.id } }});
                     if (ws) {
                       // If RETUR, add to returned_qty instead of healthy quantity (Based on previous logic)
                       if (kategori === 'RETUR') {
                         await tx.warehouseStock.update({ where: { id: ws.id }, data: { returned_qty: ws.returned_qty + item.qty }});
                       } else {
                         await tx.warehouseStock.update({ where: { id: ws.id }, data: { quantity: ws.quantity + item.qty }});
                       }
                     }
                   } else if (destType === 'OUTLET' && destId) {
                     const os = await tx.outletStock.findUnique({ where: { outlet_id_product_id: { outlet_id: destId, product_id: product.id } }});
                     if (os) await tx.outletStock.update({ where: { id: os.id }, data: { quantity: os.quantity + item.qty }});
                   }
                   
                   // Decrease global product.stok only if it leaves the internal ecosystem (not to warehouse/outlet)
                   // But if RETUR, we also decreased it previously because it becomes isolated.
                   let newBalance = product.stok;
                   if (!['WAREHOUSE', 'OUTLET'].includes(destType) || kategori === 'RETUR') {
                     newBalance -= item.qty;
                     await tx.product.update({ where: { id: product.id }, data: { stok: newBalance }});
                   }
                   
                   await tx.stockTransaction.create({
                     data: {
                       product_id: product.id,
                       type: kategori === 'RETUR' ? 'RETUR' : 'DISTRIBUSI',
                       flow: 'OUT',
                       qty: item.qty,
                       balance: newBalance,
                       description: kategori === 'RETUR' ? `Retur dari ${srcName} ke ${destName}` : `Dari ${srcName} ke ${destName}`,
                       date: parsedData.date ? new Date(parsedData.date) : new Date(),
                       source_type: srcType,
                       source_id: sourceId,
                       destination_type: kategori === 'RETUR' ? 'WAREHOUSE_RETURN' : destType,
                       destination_id: destId,
                       employee_id: employeeId
                     }
                   });
                 }
               }
            }
          }
        }, {
          maxWait: 5000,
          timeout: 20000
        });
        
        replyMsg = `✅ *${totalShipments} Rute Logistik* tanggal ${parsedData.date} berhasil diproses dan dicatat!`;
      }
    } catch (dbError: any) {
      console.error('Database insertion error:', dbError);
      if (dbError?.message && dbError.message.startsWith('AMBIGUOUS:')) {
        replyMsg = `⚠️ Laporan dibatalkan.\n\n${dbError.message.replace('AMBIGUOUS:', '')}`;
      } else {
        replyMsg = `❌ Gagal mencatat laporan ${parsedData.report_type} ke database.`;
      }
    }

    await sendChatPresence(payload.chat_id, 'paused');
    await sendMessage(payload.chat_id, replyMsg, payload.id);

    return NextResponse.json({ status: 'success', parsedData, replyMsg });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ status: 'error', message: 'Internal Server Error' }, { status: 500 });
  }
}
