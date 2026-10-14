/** Mirrors server/src/utils/smsText.js so the counter matches what Beem bills. */
const GSM_BASIC = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€\f';
const BASIC = new Set(GSM_BASIC);
const EXTENDED = new Set(GSM_EXTENDED);

export const MAX_SEGMENTS = 6;

export function analyzeSms(text = '') {
  let units = 0;
  for (const char of text) {
    if (BASIC.has(char)) units += 1;
    else if (EXTENDED.has(char)) units += 2;
    else {
      const length = text.length;
      return {
        encoding: 'UCS-2',
        characters: length,
        segments: length <= 70 ? 1 : Math.ceil(length / 67),
        limit: length <= 70 ? 70 : Math.ceil(length / 67) * 67,
      };
    }
  }
  return {
    encoding: 'GSM-7',
    characters: units,
    segments: units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153),
    limit: units <= 160 ? 160 : Math.ceil(units / 153) * 153,
  };
}

export const PLACEHOLDER_LABELS = {
  parent_name: 'Parent name',
  student_name: 'Student name',
  first_name: 'First name',
  reg_no: 'Reg. no',
  class: 'Class',
  school: 'School name',
  balance: 'Fee balance',
  term: 'Term',
  exam: 'Exam',
  average: 'Average',
  grade: 'Grade',
  division: 'Division',
  position: 'Position',
  class_size: 'Class size',
  remark: 'Remark',
};

export const SMS_CATEGORY_LABELS = {
  fee_reminder: 'Fee reminder',
  payment_receipt: 'Payment receipt',
  results: 'Results',
  announcement: 'Announcement',
  other: 'Other',
};

export const FEE_REMINDER_TEMPLATE = 'Dear {parent_name}, kindly note that {student_name} ({reg_no}) has an outstanding fee balance of {balance} for {term}. Please pay at your earliest convenience. {school}';
