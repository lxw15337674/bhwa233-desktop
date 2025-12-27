# 剪切板历史功能架构审查与改进方案

**日期**: 2025-12-27
**状态**: 待实施

本文档总结了对当前剪切板历史功能（Clipboard History）的技术审查，包括窗口管理、路由架构、核心业务逻辑以及性能优化的建议。

---

## 1. 窗口管理 (Window Management)

### 现状与问题
*   **销毁重建策略**: 目前 `toggleClipboardWindow` 采用“关闭(Destroy) vs 新建(Create)”的逻辑。
    *   **后果**: 每次打开窗口都需要重新初始化 Electron 渲染进程和 React 环境，导致明显的启动延迟（Lag）。
*   **定位问题**: 窗口位置固定或仅依赖保存的位置，未考虑多显示器场景下用户鼠标的当前位置。
*   **焦点丢失**: `blur` 事件处理与 `close` 逻辑冲突，且在 Win32 平台下可能因点击任务栏而异常隐藏。

### 改进方案：单例 + 显隐模式
1.  **单例模式 (Singleton)**: 应用启动或首次触发时创建窗口，之后常驻内存。
2.  **显隐切换 (Toggle Visibility)**:
    *   快捷键触发时：调用 `window.show()` 和 `window.focus()`，实现毫秒级“秒开”。
    *   失去焦点时：调用 `window.hide()` 而非 `close()`。
3.  **鼠标跟随定位**:
    *   在 `show()` 之前，使用 `screen.getCursorScreenPoint()` 获取鼠标位置。
    *   计算当前鼠标所在的显示器，将窗口定位在该显示器的一侧或特定位置。

---

## 2. 路由与布局架构 (Routing & Layout)

### 现状与问题
*   **路由模式错误**: `src/utils/routes.ts` 使用了 `createMemoryHistory`。
    *   **后果**: Electron 加载 `index.html#/clipboard` 时，Hash 被忽略，直接回退到首页 (`/`)。
*   **布局嵌套冗余**: `src/routes/__root.tsx` 强制对所有路由包裹 `BaseLayout`。
    *   **后果**: 紧凑模式（Compact View）被套在主程序框架内，出现了双重标题栏、侧边栏（如有）和底部 80px 的强制留白。

### 改进方案
1.  **启用 Hash 路由**: 将 `createMemoryHistory` 替换为 `createHashHistory`，确保 Electron 能正确导航到指定 Hash 页面。
2.  **布局分离**:
    *   在 `__root.tsx` 中根据路径判断，或者使用 TanStack Router 的 `_layout` 路由组功能。
    *   确保 `/clipboard` 路由是独立的，不继承 `BaseLayout` 的 UI 样式（如 Padding、TitleBar）。

---

## 3. 核心业务逻辑 Review (Business Logic)

### A. 监听机制 (Watcher)
*   **现状**: 使用 `setInterval` 每 500ms 轮询 `clipboard.readText/Image`。
*   **缺陷**: 占用空闲 CPU，存在最大 500ms 延迟，且可能漏掉极短时间内的连续复制。
*   **建议**: 
    *   短期：优化轮询逻辑。
    *   长期：引入原生 C++ 模块或 `electron-clipboard-watcher` 实现系统级事件回调。

### B. 图片处理与去重
*   **现状**: 通过比对图片 Base64 字符串进行去重；图片直接存为文件。
*   **缺陷**: 大图片的 Base64 比对极其消耗 CPU/内存；列表加载原图可能导致卡顿。
*   **建议**:
    *   **去重**: 计算图片的 Hash (MD5/XXHash) 或比对文件大小+字节头，替代 Base64 比对。
    *   **缩略图**: 保存图片时生成缩略图，列表仅加载缩略图。

### C. 前后端通信 (IPC)
*   **现状**: 后端广播 `clipboard-updated` -> 前端全量拉取第一页数据 `loadRecords(0, true)`。
*   **缺陷**: 导致列表强制刷新，滚动位置丢失，且浪费带宽。
*   **建议**: `clipboard-updated` 事件携带新增的那条 `record` 数据，前端直接 `unshift` 到状态中。

---

## 4. 功能增强建议 (Feature Roadmap)

2.  **富文本支持**:
    *   存储 `readHTML`，支持保留格式的粘贴。
    *   UI 提供“纯文本粘贴”和“原格式粘贴”选项。
4.  **快捷操作**:
    *   支持键盘上下键选择记录，回车直接粘贴（需要模拟键盘输入）。
    *   支持 `Cmd+1` ~ `Cmd+9` 快速粘贴最近 9 条记录。

---

## 5. 实施计划 (Action Items)

1.  **[High]** 修改 `src/utils/routes.ts` 为 Hash 路由。
2.  **[High]** 重构 `src/routes/__root.tsx`，剥离 `/clipboard` 的布局。
3.  **[High]** 重构 `src/clipboardWindowManager.ts` 为单例显隐模式。
4.  **[Medium]** 优化 `src/hooks/useClipboardRecords.ts` 的更新逻辑（增量更新）。
5.  **[Low]** 优化图片存储与去重算法。
