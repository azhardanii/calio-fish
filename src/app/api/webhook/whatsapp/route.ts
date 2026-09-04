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
    const isSakit = textBody.startsWith('/sakit') || textBody.startsWith('!sakit') || textBody.startsWith('#sakit') || textBody.startsWith('sakit');
    
    // Support structured reports and operational messages even without explicit /lapor prefix
    const structuredKeywords = [
      'kirim barang', 'pengiriman', 'retur', 'sample', 'distribusi',
      'laporan penjualan booth', 'laporan marketing', 'laporan shopee', 'laporan tiktok',
      'pembayaran outlet', 'pelunasan outlet', 'piutang outlet', 'bon outlet',
      'produksi', 'mengemas', 'pembersihan kulit', 'jadwal kol', 'affiliate',
      'booth', 'pameran', 'pengembalian'
    ];
    const isStructuredReport = structuredKeywords.some(kw => textBody.includes(kw));

    const isTriggered = isLapor || isMasuk || isIzin || isSakit || isStructuredReport;
    
    if (!isTriggered) {
      return NextResponse.json({ status: 'ignored', reason: 'no trigger prefix or report keyword' });
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

    if (isMasuk || isIzin || isSakit) {
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
        
        let status: 'HADIR' | 'IZIN' | 'SAKIT' = isMasuk ? 'HADIR' : isSakit ? 'SAKIT' : 'IZIN';
        let notes = isSakit 
          ? (payload.body || '').replace(/^[\/!#]?sakit\s*/i, '').trim()
          : isIzin 
          ? (payload.body || '').replace(/^[\/!#]?izin\s*/i, '').trim() 
          : '';
        
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
        }, { maxWait: 10000, timeout: 60000 });
        
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

      } else if (parsedData.report_type === 'PEMBERSIHAN_KULIT') {
        await prisma.produksi.create({
          data: {
            date: new Date(parsedData.date),
            kegiatan: 'Pembersihan',
            jenis_produksi: 'Pembersihan Kulit',
            bahan_baku: data.berat_beku_kg ? Number(data.berat_beku_kg) : null,
            bahan_jadi: data.hasil_bersih_kg ? Number(data.hasil_bersih_kg) : null,
            employee_id: employeeId
          }
        });
        replyMsg = `✅ *Pembersihan Kulit* tanggal ${parsedData.date} berhasil dicatat!\n` +
                   `🧊 Bahan Baku Beku: ${data.berat_beku_kg || 0} kg\n` +
                   `✨ Hasil Bersih Siap Olah: ${data.hasil_bersih_kg || 0} kg`;

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
              // Validasi role marketing: hanya boleh input ke outlet yang dihandle
              if (employee && (employee.role === 'MARKETING' || employee.role?.includes('MARKETING'))) {
                if (o.pengelola_id !== employee.id) {
                  throw new Error(`AMBIGUOUS:Akses ditolak. Anda (${employee.nama}) tidak memiliki izin untuk menginput laporan ke Outlet '${o.nama}' karena bukan outlet yang ditugaskan kepada Anda.`);
                }
              }
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
        }, { maxWait: 10000, timeout: 60000 });
        const tDate = new Date(parsedData.date);
        const startOfMonth = new Date(tDate.getFullYear(), tDate.getMonth(), 1);
        const endOfMonth = new Date(tDate.getFullYear(), tDate.getMonth() + 1, 0, 23, 59, 59, 999);
        const agg = await prisma.marketingOffline.aggregate({
           _sum: { omset_harian: true },
           where: { date: { gte: startOfMonth, lte: endOfMonth } }
        });
        const currentMtd = Number(agg._sum.omset_harian ?? 0);
        // Ambil target marketing staf terkait atau akumulasi target bulan berjalan dari MarketingTarget
        const staffTarget = employeeId ? await prisma.marketingTarget.findFirst({
          where: {
            employee_id: employeeId,
            bulan: tDate.getMonth() + 1,
            tahun: tDate.getFullYear(),
          }
        }) : null;
        const targetVal = staffTarget ? Number(staffTarget.target_omset) : 0;
        const gap = targetVal > 0 ? targetVal - currentMtd : 0;
        const percentage = targetVal > 0 ? ((currentMtd / targetVal) * 100).toFixed(1) : 0;

        replyMsg = `✅ *Marketing Offline* ${parsedData.date} tercatat.\n` + 
                   `💰 Omset Hari Ini: Rp ${(data.omset_harian || 0).toLocaleString('id-ID')}\n` +
                   `📈 Total MTD: Rp ${currentMtd.toLocaleString('id-ID')}\n` +
                   (targetVal > 0 
                     ? `🎯 Target Anda: Rp ${targetVal.toLocaleString('id-ID')}\n` +
                       `🎯 Kekurangan Target: Rp ${gap > 0 ? gap.toLocaleString('id-ID') : '0 (Tercapai!)'} (${percentage}%)`
                     : `🎯 Target: Belum diset di sistem`);

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
              const insufficientItems: string[] = [];
              for (const item of items) {
                if (item.product_key && item.qty > 0) {
                  const product = await tx.product.findUnique({ where: { sku: item.product_key } });
                  if (!product) {
                    insufficientItems.push(`• *${item.product_key}* (SKU tidak ditemukan di database)`);
                    continue;
                  }
                  const ws = await tx.warehouseStock.findUnique({ where: { warehouse_id_product_id: { warehouse_id: w.id, product_id: product.id } }});
                  const availableQty = ws ? ws.quantity : 0;
                  if (availableQty < item.qty) {
                    insufficientItems.push(`• *${product.name}* (Tersedia: ${availableQty} pcs, Diminta: ${item.qty} pcs)`);
                  }
                }
              }

              if (insufficientItems.length > 0) {
                throw new Error(
                  `BATAL:Stok di gudang *${w.name}* tidak mencukupi untuk pesanan online:\n` +
                  insufficientItems.join('\n') +
                  `\n\nPencatatan penjualan online dibatalkan agar tidak terjadi selisih stok fisik.`
                );
              }

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
        }, { maxWait: 10000, timeout: 60000 });
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
                const insufficientItems: string[] = [];
                for (const item of items) {
                  if (item.product_key && item.qty > 0) {
                    const product = await tx.product.findUnique({ where: { sku: item.product_key } });
                    if (!product) {
                      insufficientItems.push(`• *${item.product_key}* (SKU tidak ditemukan di database)`);
                      continue;
                    }
                    const ws = await tx.warehouseStock.findUnique({ where: { warehouse_id_product_id: { warehouse_id: w.id, product_id: product.id } }});
                    const availableQty = ws ? ws.quantity : 0;
                    if (availableQty < item.qty) {
                      insufficientItems.push(`• *${product.name}* (Tersedia: ${availableQty} pcs, Diminta: ${item.qty} pcs)`);
                    }
                  }
                }

                if (insufficientItems.length > 0) {
                  throw new Error(
                    `BATAL:Stok di gudang *${w.name}* tidak mencukupi untuk pesanan online (${entry.platform}):\n` +
                    insufficientItems.join('\n') +
                    `\n\nPencatatan penjualan online dibatalkan agar tidak terjadi selisih stok fisik.`
                  );
                }

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
        }, { maxWait: 10000, timeout: 60000 });
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

      } else if (parsedData.report_type === 'DATABASE_AFFILIATE') {
        const aff = await prisma.affiliate.create({
          data: {
            nama: data.nama || 'Affiliate Baru',
            akun_medsos: data.akun_medsos || data.nama || '-',
            no_hp: data.no_hp || null,
            alamat: data.alamat || null,
            jenis_postingan: data.jenis_postingan || null,
            media_upload: data.media_upload || null,
            ratecard: data.ratecard ? Number(data.ratecard) : null,
            link_unggahan: data.link_unggahan || null,
          }
        });
        replyMsg = `✅ *Database Affiliate* atas nama ${aff.nama} (@${aff.akun_medsos}) berhasil didaftarkan!`;

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
            let resolvedSourceName = srcName;
            if (srcType === 'WAREHOUSE') {
              const ws = await tx.warehouse.findMany({ where: { name: { contains: srcName, mode: 'insensitive' } }});
              if (ws.length > 1) {
                const names = ws.map(w => w.name).slice(0, 3).join(', ');
                throw new Error(`AMBIGUOUS:Ada lebih dari 1 warehouse dengan kata kunci '${srcName}' (${names}). Mohon copy-paste dan kirim ulang laporan Anda dengan nama yang lebih spesifik.`);
              }
              if (ws.length === 0) {
                throw new Error(`AMBIGUOUS:Tidak dapat menemukan Gudang/Warehouse Asal dengan nama '${srcName}'. Pastikan nama sesuai dengan database.`);
              }
              if (ws.length === 1) {
                sourceId = ws[0].id;
                resolvedSourceName = ws[0].name;
              }
            } else if (srcType === 'OUTLET') {
              const os = await tx.outlet.findMany({ where: { nama: { contains: srcName, mode: 'insensitive' }, OR: [{ status: 'Aktif' }, { status: 'Active' }, { status: null }] }});
              if (os.length > 1) {
                const names = os.map(o => o.nama).slice(0, 3).join(', ');
                throw new Error(`AMBIGUOUS:Ada lebih dari 1 outlet aktif dengan kata kunci '${srcName}' (${names}). Mohon copy-paste dan kirim ulang laporan Anda dengan nama yang lebih spesifik.`);
              }
              if (os.length === 0) {
                throw new Error(`AMBIGUOUS:Tidak dapat menemukan Outlet Asal dengan nama '${srcName}'. Pastikan nama outlet sudah benar dan aktif.`);
              }
              if (os.length === 1) {
                sourceId = os[0].id;
                resolvedSourceName = os[0].nama;
              }
            } else if (srcType === 'BOOTH') {
              const bs = await tx.eventBooth.findMany({ where: { nama: { contains: srcName, mode: 'insensitive' }, status: 'AKTIF' }});
              if (bs.length > 1) {
                const names = bs.map(b => b.nama).slice(0, 3).join(', ');
                throw new Error(`AMBIGUOUS:Ada lebih dari 1 booth aktif dengan kata kunci '${srcName}' (${names}).`);
              }
              if (bs.length === 0) {
                throw new Error(`AMBIGUOUS:Tidak dapat menemukan Booth Asal yang aktif dengan nama '${srcName}'.`);
              }
              if (bs.length === 1) {
                sourceId = bs[0].id;
                resolvedSourceName = bs[0].nama;
              }
            }

            // 2. Resolve Destination
            let destId = null;
            let outletId = null;
            let affiliateId = null;
            let boothId = null;
            if (destType === 'WAREHOUSE') {
              const ws = await tx.warehouse.findMany({ where: { name: { contains: destName, mode: 'insensitive' } }});
              if (ws.length > 1) {
                const names = ws.map(w => w.name).slice(0, 3).join(', ');
                throw new Error(`AMBIGUOUS:Ada lebih dari 1 warehouse dengan kata kunci '${destName}' (${names}). Mohon copy-paste dan kirim ulang laporan Anda dengan nama yang lebih spesifik.`);
              }
              if (ws.length === 0) {
                throw new Error(`AMBIGUOUS:Tidak dapat menemukan Gudang/Warehouse Tujuan dengan nama '${destName}'. Pastikan nama sesuai dengan database.`);
              }
              if (ws.length === 1) destId = ws[0].id;
            } else if (destType === 'OUTLET') {
              const os = await tx.outlet.findMany({ where: { nama: { contains: destName, mode: 'insensitive' }, OR: [{ status: 'Aktif' }, { status: 'Active' }, { status: null }] }});
              if (os.length > 1) {
                const names = os.map(o => o.nama).slice(0, 3).join(', ');
                throw new Error(`AMBIGUOUS:Ada lebih dari 1 outlet aktif dengan kata kunci '${destName}' (${names}). Mohon copy-paste dan kirim ulang laporan Anda dengan nama yang lebih spesifik.`);
              }
              if (os.length === 0) {
                throw new Error(`AMBIGUOUS:Tidak dapat menemukan Outlet Tujuan dengan nama '${destName}'. Pastikan nama outlet sudah benar dan aktif.`);
              }
              if (os.length === 1) { destId = os[0].id; outletId = os[0].id; }
            } else if (destType === 'AFFILIATE') {
              const as = await tx.affiliate.findMany({ where: { nama: { contains: destName, mode: 'insensitive' } }});
              if (as.length > 1) {
                const names = as.map(a => a.nama).slice(0, 3).join(', ');
                throw new Error(`AMBIGUOUS:Ada lebih dari 1 affiliator dengan kata kunci '${destName}' (${names}). Mohon copy-paste dan kirim ulang laporan Anda dengan nama yang lebih spesifik.`);
              }
              if (as.length === 0) {
                throw new Error(`AMBIGUOUS:Tidak dapat menemukan Affiliator dengan nama '${destName}'. Pastikan nama affiliator sesuai dengan database.`);
              }
              if (as.length === 1) affiliateId = as[0].id;
            } else if (destType === 'BOOTH') {
              const bs = await tx.eventBooth.findMany({ where: { nama: { contains: destName, mode: 'insensitive' }, status: 'AKTIF' }});
              if (bs.length > 1) {
                const names = bs.map(b => b.nama).slice(0, 3).join(', ');
                throw new Error(`AMBIGUOUS:Ada lebih dari 1 booth aktif dengan kata kunci '${destName}' (${names}).`);
              }
              if (bs.length === 0) {
                throw new Error(`AMBIGUOUS:Tidak dapat menemukan Booth Tujuan yang aktif dengan nama '${destName}'.`);
              }
              if (bs.length === 1) { destId = bs[0].id; boothId = bs[0].id; }
            }

            // 3. Pre-validate Stock Availability at Source (BATALKAN jika stok tidak cukup)
            const insufficientItems: string[] = [];
            for (const item of items) {
              if (item.product_key && item.qty > 0) {
                const product = await tx.product.findUnique({ where: { sku: item.product_key } });
                if (!product) {
                  insufficientItems.push(`• *${item.product_key}* (SKU produk tidak ditemukan di database)`);
                  continue;
                }

                if (srcType === 'WAREHOUSE' && sourceId) {
                  const ws = await tx.warehouseStock.findUnique({
                    where: { warehouse_id_product_id: { warehouse_id: sourceId, product_id: product.id } }
                  });
                  const availableQty = ws ? ws.quantity : 0;
                  if (availableQty < item.qty) {
                    insufficientItems.push(`• *${product.name}* (Tersedia: ${availableQty} pcs, Diminta: ${item.qty} pcs)`);
                  }
                } else if (srcType === 'OUTLET' && sourceId) {
                  const os = await tx.outletStock.findUnique({
                    where: { outlet_id_product_id: { outlet_id: sourceId, product_id: product.id } }
                  });
                  const availableQty = os ? os.quantity : 0;
                  if (availableQty < item.qty) {
                    insufficientItems.push(`• *${product.name}* (Tersedia di outlet: ${availableQty} pcs, Diminta: ${item.qty} pcs)`);
                  }
                } else if (srcType === 'BOOTH' && sourceId) {
                  const bs = await tx.boothStock.findUnique({
                    where: { booth_id_product_id: { booth_id: sourceId, product_id: product.id } }
                  });
                  const availableQty = bs ? bs.quantity : 0;
                  if (availableQty < item.qty) {
                    insufficientItems.push(`• *${product.name}* (Tersedia di booth: ${availableQty} pcs, Diminta: ${item.qty} pcs)`);
                  }
                }
              }
            }

            if (insufficientItems.length > 0) {
              const srcLabel = srcType === 'WAREHOUSE' 
                ? `gudang *${resolvedSourceName}*` 
                : srcType === 'OUTLET' 
                ? `outlet *${resolvedSourceName}*` 
                : `booth *${resolvedSourceName}*`;
              throw new Error(
                `BATAL:Stok di ${srcLabel} tidak mencukupi atau habis:\n` +
                insufficientItems.join('\n') +
                `\n\nPengiriman dibatalkan secara otomatis agar tidak terjadi selisih stok fisik.`
              );
            }
            
            // 4. Create Shipment Record
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
                booth_id: boothId,
                status: 'SHIPPED',
                employee_id: employeeId,
                notes: kategori === 'SAMPLE' ? `Total Produk: ${route.total_produk || 0} | Biaya Ekspedisi: Rp ${route.biaya_ekspedisi || 0}` : null
              }
            });
            totalShipments++;

            // Optional: If it's a sample, record to distribusiSample table
            if (kategori === 'SAMPLE') {
              const sampleTotal = Number(route.total_produk) || items.reduce((sum: number, it: any) => sum + (Number(it.qty) || 0), 0);
              await tx.distribusiSample.create({
                data: {
                  date: parsedData.date ? new Date(parsedData.date) : new Date(),
                  jenis_sample: destName,
                  total_produk: sampleTotal,
                  biaya_ekspedisi: Number(route.biaya_ekspedisi) || 0,
                  employee_id: employeeId
                }
              });
            }

            // 5. Process Items and Stocks
            let totalBilling = 0;
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
                     if (ws) {
                       await tx.warehouseStock.update({ where: { id: ws.id }, data: { quantity: ws.quantity - item.qty }});
                     }
                   } else if (srcType === 'OUTLET' && sourceId) {
                     const os = await tx.outletStock.findUnique({ where: { outlet_id_product_id: { outlet_id: sourceId, product_id: product.id } }});
                     if (os) await tx.outletStock.update({ where: { id: os.id }, data: { quantity: os.quantity - item.qty }});
                   } else if (srcType === 'BOOTH' && sourceId) {
                     const bs = await tx.boothStock.findUnique({ where: { booth_id_product_id: { booth_id: sourceId, product_id: product.id } }});
                     if (bs) await tx.boothStock.update({ where: { id: bs.id }, data: { quantity: Math.max(0, bs.quantity - item.qty) }});
                   }

                   // Increment Destination Stock (If internal transfer)
                   if (destType === 'WAREHOUSE' && destId) {
                     const ws = await tx.warehouseStock.findUnique({ where: { warehouse_id_product_id: { warehouse_id: destId, product_id: product.id } }});
                     if (ws) {
                       // If RETUR, add to returned_qty. If PENGEMBALIAN_BOOTH, add to healthy active quantity!
                       if (kategori === 'RETUR') {
                         await tx.warehouseStock.update({ where: { id: ws.id }, data: { returned_qty: ws.returned_qty + item.qty }});
                       } else {
                         await tx.warehouseStock.update({ where: { id: ws.id }, data: { quantity: ws.quantity + item.qty }});
                       }
                     } else {
                       await tx.warehouseStock.create({
                         data: {
                           warehouse_id: destId,
                           product_id: product.id,
                           quantity: kategori === 'RETUR' ? 0 : item.qty,
                           returned_qty: kategori === 'RETUR' ? item.qty : 0
                         }
                       });
                     }
                   } else if (destType === 'OUTLET' && destId) {
                     const os = await tx.outletStock.findUnique({ where: { outlet_id_product_id: { outlet_id: destId, product_id: product.id } }});
                     let hargaBeli = product.base_price;
                     if (os) {
                       await tx.outletStock.update({ where: { id: os.id }, data: { quantity: os.quantity + item.qty }});
                       if (os.harga_beli) hargaBeli = os.harga_beli;
                     } else {
                       await tx.outletStock.create({
                         data: {
                           outlet_id: destId,
                           product_id: product.id,
                           quantity: item.qty,
                           harga_beli: product.base_price
                         }
                       });
                     }
                     totalBilling += (Number(hargaBeli) * item.qty);
                   } else if (destType === 'BOOTH' && destId) {
                     await tx.boothStock.upsert({
                       where: { booth_id_product_id: { booth_id: destId, product_id: product.id } },
                       update: { quantity: { increment: item.qty } },
                       create: { booth_id: destId, product_id: product.id, quantity: item.qty }
                     });
                   }
                   
                   // Global product.stok balance update
                   let newBalance = product.stok;
                   if (kategori === 'PENGEMBALIAN_BOOTH') {
                     // Good stock returning from booth to warehouse increases central stock
                     newBalance += item.qty;
                     await tx.product.update({ where: { id: product.id }, data: { stok: newBalance }});
                   } else if (!['WAREHOUSE', 'OUTLET'].includes(destType) || kategori === 'RETUR') {
                     newBalance -= item.qty;
                     await tx.product.update({ where: { id: product.id }, data: { stok: newBalance }});
                   }
                   
                   const txType = kategori === 'RETUR' ? 'RETUR' : kategori === 'PENGEMBALIAN_BOOTH' ? 'PENGEMBALIAN_BOOTH' : destType === 'BOOTH' ? 'DISTRIBUSI_BOOTH' : 'DISTRIBUSI';
                   const txFlow = kategori === 'PENGEMBALIAN_BOOTH' ? 'IN' : 'OUT';

                   await tx.stockTransaction.create({
                     data: {
                       product_id: product.id,
                       type: txType,
                       flow: txFlow,
                       qty: item.qty,
                       balance: newBalance,
                       description: kategori === 'RETUR' ? `Retur dari ${srcName} ke ${destName}` : kategori === 'PENGEMBALIAN_BOOTH' ? `Pengembalian sisa layak jual dari ${srcName} ke ${destName}` : `Dari ${srcName} ke ${destName}`,
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

             if (destType === 'OUTLET' && destId && totalBilling > 0) {
               const outlet = await tx.outlet.findUnique({ where: { id: destId } });
               if (outlet) {
                 await tx.outlet.update({
                   where: { id: destId },
                   data: {
                     tagihan: Number(outlet.tagihan) + totalBilling,
                     sisa_tagihan: Number(outlet.sisa_tagihan) + totalBilling,
                     order_baru: outlet.order_baru + 1
                   }
                 });
                 await tx.outletTransaction.create({
                   data: {
                     outlet_id: destId,
                     type: 'BILLING',
                     amount: totalBilling,
                     description: `Otomatis dari Laporan WA (ID: ${shipment.id})`,
                     date: parsedData.date ? new Date(parsedData.date) : new Date()
                   }
                 });
               }
             }
          }
        }, { maxWait: 10000, timeout: 60000 });
        
        replyMsg = `✅ *${totalShipments} Rute Logistik* tanggal ${parsedData.date} berhasil diproses dan dicatat!`;

      } else if (parsedData.report_type === 'KEUANGAN_OUTLET') {
        const outletName = data.outlet_name || '-';
        const os = await prisma.outlet.findMany({ 
          where: { 
            nama: { contains: outletName, mode: 'insensitive' }, 
            OR: [{ status: 'Aktif' }, { status: 'Active' }, { status: null }] 
          }
        });
        
        if (os.length > 1) {
          const names = os.map(o => o.nama).slice(0, 3).join(', ');
          throw new Error(`AMBIGUOUS:Ada lebih dari 1 outlet aktif dengan kata kunci '${outletName}' (${names}). Mohon copy-paste dan kirim ulang laporan Anda dengan nama yang lebih spesifik.`);
        }
        if (os.length === 0) {
          throw new Error(`AMBIGUOUS:Tidak dapat menemukan Outlet dengan nama '${outletName}'. Pastikan nama outlet sudah benar dan aktif.`);
        }

        const outlet = os[0];

        // Validasi role marketing: hanya boleh input keuangan ke outlet yang dihandle
        if (employee && (employee.role === 'MARKETING' || employee.role?.includes('MARKETING'))) {
          if (outlet.pengelola_id !== employee.id) {
            throw new Error(`AMBIGUOUS:Akses ditolak. Anda (${employee.nama}) tidak memiliki izin untuk menginput keuangan ke Outlet '${outlet.nama}' karena bukan outlet yang ditugaskan kepada Anda.`);
          }
        }

        const nominal = data.nominal || 0;
        const ket = data.keterangan || `Laporan WA`;
        const tgl = parsedData.date ? new Date(parsedData.date) : new Date();

        if (data.jenis_transaksi === 'PELUNASAN') {
          const newPayment = Number(outlet.payment) + nominal;
          const newSisa = Number(outlet.tagihan) - newPayment;
          await prisma.$transaction([
            prisma.outletTransaction.create({
              data: {
                outlet_id: outlet.id,
                type: 'PELUNASAN',
                amount: nominal,
                description: ket,
                date: tgl
              }
            }),
            prisma.outlet.update({
              where: { id: outlet.id },
              data: { payment: newPayment, sisa_tagihan: newSisa }
            })
          ]);
          replyMsg = `✅ *Pembayaran Outlet* ${outlet.nama} sebesar Rp ${nominal.toLocaleString('id-ID')} berhasil dicatat!\nSisa Tagihan saat ini: Rp ${newSisa.toLocaleString('id-ID')}`;
        } else {
          const newTagihan = Number(outlet.tagihan) + nominal;
          const newSisa = newTagihan - Number(outlet.payment);
          await prisma.$transaction([
            prisma.outletTransaction.create({
              data: {
                outlet_id: outlet.id,
                type: 'PIUTANG',
                amount: nominal,
                description: ket,
                date: tgl
              }
            }),
            prisma.outlet.update({
              where: { id: outlet.id },
              data: { tagihan: newTagihan, sisa_tagihan: newSisa }
            })
          ]);
          replyMsg = `✅ *Penambahan Piutang/Bon Outlet* ${outlet.nama} sebesar Rp ${nominal.toLocaleString('id-ID')} berhasil dicatat!\nSisa Tagihan saat ini: Rp ${newSisa.toLocaleString('id-ID')}`;
        }
      } else if (parsedData.report_type === 'PENJUALAN_BOOTH') {
        const boothName = data.booth_name || '';
        const omset = Number(data.omset_harian) || 0;
        const items = Array.isArray(data.items) ? data.items : [];
        const bayarMethod = (data.metode_pembayaran || 'TUNAI').toUpperCase();

        const bsList = await prisma.eventBooth.findMany({
          where: { nama: { contains: boothName, mode: 'insensitive' }, status: 'AKTIF' }
        });
        if (bsList.length > 1) {
          const names = bsList.map(b => b.nama).slice(0, 3).join(', ');
          throw new Error(`AMBIGUOUS:Ada lebih dari 1 booth aktif dengan kata kunci '${boothName}' (${names}).`);
        }
        if (bsList.length === 0) {
          throw new Error(`AMBIGUOUS:Booth aktif dengan nama '${boothName}' tidak ditemukan.`);
        }
        const booth = bsList[0];

        await prisma.$transaction(async (tx) => {
          let calculatedTotal = 0;
          for (const item of items) {
            const itemQty = Number(item.qty) || 1;
            const unitPrice = Number(item.unit_price) || 0;
            const subtotal = itemQty * unitPrice;
            calculatedTotal += subtotal;

            // Match bundle first
            const bundle = await tx.boothBundle.findFirst({
              where: { booth_id: booth.id, nama: { contains: item.item_name, mode: 'insensitive' } },
              include: { items: true }
            });

            if (bundle) {
              for (const bi of bundle.items) {
                const bstock = await tx.boothStock.findUnique({
                  where: { booth_id_product_id: { booth_id: booth.id, product_id: bi.product_id } }
                });
                if (bstock) {
                  await tx.boothStock.update({
                    where: { id: bstock.id },
                    data: { quantity: Math.max(0, bstock.quantity - (bi.qty * itemQty)) }
                  });
                }
              }
              await tx.boothSale.create({
                data: {
                  booth_id: booth.id,
                  bundle_id: bundle.id,
                  item_name: bundle.nama,
                  qty: itemQty,
                  unit_price: unitPrice || bundle.harga_jual,
                  total_price: subtotal || (itemQty * Number(bundle.harga_jual)),
                  metode_pembayaran: bayarMethod,
                  employee_id: employeeId,
                  catatan: data.keterangan || 'Dari Laporan WA',
                }
              });
            } else {
              // Direct product
              const prod = await tx.product.findFirst({
                where: {
                  OR: [
                    { name: { contains: item.item_name, mode: 'insensitive' } },
                    { short_name: { contains: item.item_name, mode: 'insensitive' } },
                    { sku: { contains: item.item_name, mode: 'insensitive' } }
                  ]
                }
              });
              if (prod) {
                const bstock = await tx.boothStock.findUnique({
                  where: { booth_id_product_id: { booth_id: booth.id, product_id: prod.id } }
                });
                if (bstock) {
                  await tx.boothStock.update({
                    where: { id: bstock.id },
                    data: { quantity: Math.max(0, bstock.quantity - itemQty) }
                  });
                }
              }
              await tx.boothSale.create({
                data: {
                  booth_id: booth.id,
                  product_id: prod?.id || null,
                  item_name: item.item_name || 'Produk',
                  qty: itemQty,
                  unit_price: unitPrice,
                  total_price: subtotal,
                  metode_pembayaran: bayarMethod,
                  employee_id: employeeId,
                  catatan: data.keterangan || 'Dari Laporan WA',
                }
              });
            }
          }

          const finalOmset = omset > 0 ? omset : calculatedTotal;
          await tx.eventBooth.update({
            where: { id: booth.id },
            data: {
              total_penjualan: { increment: finalOmset },
              kas_masuk: { increment: finalOmset },
            }
          });
        }, { maxWait: 10000, timeout: 60000 });

        replyMsg = `✅ *Laporan Penjualan Booth* ${booth.nama} berhasil dicatat!\nTotal Omset: Rp ${omset.toLocaleString('id-ID')}\nMetode: ${bayarMethod}`;
      }
    } catch (dbError: any) {
      console.error('Database insertion error:', dbError);
      if (dbError?.message && dbError.message.startsWith('AMBIGUOUS:')) {
        replyMsg = `⚠️ Laporan dibatalkan.\n\n${dbError.message.replace('AMBIGUOUS:', '')}`;
      } else if (dbError?.message && dbError.message.startsWith('BATAL:')) {
        replyMsg = `❌ *PENGIRIMAN DIBATALKAN*\n\n${dbError.message.replace('BATAL:', '')}`;
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
