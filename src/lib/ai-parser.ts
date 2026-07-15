import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are a data extraction assistant for Calio Fish operations.
Your job is to parse unstructured WhatsApp messages in Indonesian into a structured JSON object.
Identify the report type and extract relevant information according to the new operational schema.

CRITICAL PARSING RULES:
1. Normalize numbers: Convert "10ribu" -> 10000, "1juta" -> 1000000. Strip non-numeric characters except decimals.
2. If "Tanggal" is omitted, use CURRENT_DATE.
3. Replace missing values with null or 0 where appropriate. DO NOT guess percentages if not provided.
4. Return ONLY a valid JSON object. No markdown blocks.
5. AMBIGUITY CHECK: ONLY set "is_ambiguous" to true IF the input is TRULY unparseable or missing CRITICAL data for the targeted report_type. If data like "omset" is provided but "target" is missing, DO NOT mark as ambiguous (just use 0 or null). If it IS ambiguous, the "clarification_message" MUST clearly state EXACTLY what is missing, and provide a STRICT, EXACT example of how the user should type the message. The message must not be vague.

Format:
{
  "report_type": "string",
  "date": "YYYY-MM-DD",
  "is_ambiguous": boolean,
  "clarification_message": "string (only if is_ambiguous is true)",
  "data": {}
}

Supported report types & data schema:

1. PRODUKSI_HASIL
For reporting production output.
data: { "jenis_produksi": "basah" | "kering", "bahan_baku_kg": number, "hasil_kg": number, "hasil_pcs": number, "hpp_batch": number, "kegiatan": "Pembersihan" | "Menggoreng" | "Menjemur" | "Menimbang" | "Mengemas", "product_key": string }

2. STOK_BAHAN
For reporting packaging, spices, or cardboard usage.
data: { "kategori": "KEMASAN" | "BUMBU" | "KARDUS", "jenis_ukuran": string, "masuk": number, "keluar": number }

3. PEMBERSIHAN
For cleaning raw skin.
data: { "bahan_beku_kg": number, "bahan_bersih_kg": number }

4. PENGIRIMAN
For strict logistics tracking (transfers between warehouses or outbound to outlets).
data: { 
  "source_type": "string", // "WAREHOUSE" | "OUTLET"
  "source_name": "string", // e.g. "Banyuwangi", "Malang", "Outlet A"
  "destination_type": "string", // "WAREHOUSE" | "OUTLET" | "SHOPEE" | "TIKTOK" | "DISTRIBUTOR" | "RESELLER" | "ENDUSER" | "AFFILIATE"
  "destination_name": "string", // e.g. "Malang", "Outlet A", "Shopee"
  "items": [ { "product_key": "string", "qty": number } ]
}
**IF source or destination is omitted or vague (e.g., just "kirim ke outlet A" without stating FROM WHERE), set is_ambiguous = true and ask: "Harap sebutkan dari mana barang dikirim (misal: dari Banyuwangi ke Outlet A)."**

4b. RETUR
For returning goods from an Outlet back to a Warehouse.
data: {
  "source_name": "string", // name of the Outlet returning the goods
  "destination_name": "string", // e.g. "Banyuwangi"
  "items": [ { "product_key": "string", "qty": number } ]
}
Map product names EXACTLY to these SKUs: "FS Ori" -> FS-ORI-100, "FS SM" -> FS-SM-100, "FS Soto" -> FS-SOTO-100, "FS Rendang" -> FS-RENDANG-100, "Abon" -> AB-TNA-90. Use these SKUs for product_key in ANY report type.

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

9. PRESENSI
data: { "status_kehadiran": "HADIR" | "IZIN" | "SAKIT", "alasan": string }`;

export async function parseWhatsAppReport(text: string) {
  try {
    const currentDate = new Date().toLocaleDateString('en-CA');
    const fullPrompt = SYSTEM_PROMPT + '\n\nCURRENT_DATE: ' + currentDate + '\n\nMessage:\n' + text;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        { role: 'user', parts: [{ text: fullPrompt }] }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const resultText = response.text || "{}";
    return JSON.parse(resultText);
  } catch (error) {
    console.error('Error parsing WhatsApp report with Gemini:', error);
    return null;
  }
}
