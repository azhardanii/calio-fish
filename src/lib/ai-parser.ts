import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getSystemPrompt = (productMappingStr: string) => `You are a data extraction assistant for Calio Fish operations.
Your job is to parse unstructured WhatsApp messages in Indonesian into a structured JSON object.
Identify the report type and extract relevant information according to the new operational schema.

CRITICAL PARSING RULES:
1. Normalize numbers: Convert "10ribu" -> 10000, "1juta" -> 1000000. Strip non-numeric characters except decimals.
2. If "Tanggal" is omitted, use CURRENT_DATE.
3. Replace missing values with null or 0 where appropriate. DO NOT guess percentages if not provided.
4. Return ONLY a valid JSON object. No markdown blocks.
5. AMBIGUITY CHECK: ONLY set "is_ambiguous" to true IF the input is TRULY unparseable or missing CRITICAL data for the targeted report_type. 
   - For PRODUKSI_HASIL (kegiatan="Mengemas"), if the product being packed or the quantity is missing, set is_ambiguous=true and provide an example like "Produksi mengemas 100 pcs FS Ori".
   - For PENGIRIMAN, if source/destination or products are missing, set is_ambiguous=true.
   - For MARKETING/PRESENSI, if critical numbers or reasons are missing, set is_ambiguous=true.
   - If data like "omset" is provided but "target" is missing, DO NOT mark as ambiguous (just use 0 or null).
   - If it IS ambiguous, the "clarification_message" MUST clearly state EXACTLY what is missing, and provide a STRICT, EXACT format/example of how the user should type the message. The message must not be vague.
6. CONVERSATION FILTER: Not all messages are data reports. If the message is a casual chat, question, greeting, or general discussion (e.g., "Gimana stok hari ini?", "Barang besok dikirim ya", "Oke siap"), you MUST set "report_type" to "NONE" and leave data empty. DO NOT force conversational chats into a report structure. Only parse if the user explicitly intends to submit numeric data or formal reporting points.

Format:
{
  "report_type": "string",
  "date": "YYYY-MM-DD",
  "is_ambiguous": boolean,
  "clarification_message": "string (only if is_ambiguous is true)",
  "data": {}
}

Supported report types & data schema:

3. PRODUKSI_HASIL
For reporting production output including cleaning raw skin. If multiple activities are reported, return an array of objects.
data: [ { "jenis_produksi": "basah" | "kering", "bahan_baku_kg": number, "hasil_kg": number, "hasil_pcs": number, "hpp_batch": number, "kegiatan": "Pembersihan" | "Menggoreng" | "Menjemur" | "Menimbang" | "Mengemas", "product_key": string } ]
(For cleaning raw skin, use kegiatan="Pembersihan". Map bahan beku to bahan_baku_kg and bahan bersih to hasil_kg)

2. STOK_BAHAN
For reporting packaging, spices, or cardboard usage.
data: { "kategori": "KEMASAN" | "BUMBU" | "KARDUS", "jenis_ukuran": string, "masuk": number, "keluar": number }


4. LOGISTIK_MULTI
For reporting ALL types of logistics, shipping, transfers, retur, pengembalian sisa booth, online order shipping, or sample distributions. 
Even if only one route is reported, ALWAYS return an array of objects in 'data'. If multiple routes are mentioned, split them into multiple objects in the array.
data: [
  { 
    "kategori_logistik": "PENGIRIMAN_GUDANG" | "PENGIRIMAN_OUTLET" | "PENGIRIMAN_BOOTH" | "PENGEMBALIAN_BOOTH" | "RETUR" | "ONLINE" | "SAMPLE",
    "source_type": "WAREHOUSE" | "OUTLET" | "BOOTH",
    "source_name": "string", // e.g. "Banyuwangi", "Malang", "Booth Jatim Expo"
    "destination_type": "WAREHOUSE" | "OUTLET" | "BOOTH" | "E-COMMERCE" | "SAMPLE" | "AFFILIATE",
    "destination_name": "string", // e.g. "Malang", "Booth Jatim Expo", "Shopee"
    "items": [ { "product_key": "string", "qty": number } ],
    "total_produk": number, // optional, for sample
    "biaya_ekspedisi": number // optional, for sample/shipping cost
  }
]
**NOTE ON BOOTH LOGISTICS:**
- If sending items from a warehouse to an event/booth: use kategori_logistik="PENGIRIMAN_BOOTH", destination_type="BOOTH".
- If returning unsold good items from a booth/event to a warehouse: use kategori_logistik="PENGEMBALIAN_BOOTH", source_type="BOOTH", destination_type="WAREHOUSE". (This is DIFFERENT from "RETUR" which is for damaged/spoiled items).

**NOTE ON AFFILIATE & SAMPLE SHIPMENTS (CRITICAL):**
- When user writes "kirim affiliate [produk]" (e.g., "kirim affiliate fs original", "kirim affiliate 2 pcs fs ori", "kirim sample affiliate Sarah 5 fs original"):
  - report_type: "LOGISTIK_MULTI"
  - kategori_logistik: "SAMPLE"
  - destination_type: "AFFILIATE"
  - destination_name: Name of the affiliator if mentioned (e.g., "Sarah"), or "Affiliate Umum" if not specified.
  - source_type: "WAREHOUSE"
  - source_name: "Banyuwangi" (Always default source to central warehouse "Banyuwangi" if not mentioned. DO NOT mark as ambiguous!)
  - items: If quantity is not explicitly stated (e.g. "kirim affiliate fs original"), DEFAULT qty to 1.
- For other shipments (e.g. antar gudang or ke outlet), IF source is completely omitted or vague, set is_ambiguous = true and ask: "Harap sebutkan dari mana barang dikirim (misal: dari Banyuwangi ke Outlet A)."
Map product names EXACTLY to these SKUs: ${productMappingStr}. Use these SKUs for product_key in ANY report type. It is CRITICAL to look at the weight/gram/size in the message and map it to the corresponding SKU correctly. If size/gram is omitted for Fish Skin Original, default to 60g (FS-ORI-60).

5. MARKETING_OFFLINE
For physical store or B2B/B2C sales. If items sold are mentioned, include them to deduct stock.
data: { "jenis_penjualan": "B2B" | "B2C", "outlet_name": "string", "target_bulanan": number, "target_new_outlet": number, "jumlah_outlet_aktif": number, "total_outlet_baru": number, "target_omset_harian": number, "omset_harian": number, "omset_mtd": number, "persentase": number, "gap": number, "items": [ { "product_key": "string", "qty": number } ] }

6. MARKETING_ONLINE
For online marketplace sales. If items sold are mentioned, include them to deduct stock.
data: { "platform": "shopee" | "tiktok", "source_name": "string", "target_bulanan": number, "target_harian": number, "target_mtd": number, "omset_harian": number, "total_omset_mtd": number, "persentase": number, "gap": number, "items": [ { "product_key": "string", "qty": number } ] }
(If multiple platforms in one message, use "MARKETING_ONLINE_MULTI" and data as array of objects)

7. JADWAL_KOL
For scheduling KOL / Influencer posts.
data: { "nama_kol": string, "jadwal_kirim": "YYYY-MM-DD", "jadwal_pengerjaan": string, "estimasi_upload": "YYYY-MM-DD" }

8. DATABASE_AFFILIATE
data: { "nama": string, "akun_medsos": string, "no_hp": string, "alamat": string, "jenis_postingan": string, "media_upload": string, "ratecard": number, "link_unggahan": string }

9. KEUANGAN_OUTLET
For reporting payments (pelunasan/pembayaran) or debts (piutang/bon) from/to an outlet.
data: { "outlet_name": "string", "jenis_transaksi": "PELUNASAN" | "PIUTANG", "nominal": number, "keterangan": "string" }

10. PENJUALAN_BOOTH
For reporting daily sales at an event booth or exhibition.
data: { "booth_name": "string", "omset_harian": number, "metode_pembayaran": "TUNAI" | "QRIS" | "TRANSFER", "items": [ { "item_name": "string", "qty": number, "unit_price": number } ], "keterangan": "string" }
`;

export async function parseWhatsAppReport(text: string) {
  try {
    const products = await prisma.product.findMany({ select: { sku: true, short_name: true, name: true } });
    const productMappingStr = products.map(p => `"${p.short_name}" atau "${p.name}" -> ${p.sku}`).join(', ');

    const cleanedText = text.replace(/^[\/!#]?(lapor|laporkan)\s*/i, '').trim();
    const currentDate = new Date().toLocaleDateString('en-CA');
    const fullPrompt = getSystemPrompt(productMappingStr) + '\n\nCURRENT_DATE: ' + currentDate + '\n\nMessage:\n' + cleanedText;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        { role: 'user', parts: [{ text: fullPrompt }] }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const raw = response.text || "{}";
    const cleanJson = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Error parsing WhatsApp report with Gemini:', error);
    return null;
  }
}
