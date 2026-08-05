// =====================================================
// Cloudflare Pages Functions · /api/config
// =====================================================
// 从环境变量读取 Supabase 凭据并暴露给前端
// 前端调用：fetch('/api/config').then(r => r.json())
// 返回：{ supabaseUrl, supabaseAnonKey }
// =====================================================

export async function onRequestGet(context) {
  // 从 Cloudflare Pages 环境变量读取（这些值不会出现在前端代码中）
  const supabaseUrl = context.env.SUPABASE_URL || '';
  const supabaseAnonKey = context.env.SUPABASE_ANON_KEY || '';

  return new Response(JSON.stringify({
    supabaseUrl,
    supabaseAnonKey,
    // 也可以加更多配置项
    siteName: '易捷加油',
    version: '1.0.0'
  }), {
    headers: {
      'Content-Type': 'application/json',
      // 缓存 5 分钟，减少函数调用
      'Cache-Control': 'public, max-age=300',
      // CORS（如果跨域访问）
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
