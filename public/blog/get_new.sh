#!/bin/bash
# 下载新图片替换重复的

# 重复的需要替换:
# - ai-organization.jpg (需要新图)
# - desk-organization.jpg (需要新图)

# 尝试下载新的 Unsplash 图片
download() {
  local name=$1
  local id=$2
  local url="https://images.unsplash.com/photo-$id?auto=format&fit=crop&w=800&q=80"
  
  if curl -sI "$url" | head -1 | grep -q "200"; then
    echo "下载 $name: $id"
    curl -sL "$url" -o "$name.jpg"
    return 0
  else
    echo "无效 $name: $id"
    return 1
  fi
}

# AI/科技主题新图
download "ai-organization" "1485827404703-89b55fcc595e"

# 书桌整理新图
download "desk-organization" "1518455027359-f3f8164ba6bd"

ls -la
