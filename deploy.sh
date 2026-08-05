#!/usr/bin/env bash
# =====================================================
# 易捷加油 · 一键推送与部署脚本
# =====================================================
# 用法：
#   chmod +x deploy.sh
#   ./deploy.sh           # 推送到 GitHub
#   ./deploy.sh --deploy  # 推送 + 触发 Cloudflare 部署
# =====================================================

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

GITHUB_REMOTE="https://github.com/Fcai168/recharge-h5.git"
BRANCH="main"

echo "🚀 易捷加油充值系统 · 部署脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. 检查 git
if ! command -v git &> /dev/null; then
  echo -e "${RED}❌ 未找到 git，请先安装${NC}"
  exit 1
fi

# 2. 检查当前状态
echo ""
echo "📊 当前状态："
git status --short || true
echo ""

# 3. 拉取远程（如果有）
if git remote | grep -q origin; then
  echo "🔄 拉取远程更新..."
  git pull --rebase origin "$BRANCH" 2>/dev/null || true
fi

# 4. 添加所有变更
echo "📦 添加文件..."
git add -A

# 5. 检查是否有变更
if git diff --cached --quiet; then
  echo -e "${YELLOW}ℹ️  没有新变更，跳过提交${NC}"
else
  # 6. 提交
  echo "💾 提交变更..."
  COMMIT_MSG="${1:-chore: 充值系统更新 $(date '+%Y-%m-%d %H:%M:%S')}"
  git commit -m "$COMMIT_MSG"
  echo -e "${GREEN}✅ 提交完成${NC}"
fi

# 7. 设置远程
if ! git remote | grep -q origin; then
  echo "🔗 添加远程: $GITHUB_REMOTE"
  git remote add origin "$GITHUB_REMOTE"
fi

# 8. 推送到 GitHub
echo ""
echo "⬆️  推送到 GitHub: $GITHUB_REMOTE"
git push -u origin "$BRANCH"

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ 推送成功！${NC}"
  echo ""
  echo "🌐 仓库地址: https://github.com/Fcai168/recharge-h5"
  echo ""
  echo "📋 下一步："
  echo "  1. 访问 https://dash.cloudflare.com → Workers & Pages"
  echo "  2. 连接 GitHub 仓库 Fcai168/recharge-h5"
  echo "  3. Build output: /  → 部署"
  echo ""
  echo "🔐 Supabase 集成："
  echo "  1. https://supabase.com 创建项目"
  echo "  2. SQL Editor 跑 supabase/schema.sql"
  echo "  3. 填入 js/supabase.js 的 SUPABASE_CONFIG"
else
  echo -e "${RED}❌ 推送失败${NC}"
  echo ""
  echo "💡 排查："
  echo "  1. 确认 https://github.com/Fcai168/recharge-h5 已创建"
  echo "  2. 检查 GitHub 凭据 (Personal Access Token)"
  echo "  3. 设置凭据: git config --global credential.helper store"
  exit 1
fi
