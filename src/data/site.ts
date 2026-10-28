export const site = {
  name: 'Sameer Exports',
  tagline: 'Brass Builders',
  url: 'https://brass-builders.com',
  founded: 1994,
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
    map: 'https://www.google.com/maps/place/Sameer+Exports/@27.9303815,78.1375334,17z/data=!4m6!3m5!1s0x3974bb9986410309:0x683f90c2772f122f!8m2!3d27.9303815!4d78.1375334',
  },
  hours: 'Monday to Saturday, 8:30 to 17:00 IST',
  iec: '0694001716',
  gstin: '09ACZPA8884B1Z2',
  markets: ['the UK', 'the US', 'Mexico', 'Germany', 'Canada', 'Australia'],
} as const;

export type Person = { id: string; name: string; role: string; phone: string; phoneHref: string; whatsapp?: string; email: string; ccQuotes?: boolean };

// id matches the portrait file (scripts/build-images.mjs, PEOPLE).
export const people: Person[] = [
  {
    id: 'sanjeev-agarwal',
    name: 'Sanjeev Agarwal',
    role: 'Founder and Owner',
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

export const nav = [
  { href: '/products/', label: 'Products' },
  { href: '/about/', label: 'About' },
  { href: '/contact/', label: 'Contact' },
] as const;
