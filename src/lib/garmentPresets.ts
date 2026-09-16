import { GarmentItem } from './types';

// Crisp Oxford Shirt SVG Data URI
const oxfordShirtSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 600" width="500" height="600">
  <defs>
    <linearGradient id="oxfordGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="50%" stop-color="#F2F3F7" />
      <stop offset="100%" stop-color="#E5E7EB" />
    </linearGradient>
    <filter id="subtleDrop" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  
  <g filter="url(#subtleDrop)">
    <path d="M 170 80 L 90 120 L 35 220 L 75 240 L 120 185 L 125 480 C 180 505, 320 505, 375 480 L 380 185 L 425 240 L 465 220 L 410 120 L 330 80 C 290 95, 210 95, 170 80 Z" 
          fill="url(#oxfordGrad)" stroke="#CBD5E1" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M 125 145 C 200 135, 300 135, 375 145" fill="none" stroke="#94A3B8" stroke-width="1" stroke-dasharray="2,2"/>
    <path d="M 240 85 L 240 495 L 260 495 L 260 85 Z" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1"/>
    <circle cx="250" cy="130" r="3.5" fill="#E2E8F0" stroke="#64748B" stroke-width="0.8"/>
    <circle cx="250" cy="190" r="3.5" fill="#E2E8F0" stroke="#64748B" stroke-width="0.8"/>
    <circle cx="250" cy="250" r="3.5" fill="#E2E8F0" stroke="#64748B" stroke-width="0.8"/>
    <circle cx="250" cy="310" r="3.5" fill="#E2E8F0" stroke="#64748B" stroke-width="0.8"/>
    <circle cx="250" cy="370" r="3.5" fill="#E2E8F0" stroke="#64748B" stroke-width="0.8"/>
    <circle cx="250" cy="430" r="3.5" fill="#E2E8F0" stroke="#64748B" stroke-width="0.8"/>
    <path d="M 155 190 L 210 190 L 210 255 L 182 270 L 155 255 Z" fill="none" stroke="#94A3B8" stroke-width="1"/>
    <path d="M 215 78 L 240 105 L 175 125 L 180 82 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.2"/>
    <path d="M 285 78 L 260 105 L 325 125 L 320 82 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.2"/>
    <path d="M 215 78 C 235 70, 265 70, 285 78 L 270 95 C 255 92, 245 92, 230 95 Z" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="1"/>
    <path d="M 38 215 L 72 235" stroke="#94A3B8" stroke-width="1.2"/>
    <path d="M 462 215 L 428 235" stroke="#94A3B8" stroke-width="1.2"/>
  </g>
</svg>
`)}`;

// Heavyweight 280GSM Washed Black Tee SVG Data URI
const heavyweightTeeSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 580" width="500" height="580">
  <defs>
    <linearGradient id="teeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#24262E" />
      <stop offset="45%" stop-color="#18191E" />
      <stop offset="100%" stop-color="#121316" />
    </linearGradient>
    <filter id="teeShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>
  
  <g filter="url(#teeShadow)">
    <path d="M 180 85 L 70 125 L 30 230 L 95 255 L 125 190 L 125 510 L 375 510 L 375 190 L 405 255 L 470 230 L 430 125 L 320 85 C 275 115, 225 115, 180 85 Z" 
          fill="url(#teeGrad)" stroke="#32353E" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M 125 160 L 75 175" stroke="#3A3E4A" stroke-width="1.5"/>
    <path d="M 375 160 L 425 175" stroke="#3A3E4A" stroke-width="1.5"/>
    <path d="M 180 85 C 220 120, 280 120, 320 85 C 295 72, 205 72, 180 85 Z" fill="#2E313A" stroke="#4B5060" stroke-width="1.8"/>
    <path d="M 190 92 C 225 116, 275 116, 310 92" fill="none" stroke="#1C1D22" stroke-width="1" stroke-dasharray="1.5,1.5"/>
    <line x1="125" y1="492" x2="375" y2="492" stroke="#2D3039" stroke-width="1.2" stroke-dasharray="3,2"/>
    <line x1="125" y1="496" x2="375" y2="496" stroke="#2D3039" stroke-width="1.2" stroke-dasharray="3,2"/>
    <line x1="37" y1="225" x2="90" y2="247" stroke="#2D3039" stroke-width="1.2"/>
    <line x1="463" y1="225" x2="410" y2="247" stroke="#2D3039" stroke-width="1.2"/>
  </g>
</svg>
`)}`;

// Structured Wool Overshirt SVG Data URI
const woolOvershirtSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 620" width="500" height="620">
  <defs>
    <linearGradient id="overshirtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#323640" />
      <stop offset="50%" stop-color="#242831" />
      <stop offset="100%" stop-color="#1B1E24" />
    </linearGradient>
    <filter id="ovsShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="7" stdDeviation="9" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>
  
  <g filter="url(#ovsShadow)">
    <path d="M 175 75 L 80 115 L 25 240 L 75 260 L 118 195 L 118 535 L 382 535 L 382 195 L 425 260 L 475 240 L 420 115 L 325 75 C 285 92, 215 92, 175 75 Z" 
          fill="url(#overshirtGrad)" stroke="#434855" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="235" y="80" width="30" height="455" fill="#2D313C" stroke="#484E5E" stroke-width="1.2"/>
    <circle cx="250" cy="120" r="4.5" fill="#15171C" stroke="#71798D" stroke-width="1"/>
    <circle cx="250" cy="185" r="4.5" fill="#15171C" stroke="#71798D" stroke-width="1"/>
    <circle cx="250" cy="250" r="4.5" fill="#15171C" stroke="#71798D" stroke-width="1"/>
    <circle cx="250" cy="315" r="4.5" fill="#15171C" stroke="#71798D" stroke-width="1"/>
    <circle cx="250" cy="380" r="4.5" fill="#15171C" stroke="#71798D" stroke-width="1"/>
    <circle cx="250" cy="445" r="4.5" fill="#15171C" stroke="#71798D" stroke-width="1"/>
    <rect x="140" y="185" width="70" height="85" fill="#292D37" stroke="#4B5162" stroke-width="1.2" rx="2"/>
    <path d="M 137 185 L 213 185 L 210 205 L 140 205 Z" fill="#20232B" stroke="#4B5162" stroke-width="1.2"/>
    <circle cx="175" cy="195" r="3" fill="#15171C" stroke="#687082" stroke-width="0.8"/>
    <rect x="290" y="185" width="70" height="85" fill="#292D37" stroke="#4B5162" stroke-width="1.2" rx="2"/>
    <path d="M 287 185 L 363 185 L 360 205 L 290 205 Z" fill="#20232B" stroke="#4B5162" stroke-width="1.2"/>
    <circle cx="325" cy="195" r="3" fill="#15171C" stroke="#687082" stroke-width="0.8"/>
    <path d="M 205 75 L 240 110 L 165 130 L 175 75 Z" fill="#3A3F4B" stroke="#525A6D" stroke-width="1.4"/>
    <path d="M 295 75 L 260 110 L 335 130 L 325 75 Z" fill="#3A3F4B" stroke="#525A6D" stroke-width="1.4"/>
    <path d="M 205 75 C 230 65, 270 65, 295 75 L 285 90 C 265 85, 235 85, 215 90 Z" fill="#272B33" stroke="#4A5162" stroke-width="1"/>
    <path d="M 28 235 L 72 255" stroke="#525A6D" stroke-width="1.5"/>
    <path d="M 472 235 L 428 255" stroke="#525A6D" stroke-width="1.5"/>
  </g>
</svg>
`)}`;

export const GARMENT_PRESETS: GarmentItem[] = [
  {
    id: 'oxford-white-shirt',
    name: '01 / Classic Oxford Poplin Shirt',
    category: 'Tailored Shirting',
    editorialCode: 'ESU-01-OXF',
    brand: 'STUDIO E-SUOT',
    colorName: 'Optic White',
    hex: '#F9F9FB',
    description: '120-ply long-staple Italian cotton poplin. Spread collar, mother-of-pearl hardware, split back yoke for articulated drape.',
    fabricSpec: '100% Giza Egyptian Cotton • 135 GSM',
    silhouette: 'Tailored',
    imageUrl: oxfordShirtSvg,
    aspectRatio: 500 / 600,
    anchorPointRatio: { x: 0.5, y: 0.133 },
    shoulderSpanRatio: 0.64,
    scaleFactor: 1.0,
    offsetYFactor: 0.0,
    availableSizes: ['S', 'M', 'L', 'XL'],
    defaultSize: 'M',
    sizeChart: {
      S: { chestCm: 98, shoulderCm: 44.0, lengthCm: 72 },
      M: { chestCm: 104, shoulderCm: 46.0, lengthCm: 74 },
      L: { chestCm: 110, shoulderCm: 48.0, lengthCm: 76 },
      XL: { chestCm: 116, shoulderCm: 50.0, lengthCm: 78 }
    }
  },
  {
    id: 'heavyweight-black-tee',
    name: '02 / 280GSM Heavyweight Tee',
    category: 'Structured Jersey',
    editorialCode: 'ESU-02-TEE',
    brand: 'STUDIO E-SUOT',
    colorName: 'Washed Carbon Black',
    hex: '#16171B',
    description: 'High-density combed dry jersey. 1.25-inch bound rib collar, dropped shoulders, boxy architectural cut.',
    fabricSpec: '100% Combed Compact Cotton • 280 GSM',
    silhouette: 'Boxy / Dropped',
    imageUrl: heavyweightTeeSvg,
    aspectRatio: 500 / 580,
    anchorPointRatio: { x: 0.5, y: 0.146 },
    shoulderSpanRatio: 0.72,
    scaleFactor: 1.0,
    offsetYFactor: 0.0,
    availableSizes: ['S', 'M', 'L', 'XL', 'XXL'],
    defaultSize: 'L',
    sizeChart: {
      S: { chestCm: 106, shoulderCm: 49.0, lengthCm: 68 },
      M: { chestCm: 112, shoulderCm: 51.0, lengthCm: 70 },
      L: { chestCm: 118, shoulderCm: 53.0, lengthCm: 72 },
      XL: { chestCm: 124, shoulderCm: 55.0, lengthCm: 74 },
      XXL: { chestCm: 130, shoulderCm: 57.0, lengthCm: 76 }
    }
  },
  {
    id: 'structured-wool-overshirt',
    name: '03 / Minimalist Wool Overshirt',
    category: 'Outerwear / Layering',
    editorialCode: 'ESU-03-OVS',
    brand: 'STUDIO E-SUOT',
    colorName: 'Deep Slate Graphite',
    hex: '#242831',
    description: 'Double-faced Melton wool blend. Notched camp collar, twin chest flap pockets, horn hardware, straight hemline.',
    fabricSpec: '80% Virgin Wool, 20% Polyamide • 420 GSM',
    silhouette: 'Regular',
    imageUrl: woolOvershirtSvg,
    aspectRatio: 500 / 620,
    anchorPointRatio: { x: 0.5, y: 0.121 },
    shoulderSpanRatio: 0.68,
    scaleFactor: 1.0,
    offsetYFactor: 0.0,
    availableSizes: ['S', 'M', 'L', 'XL'],
    defaultSize: 'M',
    sizeChart: {
      S: { chestCm: 108, shoulderCm: 47.0, lengthCm: 71 },
      M: { chestCm: 114, shoulderCm: 49.0, lengthCm: 73 },
      L: { chestCm: 120, shoulderCm: 51.0, lengthCm: 75 },
      XL: { chestCm: 126, shoulderCm: 53.0, lengthCm: 77 }
    }
  },
  {
    id: 'pleated-tailored-trousers',
    name: '04 / Pleated Tailored Trousers',
    category: 'bottoms',
    editorialCode: 'ESU-04-TRS',
    brand: 'STUDIO E-SUOT',
    colorName: 'Charcoal Black Melange',
    hex: '#1E2026',
    description: 'Double-pleated tailored trousers with extended waistband tab, pressed central creases, and relaxed straight leg drape.',
    fabricSpec: '100% High-Twist Tropical Wool • 260 GSM',
    silhouette: 'Tailored',
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 800" width="500" height="800">
  <defs>
    <linearGradient id="trouserGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#242730" />
      <stop offset="50%" stop-color="#1B1D24" />
      <stop offset="100%" stop-color="#14161B" />
    </linearGradient>
  </defs>
  <path d="M 120 40 L 380 40 L 390 140 L 400 760 L 270 760 L 250 250 L 230 760 L 100 760 L 110 140 Z" fill="url(#trouserGrad)" stroke="#373B47" stroke-width="2"/>
  <rect x="120" y="40" width="260" height="40" fill="#20232B" stroke="#3D4250" stroke-width="1.5"/>
  <line x1="185" y1="80" x2="185" y2="760" stroke="#3D4250" stroke-width="1.2" stroke-dasharray="4,2"/>
  <line x1="315" y1="80" x2="315" y2="760" stroke="#3D4250" stroke-width="1.2" stroke-dasharray="4,2"/>
  <line x1="250" y1="80" x2="250" y2="250" stroke="#373B47" stroke-width="1.5"/>
</svg>
`)}`,
    aspectRatio: 500 / 800,
    anchorPointRatio: { x: 0.5, y: 0.05 },
    shoulderSpanRatio: 0.85,
    scaleFactor: 1.0,
    offsetYFactor: 0.0,
    availableSizes: ['S', 'M', 'L', 'XL'],
    defaultSize: 'M',
    sizeChart: {
      S: { chestCm: 76, shoulderCm: 40.0, lengthCm: 102 },
      M: { chestCm: 82, shoulderCm: 42.0, lengthCm: 104 },
      L: { chestCm: 88, shoulderCm: 44.0, lengthCm: 106 },
      XL: { chestCm: 94, shoulderCm: 46.0, lengthCm: 108 }
    }
  },
  {
    id: 'washed-straight-denim',
    name: '05 / Washed Selvedge Denim',
    category: 'bottoms',
    editorialCode: 'ESU-05-DNM',
    brand: 'STUDIO E-SUOT',
    colorName: 'Vintage Washed Indigo',
    hex: '#2B3D59',
    description: '14oz rigid Japanese selvedge denim. Mid-rise, classic 5-pocket construction, tobacco stitching, straight leg.',
    fabricSpec: '100% Selvedge Ring-Spun Cotton • 14 OZ',
    silhouette: 'Regular',
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 800" width="500" height="800">
  <defs>
    <linearGradient id="denimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#344A6C" />
      <stop offset="50%" stop-color="#283A56" />
      <stop offset="100%" stop-color="#1C293E" />
    </linearGradient>
  </defs>
  <path d="M 125 40 L 375 40 L 388 135 L 395 760 L 272 760 L 250 240 L 228 760 L 105 760 L 112 135 Z" fill="url(#denimGrad)" stroke="#B87333" stroke-width="1.8"/>
  <rect x="125" y="40" width="250" height="38" fill="#25354E" stroke="#B87333" stroke-width="1.5"/>
  <path d="M 140 78 C 170 80, 190 120, 185 145" fill="none" stroke="#B87333" stroke-width="1.2"/>
  <path d="M 360 78 C 330 80, 310 120, 315 145" fill="none" stroke="#B87333" stroke-width="1.2"/>
  <line x1="250" y1="78" x2="250" y2="240" stroke="#B87333" stroke-width="1.5"/>
  <line x1="228" y1="760" x2="105" y2="760" stroke="#B87333" stroke-width="2.5"/>
  <line x1="395" y1="760" x2="272" y2="760" stroke="#B87333" stroke-width="2.5"/>
</svg>
`)}`,
    aspectRatio: 500 / 800,
    anchorPointRatio: { x: 0.5, y: 0.05 },
    shoulderSpanRatio: 0.85,
    scaleFactor: 1.0,
    offsetYFactor: 0.0,
    availableSizes: ['S', 'M', 'L', 'XL'],
    defaultSize: 'M',
    sizeChart: {
      S: { chestCm: 78, shoulderCm: 40.0, lengthCm: 103 },
      M: { chestCm: 84, shoulderCm: 42.0, lengthCm: 105 },
      L: { chestCm: 90, shoulderCm: 44.0, lengthCm: 107 },
      XL: { chestCm: 96, shoulderCm: 46.0, lengthCm: 109 }
    }
  }
];
