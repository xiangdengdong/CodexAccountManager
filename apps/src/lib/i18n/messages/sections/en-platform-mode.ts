"use client";

import type { MessageCatalog } from "../types";

export const EN_PLATFORM_MODE_MESSAGES: MessageCatalog = {
  平台模式选择: "Platform Mode",
  "选择 Codex CLI 直连账号，或通过 CodexManager 本地网关接入。":
    "Choose a direct Codex CLI account connection or route through the CodexManager local gateway.",
  写入位置说明: "Where changes are written",
  "这里修改的是 codexmanager-service 所在机器的 Codex 配置目录，不一定是当前浏览器所在机器。":
    "These changes affect the Codex profile directory on the machine running codexmanager-service, which may be different from the machine running this browser.",
  "当前运行环境无法访问管理 RPC，暂时不能读取或写入 Codex profile。":
    "The current runtime cannot access management RPC, so it cannot read or write the Codex profile right now.",
  "当前模式": "Current mode",
  "当前平台 Key": "Current platform key",
  "最后应用": "Last applied",
  "正在使用": "Active",
  "没有可用于账号直连的 active OpenAI 账号。":
    "No active OpenAI account is available for direct account mode.",
  "去添加 OpenAI 账号": "Add OpenAI account",
  "正在读取可用账号...": "Loading available accounts...",
  "可用账号数：{count}": "Available accounts: {count}",
  "重新应用账号直连": "Reapply direct account",
  "切换到账号直连": "Switch to direct account",
  "没有可用于本地网关的平台密钥。":
    "No platform key is available for local gateway mode.",
  "去创建平台密钥": "Create platform key",
  "选择平台密钥": "Select platform key",
  "将使用 gateway base_url": "Gateway base_url in use",
  "重新应用本地网关": "Reapply local gateway",
  "切换到本地网关": "Switch to local gateway",
  "高级与恢复": "Advanced and recovery",
  "修改 profile 目录、gateway base_url、修复历史会话或恢复接管前配置。":
    "Adjust the profile directory, gateway base_url, repair history visibility, or restore the original managed configuration.",
  "Profile 目标目录": "Target profile directory",
  "默认使用 CODEX_HOME 或 service 用户的 ~/.codex。":
    "By default, CODEX_HOME or the service user's ~/.codex is used.",
  "Codex profile 目录": "Codex profile directory",
  "CodexManager 管理文件": "CodexManager managed files",
  管理标记: "Management marker",
  "否或未知": "No or unknown",
  "默认使用当前 Web 服务可访问的本地网关地址。":
    "By default, use the local gateway address reachable from the current Web service.",
  "使用当前网关": "Use current gateway",
  "恢复与历史会话": "Restore and history",
  "切换模式时会自动修复历史会话 provider 元数据；Codex 运行中锁库时可手动重试。":
    "Switching modes automatically repairs provider metadata for historical sessions; if Codex is holding the database lock, retry manually after closing it.",
  "历史会话可见性": "History visibility",
  "切换 direct / gateway 时会自动修复历史会话的 provider 元数据。":
    "Switching between direct and gateway modes automatically repairs provider metadata for historical sessions.",
  "修复历史可见性": "Repair history visibility",
  "目标 provider": "Target provider",
  "已修复 rollout / SQLite / session_index": "Repaired rollout / SQLite / session_index",
  备份目录: "Backup directory",
  警告: "Warning",
  "历史修复备份": "History repair backups",
  "备份保存在 CodexManager 数据目录，不再写入 Codex profile。":
    "Backups are stored in the CodexManager data directory and are no longer written into the Codex profile.",
  "清理历史备份": "Clean history backups",
  "数量 / 占用": "Count / size",
  保留策略: "Retention policy",
  "最多 {count} 份，最多 {days} 天，至少保留最新 {min} 份":
    "Keep up to {count} backups, keep them for up to {days} days, and always retain the latest {min} backups.",
  "恢复接管前配置": "Restore pre-managed configuration",
};
