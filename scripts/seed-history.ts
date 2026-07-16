import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are a data extraction assistant for Calio Fish.
I will give you a text file containing many historical WhatsApp reports.
Your job is to parse ALL of them into an array of structured JSON objects.

Respond ONLY with a valid JSON array, no markdown blocks, no other text.
Format:
[
  {
    "report_type": "MARKETING_OFFLINE" | "MARKETING_ONLINE" | "PAKET_KIRIMAN" | "PEMBERSIHAN" | "PRODUKSI",
    "date": "YYYY-MM-DD",
    "data": { ... } // See schema below
  }
]

Schema for data:
For MARKETING_OFFLINE: { "target_bulanan": number, "jumlah_outlet_aktif": number, "omset_harian": number, "omset_mtd": number, "persentase": number, "gap": number }
For MARKETING_ONLINE: { "platform": "shopee" | "tiktok", "target_mtd": number, "omset_harian": number, "total_omset_mtd": number, "persentase": number, "gap": number }
For PAKET_KIRIMAN: { 
  "channels": { "shopee": number, "offline": number, "affiliate": number, "influencer": number, "sample_outlet": number },
  "products": { "fs_original": number, "fs_sambal_matah": number, "fs_soto": number, "fs_rendang": number, "abon_90": number }
}
For PEMBERSIHAN: { "bahan_beku_kg": number, "bahan_bersih_kg": number }
For PRODUKSI: { "kegiatan": string, "bahan_baku_kg": number, "bahan_jadi_kg": number, "total_hasil_pcs": number }`;

async function main() {
  const filePath = path.join(process.cwd(), 'chat-report-history.txt');
  const text = fs.readFileSync(filePath, 'utf-8');

  // We only want the history part
  const historyIndex = text.indexOf('6. HISTORY REPORT');
  const historyText = historyIndex > -1 ? text.substring(historyIndex) : text;

  console.log('Sending data to Gemini for parsing...');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\nMessage:\n' + historyText }] }
    ],
    config: {
      responseMimeType: 'application/json',
    }
  });

  const resultText = response.text || "[]";
  const reports = JSON.parse(resultText);

  console.log(`Parsed ${reports.length} reports. Inserting into database...`);

  for (const parsedData of reports) {
    const data = parsedData.data;
    try {
      if (parsedData.report_type === 'MARKETING_OFFLINE') {
        await prisma.marketingOffline.create({
          data: {
            date: new Date(parsedData.date),
            target_bulanan: data.target_bulanan || 0,
            jumlah_outlet_aktif: data.jumlah_outlet_aktif || 0,
            omset_harian: data.omset_harian || 0,
            omset_mtd: data.omset_mtd || 0,
            persentase: data.persentase || 0,
            gap: data.gap || 0
          }
        });
      } else if (parsedData.report_type === 'MARKETING_ONLINE') {
        await prisma.marketingOnline.create({
          data: {
            date: new Date(parsedData.date),
            platform: data.platform?.toLowerCase() || "unknown",
            target_mtd: data.target_mtd || 0,
            omset_harian: data.omset_harian || 0,
            total_omset_mtd: data.total_omset_mtd || 0,
            persentase: data.persentase || 0,
            gap: data.gap || 0
          }
        });
      // } else if (parsedData.report_type === 'PAKET_KIRIMAN') {
      //   await prisma.paketKiriman.create({
      //     data: {
      //       date: new Date(parsedData.date),
      //       shopee_paket: data.channels?.shopee || 0,
      //       offline_paket: data.channels?.offline || 0,
      //       affiliate_paket: data.channels?.affiliate || 0,
      //       influencer_paket: data.channels?.influencer || 0,
      //       sample_outlet_paket: data.channels?.sample_outlet || 0,
      //       fs_original: data.products?.fs_original || 0,
      //       fs_sambal_matah: data.products?.fs_sambal_matah || 0,
      //       fs_soto: data.products?.fs_soto || 0,
      //       fs_rendang: data.products?.fs_rendang || 0,
      //       abon_90: data.products?.abon_90 || 0,
      //     }
      //   });
      } else if (parsedData.report_type === 'PEMBERSIHAN') {
        await prisma.produksi.create({
          data: {
            date: new Date(parsedData.date),
            kegiatan: 'Pembersihan',
            bahan_baku: data.bahan_beku_kg || 0,
            bahan_jadi: data.bahan_bersih_kg || 0
          }
        });
      } else if (parsedData.report_type === 'PRODUKSI') {
        await prisma.produksi.create({
          data: {
            date: new Date(parsedData.date),
            kegiatan: data.kegiatan || "-",
            bahan_baku: data.bahan_baku_kg || null,
            bahan_jadi: data.bahan_jadi_kg || null,
            total_hasil_pcs: data.total_hasil_pcs || null
          }
        });
      }
    } catch (e) {
      console.error('Error inserting report:', parsedData, e);
    }
  }

  console.log('Seeding completed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
