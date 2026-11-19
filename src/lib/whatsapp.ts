export interface GowaPayload {
  event?: string;
  device_id?: string;
  payload?: any;
  message?: any;
  from?: string;
  chat_id?: string;
  chat_jid?: string;
  body?: string;
  from_name?: string;
  is_from_me?: boolean;
  timestamp?: string;
}

const GOWA_HOST = process.env.GOWA_HOST_URL;
const GOWA_USERNAME = process.env.GOWA_USERNAME;
const GOWA_PASSWORD = process.env.GOWA_PASSWORD;
const GOWA_DEVICE_ID = process.env.GOWA_DEVICE_ID;

function formatGowaRecipient(target: string): string {
  const trimmed = (target || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('@') || trimmed === 'TEST_CHAT_ID') return trimmed;
  let digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}


const getBasicAuth = () => {
  if (!GOWA_USERNAME || !GOWA_PASSWORD) {
    throw new Error('GOWA credentials are not configured');
  }
  return 'Basic ' + Buffer.from(`${GOWA_USERNAME}:${GOWA_PASSWORD}`).toString('base64');
};

export async function sendChatPresence(phoneNumber: string, action: 'composing' | 'paused' = 'composing') {
  if (!GOWA_HOST || phoneNumber === 'TEST_CHAT_ID') return;
  try {
    await fetch(`${GOWA_HOST}/send/presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getBasicAuth(),
        'X-Device-Id': GOWA_DEVICE_ID || '',
      },
      body: JSON.stringify({
        phone: phoneNumber,
        presence: action,
      }),
    });
  } catch (error) {
    console.error('Error sending chat presence', error);
  }
}

export async function readMessage(chatId: string, messageId: string) {
  if (!GOWA_HOST || chatId === 'TEST_CHAT_ID') return;
  try {
    await fetch(`${GOWA_HOST}/send/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getBasicAuth(),
        'X-Device-Id': GOWA_DEVICE_ID || '',
      },
      body: JSON.stringify({
        phone: chatId,
        message_id: messageId,
      }),
    });
  } catch (error) {
    console.error('Error reading message', error);
  }
}

export async function sendMessage(phoneNumber: string, message: string, replyMessageId?: string) {
  if (!GOWA_HOST || phoneNumber === 'TEST_CHAT_ID') return { status: 'mocked' };
  const recipient = formatGowaRecipient(phoneNumber);
  if (!recipient) return { status: 'error', message: 'Nomor tujuan kosong' };
  try {
    const bodyPayload: any = {
      phone: recipient,
      message: message,
      is_group: recipient.endsWith('@g.us'),
    };
    if (replyMessageId) {
      bodyPayload.reply_message_id = replyMessageId;
    }

    const res = await fetch(`${GOWA_HOST}/send/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getBasicAuth(),
        'X-Device-Id': GOWA_DEVICE_ID || '',
      },
      body: JSON.stringify(bodyPayload),
    });
    
    const resText = await res.text();
    if (!res.ok) {
      console.error('GOWA Error Response:', res.status, resText);
      throw new Error(`GOWA API error: ${res.status} ${resText}`);
    }
    
    try {
      return JSON.parse(resText);
    } catch (e) {
      return { status: 'success', data: resText };
    }
  } catch (error) {
    console.error('Error sending message', error);
    return { status: 'error', message: String(error) };
  }
}

export async function getWhatsAppGroups() {
  if (!GOWA_HOST) return { status: 'error', message: 'GOWA_HOST not configured' };
  try {
    const res = await fetch(`${GOWA_HOST}/user/my/groups`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getBasicAuth(),
        'X-Device-Id': GOWA_DEVICE_ID || '',
      },
      cache: 'no-store'
    });
    return res.json();
  } catch (error) {
    console.error('Error fetching groups', error);
    return { status: 'error', message: String(error) };
  }
}
