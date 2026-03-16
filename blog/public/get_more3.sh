#!/bin/bash

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

# 继续尝试 transformation/clean 相关图片
ids=(
  "transformation:1558618047-781d3d0cc89a"
  "transformation:1600585154340-be6511a19632"
  "transformation:1600566753190-17f0baa2a6c3"
  "transformation:1610313231005-bf5d5aae13bb"
  "transformation:1558618666-fcd25c85cd64"
  "transformation:1615529182905-8e79e593c9b4"
  "transformation:1584622650111-a51927d77c52"
)

for item in "${ids[@]}"; do
  name="${item%%:*}"
  id="${item##*:}"
  download_if_valid "$name" "$id"
done

ls -la *.jpg
