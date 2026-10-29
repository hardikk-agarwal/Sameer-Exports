export const site = {
  name: 'Sameer Exports',
  tagline: 'Brass Builders',
  url: 'https://brass-builders.com',
  founded: 1994,
  // This business's listings on other sites (structured data sameAs); IndiaMART shows the same GSTIN and IEC.
  profiles: ['https://www.indiamart.com/sameer-exports/'],
  contact: {
    // Business WhatsApp is Sanjeev Agarwal's mobile.
    whatsappNumber: '+91 98370 31885',
    whatsapp: 'https://wa.me/919837031885',
    office: '+91 571 251 3295',
    officeHref: 'tel:+915712513295',
    email: 'info@brass-builders.com',
  },
  address: {
    street: 'C-235, Ramghat Road, UPSIDC Sector 2, Talanagri',
    city: 'Aligarh',
    region: 'Uttar Pradesh',
    postcode: '202002',
    country: 'India',
    lat: 27.9303815,
    lng: 78.1375334,
    map: 'https://maps.app.goo.gl/2Q6cbhhksLy6vDGPA',
  },
  hours: 'Monday to Saturday, 8:30 to 17:00 IST',
  iec: '0694001716',
  gstin: '09ACZPA8884B1Z2',
  markets: ['the UK', 'the US', 'Mexico', 'Germany', 'Canada', 'Australia'],
} as const;

export type Person = { id: string; name: string; role: string; founder?: boolean; phone: string; phoneHref: string; whatsapp?: string; email: string; ccQuotes?: boolean };

// id matches the portrait file (scripts/build-images.mjs, PEOPLE).
export const people: Person[] = [
  {
    id: 'sanjeev-agarwal',
    name: 'Sanjeev Agarwal',
    role: 'CEO',
    founder: true,
    phone: '+91 98370 31885',
    phoneHref: 'tel:+919837031885',
    whatsapp: 'https://wa.me/919837031885',
    email: 'info@brass-builders.com',
  },
  {
    id: 'sarthak-agarwal',
    name: 'Sarthak Agarwal',
    role: 'Director',
    phone: '+91 70377 74646',
    phoneHref: 'tel:+917037774646',
    whatsapp: 'https://wa.me/917037774646',
    email: 'sarthak@brass-builders.com',
    // In CC on every quote request sent from the contact form.
    ccQuotes: true,
  },
];

// About page, "Our team"; id matches the portrait file (scripts/build-images.mjs, PEOPLE).
export const team = [
  { id: 'sp-agarwal', name: 'Er. S.P. Agarwal', role: 'Chief Managing Director' },
  { id: 'hardik-agarwal', name: 'Hardik Agarwal', role: 'Frontend Designer' },
];

export const nav = [
  { href: '/products/', label: 'Products' },
  { href: '/about/', label: 'About' },
  { href: '/contact/', label: 'Contact' },
] as const;
