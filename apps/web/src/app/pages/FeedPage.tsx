import { useEffect, useState } from 'react';
import { Heart, MessageCircle, Users } from 'lucide-react';
import { Link } from 'react-router';
import { getAccessToken } from '../api/client';
import {
  commentOnActivity,
  getSocialFeed,
  likeActivity,
  likeReview,
  unlikeActivity,
  unlikeReview,
  type SocialFeedItem,
} from '../api/social';

export function FeedPage() {
  const [items, setItems] = useState<SocialFeedItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const isGuest = !getAccessToken();

  useEffect(() => {
    if (isGuest) return;
    getSocialFeed({ page: 1, limit: 30 })
      .then((response) => setItems(response.data))
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load feed.'));
  }, [isGuest]);

  const toggleLike = async (item: SocialFeedItem) => {
    const liked = item.is_liked_by_user;
    try {
      if (item.type === 'review') {
        await (liked ? unlikeReview(item.id) : likeReview(item.id));
      } else if (item.type === 'activity' && item.activity?.id) {
        await (liked ? unlikeActivity(item.activity.id) : likeActivity(item.activity.id));
      }
      setItems((current) =>
        current.map((row) =>
          row.id === item.id
            ? {
                ...row,
                is_liked_by_user: !liked,
                likes_count: Math.max(0, row.likes_count + (liked ? -1 : 1)),
              }
            : row,
        ),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update like.');
    }
  };

  const submitComment = async (item: SocialFeedItem) => {
    const body = commentDrafts[item.id]?.trim();
    if (!body) return;
    try {
      if (item.type === 'activity' && item.activity?.id) {
        await commentOnActivity(item.activity.id, body);
      }
      setCommentDrafts((current) => ({ ...current, [item.id]: '' }));
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, comments_count: row.comments_count + 1 } : row)),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to post comment.');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="mb-2">Community Feed</h1>
          <p className="text-secondary">Reviews, activity recaps, and trail media from people you follow.</p>
        </div>

        {isGuest && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <p className="text-secondary">Sign in to load your personalized social feed.</p>
          </div>
        )}

        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{errorMessage}</div>}

        <div className="space-y-4">
          {items.map((item) => (
            <article key={item.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                  {item.user.full_name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-foreground">{item.user.full_name}</p>
                  <p className="text-xs text-secondary">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              </div>

              {item.photo_url && (
                <img src={item.photo_url} alt="" className="w-full h-56 object-cover rounded-lg mb-3" />
              )}

              <p className="text-sm text-foreground mb-2">
                {item.type === 'review' ? item.content : item.caption || item.content}
              </p>

              {item.trail.id && (
                <Link to={`/trail/${item.trail.id}`} className="text-sm text-primary hover:underline">
                  {item.trail.name || 'View trail'}
                </Link>
              )}

              <div className="flex items-center gap-4 mt-4 text-sm text-secondary">
                <button type="button" onClick={() => void toggleLike(item)} className="inline-flex items-center gap-1 hover:text-foreground">
                  <Heart className={`w-4 h-4 ${item.is_liked_by_user ? 'fill-primary text-primary' : ''}`} />
                  {item.likes_count}
                </button>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  {item.comments_count}
                </span>
                {item.type === 'activity' && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Activity recap
                  </span>
                )}
              </div>

              {item.type === 'activity' && item.activity?.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={commentDrafts[item.id] ?? ''}
                    onChange={(event) => setCommentDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                    placeholder="Add a comment"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void submitComment(item)}
                    className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
                  >
                    Post
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
