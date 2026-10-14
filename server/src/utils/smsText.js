/**
 * SMS length rules. GSM-7 messages hold 160 characters (153 per part when concatenated);
 * any character outside the GSM alphabet forces UCS-2: 70 characters (67 per part).
 */
const GSM_BASIC = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€\f';
const GSM_BASIC_SET = new Set(GSM_BASIC);
const GSM_EXTENDED_SET = new Set(GSM_EXTENDED);

export const MAX_SEGMENTS = 6;

export function analyzeSms(text = '') {
  const chars = [...text];
  let gsm = true;
  let units = 0;
  for (const char of chars) {
    if (GSM_BASIC_SET.has(char)) units += 1;
    else if (GSM_EXTENDED_SET.has(char)) units += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) {
    return {
      encoding: 'GSM-7',
      characters: units,
      segments: units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153),
      perSegment: units <= 160 ? 160 : 153,
    };
  }
  const length = text.length; // UTF-16 code units
  return {
    encoding: 'UCS-2',
    characters: length,
    segments: length <= 70 ? 1 : Math.ceil(length / 67),
    perSegment: length <= 70 ? 70 : 67,
  };
}
