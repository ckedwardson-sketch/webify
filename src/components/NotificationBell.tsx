import React, { useState, useEffect } from "react";
import { getUnreadCount } from "../db/notificationFunctions";

interface NotificationBellProps {
  onOpenNotifications: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onOpenNotifications }) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isVisible, setIsVisible] = useState<boolean>(true);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const count = await getUnreadCount();
        setUnreadCount(count);
      } catch (error) {
        console.error("Failed to fetch unread notification count:", error);
      }
    };

    // Initial fetch
    fetchUnreadCount();

    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    onOpenNotifications();
  };

  // Hide bell when no notifications and no unread
  useEffect(() => {
    setIsVisible(unreadCount > 0);
  }, [unreadCount]);

  if (!isVisible) {
    return null;
  }

  return (
    <button 
      className="notification-bell"
      onClick={handleClick}
      aria-label="View notifications"
    >
      <span className="bell-icon">🔔</span>
      {unreadCount > 0 && (
        <span className="unread-count">{unreadCount}</span>
      )}
    </button>
  );
};

export default NotificationBell;