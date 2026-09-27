# Kun 0.3.12

0.3.12 在实验室中加入模型主动上下文压缩，并修复 Windows 从旧版升级后无法启动的问题。

## ✨ 新功能

- **模型主动上下文压缩**：实验室新增「上下文压缩」。开启「模型主动上下文压缩」后，上下文预算到达 25%、50%、75% 时会提示模型处理，并提供 `compact_context`，沿用现有摘要压缩。再开启「窗口式上下文」后改为 `new_context`，不再写摘要。窗口式开关依赖总开关；关闭总开关时窗口式上下文一并关闭。设置从下一轮生效。无法执行所需工具的模型路由会在接纳时直接报错。

## 🐛 修复与改进

- **Windows 升级启动**：从 0.3.11 之前的版本升级时，已安装扩展的路径仍保留原来的大小写（如 `C:\Users\...`），而新版本会把数据目录收成小写。启动校验把这两条路径当成不同目录，Kun 在恢复阶段退出，Retry 也会重复失败。现在只接受同一安装目录的大小写差异，并改写成当前数据目录；指向其他目录的记录仍然拒绝。macOS 与 Linux 不受影响。没有安装过扩展的 Windows 用户原本就可以启动。

## 更新方式

通过应用内更新入口下载更新，完成后重启 Kun 安装。此更新沿用桌面应用的稳定更新通道，Kun Runtime 和终端命令随桌面应用一同更新。

---

## English

Kun 0.3.12 adds model-initiated context compression in Laboratory settings and fixes startup after upgrading on Windows.

- **Model-initiated context compression**: Laboratory gains a Context compression section. With model-initiated compression on, the model is prompted at 25%, 50%, and 75% of the context budget and can call `compact_context`, which uses Kun's existing summary compaction. Enabling windowed context as well switches that path to `new_context` and does not write a summary. Windowed context requires the parent switch and turns off with it. The change applies from the next turn. Routes that cannot run the required tools fail at admission.
- **Windows upgrade startup**: Extensions installed before 0.3.11 keep their original path casing, such as `C:\Users\...`, while 0.3.11 stores the data directory in lowercase. Startup treated those strings as different directories, so Kun exited during recovery and Retry failed the same way. A case-only difference for the same install directory is now rewritten to the current data directory. A path that names a different directory is still rejected. macOS and Linux are unchanged. Windows installs with no extension records already started.

Download the update from Kun and restart to install. The bundled runtime and terminal commands update with the desktop application.

[Full changelog](https://github.com/KunAgent/Kun/compare/v0.3.11...v0.3.12)
