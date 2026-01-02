import { Env } from './types';
import { adminPage } from './templates/admin';
import { configPage } from './templates/config';
import { loginPage } from './templates/login';
import { handleDebugRequest } from './templates/debug';
import { SubscriptionService } from './services/subscription';
import { 
  sendNotificationToAllChannels, 
  sendTelegramNotification, 
  sendNotifyXNotification, 
  sendWeNotifyEdgeNotification,
  sendWebhookNotification,
  sendWechatBotNotification,
  sendEmailNotification,
  sendBarkNotification,
  formatNotificationContent
} from './services/notification';
import { getConfig, generateRandomSecret } from './utils/config';
import { generateJWT, verifyJWT } from './utils/auth';
import { getCurrentTimeInTimezone, formatTimeInTimezone } from './utils/date';
import { getCookieValue } from './utils/http';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Debug page
    if (url.pathname === '/debug') {
      return handleDebugRequest(request, env);
    }

    // API Routes
    if (url.pathname.startsWith('/api')) {
      return handleApiRequest(request, env);
    }

    // Admin Routes
    if (url.pathname.startsWith('/admin')) {
      return handleAdminRequest(request, env);
    }

    // Default: Login or Redirect to Admin
    return handleMainRequest(request, env);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const config = await getConfig(env);
    const timezone = config?.TIMEZONE || 'UTC';
    const currentTime = getCurrentTimeInTimezone(timezone);
    console.log('[Workers] 定时任务触发 UTC:', new Date().toISOString(), timezone + ':', currentTime.toLocaleString('zh-CN', {timeZone: timezone}));
    
    const subscriptionService = new SubscriptionService(env);
    const { notifications } = await subscriptionService.checkExpiringSubscriptions();
    
    if (notifications.length > 0) {
      // 按到期时间排序
      notifications.sort((a, b) => a.daysUntil - b.daysUntil);
      
      const subscriptions = notifications.map(n => ({
        ...n.subscription,
        daysRemaining: n.daysUntil
      }));

      const commonContent = formatNotificationContent(subscriptions, config);
      const title = '订阅到期提醒';
      await sendNotificationToAllChannels(title, commonContent, config, '[定时任务]');
    }
  }
};

async function handleMainRequest(request: Request, env: Env): Promise<Response> {
  return new Response(loginPage, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const token = getCookieValue(request.headers.get('Cookie'), 'token');
    const config = await getConfig(env);
    const user = token ? await verifyJWT(token, config.JWT_SECRET) : null;

    if (!user) {
      return new Response('', {
        status: 302,
        headers: { 'Location': '/' }
      });
    }

    if (url.pathname === '/admin/config') {
      return new Response(configPage, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return new Response(adminPage, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (error) {
    console.error('[Admin] Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(4); // Remove '/api'
  const method = request.method;
  const config = await getConfig(env);

  // Public API: Login
  if (path === '/login' && method === 'POST') {
    try {
      const body: any = await request.json();
      if (body.username === config.ADMIN_USERNAME && body.password === config.ADMIN_PASSWORD) {
        const token = await generateJWT(body.username, config.JWT_SECRET);
        return new Response(JSON.stringify({ success: true }), {
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `token=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400`
          }
        });
      } else {
        return new Response(JSON.stringify({ success: false, message: '用户名或密码错误' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid request' }), { status: 400 });
    }
  }

  // Public API: Logout
  if (path === '/logout' && (method === 'GET' || method === 'POST')) {
    return new Response('', {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': 'token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0'
      }
    });
  }
  
  // Third-party Notification API (Public)
  if (path.startsWith('/notify/')) {
      // ... implementation ...
      // reusing existing logic structure
      if (method === 'POST') {
        try {
          const body: any = await request.json();
          const title = body.title || '第三方通知';
          const content = body.content || '';

          if (!content) {
            return new Response(JSON.stringify({ message: '缺少必填参数 content' }), { status: 400 });
          }

          await sendNotificationToAllChannels(title, content, config, '[第三方API]');

          return new Response(JSON.stringify({
              message: '发送成功',
              response: { errcode: 0, errmsg: 'ok', msgid: 'MSGID' + Date.now() }
            }), { headers: { 'Content-Type': 'application/json' } });
        } catch (error: any) {
          return new Response(JSON.stringify({
              message: '发送失败',
              response: { errcode: 1, errmsg: error.message }
            }), { status: 500 });
        }
      }
  }

  // Auth Check for other APIs
  const token = getCookieValue(request.headers.get('Cookie'), 'token');
  const user = token ? await verifyJWT(token, config.JWT_SECRET) : null;

  if (!user) {
    return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Config API
  if (path === '/config') {
    if (method === 'GET') {
      const { JWT_SECRET, ADMIN_PASSWORD, ...safeConfig } = config;
      return new Response(JSON.stringify(safeConfig), { headers: { 'Content-Type': 'application/json' } });
    }
    if (method === 'POST') {
      try {
        const newConfig: any = await request.json();
        const updatedConfig = {
            ...config,
            ADMIN_USERNAME: newConfig.ADMIN_USERNAME || config.ADMIN_USERNAME,
            TG_BOT_TOKEN: newConfig.TG_BOT_TOKEN || '',
            TG_CHAT_ID: newConfig.TG_CHAT_ID || '',
            NOTIFYX_API_KEY: newConfig.NOTIFYX_API_KEY || '',
            WENOTIFY_URL: newConfig.WENOTIFY_URL || '',
            WENOTIFY_TOKEN: newConfig.WENOTIFY_TOKEN || '',
            WENOTIFY_USERID: newConfig.WENOTIFY_USERID || '',
            WENOTIFY_TEMPLATE_ID: newConfig.WENOTIFY_TEMPLATE_ID || '',
            WEBHOOK_URL: newConfig.WEBHOOK_URL || '',
            WEBHOOK_METHOD: newConfig.WEBHOOK_METHOD || 'POST',
            WEBHOOK_HEADERS: newConfig.WEBHOOK_HEADERS || '',
            WEBHOOK_TEMPLATE: newConfig.WEBHOOK_TEMPLATE || '',
            SHOW_LUNAR: newConfig.SHOW_LUNAR === true,
            WECHATBOT_WEBHOOK: newConfig.WECHATBOT_WEBHOOK || '',
            WECHATBOT_MSG_TYPE: newConfig.WECHATBOT_MSG_TYPE || 'text',
            WECHATBOT_AT_MOBILES: newConfig.WECHATBOT_AT_MOBILES || '',
            WECHATBOT_AT_ALL: newConfig.WECHATBOT_AT_ALL || 'false',
            RESEND_API_KEY: newConfig.RESEND_API_KEY || '',
            EMAIL_FROM: newConfig.EMAIL_FROM || '',
            EMAIL_FROM_NAME: newConfig.EMAIL_FROM_NAME || '',
            EMAIL_TO: newConfig.EMAIL_TO || '',
            BARK_DEVICE_KEY: newConfig.BARK_DEVICE_KEY || '',
            BARK_SERVER: newConfig.BARK_SERVER || 'https://api.day.app',
            BARK_IS_ARCHIVE: newConfig.BARK_IS_ARCHIVE || 'false',
            ENABLED_NOTIFIERS: newConfig.ENABLED_NOTIFIERS || ['notifyx'],
            TIMEZONE: newConfig.TIMEZONE || config.TIMEZONE || 'UTC'
        };
        
        if (newConfig.ADMIN_PASSWORD) {
            updatedConfig.ADMIN_PASSWORD = newConfig.ADMIN_PASSWORD;
        }

        if (!updatedConfig.JWT_SECRET || updatedConfig.JWT_SECRET === 'your-secret-key') {
            updatedConfig.JWT_SECRET = generateRandomSecret();
        }

        await env.SUBSCRIPTIONS_KV.put('config', JSON.stringify(updatedConfig));
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch (error: any) {
        return new Response(JSON.stringify({ success: false, message: error.message }), { status: 400 });
      }
    }
  }

  // Test Notification API
  if (path === '/test-notification' && method === 'POST') {
    try {
        const body: any = await request.json();
        let success = false;
        let message = '';
        
        // Mock config for test
        const testConfig = { ...config, ...body }; 
        // Note: body contains specific fields like TG_BOT_TOKEN which overlay on config.
        // The original code manually mapped fields. Here we can be a bit more dynamic or strict.
        // Let's stick to strict mapping as per original to avoid pollution if needed, 
        // but spreading body over config is easier if field names match.
        // The original code constructed `testConfig` manually for each type.
        
        if (body.type === 'telegram') {
            const content = '*测试通知*\n\n这是一条测试通知...';
            success = await sendTelegramNotification(content, { ...config, TG_BOT_TOKEN: body.TG_BOT_TOKEN, TG_CHAT_ID: body.TG_CHAT_ID });
        } else if (body.type === 'notifyx') {
            success = await sendNotifyXNotification('测试通知', '## 测试通知...', '测试描述', { ...config, NOTIFYX_API_KEY: body.NOTIFYX_API_KEY });
        } else if (body.type === 'wenotify') {
            success = await sendWeNotifyEdgeNotification('测试通知', '测试通知...', { ...config, WENOTIFY_URL: body.WENOTIFY_URL, WENOTIFY_TOKEN: body.WENOTIFY_TOKEN, WENOTIFY_USERID: body.WENOTIFY_USERID, WENOTIFY_TEMPLATE_ID: body.WENOTIFY_TEMPLATE_ID });
        } else if (body.type === 'webhook') {
            success = await sendWebhookNotification('测试通知', '测试通知...', { ...config, WEBHOOK_URL: body.WEBHOOK_URL, WEBHOOK_METHOD: body.WEBHOOK_METHOD, WEBHOOK_HEADERS: body.WEBHOOK_HEADERS, WEBHOOK_TEMPLATE: body.WEBHOOK_TEMPLATE });
        } else if (body.type === 'wechatbot') {
            success = await sendWechatBotNotification('测试通知', '测试通知...', { ...config, WECHATBOT_WEBHOOK: body.WECHATBOT_WEBHOOK, WECHATBOT_MSG_TYPE: body.WECHATBOT_MSG_TYPE, WECHATBOT_AT_MOBILES: body.WECHATBOT_AT_MOBILES, WECHATBOT_AT_ALL: body.WECHATBOT_AT_ALL });
        } else if (body.type === 'email') {
            success = await sendEmailNotification('测试通知', '测试通知...', { ...config, RESEND_API_KEY: body.RESEND_API_KEY, EMAIL_FROM: body.EMAIL_FROM, EMAIL_FROM_NAME: body.EMAIL_FROM_NAME, EMAIL_TO: body.EMAIL_TO });
        } else if (body.type === 'bark') {
            success = await sendBarkNotification('测试通知', '测试通知...', { ...config, BARK_SERVER: body.BARK_SERVER, BARK_DEVICE_KEY: body.BARK_DEVICE_KEY, BARK_IS_ARCHIVE: body.BARK_IS_ARCHIVE });
        }
        
        return new Response(JSON.stringify({ success, message: success ? '发送成功' : '发送失败' }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
    }
  }

  // Subscriptions API
  const subscriptionService = new SubscriptionService(env);
  
  if (path === '/subscriptions') {
    if (method === 'GET') {
      const subscriptions = await subscriptionService.getAllSubscriptions();
      return new Response(JSON.stringify(subscriptions), { headers: { 'Content-Type': 'application/json' } });
    }
    if (method === 'POST') {
      const sub = await request.json();
      const result = await subscriptionService.createSubscription(sub as any);
      return new Response(JSON.stringify(result), { status: result.success ? 201 : 400, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (path.startsWith('/subscriptions/')) {
    const parts = path.split('/');
    const id = parts[2];

    if (parts[3] === 'toggle-status' && method === 'POST') {
      const body: any = await request.json();
      const result = await subscriptionService.toggleSubscriptionStatus(id, body.isActive);
      return new Response(JSON.stringify(result), { status: result.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (parts[3] === 'test-notify' && method === 'POST') {
      // Implement test notify for single subscription
      try {
        const sub = await subscriptionService.getSubscription(id);
        if (!sub) return new Response(JSON.stringify({ success: false, message: 'Subscription not found' }), { status: 404 });
        
        // Calculate days remaining roughly
        const now = new Date();
        const expiry = new Date(sub.expiryDate);
        // Note: exact calculation logic is in checkExpiringSubscriptions but we can approximate or duplicate for display
        sub.daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        const content = formatNotificationContent([sub], config);
        await sendNotificationToAllChannels('订阅提醒测试', content, config, '[手动测试]');
        return new Response(JSON.stringify({ success: true, message: '已发送' }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 500 });
      }
    }

    if (method === 'GET') {
      const sub = await subscriptionService.getSubscription(id);
      return new Response(JSON.stringify(sub), { headers: { 'Content-Type': 'application/json' } });
    }

    if (method === 'PUT') {
      const sub = await request.json();
      const result = await subscriptionService.updateSubscription(id, sub as any);
      return new Response(JSON.stringify(result), { status: result.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (method === 'DELETE') {
      const result = await subscriptionService.deleteSubscription(id);
      return new Response(JSON.stringify(result), { status: result.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ success: false, message: 'Not Found' }), { status: 404 });
}
