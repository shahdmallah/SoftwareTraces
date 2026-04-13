export type Difficulty = 'Easy' | 'Moderate' | 'Hard' | 'Expert';

export interface Trail {
  id: string;
  name: string;
  nameAr: string;
  region: string;
  regionAr: string;
  description: string;
  descriptionAr: string;
  distance: number; // km
  duration: string;
  elevationGain: number; // meters
  elevationMin: number;
  elevationMax: number;
  difficulty: Difficulty;
  rating: number;
  reviews: number;
  image: string;
  images: string[];
  features: string[];
  featuresAr: string[];
  hasCheckpoint: boolean;
  checkpointNote?: string;
  coordinates: [number, number]; // [lat, lon]
  mapX: number; // SVG map x position
  mapY: number; // SVG map y position
  tags: string[];
}

export const trails: Trail[] = [
  {
    id: '1',
    name: 'Wadi Qelt Trail',
    nameAr: 'مسار وادي القلط',
    region: 'Jericho',
    regionAr: 'أريحا',
    description: 'A breathtaking canyon hike from Jerusalem to Jericho through the Judean Desert, passing St. George Monastery clinging to the cliff face.',
    descriptionAr: 'رحلة تسلق رائعة عبر الأخدود من القدس إلى أريحا عبر الصحراء اليهودية، مروراً بدير مار جرجس المتشبث بوجه الجرف.',
    distance: 14.5,
    duration: '5–6 hrs',
    elevationGain: 630,
    elevationMin: -350,
    elevationMax: 480,
    difficulty: 'Hard',
    rating: 4.9,
    reviews: 312,
    image: 'https://images.unsplash.com/photo-1679940640486-967ee217bf8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    images: [
      'https://images.unsplash.com/photo-1679940640486-967ee217bf8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
      'https://images.unsplash.com/photo-1763844071701-081c6b7f22c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
      'https://images.unsplash.com/photo-1715273504630-7c42124bc0ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    ],
    features: ['Canyon', 'Monastery', 'Spring', 'Desert'],
    featuresAr: ['أخدود', 'دير', 'ينبوع', 'صحراء'],
    hasCheckpoint: true,
    checkpointNote: 'Israeli checkpoint at Wadi Qelt entrance — allow extra time',
    coordinates: [31.85, 35.38],
    mapX: 242,
    mapY: 258,
    tags: ['desert', 'canyon', 'historical'],
  },
  {
    id: '2',
    name: 'Beit Jibrin Caves Trail',
    nameAr: 'مسار كهوف بيت جبرين',
    region: 'Hebron',
    regionAr: 'الخليل',
    description: 'Explore the ancient Bell Caves carved by Byzantine and Crusader inhabitants amid rolling limestone hills.',
    descriptionAr: 'استكشاف الكهوف الجرسية القديمة المنحوتة من قبل السكان البيزنطيين والصليبيين وسط التلال الكلسية المتدحرجة.',
    distance: 7.2,
    duration: '3–4 hrs',
    elevationGain: 210,
    elevationMin: 310,
    elevationMax: 520,
    difficulty: 'Moderate',
    rating: 4.7,
    reviews: 187,
    image: 'https://images.unsplash.com/photo-1768133571447-8a332c020825?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    images: [
      'https://images.unsplash.com/photo-1768133571447-8a332c020825?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
      'https://images.unsplash.com/photo-1636385927808-8177f1c8f570?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    ],
    features: ['Caves', 'Historical', 'Archaeological'],
    featuresAr: ['كهوف', 'تاريخي', 'أثري'],
    hasCheckpoint: false,
    coordinates: [31.61, 34.90],
    mapX: 176,
    mapY: 352,
    tags: ['historical', 'caves', 'moderate'],
  },
  {
    id: '3',
    name: 'Battir Terraces Trail',
    nameAr: 'مسار مدرجات بتير',
    region: 'Bethlehem',
    regionAr: 'بيت لحم',
    description: 'UNESCO World Heritage terraced farmlands with ancient Roman irrigation channels and panoramic views.',
    descriptionAr: 'أراضٍ زراعية مدرجة على قائمة التراث العالمي لليونسكو مع قنوات ري رومانية قديمة وإطلالات بانورامية.',
    distance: 9.8,
    duration: '4 hrs',
    elevationGain: 320,
    elevationMin: 540,
    elevationMax: 860,
    difficulty: 'Moderate',
    rating: 4.8,
    reviews: 256,
    image: 'https://images.unsplash.com/photo-1722228097356-bd0202d99367?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    images: [
      'https://images.unsplash.com/photo-1722228097356-bd0202d99367?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
      'https://images.unsplash.com/photo-1636385927808-8177f1c8f570?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    ],
    features: ['Terraces', 'Olive Trees', 'UNESCO', 'Village'],
    featuresAr: ['مدرجات', 'أشجار زيتون', 'يونسكو', 'قرية'],
    hasCheckpoint: false,
    coordinates: [31.72, 35.11],
    mapX: 216,
    mapY: 308,
    tags: ['heritage', 'terraces', 'olive'],
  },
  {
    id: '4',
    name: 'Mount Gerizim Summit',
    nameAr: 'قمة جبل جرزيم',
    region: 'Nablus',
    regionAr: 'نابلس',
    description: 'Sacred mountain of the Samaritans with panoramic views over Nablus and the valley.',
    descriptionAr: 'الجبل المقدس للسامريين مع إطلالات بانورامية على نابلس والوادي.',
    distance: 11.3,
    duration: '4–5 hrs',
    elevationGain: 580,
    elevationMin: 440,
    elevationMax: 881,
    difficulty: 'Hard',
    rating: 4.6,
    reviews: 143,
    image: 'https://images.unsplash.com/photo-1772013971664-5808a8e1a102?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    images: [
      'https://images.unsplash.com/photo-1772013971664-5808a8e1a102?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
      'https://images.unsplash.com/photo-1763844071701-081c6b7f22c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    ],
    features: ['Summit', 'Sacred Site', 'Panoramic View'],
    featuresAr: ['قمة', 'موقع مقدس', 'إطلالة بانورامية'],
    hasCheckpoint: false,
    coordinates: [32.2, 35.27],
    mapX: 248,
    mapY: 196,
    tags: ['summit', 'spiritual', 'hard'],
  },
  {
    id: '5',
    name: 'Dead Sea Shore Walk',
    nameAr: 'مسار شاطئ البحر الميت',
    region: 'Jericho',
    regionAr: 'أريحا',
    description: 'Walk along the lowest point on Earth at -430m, with stunning views of the Jordanian mountains across glittering salt waters.',
    descriptionAr: 'تمشَّ على أخفض نقطة على وجه الأرض عند -430م، مع مناظر خلابة للجبال الأردنية عبر المياه المتلألئة الملحية.',
    distance: 5.5,
    duration: '2 hrs',
    elevationGain: 0,
    elevationMin: -430,
    elevationMax: -420,
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 421,
    image: 'https://images.unsplash.com/photo-1715273504630-7c42124bc0ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    images: [
      'https://images.unsplash.com/photo-1715273504630-7c42124bc0ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
      'https://images.unsplash.com/photo-1679940640486-967ee217bf8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    ],
    features: ['Dead Sea', 'Salt Flats', 'Unique Geology', '–430m'],
    featuresAr: ['البحر الميت', 'مسطحات ملحية', 'جيولوجيا فريدة', '-430م'],
    hasCheckpoint: true,
    checkpointNote: 'Area requires coordination — check access status beforehand',
    coordinates: [31.5, 35.5],
    mapX: 292,
    mapY: 330,
    tags: ['water', 'unique', 'easy'],
  },
  {
    id: '6',
    name: 'Bireh–Ramallah Ridge',
    nameAr: 'مسار نجف البيرة–رام الله',
    region: 'Ramallah',
    regionAr: 'رام الله',
    description: 'An urban-edge trail skirting ancient olive groves with sweeping views of the city and hills.',
    descriptionAr: 'مسار على حواف المدينة يتعرج عبر بساتين الزيتون القديمة مع إطلالات واسعة على المدينة والتلال.',
    distance: 6.8,
    duration: '2.5 hrs',
    elevationGain: 190,
    elevationMin: 850,
    elevationMax: 1020,
    difficulty: 'Easy',
    rating: 4.5,
    reviews: 98,
    image: 'https://images.unsplash.com/photo-1726091983472-a7da2540c492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    images: [
      'https://images.unsplash.com/photo-1726091983472-a7da2540c492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
      'https://images.unsplash.com/photo-1722228097356-bd0202d99367?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    ],
    features: ['Olive Groves', 'City Views', 'Urban Edge'],
    featuresAr: ['بساتين زيتون', 'إطلالات المدينة', 'أطراف المدينة'],
    hasCheckpoint: false,
    coordinates: [31.9, 35.2],
    mapX: 234,
    mapY: 240,
    tags: ['easy', 'olive', 'city'],
  },
];

export const mockElevationData = [
  { dist: 0, elev: 480 }, { dist: 1, elev: 420 }, { dist: 2, elev: 350 },
  { dist: 3, elev: 280 }, { dist: 4, elev: 200 }, { dist: 5, elev: 120 },
  { dist: 6, elev: 40 }, { dist: 7, elev: -50 }, { dist: 8, elev: -120 },
  { dist: 9, elev: -200 }, { dist: 10, elev: -280 }, { dist: 11, elev: -320 },
  { dist: 12, elev: -350 }, { dist: 13, elev: -350 }, { dist: 14.5, elev: -350 },
];

export const mockReviews = [
  { id: '1', name: 'Ahmad Khalil', avatar: 'AK', rating: 5, date: '2 days ago', comment: 'Absolutely stunning trail. The monastery view at sunrise is unforgettable. Bring plenty of water!', lang: 'en' },
  { id: '2', name: 'سارة النابلسي', avatar: 'سن', rating: 5, date: 'أسبوع مضى', comment: 'مسار رائع، الطبيعة خلابة والهواء منعش. أنصح بالبدء مبكراً في الصباح.', lang: 'ar' },
  { id: '3', name: 'Yusuf Omar', avatar: 'YO', rating: 4, date: '3 weeks ago', comment: 'Great hike but challenging. The checkpoint added 30 min. Well worth it overall.', lang: 'en' },
];

export const prayerTimes = {
  fajr: '04:32',
  dhuhr: '12:15',
  asr: '15:38',
  maghrib: '18:52',
  isha: '20:18',
};
