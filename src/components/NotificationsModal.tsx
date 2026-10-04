import React, { useState, useEffect } from "react";
import { getNotifications, markRead, markAllRead } from "../db/notificationFunctions";

interface Notification {
  id: number;
  type: string;
  ingredient_id: number | null;
  message: string;
  read_flag: number;
  created_at: string;
  warning_stage: string | null;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const data = await getNotifications();
        setNotifications(data);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [isOpen]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? {...n, read_flag: 1} : n));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllRead();
      setNotifications(prev => prev.map(n => ({...n, read_flag: 1})));
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content notifications-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Notifications</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {loading ? (
            <p>Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p>No notifications available</p>
          ) : (
            <>
              <div className="notifications-header">
                <button 
                  className="mark-all-read-btn"
                  onClick={handleMarkAllAsRead}
                >
                  Mark All as Read
                </button>
              </div>
              
              <div className="notifications-list">
                {notifications.map(notification => (
                  <div 
                    key={notification.id} 
                    className={`notification-item ${notification.read_flag === 0 ? 'unread' : ''}`}
                  >
                    <div className="notification-content">
                      <div className="notification-header">
                        <span className={`notification-type ${notification.type}`}>
                          {notification.type.toUpperCase()}
                        </span>
                        {notification.warning_stage && (
                          <span className="warning-stage">
                            {notification.warning_stage.toUpperCase()}
                          </span>
                        )}
                        <span className="notification-date">
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="notification-message">{notification.message}</p>
                    </div>
                    {notification.read_flag === 0 && (
                      <button 
                        className="mark-as-read-btn"
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        Mark as Read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsModal;