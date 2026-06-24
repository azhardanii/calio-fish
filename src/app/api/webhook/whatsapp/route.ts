import { NextResponse } from 'next/server';
import { GowaPayload, sendMessage, sendChatPresence } from '@/lib/whatsapp';
import { parseWhatsAppReport } from '@/lib/ai-parser';
import { prisma } from '@/lib/prisma';
import { getOfflineTarget, getOnlineTarget } from '@/lib/settings';

const ADMIN_PHONE = process.env.WA_ADMIN_PHONE || '6285157991798';
const TARGET_GROUP_ID = process.env.WA_GROUP_ID || '120363293055467760@g.us';

/**
 * Auto-compute persentase & gap from omset_mtd and target
 */
function computeMetrics(omsetMtd: number, target: number) {
  const persentase = target > 0 ? (omsetMtd / target) * 100 : 0;
  const gap = omsetMtd - target;
  return {
    persentase: Math.round(persentase * 100) / 100,
    gap: Math.round(gap),
  };
}

function getMonthBounds(dateStr: string) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

async function saveMarketingOnline(date: string, data: { platform: string; omset_harian: number }) {
  const platform = data.platform?.toLowerCase() || 'unknown';
  const target = await getOnlineTarget(platform);
  
  // Hitung MTD dari 1 bulan ini + omset hari ini
  const { start, end } = getMonthBounds(date);
  const agg = await prisma.marketingOnline.aggregate({
    _sum: { omset_harian: true },
    where: { platform, date: { gte: start, lte: end } }
  });
  const total_omset_mtd = (Number(agg._sum.omset_harian) || 0) + (data.omset_harian || 0);
  
  const { persentase, gap } = computeMetrics(total_omset_mtd, target);

  await prisma.marketingOnline.create({
    data: {
      date: new Date(date),
      platform,
      target_mtd: target,
      omset_harian: data.omset_harian || 0,
      total_omset_mtd,
      persentase,
      gap,
    },
  });
}

// Keep track of recently processed message IDs to prevent duplicate webhooks
const processedMessageIds = new Set<string>();

export async function POST(req: Request) {
  try {
    const body: GowaPayload = await req.json();

    // 1. Ignore non-message events
    if (body.event !== 'message') {
      return NextResponse.json({ status: 'ignored', reason: 'not a message event' });
    }

    const payload = body.payload;
    if (!payload) return NextResponse.json({ status: 'ignored', reason: 'no payload' });

    // Deduplicate: If we already processed this message ID from another device, ignore it
    if (processedMessageIds.has(payload.id)) {
      return NextResponse.json({ status: 'ignored', reason: 'duplicate message id' });
    }
    processedMessageIds.add(payload.id);
    
    // Prevent memory leak by keeping max 1000 IDs
    if (processedMessageIds.size > 1000) {
      const firstItem = processedMessageIds.values().next().value;
      if (firstItem) processedMessageIds.delete(firstItem);
    }

    // DEBUG: Log raw payload to see actual field names
    console.log('[Webhook - RAW PAYLOAD]', JSON.stringify(body, null, 2));

    // 2. Ignore messages outside of the designated WhatsApp Group
    if (payload.chat_id !== TARGET_GROUP_ID) {
      return NextResponse.json({ status: 'ignored', reason: 'unauthorized sender, not target group' });
    }

    const sender = payload.from_name || payload.from || 'Unknown';
    console.log(`[Webhook - DITERIMA] Pesan masuk dari: ${sender} (Chat ID: ${payload.chat_id})\nMessage:\n${payload.body}`);

    await sendChatPresence(payload.chat_id, 'composing');
    const parsedData = await parseWhatsAppReport(payload.body);

    if (!parsedData || !parsedData.report_type) {
      await sendChatPresence(payload.chat_id, 'paused');
      return NextResponse.json({ status: 'ignored', reason: 'unparseable or not a report' });
    }

    let replyMsg = `✅ Laporan *${parsedData.report_type}* tanggal ${parsedData.date} berhasil dicatat!`;
    const data = parsedData.data;

    try {
      if (parsedData.report_type === 'MARKETING_OFFLINE') {
        const target = await getOfflineTarget();
        
        // Count active outlets
        const jumlah_outlet_aktif = await prisma.outlet.count();
        
        // Compute MTD
        const { start, end } = getMonthBounds(parsedData.date);
        const agg = await prisma.marketingOffline.aggregate({
          _sum: { omset_harian: true },
          where: { date: { gte: start, lte: end } }
        });
        const omset_mtd = (Number(agg._sum.omset_harian) || 0) + (data.omset_harian || 0);
        
        const { persentase, gap } = computeMetrics(omset_mtd, target);

        await prisma.marketingOffline.create({
          data: {
            date: new Date(parsedData.date),
            target_bulanan: target,
            jumlah_outlet_aktif,
            omset_harian: data.omset_harian || 0,
            omset_mtd,
            persentase,
            gap,
          },
        });

        replyMsg = `✅ *Marketing Offline* ${parsedData.date}\nOutlet Aktif: ${jumlah_outlet_aktif}\nOmset Hari Ini: Rp ${(data.omset_harian || 0).toLocaleString('id-ID')}\nOmset MTD: Rp ${omset_mtd.toLocaleString('id-ID')}\nTarget: Rp ${target.toLocaleString('id-ID')}\n📊 ${persentase}% | GAP: Rp ${gap.toLocaleString('id-ID')}`;

      } else if (parsedData.report_type === 'MARKETING_ONLINE') {
        await saveMarketingOnline(parsedData.date, data);
        replyMsg = `✅ *Marketing Online (${data.platform})* ${parsedData.date} berhasil dicatat!`;

      } else if (parsedData.report_type === 'MARKETING_ONLINE_MULTI') {
        // Handle combined Shopee + TikTok in one message
        for (const entry of data) {
          await saveMarketingOnline(parsedData.date, entry);
        }
        replyMsg = `✅ *Marketing Online (Shopee + TikTok)* ${parsedData.date} berhasil dicatat!`;

      } else if (parsedData.report_type === 'PAKET_KIRIMAN') {
        await prisma.paketKiriman.create({
          data: {
            date: new Date(parsedData.date),
            shopee_paket: data.channels?.shopee || 0,
            tiktok_paket: data.channels?.tiktok || 0,
            offline_paket: data.channels?.offline || 0,
            affiliate_paket: data.channels?.affiliate || 0,
            influencer_paket: data.channels?.influencer || 0,
            sample_outlet_paket: data.channels?.sample_outlet || 0,
            fs_original: data.products?.fs_original || 0,
            fs_sambal_matah: data.products?.fs_sambal_matah || 0,
            fs_soto: data.products?.fs_soto || 0,
            fs_rendang: data.products?.fs_rendang || 0,
            abon_90: data.products?.abon_90 || 0,
          },
        });
        replyMsg = `✅ *Paket Kiriman* ${parsedData.date} berhasil dicatat!`;

      } else if (parsedData.report_type === 'PEMBERSIHAN') {
        await prisma.produksi.create({
          data: {
            date: new Date(parsedData.date),
            kegiatan: 'Pembersihan Kulit',
            bahan_baku: data.bahan_beku_kg || null,
            bahan_jadi: data.bahan_bersih_kg || null,
          },
        });
        replyMsg = `✅ *Pembersihan Kulit* ${parsedData.date} berhasil dicatat ke Produksi!`;

      } else if (parsedData.report_type === 'PRODUKSI') {
        await prisma.produksi.create({
          data: {
            date: new Date(parsedData.date),
            kegiatan: data.kegiatan || '-',
            bahan_baku: data.bahan_baku_kg || null,
            bahan_jadi: data.bahan_jadi_kg || null,
            total_hasil_pcs: data.total_hasil_pcs || null,
          },
        });

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
        await prisma.distribusiSample.create({
          data: {
            date: new Date(parsedData.date),
            jenis_sample: data.jenis_sample || '-',
            total_produk: data.total_produk || 0,
            biaya_ekspedisi: data.biaya_ekspedisi || 0,
          },
        });

      } else if (parsedData.report_type === 'PRESENSI') {
        // Extract sender phone number
        const senderPhone = payload.from || '';
        // Strip non digits, and get the last 8-10 digits for robust matching
        const cleanPhone = senderPhone.replace(/\D/g, '');
        const phoneKey = cleanPhone.length > 8 ? cleanPhone.slice(-8) : cleanPhone;

        const employee = await prisma.employee.findFirst({
          where: {
            no_hp: { contains: phoneKey }
          }
        });

        if (!employee) {
          replyMsg = `❌ *Presensi Gagal*\nNomor HP Anda (${senderPhone}) belum terdaftar di Database Karyawan. Silakan hubungi admin untuk mendaftarkan nomor Anda.`;
        } else {
          await prisma.attendance.create({
            data: {
              date: new Date(parsedData.date),
              employee: { connect: { id: employee.id } },
              status_kehadiran: data.status_kehadiran || 'HADIR',
              alasan: data.alasan || null,
              // Waktu is auto set to now() in DB
            }
          });
          replyMsg = `✅ *Presensi Berhasil*\nNama: ${employee.nama}\nStatus: ${data.status_kehadiran}\nJam: ${new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB`;
        }
      }
    } catch (dbError) {
      console.error('Database insertion error:', dbError);
      replyMsg = `❌ Gagal mencatat laporan ${parsedData.report_type} ke database.`;
    }

    await sendChatPresence(payload.chat_id, 'paused');
    await sendMessage(payload.chat_id, replyMsg);

    return NextResponse.json({ status: 'success', parsedData });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ status: 'error', message: 'Internal Server Error' }, { status: 500 });
  }
}
