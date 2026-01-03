import { Subscription, Env } from '../types';
import { lunarBiz, lunarCalendar } from '../utils/lunar';
import { getConfig } from '../utils/config';
import { getCurrentTimeInTimezone } from '../utils/date';

export class SubscriptionService {
  constructor(private env: Env) {}

  async getAllSubscriptions(): Promise<Subscription[]> {
    if (!this.env.SUBSCRIPTIONS_KV) return [];
    const data = await this.env.SUBSCRIPTIONS_KV.get('subscriptions');
    return data ? JSON.parse(data) : [];
  }

  async getSubscription(id: string): Promise<Subscription | undefined> {
    const subscriptions = await this.getAllSubscriptions();
    return subscriptions.find(s => s.id === id);
  }

  async createSubscription(subscription: Partial<Subscription>): Promise<{ success: boolean; message?: string; subscription?: Subscription }> {
    try {
      const subscriptions = await this.getAllSubscriptions();
      const config = await getConfig(this.env);
      const timezone = config.timezone || 'UTC';
      const currentTime = getCurrentTimeInTimezone(timezone);

      if (!subscription.name || !subscription.expiryDate) {
        return { success: false, message: '缺少必填字段' };
      }

      let expiryDate = new Date(subscription.expiryDate);
      let useLunar = !!subscription.useLunar;

      if (useLunar) {
        let lunar = lunarCalendar.solar2lunar(
          expiryDate.getFullYear(),
          expiryDate.getMonth() + 1,
          expiryDate.getDate()
        );
        if (!lunar) {
           return { success: false, message: '农历日期超出支持范围（1900-2100年）' };
        }
        
        if (subscription.periodValue && subscription.periodUnit) {
           while (expiryDate <= currentTime) {
              lunar = lunarBiz.addLunarPeriod(lunar, subscription.periodValue, subscription.periodUnit);
              const solar = lunarBiz.lunar2solar(lunar);
              if (!solar) break;
              expiryDate = new Date(solar.year, solar.month - 1, solar.day);
           }
           subscription.expiryDate = expiryDate.toISOString();
        }
      } else {
         if (expiryDate < currentTime && subscription.periodValue && subscription.periodUnit) {
            while (expiryDate < currentTime) {
               if (subscription.periodUnit === 'day') {
                  expiryDate.setDate(expiryDate.getDate() + subscription.periodValue);
               } else if (subscription.periodUnit === 'month') {
                  expiryDate.setMonth(expiryDate.getMonth() + subscription.periodValue);
               } else if (subscription.periodUnit === 'year') {
                  expiryDate.setFullYear(expiryDate.getFullYear() + subscription.periodValue);
               }
            }
            subscription.expiryDate = expiryDate.toISOString();
         }
      }

      const newSubscription: Subscription = {
        id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : Date.now().toString(),
        name: subscription.name,
        customType: subscription.customType || '',
        startDate: subscription.startDate || null,
        expiryDate: subscription.expiryDate!,
        periodValue: subscription.periodValue || 1,
        periodUnit: subscription.periodUnit || 'month',
        price: subscription.price !== undefined ? Number(subscription.price) : undefined,
        reminderDays: subscription.reminderDays !== undefined ? subscription.reminderDays : 7,
        notes: subscription.notes || '',
        isActive: subscription.isActive !== false,
        autoRenew: subscription.autoRenew !== false,
        useLunar: useLunar,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      subscriptions.push(newSubscription);
      await this.env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));
      return { success: true, subscription: newSubscription };
    } catch (error: any) {
      console.error("创建订阅异常：", error);
      return { success: false, message: error.message || '创建订阅失败' };
    }
  }

  async updateSubscription(id: string, subscription: Partial<Subscription>): Promise<{ success: boolean; message?: string; subscription?: Subscription }> {
    try {
      const subscriptions = await this.getAllSubscriptions();
      const index = subscriptions.findIndex(s => s.id === id);

      if (index === -1) {
        return { success: false, message: '订阅不存在' };
      }

      if (!subscription.name || !subscription.expiryDate) {
        return { success: false, message: '缺少必填字段' };
      }

      let expiryDate = new Date(subscription.expiryDate);
      const config = await getConfig(this.env);
      const timezone = config.timezone || 'UTC';
      const currentTime = getCurrentTimeInTimezone(timezone);

      let useLunar = !!subscription.useLunar;
      if (useLunar) {
         let lunar = lunarCalendar.solar2lunar(
            expiryDate.getFullYear(),
            expiryDate.getMonth() + 1,
            expiryDate.getDate()
         );
         if (!lunar) return { success: false, message: '农历日期超出支持范围' };
         
         if (expiryDate < currentTime && subscription.periodValue && subscription.periodUnit) {
            do {
               lunar = lunarBiz.addLunarPeriod(lunar, subscription.periodValue, subscription.periodUnit);
               const solar = lunarBiz.lunar2solar(lunar);
               if (!solar) break; 
               expiryDate = new Date(solar.year, solar.month - 1, solar.day);
            } while (expiryDate < currentTime);
            subscription.expiryDate = expiryDate.toISOString();
         }
      } else {
         if (expiryDate < currentTime && subscription.periodValue && subscription.periodUnit) {
            while (expiryDate < currentTime) {
               if (subscription.periodUnit === 'day') {
                  expiryDate.setDate(expiryDate.getDate() + subscription.periodValue);
               } else if (subscription.periodUnit === 'month') {
                  expiryDate.setMonth(expiryDate.getMonth() + subscription.periodValue);
               } else if (subscription.periodUnit === 'year') {
                  expiryDate.setFullYear(expiryDate.getFullYear() + subscription.periodValue);
               }
            }
            subscription.expiryDate = expiryDate.toISOString();
         }
      }

      subscriptions[index] = {
        ...subscriptions[index],
        name: subscription.name,
        customType: subscription.customType || subscriptions[index].customType || '',
        startDate: subscription.startDate || subscriptions[index].startDate,
        expiryDate: subscription.expiryDate!,
        periodValue: subscription.periodValue || subscriptions[index].periodValue || 1,
        periodUnit: subscription.periodUnit || subscriptions[index].periodUnit || 'month',
        price: subscription.price !== undefined ? Number(subscription.price) : subscriptions[index].price,
        reminderDays: subscription.reminderDays !== undefined ? subscription.reminderDays : subscriptions[index].reminderDays,
        notes: subscription.notes || '',
        isActive: subscription.isActive !== undefined ? subscription.isActive : subscriptions[index].isActive,
        autoRenew: subscription.autoRenew !== undefined ? subscription.autoRenew : subscriptions[index].autoRenew,
        useLunar: useLunar,
        updatedAt: new Date().toISOString()
      };

      await this.env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));
      return { success: true, subscription: subscriptions[index] };
    } catch (error: any) {
      return { success: false, message: '更新订阅失败' };
    }
  }

  async deleteSubscription(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const subscriptions = await this.getAllSubscriptions();
      const filtered = subscriptions.filter(s => s.id !== id);
      if (filtered.length === subscriptions.length) {
        return { success: false, message: '订阅不存在' };
      }
      await this.env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(filtered));
      return { success: true };
    } catch (error) {
      return { success: false, message: '删除订阅失败' };
    }
  }
  
  async toggleSubscriptionStatus(id: string, isActive: boolean): Promise<{ success: boolean; message?: string; subscription?: Subscription }> {
    try {
      const subscriptions = await this.getAllSubscriptions();
      const index = subscriptions.findIndex(s => s.id === id);
      if (index === -1) return { success: false, message: '订阅不存在' };
      
      subscriptions[index] = {
        ...subscriptions[index],
        isActive: isActive,
        updatedAt: new Date().toISOString()
      };
      
      await this.env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));
      return { success: true, subscription: subscriptions[index] };
    } catch (error) {
      return { success: false, message: '更新状态失败' };
    }
  }

  async checkExpiringSubscriptions(): Promise<{ notifications: { subscription: Subscription; daysUntil: number }[] }> {
    const subscriptions = await this.getAllSubscriptions();
    const config = await getConfig(this.env);
    const timezone = config.timezone || 'UTC';
    const currentTime = getCurrentTimeInTimezone(timezone);
    
    // Normalize current time to start of day for accurate day calculation
    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);

    const notifications: { subscription: Subscription; daysUntil: number }[] = [];
    let hasUpdates = false;

    for (let i = 0; i < subscriptions.length; i++) {
      let sub = subscriptions[i];
      if (!sub.isActive) continue;

      let expiryDate = new Date(sub.expiryDate);
      
      // Calculate days remaining
      // For calculation, we need to compare dates without time component
      const expiryCheck = new Date(expiryDate);
      expiryCheck.setHours(0, 0, 0, 0);
      
      const diffTime = expiryCheck.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Check for auto-renewal if expired
      if (daysRemaining < 0 && sub.autoRenew) {
          // Auto-renew logic
          console.log(`[AutoRenew] Renewing subscription: ${sub.name}`);
          
          // Calculate next expiry date based on period
          if (sub.useLunar) {
             const currentLunar = lunarCalendar.solar2lunar(
                expiryDate.getFullYear(),
                expiryDate.getMonth() + 1,
                expiryDate.getDate()
             );
             if (currentLunar) {
                 // Add period to lunar date
                 // We loop until the new expiry date is in the future relative to NOW
                 // However, for strict adherence to period, we just add one period.
                 // But if it's long expired, we might need to add multiple.
                 // Let's assume we add one period at a time or enough to be future.
                 // Standard logic: Add period until > today.
                 
                 let nextLunar = currentLunar;
                 let nextSolarDate = expiryDate;
                 
                 do {
                     nextLunar = lunarBiz.addLunarPeriod(nextLunar, sub.periodValue || 1, sub.periodUnit || 'month');
                     const solar = lunarBiz.lunar2solar(nextLunar);
                     if (!solar) break;
                     nextSolarDate = new Date(solar.year, solar.month - 1, solar.day);
                 } while (nextSolarDate < today);
                 
                 sub.expiryDate = nextSolarDate.toISOString();
             }
          } else {
             // Solar auto-renew
             do {
                if (sub.periodUnit === 'day') {
                   expiryDate.setDate(expiryDate.getDate() + (sub.periodValue || 1));
                } else if (sub.periodUnit === 'month') {
                   expiryDate.setMonth(expiryDate.getMonth() + (sub.periodValue || 1));
                } else if (sub.periodUnit === 'year') {
                   expiryDate.setFullYear(expiryDate.getFullYear() + (sub.periodValue || 1));
                }
             } while (expiryDate < today);
             sub.expiryDate = expiryDate.toISOString();
          }
          
          sub.updatedAt = new Date().toISOString();
          subscriptions[i] = sub;
          hasUpdates = true;
          
          // Recalculate days remaining for the renewed subscription
          const newExpiry = new Date(sub.expiryDate);
          newExpiry.setHours(0, 0, 0, 0);
          const newDiff = newExpiry.getTime() - today.getTime();
          const newDaysRemaining = Math.ceil(newDiff / (1000 * 60 * 60 * 24));
          
          // Add to notifications as "Renewed" or just status update?
          // Usually we want to notify that it was renewed or is now due in X days.
          // If it's renewed, it might be far in future, so maybe no notification unless reminderDays matches.
          // But if we want to notify "Renewed", we might need a special flag.
          // For now, let's just check against reminderDays again.
          
          if (newDaysRemaining <= (sub.reminderDays || 7) && newDaysRemaining >= 0) {
             notifications.push({ subscription: sub, daysUntil: newDaysRemaining });
          }
      } else {
          // Regular check
          if (daysRemaining <= (sub.reminderDays || 7) && daysRemaining >= 0) {
              notifications.push({ subscription: sub, daysUntil: daysRemaining });
          } else if (daysRemaining < 0) {
              // Expired and not auto-renewed
              notifications.push({ subscription: sub, daysUntil: daysRemaining });
          }
      }
    }

    if (hasUpdates) {
       await this.env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));
    }

    return { notifications };
  }

}
