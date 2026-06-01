import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

export type Language = 'ar' | 'en';

type TranslationEntry = {
  ar: string;
  en: string;
};

export type TranslationKey = keyof typeof translations;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

const translations = {
  // Global
  appName: { ar: 'مسارات فلسطين', en: 'Palestine Trails' },
  back: { ar: 'رجوع', en: 'Back' },
  next: { ar: 'التالي', en: 'Next' },
  skip: { ar: 'تخطي', en: 'Skip' },
  getStarted: { ar: 'ابدأ الآن', en: 'Get Started' },
  search: { ar: 'بحث', en: 'Search' },
  all: { ar: 'الكل', en: 'All' },
  any: { ar: 'أي', en: 'Any' },
  viewDetails: { ar: 'عرض التفاصيل', en: 'View Details' },
  record: { ar: 'تسجيل', en: 'Record' },
  trailNotFound: { ar: 'المسار غير موجود', en: 'Trail not found' },

  // Onboarding
  onboardingSlide1Title: { ar: 'اكتشف مسارات فلسطين', en: "Discover Palestine's Trails" },
  onboardingSlide1Subtitle: { ar: 'استكشف الجمال الطبيعي من وادي القلط إلى جبال الخليل', en: 'Explore the natural beauty from Wadi Qelt to the Hebron Mountains' },
  onboardingSlide2Title: { ar: 'سجّل رحلتك', en: 'Record Your Journey' },
  onboardingSlide2Subtitle: { ar: 'تتبع مساراتك في الوقت الفعلي، وحافظ على ذكرياتك للأبد', en: 'Track your routes in real time and keep your memories forever' },
  onboardingSlide3Title: { ar: 'انضم إلى المجتمع', en: 'Join the Community' },
  onboardingSlide3Subtitle: { ar: 'شارك تجاربك مع آلاف المتسلقين الفلسطينيين حول العالم', en: 'Share your adventures with thousands of Palestinian hikers worldwide' },

  // Auth
  authWelcomeBack: { ar: 'مرحباً بعودتك', en: 'Welcome Back' },
  authCreateAccount: { ar: 'إنشاء حساب', en: 'Create Account' },
  authFullName: { ar: 'الاسم الكامل', en: 'Full Name' },
  authEmail: { ar: 'البريد الإلكتروني', en: 'Email' },
  authPassword: { ar: 'كلمة المرور', en: 'Password' },
  authSignIn: { ar: 'تسجيل الدخول', en: 'Sign In' },
  authSignUp: { ar: 'إنشاء حساب', en: 'Sign Up' },
  authToggleToSignUp: { ar: 'ليس لديك حساب؟ أنشئ حساباً', en: "Don't have an account? Sign Up" },
  authToggleToSignIn: { ar: 'لديك حساب؟ سجّل الدخول', en: 'Already have an account? Sign In' },
  authErrorTitle: { ar: 'خطأ', en: 'Error' },
  authErrorFillAll: { ar: 'يرجى تعبئة جميع الحقول', en: 'Please fill in all fields' },

  // Explore
  exploreTitle: { ar: 'استكشاف المسارات', en: 'Explore Trails' },
  exploreSubtitle: { ar: 'اعثر على المسار المناسب لك', en: 'Find the right trail for you' },
  exploreSearchPlaceholder: { ar: 'ابحث عن مسار...', en: 'Search trails...' },
  exploreCreateTrail: { ar: 'إضافة مسار', en: 'Add a Trail' },
  exploreCreateTrailSub: { ar: 'افتح أداة الإنشاء وحدد نقطة البداية والنهاية', en: 'Open the trail creator and place start and end points' },
  filterDifficulty: { ar: 'الصعوبة', en: 'Difficulty' },
  filterLength: { ar: 'المسافة', en: 'Distance' },
  filterFeature: { ar: 'الميزات', en: 'Features' },
  difficultyEasy: { ar: 'سهل', en: 'Easy' },
  difficultyModerate: { ar: 'متوسط', en: 'Moderate' },
  difficultyHard: { ar: 'صعب', en: 'Hard' },
  lengthAny: { ar: 'أي مسافة', en: 'Any distance' },
  lengthShort: { ar: 'أقل من 7كم', en: '<7km' },
  lengthMedium: { ar: '7–12كم', en: '7–12km' },
  lengthLong: { ar: 'أكثر من 12كم', en: '>12km' },
  reviewsAny: { ar: 'أي عدد', en: 'Any' },
  reviewsProven: { ar: 'مثبت (10+)', en: 'Proven (10+)' },
  reviewsPopular: { ar: 'شائع (50+)', en: 'Popular (50+)' },
  reviewsLegendary: { ar: 'أسطوري (200+)', en: 'Legendary (200+)' },
  featureWater: { ar: 'مياه', en: 'Water' },
  featureHistorical: { ar: 'تاريخي', en: 'Historical' },
  featureOlive: { ar: 'زيتون', en: 'Olive' },
  featureSummit: { ar: 'قمة', en: 'Summit' },
  statDistance: { ar: 'المسافة', en: 'Distance' },
  statDuration: { ar: 'المدة', en: 'Duration' },
  statElevation: { ar: 'الارتفاع', en: 'Elevation' },

  // History
  historyTitle: { ar: 'سجل الرحلات', en: 'Hiking History' },
  historySubtitle: { ar: 'ملخّص نشاطك', en: 'Your activity summary' },
  historyTabList: { ar: 'القائمة', en: 'List' },
  historyTabCalendar: { ar: 'التقويم', en: 'Calendar' },
  historyTotalDistance: { ar: 'إجمالي المسافة', en: 'Total distance' },
  historyTripsCount: { ar: 'عدد الرحلات', en: 'Trips' },
  historyTotalTime: { ar: 'إجمالي الوقت', en: 'Total time' },
  historyMonthTitle: { ar: 'أبريل ٢٠٢٦', en: 'April 2026' },
  historyMonthTitleEnOnly: { ar: 'April 2026', en: 'April 2026' },
  historyThisMonthHikes: { ar: 'رحلات هذا الشهر', en: 'Hikes this month' },
  historyTotalKm: { ar: 'المسافة الكلية', en: 'Total distance' },
  historyHighestElevation: { ar: 'أعلى ارتفاع', en: 'Highest elevation' },
  historyAvgDuration: { ar: 'متوسط المدة', en: 'Avg duration' },

  // Activity
  activityHistory: { ar: 'السجل', en: 'History' },
  activityJournal: { ar: 'المذكرات', en: 'Journal' },
  activityCommunity: { ar: 'المجتمع', en: 'Community' },
  activityWriteEntry: { ar: 'اكتب ملاحظة جديدة', en: 'Write new journal entry' },

  // Saved
  savedTitle: { ar: 'المحفوظة', en: 'Saved Trails' },
  savedSubtitle: { ar: 'المسارات التي تريد العودة إليها لاحقاً', en: 'Trails you want to come back to later' },

  // Trail detail
  trailDetailDistance: { ar: 'المسافة', en: 'Distance' },
  trailDetailDuration: { ar: 'المدة', en: 'Duration' },
  trailDetailDifficulty: { ar: 'الصعوبة', en: 'Difficulty' },
  trailDetailRating: { ar: 'التقييم', en: 'Rating' },
  reviews: { ar: 'مراجعات', en: 'reviews' },

  // Recording
  recordingStatusRecording: { ar: 'جارٍ التسجيل', en: 'Recording' },
  recordingStatusPaused: { ar: 'متوقف مؤقتاً', en: 'Paused' },
  recordingStatusStopped: { ar: 'تم الإيقاف', en: 'Stopped' },
  recordingElapsed: { ar: 'الوقت المنقضي', en: 'Elapsed time' },
  recordingPace: { ar: 'الوتيرة', en: 'Pace' },
  recordingPaceUnit: { ar: 'دقيقة/كم', en: 'min/km' },

  profileName: { ar: 'أحمد خليل', en: 'Ahmad Khalil' },
  profileSub: { ar: 'متسلق ومستكشف مسارات', en: 'Hiker & trail explorer' },
  profileLocation: { ar: 'رام الله، فلسطين 🇵🇸', en: 'Ramallah, Palestine 🇵🇸' },
  edit: { ar: 'تعديل', en: 'Edit' },
  profileTotalDistance: { ar: 'إجمالي المسافة', en: 'Total distance' },
  profileCompletedTrips: { ar: 'رحلات مكتملة', en: 'Completed trips' },
  profileBadges: { ar: 'الإنجازات', en: 'Badges' },
  unitKm: { ar: 'كم', en: 'km' },
  unitTrips: { ar: 'رحلات', en: 'trips' },
  unitBadges: { ar: 'شارات', en: 'badges' },
  achievementsTitle: { ar: 'الإنجازات', en: 'Achievements' },
  nextMilestone: { ar: 'الهدف القادم', en: 'Next milestone' },
  languageTitle: { ar: 'اللغة', en: 'Language' },
  languageArabic: { ar: 'العربية', en: 'Arabic' },
  languageEnglish: { ar: 'الإنجليزية', en: 'English' },
  logout: { ar: 'تسجيل الخروج', en: 'Sign Out' },
  settingLanguage: { ar: 'اللغة', en: 'Language' },
  settingFavorites: { ar: 'المفضلة', en: 'Favorites' },
  settingNotifications: { ar: 'الإشعارات', en: 'Notifications' },
  settingPrivacy: { ar: 'الخصوصية', en: 'Privacy' },
  settingGeneral: { ar: 'الإعدادات العامة', en: 'General Settings' },
  languageCurrent: { ar: 'العربية', en: 'English' },
  favoritesCount: { ar: 'عدد المفضلات', en: 'Favorites count' },
  notificationsOn: { ar: 'مفعّل', en: 'On' },
  items: { ar: 'عناصر', en: 'items' },
  filtersShow: { ar: 'إظهار المرشحات', en: 'Show filters' },
  filtersHide: { ar: 'إخفاء المرشحات', en: 'Hide filters' },
  tabExplore: { ar: 'استكشاف', en: 'Explore' },
  tabSaved: { ar: 'المحفوظة', en: 'Saved' },
  tabMap: { ar: 'الخريطة', en: 'Map' },
  tabActivity: { ar: 'الخلاصة', en: 'Feed' },
  tabProfile: { ar: 'الملف', en: 'Profile' },
  activitySubtitle: { ar: 'قصتك في المشي ورحلاتك السابقة وتحديثات المجتمع في مكان واحد', en: 'Your hiking story, past trips, and community moments in one place.' },
  detailWeatherTitle: { ar: 'الطقس', en: 'Weather' },
  detailWeatherToday: { ar: 'اليوم', en: 'Today' },
  detailWeatherWind: { ar: 'الرياح', en: 'Wind' },
  detailWeatherBestTime: { ar: 'أفضل وقت', en: 'Best time' },
  detailWeatherSource: { ar: 'توقع أسبوعي من دائرة الأرصاد الجوية الفلسطينية', en: 'Weekly forecast from the Palestinian Meteorological Department' },
  detailWeatherFallback: { ar: 'يتم عرض نسخة احتياطية مؤقتة إلى أن يتوفر الاتصال بالمصدر الرسمي.', en: 'Showing a temporary fallback until the official source is reachable.' },
  detailOverviewTitle: { ar: 'نظرة عامة', en: 'Overview' },
  detailElevationRange: { ar: 'نطاق الارتفاع', en: 'Elevation range' },
  detailCommunityTitle: { ar: 'من المجتمع', en: 'From the community' },
  previewOnMap: { ar: 'معاينة على الخريطة', en: 'Preview on map' },
  saveTrail: { ar: 'حفظ المسار', en: 'Save trail' },
  savedTrail: { ar: 'تم الحفظ', en: 'Saved' },
  weatherSunny: { ar: 'مشمس', en: 'Sunny' },
  weatherBreezy: { ar: 'منعش مع نسيم', en: 'Breezy' },
  weatherClear: { ar: 'صحو', en: 'Clear' },
  weatherCool: { ar: 'لطيف ومائل للبرودة', en: 'Cool' },
  weatherDry: { ar: 'جاف ودافئ', en: 'Dry and warm' },
  weatherMorning: { ar: 'الصباح المبكر', en: 'Early morning' },
  weatherAfternoon: { ar: 'بعد الظهر', en: 'Afternoon' },
  weatherSunset: { ar: 'قبل الغروب', en: 'Before sunset' },
  weekdaySaturday: { ar: 'السبت', en: 'Saturday' },
  weekdaySunday: { ar: 'الأحد', en: 'Sunday' },
  weekdayMonday: { ar: 'الإثنين', en: 'Monday' },
  weekdayTuesday: { ar: 'الثلاثاء', en: 'Tuesday' },
  weekdayWednesday: { ar: 'الأربعاء', en: 'Wednesday' },
  weekdayThursday: { ar: 'الخميس', en: 'Thursday' },
  weekdayFriday: { ar: 'الجمعة', en: 'Friday' },
  postTimeRecent: { ar: 'منذ ساعتين', en: '2h ago' },
  postTimeYesterday: { ar: 'أمس', en: 'Yesterday' },
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  const t = useMemo(
    () => (key: keyof typeof translations) => translations[key][language],
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
