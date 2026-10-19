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

/**
 * Ready-made SMS templates in Kiswahili and English. `targets` lists the audiences whose
 * placeholders the template uses (results need an exam, balances need students).
 */
const STUDENT_TARGETS = ['all_parents', 'class', 'defaulters', 'students'];
export const SMS_TEMPLATES = [
  {
    id: 'fee_reminder',
    label: { sw: 'Kikumbusho cha ada', en: 'Fee reminder' },
    targets: STUDENT_TARGETS,
    text: {
      sw: 'Ndugu {parent_name}, tunakukumbusha kuwa {student_name} ({reg_no}) ana salio la ada la {balance} kwa {term}. Tafadhali lipa mapema iwezekanavyo. Asante. {school}',
      en: 'Dear {parent_name}, kindly note that {student_name} ({reg_no}) has an outstanding fee balance of {balance} for {term}. Please pay at your earliest convenience. {school}',
    },
  },
  {
    id: 'results',
    label: { sw: 'Matokeo ya mtihani', en: 'Examination results' },
    targets: ['exam_results'],
    text: {
      sw: 'Ndugu {parent_name}, matokeo ya {exam}: {student_name} amepata wastani wa {average}, daraja {grade}, nafasi {position} kati ya {class_size}. {remark}. {school}',
      en: 'Dear {parent_name}, {exam} results: {student_name} scored an average of {average}, grade {grade}, position {position} of {class_size}. {remark}. {school}',
    },
  },
  {
    id: 'term_opening',
    label: { sw: 'Kufunguliwa kwa shule', en: 'School opening' },
    targets: STUDENT_TARGETS,
    text: {
      sw: 'Ndugu {parent_name}, shule itafunguliwa tarehe ___. Tafadhali hakikisha {first_name} anafika mapema akiwa na sare kamili na ada ya {term} imelipwa. {school}',
      en: 'Dear {parent_name}, school reopens on ___. Please make sure {first_name} arrives on time in full uniform and that {term} fees are paid. {school}',
    },
  },
  {
    id: 'meeting',
    label: { sw: 'Mkutano wa wazazi', en: 'Parents meeting' },
    targets: [...STUDENT_TARGETS, 'exam_results', 'custom'],
    text: {
      sw: 'Ndugu mzazi, unakaribishwa kwenye mkutano wa wazazi utakaofanyika shuleni tarehe ___ kuanzia saa ___. Mahudhurio yako ni muhimu. {school}',
      en: 'Dear parent, you are invited to the parents meeting at the school on ___ at ___. Your attendance is important. {school}',
    },
  },
  {
    id: 'announcement',
    label: { sw: 'Tangazo la jumla', en: 'General announcement' },
    targets: [...STUDENT_TARGETS, 'exam_results', 'custom'],
    text: {
      sw: 'Ndugu mzazi, {school} inakutaarifu kuwa ___. Kwa maelezo zaidi wasiliana na ofisi ya shule.',
      en: 'Dear parent, {school} wishes to inform you that ___. For more details please contact the school office.',
    },
  },
];

export function templateText(id, language) {
  return SMS_TEMPLATES.find((template) => template.id === id)?.text[language] ?? '';
}

/** Default fee reminder (Kiswahili — most guardians read SMS in Kiswahili). */
export const FEE_REMINDER_TEMPLATE = templateText('fee_reminder', 'sw');
