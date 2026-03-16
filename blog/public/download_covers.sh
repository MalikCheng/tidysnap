#!/bin/bash

# 定义文章主题和对应的搜索词
declare -A topics=(
  ["desk-organization"]="desk organization minimal"
  ["habit-formation"]="morning routine habit"
  ["home-office"]="home office workspace"
  ["remote-work"]="remote work laptop"
  ["cable-management"]="cable management charger"
  ["ai-organization"]="artificial intelligence tech"
  ["ai-tips"]="technology computer AI"
  ["transformation"]="clean room organization"
)

echo "开始下载封面图..."
for key in "${!topics[@]}"; do
  echo "下载: $key - ${topics[$key]}"
done
