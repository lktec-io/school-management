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
  utility: {
    registered: 'Shule Binafsi Iliyosajiliwa — Zanzibar',
    registration: 'Usajili',
    results: 'Matokeo',
    fees: 'Ada na Risiti',
    contact: 'Wasiliana Nasi',
    language: 'Lugha',
  },
  nav: {
    home: 'Mwanzo',
    about: 'Kuhusu Sisi',
    academics: 'Masomo na Mitaala',
    announcements: 'Matangazo',
    services: 'Huduma Kidijitali',
    login: 'Ingia Kwenye Mfumo',
    openPortal: 'Fungua Mfumo',
    menu: 'Menyu',
  },
  leadership: 'Uongozi',
  slideshow: { previous: 'Picha iliyotangulia', next: 'Picha inayofuata', goTo: 'Nenda kwenye picha', pause: 'Simamisha', play: 'Endelea' },
  about: {
    eyebrow: 'Kuhusu Sisi',
    title: 'Dira, Dhamira na Maadili',
    lead: 'Misingi inayoongoza kila tunachofanya darasani na nje ya darasa.',
    vision: 'Dira',
    mission: 'Dhamira',
    values: 'Maadili ya Msingi',
    standards: 'Viwango vya Elimu Binafsi Zanzibar',
    readMore: 'Soma zaidi',
    readLess: 'Funga',
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
      { code: 'O-LEVEL', title: 'Sekondari — Kidato cha 1–4', text: 'Maandalizi ya mtihani wa taifa (CSEE) kwa masomo ya sayansi, biashara na sanaa.' },
      { code: 'A-LEVEL', title: 'Sekondari — Kidato cha 5–6', text: 'Michepuo maalum inayowaandaa wanafunzi kwa elimu ya juu (ACSEE).' },
    ],
  },
  announcements: {
    eyebrow: 'Matangazo',
    title: 'Habari na Matangazo',
    empty: 'Hakuna matangazo kwa sasa. Tafadhali tembelea tena baadaye.',
    error: 'Matangazo hayakuweza kupakiwa kwa sasa.',
    categories: { general: 'Jumla', admissions: 'Udahili', examinations: 'Mitihani', events: 'Matukio', fees: 'Ada' },
  },
  services: {
    eyebrow: 'Huduma Kidijitali',
    title: 'Huduma za Mtandaoni',
    lead: 'Wazazi na watumishi wanaweza kupata huduma hizi kwa kuingia kwenye mfumo wa shule.',
    items: [
      { key: 'results', title: 'Matokeo na Ripoti', text: 'Pakua ripoti rasmi za maendeleo ya mwanafunzi (PDF).' },
      { key: 'fees', title: 'Ada na Risiti', text: 'Angalia salio la ada na pakua risiti rasmi za malipo.' },
      { key: 'sms', title: 'Taarifa kwa SMS', text: 'Pokea taarifa za malipo, matokeo na matangazo kwa simu.' },
      { key: 'staff', title: 'Mfumo wa Watumishi', text: 'Usimamizi wa wanafunzi, alama, fedha na kumbukumbu.' },
    ],
    action: 'Ingia',
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
  utility: {
    registered: 'Registered Private School — Zanzibar',
    registration: 'Reg. No',
    results: 'Results',
    fees: 'Fees & Receipts',
    contact: 'Contact Us',
    language: 'Language',
  },
  nav: {
    home: 'Home',
    about: 'About Us',
    academics: 'Academics',
    announcements: 'Announcements',
    services: 'Digital Services',
    login: 'Portal Login',
    openPortal: 'Open Portal',
    menu: 'Menu',
  },
  leadership: 'Leadership',
  slideshow: { previous: 'Previous slide', next: 'Next slide', goTo: 'Go to slide', pause: 'Pause', play: 'Play' },
  about: {
    eyebrow: 'About Us',
    title: 'Vision, Mission and Values',
    lead: 'The principles that guide everything we do, in and out of the classroom.',
    vision: 'Vision',
    mission: 'Mission',
    values: 'Core Values',
    standards: 'Zanzibar Private Education Standards',
    readMore: 'Read more',
    readLess: 'Close',
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
      { code: 'O-LEVEL', title: 'Secondary — Form 1–4', text: 'Preparation for the national CSEE in science, business and arts subjects.' },
      { code: 'A-LEVEL', title: 'Secondary — Form 5–6', text: 'Specialised combinations preparing students for higher education (ACSEE).' },
    ],
  },
  announcements: {
    eyebrow: 'Announcements',
    title: 'News and Announcements',
    empty: 'There are no announcements at the moment. Please check back later.',
    error: 'Announcements could not be loaded right now.',
    categories: { general: 'General', admissions: 'Admissions', examinations: 'Examinations', events: 'Events', fees: 'Fees' },
  },
  services: {
    eyebrow: 'Digital Services',
    title: 'Online Services',
    lead: 'Parents and staff can use these services by signing in to the school portal.',
    items: [
      { key: 'results', title: 'Results & Report Cards', text: 'Download official student progress reports (PDF).' },
      { key: 'fees', title: 'Fees & Receipts', text: 'Check fee balances and download official payment receipts.' },
      { key: 'sms', title: 'SMS Notifications', text: 'Receive payment, results and announcement alerts by phone.' },
      { key: 'staff', title: 'Staff Portal', text: 'Manage students, marks, finance and records.' },
    ],
    action: 'Sign in',
  },
  footer: {
    contact: 'Contact',
    quickLinks: 'Quick Links',
    portal: 'School Portal',
    rights: 'All rights reserved.',
  },
};

export const COPY = { sw, en };
