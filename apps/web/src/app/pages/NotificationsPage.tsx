import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { getAccessToken } from '../api/client';
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '../api/notifications';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const isGuest = !getAccessToken();

  const load = () => {
    getNotifications({ page: 1, limit: 50 })
      .then((response) => setNotifications(response.data))
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load notifications.'));
  };

  useEffect(() => {
    if (isGuest) return;
    load();
  }, [isGuest]);

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item)));
  };

  const markAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
  };

  const remove = async (id: string) => {
    await deleteNotification(id);
    setNotifications((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="mb-2">Notifications</h1>
            <p className="text-secondary">Follows, likes, safety alerts, challenges, and system updates.</p>
          </div>
          {!isGuest && (
            <button type="button" onClick={() => void markAllRead()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm">
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {isGuest && (
          <div className="bg-card rounded-xl border border-border p-6">
            <p className="text-secondary">Sign in to view notifications.</p>
          </div>
        )}

        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{errorMessage}</div>}

        <div className="space-y-3">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={`bg-card rounded-xl border p-4 ${notification.read_at ? 'border-border' : 'border-primary/30'}`}
            >
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{notification.title}</p>
                  <p className="text-sm text-secondary mt-1">{notification.body}</p>
                  <p className="text-xs text-secondary mt-2">{new Date(notification.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  {!notification.read_at && (
                    <button type="button" onClick={() => void markRead(notification.id)} className="text-xs text-primary">
                      Read
                    </button>
                  )}
                  <button type="button" onClick={() => void remove(notification.id)} className="text-secondary hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!isGuest && !notifications.length && <p className="text-secondary text-sm">No notifications yet.</p>}
        </div>
      </div>
    </div>
  );
}
