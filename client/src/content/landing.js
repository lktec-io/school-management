/**
 * Public landing page content (Kiswahili / English).
 *
 * Editing guide:
 *  - Photos: the defaults are licensed stock photos from images.unsplash.com. For the best result
 *    replace them with the school's own photos — copy JPGs to client/public/images/ and change the
 *    URLs in IMAGES / SLIDES below to e.g. '/images/campus/form-three.jpg' (landscape, ≥1600px wide).
 *  - Administration photos: copy portraits to client/public/images/staff/ using the file names in
 *    STAFF (JPG, roughly 4:5). Until a photo exists, an initials frame is shown.
 *  - Portal and login-page labels live in src/i18n/locales/ (sw.js, en.js).
 *  - School name, contacts, vision, mission and the headmaster's name come from School Settings
 *    in the portal; announcements are managed there too.
 */

const unsplash = (id, width = 1800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=70`;

export const IMAGES = {
  overview: unsplash('1509062522246-3755977927d7', 1200),
  administration: unsplash('1552664730-d307ca884978', 1600),
  parents: unsplash('1523240795612-9a054b0db644', 1200),
  cta: unsplash('1577896851231-70ef18881754', 1800),
  login: unsplash('1571260899304-425eee4c7efc', 2000),
};

/** Hero background rotation: students in class and study discussions. */
export const SLIDES = [
  { id: 'form-three', image: unsplash('1571260899304-425eee4c7efc'), alt: { sw: 'Wanafunzi wa sekondari wakiwa darasani', en: 'Secondary students at work in class' } },
  { id: 'lesson', image: unsplash('1509062522246-3755977927d7'), alt: { sw: 'Mwalimu akifundisha darasa', en: 'A teacher leading a lesson' } },
  { id: 'discussion', image: unsplash('1523240795612-9a054b0db644'), alt: { sw: 'Wanafunzi katika majadiliano ya kujisomea', en: 'Students in a study discussion' } },
  { id: 'participation', image: unsplash('1577896851231-70ef18881754'), alt: { sw: 'Wanafunzi wakinyoosha mikono darasani', en: 'Students raising their hands in class' } },
];

/** School administration (no political office holders). `nameFrom` reads a name from School Settings. */
export const STAFF = [
  { id: 'headmaster', photo: '/images/staff/headmaster.jpg', nameFrom: 'headmasterName', role: { sw: 'Mkuu wa Shule', en: 'Headmaster' }, duty: { sw: 'Uongozi na usimamizi wa shule nzima', en: 'Overall leadership and management' } },
  { id: 'deputy', photo: '/images/staff/deputy-headmaster.jpg', role: { sw: 'Makamu Mkuu wa Shule', en: 'Deputy Headmaster' }, duty: { sw: 'Nidhamu, ratiba na shughuli za kila siku', en: 'Discipline, timetable and daily operations' } },
  { id: 'academic', photo: '/images/staff/academic-master.jpg', role: { sw: 'Mratibu wa Taaluma', en: 'Academic Master' }, duty: { sw: 'Mitaala, mitihani na matokeo', en: 'Curriculum, examinations and results' } },
  { id: 'secretary', photo: '/images/staff/secretary.jpg', role: { sw: 'Katibu wa Shule', en: 'School Secretary' }, duty: { sw: 'Udahili, kumbukumbu na mawasiliano', en: 'Admissions, records and communication' } },
  { id: 'bursar', photo: '/images/staff/bursar.jpg', role: { sw: 'Mhasibu', en: 'Bursar' }, duty: { sw: 'Ada, risiti na fedha za shule', en: 'Fees, receipts and school finance' } },
  { id: 'teachers', photo: '/images/staff/teachers.jpg', role: { sw: 'Walimu na Walimu wa Darasa', en: 'Teachers & Class Teachers' }, duty: { sw: 'Ufundishaji, alama na malezi ya wanafunzi', en: 'Teaching, assessment and pastoral care' } },
];

const sw = {
  registered: 'Shule Binafsi Iliyosajiliwa — Zanzibar',
  registration: 'Namba ya Usajili',
  skip: 'Ruka hadi maudhui',
  nav: {
    home: 'Mwanzo',
    overview: 'Kuhusu Shule',
    streams: 'Michepuo',
    administration: 'Uongozi',
    parents: 'Wazazi',
    announcements: 'Matangazo',
    contact: 'Mawasiliano',
    login: 'Ingia Mfumoni',
    openPortal: 'Fungua Mfumo',
    menu: 'Menyu',
  },
  hero: {
    eyebrow: 'Elimu ya Sekondari — Kidato cha I hadi VI',
    intro: 'Tunawalea wanafunzi wenye maarifa, nidhamu na ujasiri — kwa walimu wenye sifa, mitaala rasmi na ushirikiano wa karibu na wazazi.',
    primary: 'Ingia Mfumoni',
    secondary: 'Fahamu shule yetu',
    highlights: ['Mitaala rasmi ya NECTA', 'Ripoti za matokeo mtandaoni', 'Taarifa kwa wazazi kwa SMS'],
    slide: 'Picha',
  },
  overview: {
    eyebrow: 'Kuhusu Shule',
    title: 'Mazingira bora ya kujifunzia na kukua',
    lead: 'Shule yetu inachanganya ufundishaji makini, nidhamu na teknolojia ili kila mwanafunzi afikie uwezo wake kamili.',
    vision: 'Dira',
    mission: 'Dhamira',
    defaultVision: 'Kuwa kituo bora cha elimu Zanzibar kinachotoa wahitimu wenye maarifa, maadili mema na ujuzi wa kushindana kitaifa na kimataifa.',
    defaultMission: 'Kutoa elimu bora yenye kuzingatia mitaala rasmi, malezi mema na matumizi ya teknolojia, kwa kushirikiana na wazazi na jamii.',
    values: ['Uadilifu', 'Nidhamu', 'Ubora wa Kitaaluma', 'Ushirikiano'],
    valuesLabel: 'Maadili yetu',
    imageAlt: 'Mwalimu na wanafunzi darasani',
  },
  streams: {
    eyebrow: 'Michepuo ya Masomo',
    title: 'Njia ya kila mwanafunzi kufanikiwa',
    lead: 'Kidato cha I–II hujenga msingi wa masomo yote; kuanzia Kidato cha III wanafunzi huchagua mchepuo kulingana na vipaji na malengo yao.',
    oLevel: 'Kidato cha III–IV (CSEE)',
    aLevel: 'Kidato cha V–VI (ACSEE)',
    oStreams: [
      { code: 'SAYANSI', title: 'Mchepuo wa Sayansi', subjects: 'Fizikia · Kemia · Baiolojia · Hisabati' },
      { code: 'SANAA', title: 'Mchepuo wa Sanaa', subjects: 'Historia · Jiografia · Fasihi · Uraia' },
      { code: 'BIASHARA', title: 'Mchepuo wa Biashara', subjects: 'Biashara · Uhasibu · Hisabati · Uraia' },
    ],
    combinations: [
      { code: 'PCM', title: 'Fizikia, Kemia, Hisabati' },
      { code: 'PCB', title: 'Fizikia, Kemia, Baiolojia' },
      { code: 'CBG', title: 'Kemia, Baiolojia, Jiografia' },
      { code: 'HGL', title: 'Historia, Jiografia, Lugha' },
      { code: 'HKL', title: 'Historia, Kiswahili, Lugha' },
      { code: 'EGM', title: 'Uchumi, Jiografia, Hisabati' },
    ],
  },
  administration: {
    eyebrow: 'Muundo wa Uongozi',
    title: 'Timu inayoongoza shule',
    lead: 'Kila idara ina mtu mahususi wa kuwajibika, ili wazazi na wanafunzi wapate huduma kwa haraka.',
    banner: 'Uongozi wa pamoja, maamuzi kwa ajili ya mwanafunzi.',
  },
  parents: {
    eyebrow: 'Mfumo wa Wazazi',
    title: 'Fuatilia maendeleo ya mtoto wako popote ulipo',
    lead: 'Kila mzazi aliyesajiliwa hupata akaunti yake kwenye mfumo wa shule.',
    items: [
      { key: 'reports', title: 'Ripoti za matokeo', text: 'Angalia na pakua ripoti rasmi za kila mtihani kama PDF.' },
      { key: 'fees', title: 'Salio la ada', text: 'Ona ankara, malipo na salio la muhula kwa kila mtoto.' },
      { key: 'receipts', title: 'Risiti rasmi', text: 'Pakua risiti ya kila malipo wakati wowote.' },
      { key: 'sms', title: 'Taarifa kwa SMS', text: 'Pokea uthibitisho wa malipo, matokeo na matangazo kwa simu.' },
    ],
    action: 'Ingia kama mzazi',
    imageAlt: 'Wanafunzi wakijisomea pamoja',
  },
  announcements: {
    eyebrow: 'Matangazo',
    title: 'Habari na Matangazo',
    empty: 'Hakuna matangazo kwa sasa. Tafadhali tembelea tena baadaye.',
    error: 'Matangazo hayakuweza kupakiwa kwa sasa.',
    categories: { general: 'Jumla', admissions: 'Udahili', examinations: 'Mitihani', events: 'Matukio', fees: 'Ada' },
  },
  cta: {
    title: 'Watumishi na wazazi — karibuni kwenye mfumo',
    text: 'Ingia kwa barua pepe au namba ya simu iliyosajiliwa na shule.',
    button: 'Ingia Mfumoni',
  },
  footer: { contact: 'Mawasiliano', quickLinks: 'Viungo vya Haraka', portal: 'Mfumo wa Shule', rights: 'Haki zote zimehifadhiwa.' },
};

const en = {
  registered: 'Registered Private School — Zanzibar',
  registration: 'Reg. No',
  skip: 'Skip to content',
  nav: {
    home: 'Home',
    overview: 'About',
    streams: 'Streams',
    administration: 'Administration',
    parents: 'Parents',
    announcements: 'News',
    contact: 'Contact',
    login: 'Login',
    openPortal: 'Open Portal',
    menu: 'Menu',
  },
  hero: {
    eyebrow: 'Secondary Education — Form I to VI',
    intro: 'We raise confident, disciplined and knowledgeable young people — with qualified teachers, the official curriculum and close partnership with parents.',
    primary: 'Login to the portal',
    secondary: 'Discover our school',
    highlights: ['Official NECTA curriculum', 'Report cards online', 'SMS updates for parents'],
    slide: 'Photo',
  },
  overview: {
    eyebrow: 'About the School',
    title: 'A great place to learn and grow',
    lead: 'Our school combines dedicated teaching, discipline and technology so that every learner reaches their full potential.',
    vision: 'Vision',
    mission: 'Mission',
    defaultVision: 'To be a leading centre of learning in Zanzibar, producing graduates with knowledge, strong values and the skills to compete nationally and internationally.',
    defaultMission: 'To provide quality education built on the official curriculum, good upbringing and technology, in partnership with parents and the community.',
    values: ['Integrity', 'Discipline', 'Academic Excellence', 'Partnership'],
    valuesLabel: 'Our values',
    imageAlt: 'A teacher with students in class',
  },
  streams: {
    eyebrow: 'Academic Streams',
    title: 'A path to success for every learner',
    lead: 'Forms I–II build a broad foundation; from Form III students choose a stream that matches their talents and goals.',
    oLevel: 'Form III–IV (CSEE)',
    aLevel: 'Form V–VI (ACSEE)',
    oStreams: [
      { code: 'SCIENCE', title: 'Science Stream', subjects: 'Physics · Chemistry · Biology · Mathematics' },
      { code: 'ARTS', title: 'Arts Stream', subjects: 'History · Geography · Literature · Civics' },
      { code: 'BUSINESS', title: 'Business Stream', subjects: 'Commerce · Book-keeping · Mathematics · Civics' },
    ],
    combinations: [
      { code: 'PCM', title: 'Physics, Chemistry, Mathematics' },
      { code: 'PCB', title: 'Physics, Chemistry, Biology' },
      { code: 'CBG', title: 'Chemistry, Biology, Geography' },
      { code: 'HGL', title: 'History, Geography, Language' },
      { code: 'HKL', title: 'History, Kiswahili, Language' },
      { code: 'EGM', title: 'Economics, Geography, Mathematics' },
    ],
  },
  administration: {
    eyebrow: 'Administrative Structure',
    title: 'The team that leads the school',
    lead: 'Every office has a clear owner, so parents and students are served quickly.',
    banner: 'Shared leadership, decisions made for the learner.',
  },
  parents: {
    eyebrow: 'Parents Portal',
    title: 'Follow your child’s progress from anywhere',
    lead: 'Every registered parent gets their own account on the school portal.',
    items: [
      { key: 'reports', title: 'Report cards', text: 'View and download the official report card for every examination as a PDF.' },
      { key: 'fees', title: 'Fee balance', text: 'See the bill, payments and term balance for each child.' },
      { key: 'receipts', title: 'Official receipts', text: 'Download the receipt for any payment at any time.' },
      { key: 'sms', title: 'SMS notifications', text: 'Receive payment confirmations, results and announcements by phone.' },
    ],
    action: 'Login as a parent',
    imageAlt: 'Students studying together',
  },
  announcements: {
    eyebrow: 'Announcements',
    title: 'News and Announcements',
    empty: 'There are no announcements at the moment. Please check back later.',
    error: 'Announcements could not be loaded right now.',
    categories: { general: 'General', admissions: 'Admissions', examinations: 'Examinations', events: 'Events', fees: 'Fees' },
  },
  cta: {
    title: 'Staff and parents — welcome to the portal',
    text: 'Sign in with the email address or phone number registered with the school.',
    button: 'Login to the portal',
  },
  footer: { contact: 'Contact', quickLinks: 'Quick Links', portal: 'School Portal', rights: 'All rights reserved.' },
};

export const COPY = { sw, en };
