/**
 * Trifonia Academy — public website content (Kiswahili / English).
 *
 * Editing guide:
 *  - Photos live in client/public/images/campus/ and client/public/images/tours/ (Unsplash License —
 *    credits in CREDITS.md there). To use the school's own photos, save a JPG under the same file
 *    name (landscape, ≥1600px wide) or point IMAGES / SLIDES / TOURS below at a new file.
 *  - Administration photos: copy portraits to client/public/images/staff/ using the file names in
 *    STAFF (JPG, roughly 4:5). Until a photo exists, an initials frame is shown.
 *  - Instagram: reels in INSTAGRAM_REELS are embedded on the page; the “Follow us” link comes from
 *    School Settings → Instagram page.
 *  - School name, registration number, motto, phones, vision, mission and the headmaster's name come
 *    from School Settings in the portal; announcements are managed there too.
 *  - Portal and login-page labels live in src/i18n/locales/ (sw.js, en.js).
 */

const campus = (file) => `/images/campus/${file}`;
const tours = (file) => `/images/tours/${file}`;

export const IMAGES = {
  overview: campus('teacher-with-students.jpg'),
  administration: campus('teacher-chalkboard.jpg'),
  parents: campus('student-portrait.jpg'),
  scienceLab: campus('science-lab-microscope.jpg'),
  practical: campus('science-lab-practical.jpg'),
  computer: campus('digital-learning.jpg'),
  cta: campus('school-outreach-class.jpg'),
  login: campus('secondary-class-lesson.jpg'),
};

/** Hero background rotation: students in uniform, lessons, the science lab. */
export const SLIDES = [
  { id: 'uniform-class', image: campus('students-uniform-class.jpg'), alt: { sw: 'Wanafunzi katika sare za shule darasani', en: 'Students in school uniform in class' } },
  { id: 'lesson', image: campus('secondary-class-lesson.jpg'), alt: { sw: 'Mwalimu akifundisha darasa la sekondari', en: 'A teacher leading a secondary class' } },
  { id: 'science', image: campus('science-lab-microscope.jpg'), alt: { sw: 'Mwanafunzi akitumia hadubini maabara', en: 'A student using a microscope in the science lab' } },
  { id: 'teacher', image: campus('teacher-with-students.jpg'), alt: { sw: 'Mwalimu akiwa na wanafunzi darasani', en: 'A teacher with students in the classroom' } },
];

/** Educational tours and excursions. */
export const TOURS = [
  { id: 'kilimanjaro', image: tours('kilimanjaro.jpg'), name: 'Kilimanjaro', note: { sw: 'Mlima mrefu zaidi Afrika', en: 'Africa’s highest mountain' } },
  { id: 'ngorongoro', image: tours('ngorongoro.jpg'), name: 'Ngorongoro', note: { sw: 'Kreta na wanyamapori', en: 'The crater and its wildlife' } },
  { id: 'arusha', image: tours('arusha-meru.jpg'), name: 'Arusha', note: { sw: 'Mlima Meru na jiji la Arusha', en: 'Mount Meru and Arusha city' } },
  { id: 'mikumi', image: tours('mikumi.jpg'), name: 'Mikumi', note: { sw: 'Hifadhi ya Taifa ya Mikumi', en: 'Mikumi National Park' } },
  { id: 'bagamoyo', image: tours('bagamoyo.jpg'), name: 'Bagamoyo', note: { sw: 'Mji wa kihistoria', en: 'Historic coastal town' } },
];

/** Instagram reels embedded on the page (https://www.instagram.com/reel/<code>/). */
export const INSTAGRAM_REELS = ['Dd_c3hOgiCW'];

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
    levels: 'Ngazi za Elimu',
    achievements: 'Mafanikio',
    media: 'Video',
    administration: 'Uongozi',
    announcements: 'Matangazo',
    contact: 'Mawasiliano',
    login: 'Ingia Mfumoni',
    openPortal: 'Fungua Mfumo',
    menu: 'Menyu',
  },
  admissions: {
    badge: 'UDAHILI 2027',
    text: 'Nafasi za kujiunga kwa mwaka wa masomo 2027 ziko wazi — Awali (KG), Msingi na Sekondari.',
    call: 'Piga simu',
  },
  hero: {
    eyebrow: 'Elimu ya Awali, Msingi na Sekondari',
    intro: 'Tunawalea wanafunzi wenye maarifa, nidhamu na ujasiri — kwa walimu wenye sifa, maabara za kisasa na ushirikiano wa karibu na wazazi.',
    primary: 'Ingia Mfumoni',
    secondary: 'Fahamu shule yetu',
    highlights: ['Ufaulu wa 100% CSEE', 'Daraja la Kwanza (Division One)', 'Ziara za kielimu Tanzania'],
  },
  overview: {
    eyebrow: 'Kuhusu Shule',
    title: 'Mazingira bora ya kujifunzia na kukua',
    lead: 'Trifonia Academy inachanganya ufundishaji makini, nidhamu na teknolojia ili kila mwanafunzi afikie uwezo wake kamili.',
    vision: 'Dira',
    mission: 'Dhamira',
    defaultVision: 'Kuwa kituo bora cha elimu Zanzibar kinachotoa wahitimu wenye maarifa, maadili mema na ujuzi wa kushindana kitaifa na kimataifa.',
    defaultMission: 'Kutoa elimu bora yenye kuzingatia mitaala rasmi, malezi mema na matumizi ya teknolojia, kwa kushirikiana na wazazi na jamii.',
    values: ['Uadilifu', 'Nidhamu', 'Ubora wa Kitaaluma', 'Ushirikiano'],
    valuesLabel: 'Maadili yetu',
    imageAlt: 'Mwalimu akiwa na wanafunzi darasani',
  },
  levels: {
    eyebrow: 'Ngazi za Elimu',
    title: 'Kuanzia Awali hadi Sekondari',
    lead: 'Mwanafunzi anaweza kusoma Trifonia Academy tangu elimu ya awali hadi kuhitimu sekondari.',
    items: [
      { code: 'AWALI', title: 'Elimu ya Awali (Pre-Unit / KG)', text: 'Msingi imara wa kusoma, kuandika, kuhesabu na stadi za maisha katika mazingira ya upendo.' },
      { code: 'MSINGI', title: 'Elimu ya Msingi', text: 'Masomo ya msingi kwa Kiswahili na Kiingereza, sayansi, hisabati, TEHAMA na maadili.' },
      { code: 'SEKONDARI', title: 'Elimu ya Sekondari', text: 'Maandalizi kamili ya mitihani ya taifa (CSEE) kwa michepuo ya sayansi, biashara na sanaa.' },
    ],
    streamsLabel: 'Michepuo ya Sekondari (Kidato cha III–IV)',
    streams: [
      { code: 'SAYANSI', title: 'Sayansi', subjects: 'Fizikia · Kemia · Baiolojia · Hisabati' },
      { code: 'BIASHARA', title: 'Biashara', subjects: 'Biashara · Uhasibu · Hisabati · Uraia' },
      { code: 'SANAA', title: 'Sanaa', subjects: 'Historia · Jiografia · Fasihi · Uraia' },
    ],
  },
  achievements: {
    eyebrow: 'Mafanikio Yetu',
    title: 'Matokeo yanayojieleza yenyewe',
    stats: [
      { value: '100%', label: 'Ufaulu katika mtihani wa taifa wa Kidato cha Nne (CSEE)' },
      { value: 'Div. I', label: 'Wanafunzi wenye Daraja la Kwanza na heshima za kitaaluma' },
      { value: '5', label: 'Maeneo ya ziara za kielimu: Kilimanjaro, Ngorongoro, Arusha, Mikumi na Bagamoyo' },
    ],
    toursTitle: 'Ziara za Kielimu',
    toursLead: 'Masomo nje ya darasa: wanafunzi hujifunza jiografia, historia na mazingira kwa kuona.',
  },
  facilities: {
    eyebrow: 'Mazingira ya Kujifunzia',
    title: 'Maabara za sayansi na TEHAMA',
    items: [
      { key: 'science', title: 'Maabara ya Sayansi', text: 'Majaribio ya vitendo ya Fizikia, Kemia na Baiolojia kwa vifaa vya kisasa.' },
      { key: 'practical', title: 'Masomo ya Vitendo', text: 'Wanafunzi hujifunza kwa kufanya — kila somo la sayansi lina vipindi vya maabara.' },
      { key: 'computer', title: 'Chumba cha Kompyuta', text: 'Mafunzo ya kompyuta na intaneti yanayowaandaa kwa ulimwengu wa kidijitali.' },
    ],
  },
  media: {
    eyebrow: 'Trifonia Kwenye Mitandao',
    title: 'Tazama maisha ya shule',
    lead: 'Video fupi kutoka kwenye ukurasa wetu wa Instagram.',
    follow: 'Tufuate Instagram',
    open: 'Fungua kwenye Instagram',
    frameTitle: 'Video ya Trifonia Academy kwenye Instagram',
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
    imageAlt: 'Mwanafunzi katika sare ya shule',
  },
  announcements: {
    eyebrow: 'Matangazo',
    title: 'Habari na Matangazo',
    live: 'HABARI MPYA',
    new: 'MPYA',
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
    levels: 'Levels',
    achievements: 'Achievements',
    media: 'Videos',
    administration: 'Administration',
    announcements: 'News',
    contact: 'Contact',
    login: 'Login',
    openPortal: 'Open Portal',
    menu: 'Menu',
  },
  admissions: {
    badge: 'ADMISSIONS 2027',
    text: 'Admissions are open for the 2027 academic year — Nursery (KG), Primary and Secondary.',
    call: 'Call us',
  },
  hero: {
    eyebrow: 'Nursery, Primary and Secondary Education',
    intro: 'We raise confident, disciplined and knowledgeable young people — with qualified teachers, modern laboratories and close partnership with parents.',
    primary: 'Login to the portal',
    secondary: 'Discover our school',
    highlights: ['100% CSEE pass rate', 'Division One honours', 'Educational tours across Tanzania'],
  },
  overview: {
    eyebrow: 'About the School',
    title: 'A great place to learn and grow',
    lead: 'Trifonia Academy combines dedicated teaching, discipline and technology so that every learner reaches their full potential.',
    vision: 'Vision',
    mission: 'Mission',
    defaultVision: 'To be a leading centre of learning in Zanzibar, producing graduates with knowledge, strong values and the skills to compete nationally and internationally.',
    defaultMission: 'To provide quality education built on the official curriculum, good upbringing and technology, in partnership with parents and the community.',
    values: ['Integrity', 'Discipline', 'Academic Excellence', 'Partnership'],
    valuesLabel: 'Our values',
    imageAlt: 'A teacher with students in class',
  },
  levels: {
    eyebrow: 'Levels of Education',
    title: 'From Nursery to Secondary',
    lead: 'A learner can study at Trifonia Academy from their first school year through to secondary graduation.',
    items: [
      { code: 'NURSERY', title: 'Nursery (Pre-Unit / KG)', text: 'Strong foundations in reading, writing, numeracy and life skills in a caring environment.' },
      { code: 'PRIMARY', title: 'Primary', text: 'Core subjects in Kiswahili and English, science, mathematics, ICT and ethics.' },
      { code: 'SECONDARY', title: 'Secondary', text: 'Complete preparation for the national CSEE in science, business and arts streams.' },
    ],
    streamsLabel: 'Secondary streams (Form III–IV)',
    streams: [
      { code: 'SCIENCE', title: 'Science', subjects: 'Physics · Chemistry · Biology · Mathematics' },
      { code: 'BUSINESS', title: 'Business', subjects: 'Commerce · Book-keeping · Mathematics · Civics' },
      { code: 'ARTS', title: 'Arts', subjects: 'History · Geography · Literature · Civics' },
    ],
  },
  achievements: {
    eyebrow: 'Our Achievements',
    title: 'Results that speak for themselves',
    stats: [
      { value: '100%', label: 'Pass rate in the national Form Four examination (CSEE)' },
      { value: 'Div. I', label: 'Students earning Division One and academic honours' },
      { value: '5', label: 'Educational tour destinations: Kilimanjaro, Ngorongoro, Arusha, Mikumi and Bagamoyo' },
    ],
    toursTitle: 'Educational Tours',
    toursLead: 'Learning beyond the classroom: students study geography, history and the environment first-hand.',
  },
  facilities: {
    eyebrow: 'Learning Facilities',
    title: 'Science laboratories and ICT',
    items: [
      { key: 'science', title: 'Science Laboratory', text: 'Hands-on Physics, Chemistry and Biology practicals with modern equipment.' },
      { key: 'practical', title: 'Practical Learning', text: 'Students learn by doing — every science subject includes laboratory sessions.' },
      { key: 'computer', title: 'Computer Room', text: 'Computer and internet skills that prepare learners for a digital world.' },
    ],
  },
  media: {
    eyebrow: 'Trifonia Online',
    title: 'See school life in action',
    lead: 'Short videos from our Instagram page.',
    follow: 'Follow us on Instagram',
    open: 'Open on Instagram',
    frameTitle: 'Trifonia Academy video on Instagram',
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
    imageAlt: 'A student in school uniform',
  },
  announcements: {
    eyebrow: 'Announcements',
    title: 'News and Announcements',
    live: 'BREAKING',
    new: 'NEW',
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
