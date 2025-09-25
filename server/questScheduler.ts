import { NotificationService } from "./notificationService";

export class QuestScheduler {
  private static isRunning = false;
  private static lastReminderDate: string | null = null;

  // Check if current time is within quest reminder window (14:00-14:15 UTC)
  private static isInReminderWindow(): boolean {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    
    // Check if time is between 14:00 and 14:15 UTC
    return utcHour === 14 && utcMinute >= 0 && utcMinute <= 15;
  }

  // Get current date in YYYY-MM-DD format (UTC)
  private static getCurrentDateUTC(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  // Check if we should send reminder (in window and not sent today)
  private static shouldSendReminder(): boolean {
    if (!this.isInReminderWindow()) {
      return false;
    }

    const today = this.getCurrentDateUTC();
    if (this.lastReminderDate === today) {
      return false; // Already sent today
    }

    return true;
  }

  // Send quest reminder notification
  private static async sendQuestReminder(): Promise<void> {
    try {
      console.log('🎯 Sending daily quest reminder notifications...');
      
      const result = await NotificationService.sendQuestReminderNotification();
      
      // Mark reminder as sent for today
      this.lastReminderDate = this.getCurrentDateUTC();
      
      console.log(`✅ Quest reminder sent successfully: ${result.sent} users notified, ${result.failed} failed`);
    } catch (error) {
      console.error('❌ Failed to send quest reminder:', error);
    }
  }

  // Main scheduler loop - runs every minute
  private static async schedulerLoop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      if (this.shouldSendReminder()) {
        await this.sendQuestReminder();
      }
    } catch (error) {
      console.error('❌ Quest scheduler error:', error);
    }

    // Schedule next check in 1 minute
    setTimeout(() => {
      this.schedulerLoop();
    }, 60 * 1000); // 60 seconds
  }

  // Start the quest reminder scheduler
  public static start(): void {
    if (this.isRunning) {
      console.log('⚠️ Quest scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('🎯 Quest reminder scheduler started (daily reminders at 14:00-14:15 UTC)');
    
    // Start the scheduler loop
    this.schedulerLoop();
  }

  // Stop the quest reminder scheduler
  public static stop(): void {
    this.isRunning = false;
    console.log('🛑 Quest reminder scheduler stopped');
  }

  // Get scheduler status
  public static getStatus(): {
    isRunning: boolean;
    lastReminderDate: string | null;
    nextReminderWindow: string;
    currentTimeUTC: string;
    inWindow: boolean;
  } {
    const now = new Date();
    const todayUTC = this.getCurrentDateUTC();
    
    // Calculate next reminder time
    let nextReminder = new Date(todayUTC + 'T14:00:00.000Z');
    if (now >= nextReminder) {
      // Today's window has passed, next reminder is tomorrow
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowUTC = tomorrow.toISOString().split('T')[0];
      nextReminder = new Date(tomorrowUTC + 'T14:00:00.000Z');
    }

    return {
      isRunning: this.isRunning,
      lastReminderDate: this.lastReminderDate,
      nextReminderWindow: nextReminder.toISOString(),
      currentTimeUTC: now.toISOString(),
      inWindow: this.isInReminderWindow()
    };
  }
}