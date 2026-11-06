/**
 * Gestionnaire de clés / identifiants côté serveur.
 * Stockage en mémoire + variables d'environnement. Les secrets ne sont JAMAIS renvoyés au client
 * (seulement un aperçu masqué) et ne sont jamais écrits sur disque par ce module.
 */

export interface KeyStore {
  twelveDataApiKey: string;
  finnhubApiKey: string;
  githubToken: string;
  telegramBotToken: string;
  telegramChatId: string;
  whatsappToken: string;
  whatsappPhoneNumberId: string;
  whatsappRecipient: string;
}

const ENV_NAMES: Record<keyof KeyStore, string> = {
  twelveDataApiKey: 'TWELVE_DATA_API_KEY',
  finnhubApiKey: 'FINNHUB_API_KEY',
  githubToken: 'GITHUB_TOKEN',
  telegramBotToken: 'TELEGRAM_BOT_TOKEN',
  telegramChatId: 'TELEGRAM_CHAT_ID',
  whatsappToken: 'WHATSAPP_TOKEN',
  whatsappPhoneNumberId: 'WHATSAPP_PHONE_NUMBER_ID',
  whatsappRecipient: 'WHATSAPP_RECIPIENT'
};

const STORE = {} as KeyStore;
(Object.keys(ENV_NAMES) as Array<keyof KeyStore>).forEach(k => {
  STORE[k] = process.env[ENV_NAMES[k]] || '';
});

export function setApiKeys(keys: Partial<KeyStore>): void {
  (Object.keys(ENV_NAMES) as Array<keyof KeyStore>).forEach(k => {
    const v = keys[k];
    if (typeof v === 'string') STORE[k] = v.trim().slice(0, 512);
  });
}

/** Corrigé : l'ancienne version cherchait `TWELVEDATAAPIKEY` (nom inexistant). */
export function getSecretKey(name: keyof KeyStore): string {
  return STORE[name] || process.env[ENV_NAMES[name]] || '';
}

const mask = (s: string) =>
  s && s.length > 8 ? `${s.substring(0, 3)}••••${s.substring(s.length - 3)}` : s ? 'Configurée' : 'Non configurée';

export function getKeysPublicStatus() {
  const entry = (v: string) => ({ configured: Boolean(v), preview: mask(v) });
  return {
    twelveData: entry(getSecretKey('twelveDataApiKey')),
    finnhub: entry(getSecretKey('finnhubApiKey')),
    github: entry(getSecretKey('githubToken')),
    telegram: entry(getSecretKey('telegramBotToken')),
    whatsapp: entry(getSecretKey('whatsappToken'))
  };
}
