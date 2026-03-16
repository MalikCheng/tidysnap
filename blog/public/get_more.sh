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

# 继续测试更多图片 ID
ids=(
  "habit-formation:1544367567-0c630a740a2b"
  "habit-formation:1506126612848-85f7a30ef420"
  "habit-formation:1515377909343-d6c4d5b3a1f9"
  "remote-work:1522071820082-009f6369dede"
  "remote-work:1587614389765-d5523e4e5c6c"
  "remote-work:1593642632559-0c6d3fc62b39"
  "transformation:1558618047-781d3d0cc89a"
  "transformation:1584622650111-a51927d77c52"
  "transformation:1527063039198-02d4560b7f3c"
)

for item in "${ids[@]}"; do
  name="${item%%:*}"
  id="${item##*:}"
  download_if_valid "$name" "$id"
done

ls -la *.jpg
