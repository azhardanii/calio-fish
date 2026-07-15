export interface GowaPayload {
  event: string;
  device_id: string;
  payload: {
    id: string;
    from: string;
    chat_id: string;
    body: string;
    from_name: string;
    is_from_me?: boolean;
    timestamp?: string;
  };
}

const GOWA_HOST = process.env.GOWA_HOST_URL;
const GOWA_USERNAME = process.env.GOWA_USERNAME;
const GOWA_PASSWORD = process.env.GOWA_PASSWORD;
const GOWA_DEVICE_ID = process.env.GOWA_DEVICE_ID;


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
  try {
    const bodyPayload: any = {
      phone: phoneNumber,
      message: message,
      is_group: phoneNumber.endsWith('@g.us'),
    };
    if (replyMessageId) {
      bodyPayload.reply_message_id = replyMessageId;
    }

    const res = await fetch(`${GOWA_HOST}/send/message/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getBasicAuth(),
        'X-Device-Id': GOWA_DEVICE_ID || '',
      },
      body: JSON.stringify(bodyPayload),
    });
    return res.json();
  } catch (error) {
    console.error('Error sending message', error);
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
