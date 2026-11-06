/**
 * WhatsApp Cloud API (Meta). Nécessite un numéro d'envoi configuré chez Meta.
 * Limite connue : hors fenêtre de 24 h de conversation, Meta impose des modèles (templates) approuvés ;
 * ce module envoie du texte libre, donc il ne fonctionne que dans la fenêtre de service.
 */
import { bzFetch } from './http.server.js';
import { getSecretKey } from './keystore.server.js';

export async function sendWhatsAppText(text: string): Promise<{ success: boolean; error?: string }> {
  const token = getSecretKey('whatsappToken');
  const phoneId = getSecretKey('whatsappPhoneNumberId');
  const to = getSecretKey('whatsappRecipient');
  if (!token || !phoneId || !to) return { success: false, error: 'Configuration WhatsApp incomplète (token, phone number id, destinataire).' };
  try {
    const res = await bzFetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(phoneId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 3800) } }),
      timeoutMs: 8000,
      retries: 0
    });
    if (!res.ok) return { success: false, error: `WhatsApp HTTP ${res.status}` };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Erreur réseau WhatsApp' };
  }
}
