export type Friend = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  statusEn: string;
  statusAr: string;
  mutuals: number;
};

export type MessageThread = {
  id: string;
  friendId: string;
  name: string;
  avatar: string;
  previewEn: string;
  previewAr: string;
  time: string;
  unread: number;
};

export type FeedItem =
  | {
      id: string;
      kind: 'recap';
      trailId: string;
      user: string;
      handle: string;
      avatar: string;
      image: string;
      trailNameEn: string;
      trailNameAr: string;
      regionEn: string;
      regionAr: string;
      captionEn: string;
      captionAr: string;
      timeEn: string;
      timeAr: string;
      likes: number;
      comments: number;
      distance: string;
    }
  | {
      id: string;
      kind: 'plan';
      trailId: string;
      user: string;
      handle: string;
      avatar: string;
      cover: string;
      destinationEn: string;
      destinationAr: string;
      dateEn: string;
      dateAr: string;
      vibeEn: string;
      vibeAr: string;
      noteEn: string;
      noteAr: string;
      peopleJoined: number;
      spotsLeft: number;
    };

export const friends: Friend[] = [
  {
    id: 'f1',
    name: 'Leila Darwish',
    handle: '@leila.steps',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=faces&fit=crop&w=240&h=240',
    statusEn: 'Finished Ramallah Ridge today',
    statusAr: 'أنهت تلال رام الله اليوم',
    mutuals: 8,
  },
  {
    id: 'f2',
    name: 'Omar Saleh',
    handle: '@omar.on.trails',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=faces&fit=crop&w=240&h=240',
    statusEn: 'Planning a Wadi Qelt return',
    statusAr: 'يخطط لعودة إلى وادي القلط',
    mutuals: 5,
  },
  {
    id: 'f3',
    name: 'Dima Nasser',
    handle: '@dima.routes',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=faces&fit=crop&w=240&h=240',
    statusEn: 'Hosting Friday meetup',
    statusAr: 'تنظم لقاء الجمعة',
    mutuals: 11,
  },
  {
    id: 'f4',
    name: 'Yousef Haddad',
    handle: '@yousef.hikes',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=faces&fit=crop&w=240&h=240',
    statusEn: 'Looking for sunset crew',
    statusAr: 'يبحث عن رفاق للغروب',
    mutuals: 6,
  },
];

export const messageThreads: MessageThread[] = [
  {
    id: 'm1',
    friendId: 'f3',
    name: 'Dima Nasser',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=faces&fit=crop&w=240&h=240',
    previewEn: 'Want me to save you a spot for Friday morning?',
    previewAr: 'هل تريدين أن أحجز لك مكاناً لصباح الجمعة؟',
    time: '9:24',
    unread: 2,
  },
  {
    id: 'm2',
    friendId: 'f2',
    name: 'Omar Saleh',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=faces&fit=crop&w=240&h=240',
    previewEn: 'The spring is flowing again near the canyon turn.',
    previewAr: 'النبع يجري من جديد قرب منعطف الوادي.',
    time: 'Yesterday',
    unread: 0,
  },
  {
    id: 'm3',
    friendId: 'f1',
    name: 'Leila Darwish',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=faces&fit=crop&w=240&h=240',
    previewEn: 'Sending you the photo set from the ridge now.',
    previewAr: 'أرسل لك الآن مجموعة الصور من التلال.',
    time: 'Tue',
    unread: 1,
  },
];

export const feedItems: FeedItem[] = [
  {
    id: 'r1',
    kind: 'recap',
    trailId: '6',
    user: 'Leila Darwish',
    handle: '@leila.steps',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=faces&fit=crop&w=240&h=240',
    image: 'https://images.unsplash.com/photo-1726091983472-a7da2540c492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
    trailNameEn: 'Ramallah Ridge',
    trailNameAr: 'تلال رام الله',
    regionEn: 'Ramallah Highlands',
    regionAr: 'مرتفعات رام الله',
    captionEn: 'Golden hour at the ridge. We finished with mint tea and a perfect wind line across the hills.',
    captionAr: 'الساعة الذهبية على التلال. أنهينا الرحلة مع شاي النعناع وهواء رائع فوق التلال.',
    timeEn: '42 min ago',
    timeAr: 'منذ 42 دقيقة',
    likes: 184,
    comments: 19,
    distance: '6.5 km',
  },
  {
    id: 'p1',
    kind: 'plan',
    trailId: '3',
    user: 'Dima Nasser',
    handle: '@dima.routes',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=faces&fit=crop&w=240&h=240',
    cover: 'https://images.unsplash.com/photo-1722228097356-bd0202d99367?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
    destinationEn: 'Battir Terraces Meetup',
    destinationAr: 'لقاء مصاطب بتير',
    dateEn: 'Friday, Apr 25 at 6:30 AM',
    dateAr: 'الجمعة 25 أبريل الساعة 6:30 ص',
    vibeEn: 'Easy pace, coffee stop, photo walk',
    vibeAr: 'مشي هادئ، استراحة قهوة، وتصوير',
    noteEn: 'Bringing two extra seats from Ramallah. Join if you want a gentle morning hike with friends.',
    noteAr: 'لدي مقعدان إضافيان من رام الله. انضموا إذا أردتم مشياً صباحياً هادئاً مع الأصدقاء.',
    peopleJoined: 7,
    spotsLeft: 2,
  },
  {
    id: 'r2',
    kind: 'recap',
    trailId: '1',
    user: 'Omar Saleh',
    handle: '@omar.on.trails',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=faces&fit=crop&w=240&h=240',
    image: 'https://images.unsplash.com/photo-1679940640486-967ee217bf8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
    trailNameEn: 'Wadi Qelt Trail',
    trailNameAr: 'مسار وادي القلط',
    regionEn: 'Jericho Valley',
    regionAr: 'وادي أريحا',
    captionEn: 'Steep descent, cold spring water, and one of the best canyon light moments I have seen all season.',
    captionAr: 'نزول حاد، ماء نبع بارد، وأجمل ضوء داخل الوادي شاهدته هذا الموسم.',
    timeEn: '3h ago',
    timeAr: 'منذ 3 ساعات',
    likes: 261,
    comments: 34,
    distance: '14.2 km',
  },
  {
    id: 'p2',
    kind: 'plan',
    trailId: '5',
    user: 'Yousef Haddad',
    handle: '@yousef.hikes',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=faces&fit=crop&w=240&h=240',
    cover: 'https://images.unsplash.com/photo-1511497584788-876760111969?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
    destinationEn: 'Olive Grove Sunset Loop',
    destinationAr: 'جولة غروب بين الزيتون',
    dateEn: 'Saturday, Apr 26 at 4:15 PM',
    dateAr: 'السبت 26 أبريل الساعة 4:15 م',
    vibeEn: 'Sunset loop, picnic blankets, beginner-friendly',
    vibeAr: 'جولة غروب، بطانيات للنزهة، مناسبة للمبتدئين',
    noteEn: 'Thinking of a relaxed after-work hike. We can stay for sunset photos if the sky is clear.',
    noteAr: 'أفكر في مشي هادئ بعد العمل. يمكننا البقاء لصور الغروب إذا كانت السماء صافية.',
    peopleJoined: 4,
    spotsLeft: 5,
  },
];
