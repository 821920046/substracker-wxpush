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
        id: Date.now().toString(),
        name: subscription.name,
        customType: subscription.customType || '',
        startDate: subscription.startDate || null,
        expiryDate: subscription.expiryDate!,
        periodValue: subscription.periodValue || 1,
        periodUnit: subscription.periodUnit || 'month',
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
    const notifications: { subscription: Subscription; daysUntil: number }[] = [];
    let hasUpdates = false;

    for (let i = 0; i < subscriptions.length; i++) {
      let sub = subscriptions[i];
      if (!sub.isActive) continue;

      const expiryDate = new Date(sub.expiryDate);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= (sub.reminderDays || 7)) {
        notifications.push({ subscription: sub, daysUntil: daysUntilExpiry });
      }

      // Auto-renew logic
      if (sub.autoRenew && daysUntilExpiry <= 0) {
        // Calculate next expiry
        let nextExpiryDate = new Date(expiryDate);
        if (sub.useLunar) {
           let lunar = lunarCalendar.solar2lunar(nextExpiryDate.getFullYear(), nextExpiryDate.getMonth() + 1, nextExpiryDate.getDate());
           if (lunar && sub.periodValue && sub.periodUnit) {
              do {
                 lunar = lunarBiz.addLunarPeriod(lunar, sub.periodValue, sub.periodUnit);
                 const solar = lunarBiz.lunar2solar(lunar);
                 if (!solar) break;
                 nextExpiryDate = new Date(solar.year, solar.month - 1, solar.day);
              } while (nextExpiryDate <= currentTime);
           }
        } else {
           if (sub.periodValue && sub.periodUnit) {
              while (nextExpiryDate <= currentTime) {
                 if (sub.periodUnit === 'day') nextExpiryDate.setDate(nextExpiryDate.getDate() + sub.periodValue);
                 else if (sub.periodUnit === 'month') nextExpiryDate.setMonth(nextExpiryDate.getMonth() + sub.periodValue);
                 else if (sub.periodUnit === 'year') nextExpiryDate.setFullYear(nextExpiryDate.getFullYear() + sub.periodValue);
              }
           }
        }
        
        if (nextExpiryDate.getTime() !== expiryDate.getTime()) {
           sub.expiryDate = nextExpiryDate.toISOString();
           sub.updatedAt = new Date().toISOString();
           subscriptions[i] = sub;
           hasUpdates = true;
        }
      }
    }

    if (hasUpdates) {
      await this.env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));
    }

    return { notifications };
  }
}
