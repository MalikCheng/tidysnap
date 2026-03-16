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

# 继续尝试更多图片 ID
ids=(
  "habit-formation:1470252649378-9c29740c9fa8"
  "habit-formation:1506784365847-bbad939e9335"
  "habit-formation:1499721403042-8d3e44510e0e"
  "remote-work:1609793330157-55e8a685d187"
  "remote-work:1587578932407-c8129c5d8c12"
  "remote-work:1556761175-5973dc0f32e7"
  "transformation:1584622650111-a51927d77c52"
  "transformation:1584438780053-8fd955a3e5b8"
  "transformation:1494438639944-d64f8a1f65b4"
  "lifestyle:1444412664976-5db6e6c63f91"
  "lifestyle:1506126612848-85f7a30ef420"
)

for item in "${ids[@]}"; do
  name="${item%%:*}"
  id="${item##*:}"
  download_if_valid "$name" "$id"
done

ls -la *.jpg
