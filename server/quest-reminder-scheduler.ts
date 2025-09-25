import { storage } from "./storage";
import { questReminders, userStats } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import fetch from "node-fetch";

// Quest reminder scheduler - runs every hour to check for 16:00 local time notifications
export class QuestReminderScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    console.log("🕒 Quest Reminder Scheduler initialized");
  }

  // Start the scheduler - runs every hour
  start(): void {
    if (this.isRunning) {
      console.log("⚠️ Quest reminder scheduler already running");
      return;
    }

    console.log("🚀 Starting quest reminder scheduler (runs every hour)");
    this.isRunning = true;

    // Run immediately on start, then every hour
    this.checkAndSendReminders();
    
    // Run every hour (3600000 ms)
    this.intervalId = setInterval(() => {
      this.checkAndSendReminders();
    }, 60 * 60 * 1000); // 1 hour
  }

  // Stop the scheduler
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("🛑 Quest reminder scheduler stopped");
  }

  // Check current time across timezones and send reminders for 16:00 local time
  private async checkAndSendReminders(): Promise<void> {
    try {
      console.log("🔍 Checking for users at 16:00 local time...");
      
      const currentUTC = new Date();
      const targetLocalHour = 16; // 4:00 PM local time
      const targetLocalMinute = 0;
      const todayDateString = currentUTC.toISOString().split('T')[0]; // YYYY-MM-DD

      // Get all users with their timezones
      const allUserStats = await db
        .select()
        .from(userStats)
        .where(sql`timezone IS NOT NULL AND timezone != ''`);

      console.log(`📊 Found ${allUserStats.length} users with timezone data`);

      let remindersSent = 0;
      let usersChecked = 0;

      for (const userStat of allUserStats) {
        usersChecked++;
        
        try {
          // Check if user already received reminder today
          const existingReminder = await db
            .select()
            .from(questReminders)
            .where(
              and(
                eq(questReminders.farcasterFid, userStat.farcasterFid),
                eq(questReminders.reminderDate, todayDateString)
              )
            );

          if (existingReminder.length > 0) {
            // User already received reminder today
            continue;
          }

          // Calculate current local time for this user
          const userTimezone = userStat.timezone || 'UTC';
          
          // Better timezone conversion using toLocaleString
          const userLocalTime = new Date(currentUTC.toLocaleString("en-US", { timeZone: userTimezone }));
          const userLocalHour = userLocalTime.getHours();
          const userLocalMinute = userLocalTime.getMinutes();
          
          console.log(`🔍 User ${userStat.farcasterUsername} (${userTimezone}): UTC ${currentUTC.toLocaleTimeString()} → Local ${userLocalTime.toLocaleTimeString()} (${userLocalHour}:${userLocalMinute})`);

          // Check if it's 16:00-16:15 (4:00-4:15 PM) in user's local time (15 minute window)
          if (userLocalHour === targetLocalHour && userLocalMinute >= targetLocalMinute && userLocalMinute < targetLocalMinute + 15) {
            console.log(`🎯 Sending reminder to user ${userStat.farcasterUsername} (${userTimezone}) - Local time: ${userLocalTime.toLocaleTimeString()}`);
            
            // Send reminder notification
            await this.sendQuestReminder(userStat.farcasterFid, userStat.farcasterUsername, userTimezone, todayDateString);
            remindersSent++;
          }
        } catch (userError) {
          console.error(`❌ Error processing user ${userStat.farcasterFid}:`, userError);
        }
      }

      console.log(`✅ Quest reminder check completed - ${remindersSent} reminders sent out of ${usersChecked} users checked`);
    } catch (error) {
      console.error("❌ Error in quest reminder scheduler:", error);
    }
  }

  // Send quest reminder notification to a specific user
  private async sendQuestReminder(
    farcasterFid: string, 
    farcasterUsername: string, 
    timezone: string, 
    reminderDate: string
  ): Promise<void> {
    try {
      // Record that reminder was sent
      await db
        .insert(questReminders)
        .values({
          farcasterFid,
          reminderDate,
          timezone,
          localTime: "16:00"
        });

      // Send actual Farcaster notification if user has notification details
      await this.sendFarcasterNotification(farcasterFid, farcasterUsername, timezone);
      
      console.log(`📢 Quest reminder sent to ${farcasterUsername} (${farcasterFid}) in ${timezone}`);

    } catch (error) {
      console.error(`❌ Failed to send quest reminder to ${farcasterFid}:`, error);
    }
  }

  // Send actual Farcaster notification via API
  private async sendFarcasterNotification(
    farcasterFid: string, 
    farcasterUsername: string, 
    timezone: string
  ): Promise<void> {
    try {
      // Get user's stored notification details from database
      const userStat = await db
        .select()
        .from(userStats)
        .where(eq(userStats.farcasterFid, farcasterFid))
        .limit(1);

      if (userStat.length === 0 || !userStat[0].farcasterNotificationUrl || !userStat[0].farcasterNotificationToken) {
        console.log(`⚠️ No Farcaster notification details for user ${farcasterUsername} - using mock notification`);
        return;
      }

      const notificationDetails = {
        url: userStat[0].farcasterNotificationUrl,
        token: userStat[0].farcasterNotificationToken
      };

      const notificationPayload = {
        notificationId: `quest-reminder-${farcasterFid}-${Date.now()}`,
        title: "TravelMint Daily Quest",
        body: "⏰ Don't forget your daily streak! Complete today's quests",
        targetUrl: process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_DEV_DOMAIN}` : undefined,
      };

      const response = await fetch(notificationDetails.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${notificationDetails.token}`,
        },
        body: JSON.stringify(notificationPayload),
      });

      if (response.ok) {
        console.log(`✅ Farcaster notification sent to ${farcasterUsername}`);
      } else {
        console.warn(`⚠️ Farcaster notification failed for ${farcasterUsername}:`, response.status);
      }

    } catch (error) {
      console.error(`❌ Failed to send Farcaster notification to ${farcasterUsername}:`, error);
      // Don't throw error, continue with other users
    }
  }

  // Get scheduler status
  getStatus(): { isRunning: boolean; nextCheck: string } {
    const nextCheckTime = new Date(Date.now() + (60 * 60 * 1000)); // Next hour
    return {
      isRunning: this.isRunning,
      nextCheck: nextCheckTime.toISOString()
    };
  }
}

// Singleton instance
export const questReminderScheduler = new QuestReminderScheduler();