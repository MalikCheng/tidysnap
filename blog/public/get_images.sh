#!/bin/bash

# 测试并下载图片的函数
download_if_valid() {
  local name=$1
  local id=$2
  local url="https://images.unsplash.com/photo-$id?auto=format&fit=crop&w=1600&q=80"
  
  if curl -sI "$url" | head -1 | grep -q "200"; then
    echo "✅ 下载 $name: $id"
    curl -sL "$url" -o "$name.jpg"
    return 0
  else
    echo "❌ 无效 $name: $id"
    return 1
  fi
}

# 测试一批图片 ID
echo "测试图片 ID..."

# 一些可能可用的 Unsplash 图片 ID (来自常见分类)
ids=(
  "desk-organization:1497215728101-856f4ea42174"
  "desk-organization:1518455027359-f3f8164ba6bd"
  "home-office:1593642632559-0c6d3fc62b39"
  "home-office:1506905925346-21bda4d32df4"
  "ai-tech:1677442674439-d25e5afc8c2e"
  "ai-tech:1485827404703-89b55fcc595e"
  "cable:1558618666-fcd25c85cd64"
  "cable:1563206095-64c44dc32be2"
  "habit:1506126612848-85f7a30ef420"
  "habit:1499750310107-5c28e9b1cbd8"
  "remote-work:1522071820082-009f6369dede"
  "remote-work:1593642704905-a2d8c01a6c40"
)

for item in "${ids[@]}"; do
  name="${item%%:*}"
  id="${item##*:}"
  download_if_valid "$name" "$id"
done

echo "完成!"
ls -la *.jpg 2>/dev/null || echo "没有下载到图片"
