import React, { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { useRealtime } from '../context/RealtimeContext';
import { useApp } from '../context/AppContext';
import { formatDistanceToNow } from 'date-fns';
import { bn } from 'date-fns/locale';

export const NotificationPanel: React.FC = () => {
  const { state } = useApp();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAllNotifications, isConnected } = useRealtime();
  const [isOpen, setIsOpen] = useState(false);
  const lang = state.language;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'consultation':
        return '💬';
      case 'price_alert':
        return '💰';
      case 'irrigation':
        return '💧';
      case 'disease_review':
        return '🌾';
      case 'system':
        return '📢';
      default:
        return '🔔';
    }
  };

  const formatTime = (date: Date) => {
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: lang === 'bn' ? bn : undefined,
    });
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-muted transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {isConnected && (
          <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-background" />
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-2xl z-50 max-h-[600px] flex flex-col animate-in slide-in-from-top-5 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold">
                  {lang === 'bn' ? 'বিজ্ঞপ্তি' : 'Notifications'}
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <>
                    <button
                      onClick={markAllAsRead}
                      className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                      title={lang === 'bn' ? 'সব পড়েছি চিহ্নিত করুন' : 'Mark all as read'}
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                    <button
                      onClick={clearAllNotifications}
                      className="p-1.5 hover:bg-muted rounded-lg transition-colors text-red-600"
                      title={lang === 'bn' ? 'সব মুছে ফেলুন' : 'Clear all'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Bell className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">
                    {lang === 'bn' ? 'কোনো বিজ্ঞপ্তি নেই' : 'No notifications'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                        !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm">
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              {formatTime(notification.timestamp)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                clearNotification(notification.id);
                              }}
                              className="p-1 hover:bg-background rounded transition-colors"
                            >
                              <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Connection Status */}
            <div className="p-3 border-t border-border bg-muted/30">
              <div className="flex items-center justify-center gap-2 text-xs">
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-muted-foreground">
                  {isConnected
                    ? (lang === 'bn' ? 'রিয়েল-টাইম সংযুক্ত' : 'Real-time connected')
                    : (lang === 'bn' ? 'সংযোগ বিচ্ছিন্ন' : 'Disconnected')
                  }
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
