"""
Notification Scheduler for Food Budget System
Handles scheduling and sending notifications for reclassification events
"""

import sqlite3
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from enum import Enum

class NotificationMode(str, Enum):
    URGENT = "urgent"
    WARNING = "warning"
    DOUBLE_WARN = "double_warn"

class NotificationStage(str, Enum):
    PROJECTED_RECLASSIFICATION = "projected_reclassification"
    DAYS_BEFORE = "days_before"
    WEEKS_BEFORE = "weeks_before"
    ACTUAL_RECLASSIFICATION = "actual_reclassification"

class NotificationScheduler:
    def __init__(self, db_path: str):
        self.db_path = db_path
    
    def get_notification_settings(self) -> Dict[str, Any]:
        """Get current notification settings"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT notification_mode, warning_days, warning_weeks FROM food_budget_settings WHERE id = 1
            """)
            
            result = cursor.fetchone()
            if result:
                return {
                    'mode': result[0],
                    'warning_days': result[1],
                    'warning_weeks': result[2]
                }
            else:
                return {
                    'mode': 'urgent',
                    'warning_days': 0,
                    'warning_weeks': 0
                }
        finally:
            conn.close()
    
    def check_for_notifications(self) -> List[Dict[str, Any]]:
        """
        Check for any pending notifications
        """
        notifications = []
        
        # Get current notification settings
        settings = self.get_notification_settings()
        mode = settings['mode']
        
        if mode == 'urgent':
            # Urgent mode - only notify on actual reclassification
            notifications.extend(self._check_actual_reclassifications())
        elif mode == 'warning':
            # Warning mode - notify on actual reclassification and days before
            notifications.extend(self._check_actual_reclassifications())
            notifications.extend(self._check_days_before_notifications(settings['warning_days']))
        elif mode == 'double_warn':
            # Double warning mode - notify on all stages
            notifications.extend(self._check_actual_reclassifications())
            notifications.extend(self._check_weeks_before_notifications(settings['warning_weeks']))
            notifications.extend(self._check_days_before_notifications(settings['warning_days']))
        
        return notifications
    
    def _check_actual_reclassifications(self) -> List[Dict[str, Any]]:
        """Check for ingredients that were actually reclassified"""
        # In a real implementation, this would check for recent changes
        # For now, we'll return empty list as this requires more complex tracking
        return []
    
    def _check_weeks_before_notifications(self, weeks_before: int) -> List[Dict[str, Any]]:
        """Check for notifications weeks before projected reclassification"""
        if weeks_before <= 0:
            return []
        # Implementation would check for upcoming reclassifications
        return []
    
    def _check_days_before_notifications(self, days_before: int) -> List[Dict[str, Any]]:
        """Check for notifications days before projected reclassification"""
        if days_before <= 0:
            return []
        # Implementation would check for upcoming reclassifications
        return []
    
    def schedule_notification(self, notification_type: str, ingredient_id: int, 
                            message: str, stage: NotificationStage) -> bool:
        """
        Schedule a notification for a reclassification event
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Insert notification
            current_time = datetime.now().isoformat()
            cursor.execute("""
                INSERT INTO notifications (type, ingredient_id, message, warning_stage, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (notification_type, ingredient_id, message, stage.value, current_time))
            
            conn.commit()
            return True
            
        except Exception as e:
            print(f"Error scheduling notification: {e}")
            return False
        finally:
            conn.close()
    
    def get_unread_notifications_count(self) -> int:
        """Get count of unread notifications"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT COUNT(*) as count FROM notifications WHERE read_flag = 0
            """)
            
            result = cursor.fetchone()
            return result[0] if result else 0
        finally:
            conn.close()
    
    def mark_notifications_as_read(self, notification_ids: List[int]) -> bool:
        """Mark notifications as read"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            placeholders = ','.join(['?' for _ in notification_ids])
            cursor.execute(f"""
                UPDATE notifications SET read_flag = 1 WHERE id IN ({placeholders})
            """, notification_ids)
            
            conn.commit()
            return True
        except Exception as e:
            print(f"Error marking notifications as read: {e}")
            return False
        finally:
            conn.close()

def main():
    """Main function for testing"""
    print("Food Budget Notification Scheduler initialized")

if __name__ == "__main__":
    main()