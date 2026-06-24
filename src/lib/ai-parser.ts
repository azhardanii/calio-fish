import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are a data extraction assistant for Calio Fish operations.
Your job is to parse unstructured WhatsApp messages in Indonesian into a structured JSON object.
Identify the report type and extract relevant information.

CRITICAL PARSING RULES:
1. Normalize numbers: Convert human readable values like "10ribu" or "10rb" to 10000, "1juta" or "1jt" to 1000000, "seratusribu" to 100000, "50rb" to 50000, "5jt" to 5000000. Strip any non-numeric characters from the final number except for negative signs and decimal points.
2. If "Tanggal" is omitted or not provided in the message, you MUST use the value of CURRENT_DATE provided at the end of the prompt.
3. For weights (kg), ensure the decimal is correctly parsed (e.g. "10,5" or "10.5" -> 10.5).
4. DO NOT expect or parse: target, persentase, or GAP. These are auto-calculated by the system.

Possible report types:
- "MARKETING_OFFLINE"
- "MARKETING_ONLINE"
- "PAKET_KIRIMAN"
- "PEMBERSIHAN"
- "PRODUKSI"
- "DATABASE_AFFILIATE"
- "DISTRIBUSI_SAMPLE"
- "PRESENSI"

Respond ONLY with a valid JSON object, no markdown blocks.
Format:
{
  "report_type": "string",
  "date": "YYYY-MM-DD",
  "data": {}
}

For MARKETING_OFFLINE:
User only sends: omset_harian.
data: { "omset_harian": number }

For MARKETING_ONLINE:
User only sends: platform name, omset_harian. If the message contains both Shopee AND TikTok data in one message, return an ARRAY of two objects.
data: { "platform": "shopee" | "tiktok", "omset_harian": number }
If both platforms in one message, respond with:
{ "report_type": "MARKETING_ONLINE_MULTI", "date": "YYYY-MM-DD", "data": [
  { "platform": "shopee", "omset_harian": number },
  { "platform": "tiktok", "omset_harian": number }
]}

For PAKET_KIRIMAN:
Extract only the values provided in the message. If a channel or product is not mentioned, omit it.
data: { 
  "channels": { "shopee"?: number, "tiktok"?: number, "offline"?: number, "affiliate"?: number, "influencer"?: number, "sample_outlet"?: number },
  "products": { "fs_original"?: number, "fs_sambal_matah"?: number, "fs_soto"?: number, "fs_rendang"?: number, "abon_90"?: number }
}

For PEMBERSIHAN:
data: { "bahan_beku_kg": number, "bahan_bersih_kg": number }

For PRODUKSI:
data: { "kegiatan": string, "bahan_baku_kg": number (optional), "bahan_jadi_kg": number (optional), "total_hasil_pcs": number (optional) }

For DATABASE_AFFILIATE:
data: { "nama": string, "akun_medsos": string, "no_hp": string, "alamat": string, "jenis_postingan": string, "media_upload": string, "ratecard": number, "link_unggahan": string }

For DISTRIBUSI_SAMPLE:
data: { "jenis_sample": string, "total_produk": number, "biaya_ekspedisi": number }

For PRESENSI:
User sends: "HADIR", "IZIN", "SAKIT", dll, dan bisa jadi disertai alasannya. User tidak menyebutkan namanya (nama akan dilacak via Nomor HP pemroses).
data: { "status_kehadiran": "HADIR" | "IZIN" | "SAKIT" | "ALPA", "alasan": string (optional) }`;

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
