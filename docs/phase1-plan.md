# tidysnap 阶段1执行计划（Beta 2026.4 上线前）

---

## 1. 分工表

**@product-manager**
- 定义 MVP Scope：上传 → AI分析 → 箭头标签 → 下载，砍掉所有边缘需求
- 撰写 PRD v1.0，冻结功能边界
- 优先级排序：P0=核心流程，P1=CTA/下载，P2=历史记录

**@tech-lead**
- 集成 Nana Banana 2 / Gemini Flash，制定 API 规范（输入/输出/超时/降级）
- 设计图像预处理 pipeline（压缩/方向校正）
- 搭建 Stripe webhook 端点，防重放攻击
- 技术选型审批（Next.js vs Astro SSR，明确部署架构）

**@frontend-engineer**
- 移动端照片上传组件（支持 Camera API / 文件选择）
- AI 计划图渲染（箭头 SVG 叠加层，支持 PNG 下载）
- Stripe Checkout 集成（lifttime 50% off 定价）
- Loading 状态 UI（骨架屏 + 进度预估）

**@backend-engineer**
- 图像预处理服务（resize/压缩 <2MB）
- Nana Banana 2 调用封装，含 retry 逻辑和超时降级
- Stripe webhook 处理（checkout.session.completed + 权益发放）
- API 路由：/api/upload, /api/analyze, /api/webhook

**@qa-engineer**
- 制定 P0/P1 Bug 标准（P0=上传失败/下载错误/支付失败，P1=箭头错位/体验降级）
- 移动端兼容性矩阵（iOS Safari/Android Chrome + 主要机型的 camera 权限）
- 自动化覆盖：Playwright E2E（上传→分析→下载完整流程）

**@ui-ux-designer**
- 箭头标签视觉规范（颜色/粗细/端点样式，输出 Figma token）
- 移动端拍照体验设计（权限提示/取景框/确认页）
- Loading 预期设计（3~5步进度条 + "正在分析您的桌面…"文案）
- Beta launch 视觉稿（Waitlist → Early Access → Payment 完成页）

**@seo-specialist**
- 关键词布局：AI desk organizer, tidy messy desk AI, Snap Once Tidy Forever
- 提交 sitemap.xml + structured data（Product/FAQPage schema）
- 内容营销：3篇 SEO blog（桌面整理技巧 + AI 工具测评 + 用户故事）
- Google Search Console 接入，盯住 Core Web Vitals

**@commercial-lead**
- Stripe CLI 配置：lifetime 50% off early access 定价（~$9.99 vs $19.99）
- 回本模型：$210 固定成本，定价 $9.99 × 4872 waitlist = $48,683 理论峰值
- 制定首 5000 名 early spot 发放规则（先到先得 / 邀请码）
- 退款/撤销 policy，白纸黑字写入 Stripe Dashboard

---

## 2. 时间线（Beta 2026.4 上线）

```
[Week 1] 奠基
  - PM: PRD v1.0 定稿，Scope freeze
  - TL: API 规范输出，技术选型决策
  - SEO: 关键词库 + sitemap 草稿
  - UI/UX: 箭头视觉规范 + Loading 稿输出

[Week 2-3] 核心开发
  - FE: 上传组件 + 渲染组件
  - BE: 图像预处理 + Nana Banana 2 集成
  - QA: E2E 测试用例编写完成

[Week 4] 集成 + Stripe
  - BE/FE: 完整流程联调
  - Stripe Checkout 上线（test mode）
  - QA: P0 bug 全量回归

[Week 5] Beta 发布
  - 部署至 vercel.com/tidysnap（beta 域名）
  - Waitlist 4872 人 email 推送 Early Access 邀请
  - SEO: sitemap 提交 + 3篇 blog 上线
  - 商业: Stripe live mode 审批，首批 early spot 发放
```

---

## 3. ROI 预估

| 阶段 | 里程碑 | 盈利贡献 | 说明 |
|------|--------|----------|------|
| Pre-Beta | Waitlist 5000 转化 | $0 | 品牌积累，无收入 |
| Beta Launch | 首 500 名付费 | ~$4,995 | $9.99 × 500，Stripe 手续费 -3% ≈ $4,845 |
| Beta 扩张 | 1000 名付费 | ~$9,990 | |
| **回本线** | **~$21 名付费** | **~$210** | 固定成本 $210 直接覆盖 |
| 稳定期 | 4872 全转化 | **~$47,000+** | theoretical max，Stripe 后 ~$45,600 |

**重点：Beta 前 21 笔付费即回本，压力极低。**

---

## 4. 需要补充的凭证（CEO 提供项）

- [ ] Nana Banana 2 / Gemini Flash API key（测试 + 生产）
- [ ] Stripe Account ID + 已配置的 Product/Price ID（lifetime 50% off）
- [ ] AWS/Vercel 额外配额（如图像处理需 GPU 实例）
- [ ] 现有 waitlist 4872 人 email list（CSV 或 API 接入）
- [ ] 域名 tidysnap.homes DNS 控制权确认
- [ ] 破产/退款 policy 文字描述（如有特殊条款）
- [ ] 目标市场（美国/欧洲/亚洲）优先级，影响 SEO 和定价货币
- [ ] 合规需求（GDPR / CCPA，如涉及欧盟用户数据）

---

**CEO 审批后，此计划冻结为执行基准。变更需走 Change Request 流程。**
