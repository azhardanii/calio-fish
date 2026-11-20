import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getSystemPrompt = (productMappingStr: string, typeMappingStr: string) => `You are a data extraction assistant for Calio Fish operations.
Your job is to parse unstructured WhatsApp messages in Indonesian into a structured JSON object.
Identify the report type and extract relevant information according to the new operational schema.

CRITICAL PARSING RULES:
1. Normalize numbers: Convert "10ribu" -> 10000, "1juta" -> 1000000. Strip non-numeric characters except decimals.
2. If "Tanggal" is omitted, use CURRENT_DATE.
3. Replace missing values with null or 0 where appropriate. DO NOT guess percentages if not provided.
4. Return ONLY a valid JSON object. No markdown blocks.
5. AMBIGUITY CHECK: ONLY set "is_ambiguous" to true IF the input is TRULY unparseable or missing CRITICAL data for the targeted report_type. 
   - For PRODUKSI_HASIL (kegiatan="Pengemasan"), if the product being packed or the quantity is missing, set is_ambiguous=true and provide an example like "Produksi mengemas 100 pcs FS Ori 60g".
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

1. PRESENSI
For reporting employee attendance (hadir/masuk, izin, or sakit).
data: { "status_kehadiran": "HADIR" | "IZIN" | "SAKIT", "alasan": string }

2. PENGELUARAN
For reporting company or operational expenses (operasional, marketing, fuel/bensin, store display equipment/rak, advertising/ads e-commerce like Shopee Ads/TikTok Ads, logistics, or production expenses).
data: {
  "kategori": "OPERASIONAL" | "MARKETING" | "IKLAN" | "LOGISTIK" | "PRODUKSI" | "LAINNYA",
  "judul": string, // e.g. "Beli Bensin Operasional", "Beli Rak Display", "Shopee Ads", "TikTok Ads"
  "nominal": number,
  "keterangan": string
}

3. PERSONAL_BUYER
For reporting direct retail customer sales (Personal Buyer / Pembeli Perorangan), NOT to an outlet.
data: {
  "buyer_name": string, // Name of customer/buyer, e.g. "Bu Siti", "Pak Hendra"
  "nominal": number, // Total money received in Rp
  "items": [ { "product_key": string, "qty": number, "unit_price": number } ],
  "keterangan": string,
  "source_warehouse": string // optional, defaults to "Banyuwangi"
}

4. PRODUKSI_HASIL
For reporting production output (ONLY two production activities: "Pembersihan" and "Pengemasan", e.g., "mengemas fs sambal matah 60gr : 100pcs", "mengemas :\nAbon 90gr : 100 pcs", pembersihan kulit). If multiple activities or multiple packed products are reported, return an array of objects.
data: [ { "jenis_produksi": "basah" | "kering" | string, "bahan_baku_kg": number, "hasil_kg": number, "hasil_pcs": number, "hpp_batch": number, "kegiatan": "Pembersihan" | "Pengemasan", "product_key": "string (exact SKU from mapping whenever a finished product is packed/Pengemasan)" } ]
(ONLY use kegiatan="Pembersihan" or kegiatan="Pengemasan". For cleaning raw skin, use kegiatan="Pembersihan" and map bahan beku to bahan_baku_kg and bahan bersih to hasil_kg. For packing/"mengemas"/"pengemasan", ALWAYS set kegiatan="Pengemasan", put piece count in hasil_pcs, and ALWAYS fill product_key with the exact matching SKU from the product list below, plus put the original item text in jenis_produksi if helpful.)

5. STOK_BAHAN
For reporting packaging, spices, or cardboard usage.
data: { "kategori": "KEMASAN" | "BUMBU" | "KARDUS", "jenis_ukuran": string, "masuk": number, "keluar": number }

6. LOGISTIK_MULTI
For reporting ALL types of logistics, shipping, transfers, retur, pengembalian sisa booth, online order shipping, distributor shipments, or sample distributions. 
Even if only one route is reported, ALWAYS return an array of objects in 'data'. If multiple routes are mentioned, split them into multiple objects in the array.
data: [
  { 
    "kategori_logistik": "PENGIRIMAN_GUDANG" | "PENGIRIMAN_OUTLET" | "PENGIRIMAN_BOOTH" | "PENGEMBALIAN_BOOTH" | "RETUR" | "ONLINE" | "SAMPLE" | "PENGIRIMAN_DISTRIBUTOR",
    "source_type": "WAREHOUSE" | "OUTLET" | "BOOTH" | "DISTRIBUTOR",
    "source_name": "string", // e.g. "Banyuwangi", "Malang", "Booth Jatim Expo", "Gudang Distributor Malang"
    "destination_type": "WAREHOUSE" | "OUTLET" | "BOOTH" | "E-COMMERCE" | "SAMPLE" | "AFFILIATE" | "DISTRIBUTOR",
    "destination_name": "string", // e.g. "Malang", "Booth Jatim Expo", "Shopee", "Distributor Malang"
    "items": [ { "product_key": "string", "qty": number } ],
    "total_produk": number, // optional, for sample
    "biaya_ekspedisi": number // optional, for sample/shipping cost
  }
]
**NOTE ON BOOTH LOGISTICS:**
- If sending items from a warehouse to an event/booth: use kategori_logistik="PENGIRIMAN_BOOTH", destination_type="BOOTH".
- If returning unsold good items from a booth/event to a warehouse: use kategori_logistik="PENGEMBALIAN_BOOTH", source_type="BOOTH", destination_type="WAREHOUSE". (This is DIFFERENT from "RETUR" which is for damaged/spoiled items).
**NOTE ON DISTRIBUTOR LOGISTICS:**
- If sending items from central warehouse to a distributor: destination_type="DISTRIBUTOR" or "WAREHOUSE", kategori_logistik="PENGIRIMAN_DISTRIBUTOR" or "PENGIRIMAN_GUDANG".

**NOTE ON AFFILIATE & SAMPLE SHIPMENTS (CRITICAL):**
- When user writes "kirim affiliate [produk]" (e.g., "kirim affiliate fs original", "kirim affiliate 2 pcs fs ori", "kirim sample affiliate Sarah 5 fs original"):
  - report_type: "LOGISTIK_MULTI"
  - kategori_logistik: "SAMPLE"
  - destination_type: "AFFILIATE"
  - destination_name: Name of the affiliator if mentioned (e.g., "Sarah"), or "Affiliate Umum" if not specified.
  - source_type: "WAREHOUSE"
  - source_name: "Banyuwangi" (Always default source to central warehouse "Banyuwangi" if not mentioned. DO NOT mark as ambiguous!)
  - items: If quantity is not explicitly stated (e.g. "kirim affiliate fs original"), DEFAULT qty to 1.
- For other shipments (e.g. antar gudang or ke outlet/distributor), IF source is completely omitted or vague, set is_ambiguous = true and ask: "Harap sebutkan dari mana barang dikirim (misal: dari Banyuwangi ke Outlet A)."
CRITICAL PRODUCT & CATEGORY MAPPING:
- Active categories (Kategori/Jenis) in database: ${typeMappingStr || '-'}.
- Active products in database: ${productMappingStr || '-'}.
- Always map "product_key" to one of the exact SKUs listed above (after "->") across ALL report types (PRODUKSI_HASIL when Pengemasan, PERSONAL_BUYER, LOGISTIK_MULTI, MARKETING_OFFLINE, MARKETING_ONLINE, MARKETING_ONLINE_MULTI, and optional KEUANGAN_OUTLET variants).
- Match BOTH flavor/variant AND gramasi/category (for example "fs sambal matah 60gr" vs "sambal matah 20gr", or "Abon 90gr").
- If a flavor/type only exists in ONE category/gramasi in the active product list (e.g. "abon" -> only Abon 90g, or "soto" -> only 60g), map directly to that SKU even if gramasi is omitted. If a flavor exists in MULTIPLE gramasi (e.g. 20g and 60g) and gramasi is omitted for shipment/sale/packing, set is_ambiguous = true and ask which gramasi/category (mentioning the active categories).

7. MARKETING_OFFLINE
For physical store or B2B sales. If items sold are mentioned, include them to deduct stock.
data: { "jenis_penjualan": "B2B" | "B2C", "outlet_name": "string", "target_bulanan": number, "target_new_outlet": number, "jumlah_outlet_aktif": number, "total_outlet_baru": number, "target_omset_harian": number, "omset_harian": number, "omset_mtd": number, "persentase": number, "gap": number, "items": [ { "product_key": "string", "qty": number } ] }

8. MARKETING_ONLINE
For online marketplace sales (Shopee / TikTok). If items sold are mentioned, include them to deduct stock.
data: { "platform": "shopee" | "tiktok", "source_name": "string", "target_bulanan": number, "target_harian": number, "target_mtd": number, "omset_harian": number, "total_omset_mtd": number, "persentase": number, "gap": number, "items": [ { "product_key": "string", "qty": number } ] }
(If multiple platforms in one message, use "MARKETING_ONLINE_MULTI" and data as array of objects. Note: if reporting advertising or ads cost like Shopee Ads or TikTok Ads, use report_type "PENGELUARAN" with kategori "IKLAN")

9. JADWAL_KOL
For scheduling KOL / Influencer posts.
data: { "nama_kol": string, "jadwal_kirim": "YYYY-MM-DD", "jadwal_pengerjaan": string, "estimasi_upload": "YYYY-MM-DD" }

10. DATABASE_AFFILIATE
data: { "nama": string, "akun_medsos": string, "no_hp": string, "alamat": string, "jenis_postingan": string, "media_upload": string, "ratecard": number, "link_unggahan": string }

11. KEUANGAN_OUTLET
For reporting payments (pelunasan/pembayaran) or debts (piutang/bon) from/to an outlet or distributor.
Sales report total payment nominal and sold qty PER KATEGORI/JENIS (not required per flavor).
Available KATEGORI/JENIS in DB: ${typeMappingStr || '-'}.
Optional: if sales also explicitly write specific flavor variants inside the message, map them to SKU in "variants"; otherwise omit "variants".
data: {
  "outlet_name": "string",
  "jenis_transaksi": "PELUNASAN" | "PIUTANG",
  "nominal": number,
  "keterangan": "string",
  "items": [ { "jenis": "string (exact active category code or name from Available KATEGORI/JENIS)", "qty": number, "variants": [ { "product_key": "string (exact SKU optional)", "qty": number } ] } ]
}

12. PENJUALAN_BOOTH
For reporting daily sales at an event booth or exhibition.
data: { "booth_name": "string", "omset_harian": number, "metode_pembayaran": "TUNAI" | "QRIS" | "TRANSFER", "items": [ { "item_name": "string", "product_key": "string (exact SKU if matching single product, optional)", "qty": number, "unit_price": number } ], "keterangan": "string" }
`;

const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const;

async function callGeminiWithFallback(fullPrompt: string) {
  let lastError: unknown = null;
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        config: {
          responseMimeType: 'application/json',
        },
      });
      const raw = (response.text || '').trim();
      if (!raw) {
        throw new Error(`Empty response from model ${model}`);
      }
      const cleanJson = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      lastError = error;
      if (i < GEMINI_MODELS.length - 1) {
        console.warn(`[ai-parser] Model ${model} error, fallback ke ${GEMINI_MODELS[i + 1]}:`, error);
      }
    }
  }
  throw lastError;
}

export async function parseWhatsAppReport(text: string) {
  try {
    const [products, productTypes] = await Promise.all([
      prisma.product.findMany({
        where: { is_active: true },
        include: { product_type: { select: { code: true, name: true } } },
        orderBy: [{ name: 'asc' }],
      }),
      prisma.productType.findMany({
        where: { is_active: true },
        select: { code: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const productMappingStr = products
      .map((p) => {
        const kat = p.product_type?.name || p.category || '-';
        return `"${p.short_name}" / "${p.name}" [Kategori: ${kat}] -> ${p.sku}`;
      })
      .join(', ');
    const typeMappingStr = productTypes.map(pt => `"${pt.name}" (${pt.code})`).join(', ');

    const cleanedText = text.replace(/^[\/!#]?(lapor|laporkan)\s*/i, '').trim();
    const currentDate = new Date().toLocaleDateString('en-CA');
    const fullPrompt = getSystemPrompt(productMappingStr, typeMappingStr) + '\n\nCURRENT_DATE: ' + currentDate + '\n\nMessage:\n' + cleanedText;

    return await callGeminiWithFallback(fullPrompt);
  } catch (error) {
    console.error('Error parsing WhatsApp report with Gemini:', error);
    return null;
  }
}
