/**
 * Public landing page content (Kiswahili / English).
 *
 * Editing guide:
 *  - Leadership photos: place official portraits in client/public/images/leaders/ using the file
 *    names below (JPG, roughly 3:4 portrait). Until a photo exists, an initials frame is shown.
 *  - Slideshow images: replace `image` with a local file (e.g. '/images/slides/campus.jpg') or any
 *    https://images.unsplash.com URL (allowed by the site's Content Security Policy).
 *  - Portal and login-page labels live in src/i18n/locales/ (sw.js, en.js).
 *  - School name, contacts, vision, mission and the headmaster's name come from
 *    School Settings in the portal; announcements are managed there too.
 */

export const LEADERS = [
  {
    id: 'rais-jmt',
    name: 'Mhe. Dkt. Samia Suluhu Hassan',
    photo: '/images/leaders/rais-jmt.jpg',
    title: { sw: 'Rais wa Jamhuri ya Muungano wa Tanzania', en: 'President of the United Republic of Tanzania' },
  },
  {
    id: 'rais-zanzibar',
    name: 'Mhe. Dkt. Hussein Ali Mwinyi',
    photo: '/images/leaders/rais-zanzibar.jpg',
    title: {
      sw: 'Rais wa Zanzibar na Mwenyekiti wa Baraza la Mapinduzi',
      en: 'President of Zanzibar and Chairman of the Revolutionary Council',
    },
  },
  {
    id: 'mkuu-wa-shule',
    // The name is taken from School Settings → "Headmaster's name" when set.
    name: null,
    photo: '/images/leaders/mkuu-wa-shule.jpg',
    title: { sw: 'Mkuu wa Shule', en: 'Head of School' },
  },
];

export const SLIDES = [
  {
    id: 'campus',
    image: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&w=1600&q=70',
    tag: { sw: 'Maisha ya Shule', en: 'Campus Life' },
    title: { sw: 'Mazingira Salama ya Kujifunzia', en: 'A Safe Place to Learn and Grow' },
    text: {
      sw: 'Wanafunzi wetu hujifunza katika mazingira yenye nidhamu, upendo na uangalizi wa karibu wa walimu.',
      en: 'Our students learn in a disciplined, caring environment with close attention from their teachers.',
    },
  },
  {
    id: 'ict',
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1600&q=70',
    tag: { sw: 'TEHAMA', en: 'ICT' },
    title: { sw: 'Maabara za Kisasa za Kompyuta', en: 'Modern Computer Laboratories' },
    text: {
      sw: 'Tunawaandaa wanafunzi kwa ulimwengu wa kidijitali kupitia mafunzo ya vitendo ya TEHAMA.',
      en: 'We prepare learners for a digital world through hands-on ICT training.',
    },
  },
  {
    id: 'vision',
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&q=70',
    tag: { sw: 'Dira Yetu', en: 'Our Vision' },
    title: { sw: 'Elimu Bora kwa Maendeleo ya Zanzibar', en: 'Quality Education for the Development of Zanzibar' },
    text: {
      sw: 'Kujenga kizazi chenye maarifa, maadili na ujuzi wa kuchangia maendeleo ya Zanzibar na Tanzania.',
      en: 'Raising a generation with the knowledge, values and skills to build Zanzibar and Tanzania.',
    },
  },
  {
    id: 'excellence',
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=70',
    tag: { sw: 'Ubora wa Kitaaluma', en: 'Academic Excellence' },
    title: { sw: 'Matokeo Bora, Kila Mwaka', en: 'Excellence in Every Examination' },
    text: {
      sw: 'Ufuatiliaji wa karibu wa maendeleo ya kila mwanafunzi kupitia ripoti rasmi na mawasiliano na wazazi.',
      en: 'Close tracking of every learner through official report cards and regular contact with parents.',
    },
  },
];

const sw = {
  langName: 'Kiswahili',
  registered: 'Shule Binafsi Iliyosajiliwa — Zanzibar',
  registration: 'Namba ya Usajili',
  skip: 'Ruka hadi maudhui',
  nav: {
    home: 'Mwanzo',
    features: 'Huduma',
    about: 'Kuhusu Sisi',
    academics: 'Masomo',
    announcements: 'Matangazo',
    contact: 'Mawasiliano',
    login: 'Ingia Mfumoni',
    openPortal: 'Fungua Mfumo',
    menu: 'Menyu',
    language: 'Lugha',
  },
  hero: {
    eyebrow: 'Mfumo wa Usimamizi wa Shule',
    intro: 'Elimu bora inayoungwa mkono na mfumo wa kisasa: matokeo, ada, risiti na mawasiliano na wazazi — yote mahali pamoja, kwa usalama.',
    primary: 'Ingia Mfumoni',
    secondary: 'Fahamu zaidi',
    highlights: [
      { value: 'Awali – Kidato 6', label: 'Ngazi za elimu' },
      { value: 'NECTA', label: 'Mitaala rasmi' },
      { value: 'SMS', label: 'Taarifa kwa wazazi' },
    ],
  },
  leadership: 'Uongozi',
  slideshow: { previous: 'Picha iliyotangulia', next: 'Picha inayofuata', goTo: 'Nenda kwenye picha', pause: 'Simamisha', play: 'Endelea' },
  features: {
    eyebrow: 'Huduma za Mfumo',
    title: 'Kila kitu shule inahitaji, kwenye mfumo mmoja',
    lead: 'Walimu, uongozi, mhasibu na wazazi wanafanya kazi pamoja kwa taarifa sahihi na za wakati.',
    items: [
      { key: 'academic', title: 'Taaluma', text: 'Usajili wa wanafunzi, kuingiza alama, madaraja ya NECTA, nafasi darasani na ripoti rasmi za PDF.' },
      { key: 'finance', title: 'Fedha', text: 'Mpangilio wa ada kwa darasa, malipo yenye risiti rasmi, punguzo, wadaiwa na matumizi ya shule.' },
      { key: 'parents', title: 'Mfumo wa Wazazi', text: 'Wazazi huona salio la ada, risiti na ripoti za matokeo za watoto wao popote walipo.' },
      { key: 'sms', title: 'Taarifa kwa SMS', text: 'Vikumbusho vya ada, uthibitisho wa malipo, matokeo na matangazo hufika moja kwa moja kwenye simu.' },
    ],
  },
  about: {
    eyebrow: 'Kuhusu Sisi',
    title: 'Dira, Dhamira na Maadili',
    lead: 'Misingi inayoongoza kila tunachofanya darasani na nje ya darasa.',
    vision: 'Dira',
    mission: 'Dhamira',
    values: 'Maadili ya Msingi',
    standards: 'Viwango vya Elimu',
    defaultVision: 'Kuwa kituo bora cha elimu Zanzibar kinachotoa wahitimu wenye maarifa, maadili mema na ujuzi wa kushindana kitaifa na kimataifa.',
    defaultMission: 'Kutoa elimu bora yenye kuzingatia mitaala rasmi, malezi mema na matumizi ya teknolojia, kwa kushirikiana na wazazi na jamii.',
    valueList: [
      { title: 'Uadilifu', text: 'Ukweli, uaminifu na uwajibikaji katika kila jambo.' },
      { title: 'Nidhamu', text: 'Heshima, utii wa sheria na kujituma katika masomo.' },
      { title: 'Ubora wa Kitaaluma', text: 'Kujitahidi kufikia viwango vya juu vya ufaulu.' },
    ],
    standardList: [
      'Imesajiliwa na Wizara ya Elimu na Mafunzo ya Amali Zanzibar',
      'Mitaala rasmi na mitihani ya kitaifa (NECTA) kwa sekondari',
      'Walimu wenye sifa na mafunzo endelevu',
      'Mazingira salama na kumbukumbu rasmi za mwanafunzi',
    ],
  },
  academics: {
    eyebrow: 'Masomo na Mitaala',
    title: 'Ngazi za Elimu',
    lead: 'Tunafuata mitaala rasmi ya Zanzibar na Tanzania kuanzia elimu ya awali hadi kidato cha sita.',
    levels: [
      { code: 'AWALI', title: 'Elimu ya Awali', text: 'Msingi imara wa kusoma, kuandika, kuhesabu na stadi za maisha.' },
      { code: 'MSINGI', title: 'Elimu ya Msingi', text: 'Masomo ya msingi kwa Kiswahili na Kiingereza, sayansi, hisabati na maadili.' },
      { code: 'O-LEVEL', title: 'Kidato cha 1–4', text: 'Maandalizi ya mtihani wa taifa (CSEE) kwa masomo ya sayansi, biashara na sanaa.' },
      { code: 'A-LEVEL', title: 'Kidato cha 5–6', text: 'Michepuo maalum inayowaandaa wanafunzi kwa elimu ya juu (ACSEE).' },
    ],
  },
  announcements: {
    eyebrow: 'Matangazo',
    title: 'Habari na Matangazo',
    empty: 'Hakuna matangazo kwa sasa. Tafadhali tembelea tena baadaye.',
    error: 'Matangazo hayakuweza kupakiwa kwa sasa.',
    categories: { general: 'Jumla', admissions: 'Udahili', examinations: 'Mitihani', events: 'Matukio', fees: 'Ada' },
  },
  cta: {
    title: 'Fuatilia maendeleo ya mwanafunzi wakati wowote',
    text: 'Watumishi na wazazi waliosajiliwa wanaweza kuingia kwa barua pepe au namba ya simu iliyosajiliwa na shule.',
    button: 'Ingia Mfumoni',
  },
  footer: {
    contact: 'Mawasiliano',
    quickLinks: 'Viungo vya Haraka',
    portal: 'Mfumo wa Shule',
    rights: 'Haki zote zimehifadhiwa.',
  },
};

const en = {
  langName: 'English',
  registered: 'Registered Private School — Zanzibar',
  registration: 'Reg. No',
  skip: 'Skip to content',
  nav: {
    home: 'Home',
    features: 'Features',
    about: 'About',
    academics: 'Academics',
    announcements: 'News',
    contact: 'Contact',
    login: 'Login',
    openPortal: 'Open Portal',
    menu: 'Menu',
    language: 'Language',
  },
  hero: {
    eyebrow: 'School Management Portal',
    intro: 'Quality education backed by modern tools: results, fees, receipts and parent communication — all in one secure place.',
    primary: 'Login to the portal',
    secondary: 'Learn more',
    highlights: [
      { value: 'Nursery – Form 6', label: 'Levels of education' },
      { value: 'NECTA', label: 'Official curriculum' },
      { value: 'SMS', label: 'Updates for parents' },
    ],
  },
  leadership: 'Leadership',
  slideshow: { previous: 'Previous slide', next: 'Next slide', goTo: 'Go to slide', pause: 'Pause', play: 'Play' },
  features: {
    eyebrow: 'Portal Features',
    title: 'Everything the school runs on, in one system',
    lead: 'Teachers, leadership, the bursar and parents work from the same accurate, up-to-date records.',
    items: [
      { key: 'academic', title: 'Academics', text: 'Student registration, marks entry, NECTA grading, class positions and official PDF report cards.' },
      { key: 'finance', title: 'Finance', text: 'Fee structures per class, payments with official receipts, discounts, defaulters and school expenses.' },
      { key: 'parents', title: 'Parents Portal', text: 'Parents see fee balances, receipts and their children’s report cards from anywhere.' },
      { key: 'sms', title: 'SMS Notifications', text: 'Fee reminders, payment confirmations, results and announcements go straight to parents’ phones.' },
    ],
  },
  about: {
    eyebrow: 'About Us',
    title: 'Vision, Mission and Values',
    lead: 'The principles that guide everything we do, in and out of the classroom.',
    vision: 'Vision',
    mission: 'Mission',
    values: 'Core Values',
    standards: 'Education Standards',
    defaultVision: 'To be a leading centre of learning in Zanzibar, producing graduates with knowledge, strong values and the skills to compete nationally and internationally.',
    defaultMission: 'To provide quality education built on the official curriculum, good upbringing and technology, in partnership with parents and the community.',
    valueList: [
      { title: 'Integrity', text: 'Honesty, trustworthiness and accountability in everything.' },
      { title: 'Discipline', text: 'Respect, obedience to rules and commitment to study.' },
      { title: 'Academic Excellence', text: 'Striving for the highest standards of achievement.' },
    ],
    standardList: [
      'Registered with the Zanzibar Ministry of Education and Vocational Training',
      'Official curriculum and national examinations (NECTA) at secondary level',
      'Qualified teachers with continuous professional development',
      'A safe environment and official student records',
    ],
  },
  academics: {
    eyebrow: 'Academics',
    title: 'Levels of Education',
    lead: 'We follow the official Zanzibar and Tanzania curricula from pre-primary to Form Six.',
    levels: [
      { code: 'NURSERY', title: 'Pre-Primary', text: 'Strong foundations in reading, writing, numeracy and life skills.' },
      { code: 'PRIMARY', title: 'Primary', text: 'Core subjects in Kiswahili and English, science, mathematics and ethics.' },
      { code: 'O-LEVEL', title: 'Form 1–4', text: 'Preparation for the national CSEE in science, business and arts subjects.' },
      { code: 'A-LEVEL', title: 'Form 5–6', text: 'Specialised combinations preparing students for higher education (ACSEE).' },
    ],
  },
  announcements: {
    eyebrow: 'Announcements',
    title: 'News and Announcements',
    empty: 'There are no announcements at the moment. Please check back later.',
    error: 'Announcements could not be loaded right now.',
    categories: { general: 'General', admissions: 'Admissions', examinations: 'Examinations', events: 'Events', fees: 'Fees' },
  },
  cta: {
    title: 'Follow every learner’s progress, any time',
    text: 'Registered staff and parents sign in with the email address or phone number held by the school.',
    button: 'Login to the portal',
  },
  footer: {
    contact: 'Contact',
    quickLinks: 'Quick Links',
    portal: 'School Portal',
    rights: 'All rights reserved.',
  },
};

export const COPY = { sw, en };
