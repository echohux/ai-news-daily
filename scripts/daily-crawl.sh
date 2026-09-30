#!/bin/zsh
# 每日 AI 新闻抓取任务（供 launchd / cron 调用）
# 手动测试：zsh scripts/daily-crawl.sh
set -e

# 项目根目录（脚本位于 <root>/scripts 下）
PROJECT_DIR="${0:A:h:h}"
cd "$PROJECT_DIR"

# launchd/cron 不会加载交互式 shell 配置，这里显式加载 nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# 若项目里有 .nvmrc 则用其指定版本，否则用默认版本
nvm use >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true

LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
LOG_FILE="$LOG_DIR/crawl-$(date +%Y-%m-%d).log"

{
  echo "==== $STAMP 开始抓取 ===="
  echo "node: $(command -v node) ($(node -v))"
  npm run fetch
  # 若已安装依赖则顺带重建静态产物（部署 dist/ 时需要）
  if [ -d node_modules ]; then
    npm run build
  fi
  echo "==== $STAMP 完成 ===="
} >>"$LOG_FILE" 2>&1

echo "done -> $LOG_FILE"
