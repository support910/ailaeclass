import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseStripeConfig } from '../src/lib/server/payments/stripeConfig.js';

const appRoot = resolve(import.meta.dirname, '..');

function readEnvFile(name) {
  const file = resolve(appRoot, name);
  if (!existsSync(file)) return {};
  const result = {};
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const values = {
  ...readEnvFile('.env'),
  ...readEnvFile('.env.local'),
  ...process.env
};

function present(key) {
  return typeof values[key] === 'string' && values[key].trim().length > 0;
}

function validHttpUrl(value, allowRelative = false) {
  if (allowRelative && value?.startsWith('/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

const stripe = parseStripeConfig(values);
const localEbook = resolve(
  appRoot,
  'static',
  String(values.FUNNEL_EBOOK_URL || '').replace(/^\/+/, '')
);
const supabaseVariablesReady =
  validHttpUrl(values.PUBLIC_SUPABASE_URL) &&
  present('PUBLIC_SUPABASE_ANON_KEY') &&
  present('PRIVATE_SUPABASE_SERVICE_ROLE');

const checks = [
  {
    item: 'PDF 电子书',
    ready:
      validHttpUrl(values.FUNNEL_EBOOK_URL, true) &&
      (!String(values.FUNNEL_EBOOK_URL).startsWith('/') || existsSync(localEbook)),
    detail: present('FUNNEL_EBOOK_URL') ? '下载地址已设置' : '缺少 FUNNEL_EBOOK_URL'
  },
  {
    item: 'Calendly',
    ready: validHttpUrl(values.FUNNEL_CALENDLY_URL),
    detail: present('FUNNEL_CALENDLY_URL') ? '预约链接格式有效' : '需要正式预约链接'
  },
  {
    item: 'WhatsApp',
    ready: /^(\+|00)?\d{8,15}$/.test(String(values.FUNNEL_SUPPORT_WHATSAPP || '').replace(/\s/g, '')),
    detail: present('FUNNEL_SUPPORT_WHATSAPP') ? '号码已填写' : '需要带国家/地区码的号码'
  },
  {
    item: 'FPS',
    ready: present('FUNNEL_FPS_ID') && present('FUNNEL_FPS_ACCOUNT_NAME'),
    detail: present('FUNNEL_FPS_ID') ? '收款资料已填写' : '需要 FPS ID 与账户名称'
  },
  {
    item: 'Stripe',
    ready: stripe.configured,
    detail: stripe.configured ? `${stripe.mode} 模式可用` : `缺少/无效：${stripe.issues.join(', ')}`
  },
  {
    item: 'Supabase 变量',
    ready: supabaseVariablesReady,
    detail: supabaseVariablesReady ? '三项数据库变量已填写' : '需要 URL、anon key、service role key'
  }
];

if (process.argv.includes('--online')) {
  if (!supabaseVariablesReady) {
    checks.push({ item: 'Supabase 在线', ready: false, detail: '变量不完整，未连接' });
  } else {
    try {
      const response = await fetch(
        `${values.PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/rest/v1/funnel_pages?select=slug&limit=1`,
        {
          headers: {
            apikey: values.PRIVATE_SUPABASE_SERVICE_ROLE,
            Authorization: `Bearer ${values.PRIVATE_SUPABASE_SERVICE_ROLE}`
          },
          signal: AbortSignal.timeout(10_000)
        }
      );
      checks.push({
        item: 'Supabase 在线',
        ready: response.ok,
        detail: response.ok
          ? '数据库可连接，漏斗表已存在'
          : `连接失败（HTTP ${response.status}），请更新密钥或执行迁移`
      });
    } catch {
      checks.push({ item: 'Supabase 在线', ready: false, detail: '无法连接数据库' });
    }
  }
}

console.log('\nAiLAE Funnel 配置检查\n');
console.table(
  checks.map(({ item, ready, detail }) => ({
    配置项: item,
    状态: ready ? '已就绪' : '待提供',
    说明: detail
  }))
);

const readyCount = checks.filter((check) => check.ready).length;
console.log(`结果：${readyCount}/${checks.length} 项已就绪。`);
console.log('未配置的外部服务会保持安全演示模式，不会产生真实收费。\n');

if (process.argv.includes('--strict') && readyCount !== checks.length) process.exitCode = 1;
