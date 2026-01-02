
import { Env, ChannelConfig, Subscription, Config } from '../types';
import { formatTimeInTimezone, formatTimezoneDisplay } from '../utils/date';
import { lunarCalendar } from '../utils/lunar';

/**
 * 格式化通知内容
 */
export function formatNotificationContent(subscriptions: Subscription[], config: Config): string {
  const showLunar = config.showLunarGlobal === true;
  const timezone = config.timezone || 'UTC';
  let content = '';

  for (const sub of subscriptions) {
    const typeText = sub.customType || '其他';
    const periodText = (sub.periodValue && sub.periodUnit) ? `(周期: ${sub.periodValue} ${ { day: '天', month: '月', year: '年' }[sub.periodUnit] || sub.periodUnit})` : '';

    // 格式化到期日期（使用所选时区）
    const expiryDateObj = new Date(sub.expiryDate);
    const formattedExpiryDate = formatTimeInTimezone(expiryDateObj, timezone, 'date');
    
    // 农历日期
    let lunarExpiryText = '';
    if (showLunar) {
      const lunarExpiry = lunarCalendar.solar2lunar(expiryDateObj.getFullYear(), expiryDateObj.getMonth() + 1, expiryDateObj.getDate());
      lunarExpiryText = lunarExpiry ? `\n农历日期: ${lunarExpiry.fullStr}` : '';
    }

    // 状态和到期时间
    let statusText = '';
    let statusEmoji = '';
    
    // 计算剩余天数（需要根据时区重新计算，确保准确）
    // 这里简单使用 sub.daysRemaining，假设调用前已更新
    if (sub.daysRemaining === 0) {
      statusEmoji = '⚠️';
      statusText = '今天到期！';
    } else if (sub.daysRemaining !== undefined && sub.daysRemaining < 0) {
      statusEmoji = '🚨';
      statusText = `已过期 ${Math.abs(sub.daysRemaining)} 天`;
    } else {
      statusEmoji = '📅';
      statusText = `将在 ${sub.daysRemaining} 天后到期`;
    }

    // 获取日历类型和自动续期状态
    const calendarType = sub.useLunar ? '农历' : '公历';
    const autoRenewText = sub.autoRenew ? '是' : '否';
    
    // 构建格式化的通知内容
    const subscriptionContent = `${statusEmoji} **${sub.name}**
类型: ${typeText} ${periodText}
日历类型: ${calendarType}
到期日期: ${formattedExpiryDate}${lunarExpiryText}
自动续期: ${autoRenewText}
到期状态: ${statusText}`;

    // 添加备注
    let finalContent = sub.notes ? 
      subscriptionContent + `\n备注: ${sub.notes}` : 
      subscriptionContent;

    content += finalContent + '\n\n';
  }

  // 添加发送时间和时区信息
  const currentTime = formatTimeInTimezone(new Date(), timezone, 'datetime');
  content += `发送时间: ${currentTime}\n当前时区: ${formatTimezoneDisplay(timezone)}`;

  return content;
}

/**
 * 发送通知到所有启用的渠道
 */
export async function sendNotificationToAllChannels(title: string, commonContent: string, config: Config, logPrefix = '[定时任务]'): Promise<void> {
    if (!config.enabledNotifiers || config.enabledNotifiers.length === 0) {
        console.log(`${logPrefix} 未启用任何通知渠道。`);
        return;
    }

    if (config.enabledNotifiers.includes('notifyx')) {
        const notifyxContent = `## ${title}\n\n${commonContent}`;
        const success = await sendNotifyXNotification(title, notifyxContent, `订阅提醒`, config);
        console.log(`${logPrefix} 发送NotifyX通知 ${success ? '成功' : '失败'}`);
    }
    if (config.enabledNotifiers.includes('wenotify')) {
        const wenotifyContent = commonContent.replace(/(\**|\*|##|#|`)/g, '');
        const success = await sendWeNotifyEdgeNotification(title, wenotifyContent, config);
        console.log(`${logPrefix} 发送WeNotify Edge通知 ${success ? '成功' : '失败'}`);
    }
    if (config.enabledNotifiers.includes('telegram')) {
        const telegramContent = `*${title}*\n\n${commonContent}`;
        const success = await sendTelegramNotification(telegramContent, config);
        console.log(`${logPrefix} 发送Telegram通知 ${success ? '成功' : '失败'}`);
    }
    if (config.enabledNotifiers.includes('webhook')) {
        const webhookContent = commonContent.replace(/(\**|\*|##|#|`)/g, '');
        const success = await sendWebhookNotification(title, webhookContent, config);
        console.log(`${logPrefix} 发送企业微信应用通知 ${success ? '成功' : '失败'}`);
    }
    if (config.enabledNotifiers.includes('wechatbot')) {
        const wechatbotContent = commonContent.replace(/(\**|\*|##|#|`)/g, '');
        const success = await sendWechatBotNotification(title, wechatbotContent, config);
        console.log(`${logPrefix} 发送企业微信机器人通知 ${success ? '成功' : '失败'}`);
    }
    if (config.enabledNotifiers.includes('email')) {
        const emailContent = commonContent.replace(/(\**|\*|##|#|`)/g, '');
        const success = await sendEmailNotification(title, emailContent, config);
        console.log(`${logPrefix} 发送邮件通知 ${success ? '成功' : '失败'}`);
    }
    if (config.enabledNotifiers.includes('bark')) {
        const barkContent = commonContent.replace(/(\**|\*|##|#|`)/g, '');
        const success = await sendBarkNotification(title, barkContent, config);
        console.log(`${logPrefix} 发送Bark通知 ${success ? '成功' : '失败'}`);
    }
}

// Telegram
export async function sendTelegramNotification(message: string, config: Config): Promise<boolean> {
  try {
    if (!config.telegram?.botToken || !config.telegram?.chatId) {
      console.error('[Telegram] 通知未配置，缺少Bot Token或Chat ID');
      return false;
    }

    const url = 'https://api.telegram.org/bot' + config.telegram.botToken + '/sendMessage';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegram.chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const result = await response.json() as any;
    return result.ok;
  } catch (error) {
    console.error('[Telegram] 发送通知失败:', error);
    return false;
  }
}

// NotifyX
export async function sendNotifyXNotification(title: string, content: string, description: string, config: Config): Promise<boolean> {
  try {
    if (!config.notifyx?.apiKey) {
      console.error('[NotifyX] 通知未配置，缺少API Key');
      return false;
    }

    const url = 'https://www.notifyx.cn/api/v1/send/' + config.notifyx.apiKey;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        content: content,
        description: description || ''
      })
    });

    const result = await response.json() as any;
    return result.status === 'queued';
  } catch (error) {
    console.error('[NotifyX] 发送通知失败:', error);
    return false;
  }
}

// WeNotify Edge
export async function sendWeNotifyEdgeNotification(title: string, content: string, config: Config): Promise<boolean> {
  try {
    if (!config.wenotify?.url || !config.wenotify?.token) {
      console.error('[WeNotify Edge] 通知未配置，缺少服务地址或Token');
      return false;
    }
    let base = config.wenotify.url.trim().replace(/\/+$/, '');
    let url = base.endsWith('/wxsend') ? base : base + '/wxsend';
    const body: any = {
      title: title,
      content: content
    };
    if (config.wenotify.userid) {
      body.userid = config.wenotify.userid;
    }
    if (config.wenotify.templateId) {
      body.template_id = config.wenotify.templateId;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.wenotify.token
      },
      body: JSON.stringify(body)
    });
    return response.ok;
  } catch (error) {
    console.error('[WeNotify Edge] 发送通知失败:', error);
    return false;
  }
}

// Bark
export async function sendBarkNotification(title: string, content: string, config: Config): Promise<boolean> {
  try {
    if (!config.bark?.deviceKey) {
      console.error('[Bark] 通知未配置，缺少设备Key');
      return false;
    }

    const serverUrl = config.bark.server || 'https://api.day.app';
    const url = serverUrl + '/push';
    const payload: any = {
      title: title,
      body: content,
      device_key: config.bark.deviceKey
    };

    if (config.bark.isArchive === 'true') {
      payload.isArchive = 1;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json() as any;
    return result.code === 200;
  } catch (error) {
    console.error('[Bark] 发送通知失败:', error);
    return false;
  }
}

// Email
export async function sendEmailNotification(title: string, content: string, config: Config): Promise<boolean> {
  try {
    if (!config.email?.resendApiKey || !config.email?.fromEmail || !config.email?.toEmail) {
      console.error('[邮件通知] 通知未配置，缺少必要参数');
      return false;
    }

    // 生成HTML邮件内容
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px 20px; }
        .content h2 { color: #333; margin-top: 0; }
        .content p { color: #666; line-height: 1.6; margin: 16px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .highlight { background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 ${title}</h1>
        </div>
        <div class="content">
            <div class="highlight">
                ${content.replace(/\n/g, '<br>')}
            </div>
            <p>此邮件由订阅管理系统自动发送，请及时处理相关订阅事务。</p>
        </div>
        <div class="footer">
            <p>订阅管理系统 | 发送时间: ${formatTimeInTimezone(new Date(), config.timezone || 'UTC', 'datetime')}</p>
        </div>
    </div>
</body>
</html>`;

    const fromEmail = config.email.fromEmail.includes('<') ? 
      config.email.fromEmail :
      (config.email.fromEmail ? `Notification <${config.email.fromEmail}>` : '');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.email.resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: config.email.toEmail,
        subject: title,
        html: htmlContent,
        text: content
      })
    });

    const result = await response.json() as any;
    return response.ok && result.id;
  } catch (error) {
    console.error('[邮件通知] 发送邮件失败:', error);
    return false;
  }
}

// 企业微信应用通知 (Webhook)
export async function sendWebhookNotification(title: string, content: string, config: Config): Promise<boolean> {
  try {
    if (!config.webhook?.url) {
      console.error('[企业微信应用通知] 未配置 Webhook URL');
      return false;
    }

    const method = config.webhook.method || 'POST';
    const headers = config.webhook.headers ? JSON.parse(config.webhook.headers) : { 'Content-Type': 'application/json' };
    const template = config.webhook.template ? JSON.parse(config.webhook.template) : null;

    let body;
    if (template) {
      // 使用模板替换变量
      const templateStr = JSON.stringify(template);
      const replacedStr = templateStr
        .replace(/{{title}}/g, title)
        .replace(/{{content}}/g, content)
        .replace(/{{timestamp}}/g, new Date().toISOString());
      body = replacedStr;
    } else {
      // 默认格式
      body = JSON.stringify({
        msgtype: 'text',
        text: {
          content: `${title}\n\n${content}`
        }
      });
    }

    const response = await fetch(config.webhook.url, {
      method: method,
      headers: headers,
      body: method !== 'GET' ? body : undefined
    });

    return response.ok;
  } catch (error) {
    console.error('[企业微信应用通知] 发送失败:', error);
    return false;
  }
}

// 企业微信机器人
export async function sendWechatBotNotification(title: string, content: string, config: Config): Promise<boolean> {
  try {
    if (!config.wechatBot?.webhook) {
      console.error('[企业微信机器人] 未配置 Webhook URL');
      return false;
    }

    const msgType = config.wechatBot.msgType || 'text';
    let messageData: any;

    if (msgType === 'markdown') {
      const markdownContent = `### ${title}\n\n${content}`;
      messageData = {
        msgtype: 'markdown',
        markdown: {
          content: markdownContent
        }
      };
    } else {
      const textContent = `${title}\n\n${content}`;
      messageData = {
        msgtype: 'text',
        text: {
          content: textContent
        }
      };
    }

    if (config.wechatBot.atAll === 'true') {
      if (msgType === 'text') {
        messageData.text.mentioned_list = ['@all'];
      }
    } else if (config.wechatBot.atMobiles) {
      const mobiles = config.wechatBot.atMobiles.split(',').map((m: string) => m.trim()).filter((m: string) => m);
      if (mobiles.length > 0) {
        if (msgType === 'text') {
          messageData.text.mentioned_mobile_list = mobiles;
        }
      }
    }

    const response = await fetch(config.wechatBot.webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });

    const responseText = await response.text();
    if (response.ok) {
      try {
        const result = JSON.parse(responseText);
        return result.errcode === 0;
      } catch (parseError) {
        return false;
      }
    } else {
      return false;
    }
  } catch (error) {
    console.error('[企业微信机器人] 发送通知失败:', error);
    return false;
  }
}
