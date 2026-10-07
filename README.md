# Gogodown

Gogodown 是使用 HTML、CSS、JavaScript 与 Three.js 编写的网页游戏，可独立运行，也可通过 GameHub 门户游玩。

## 本地启动

在本目录打开终端：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

浏览器访问 **http://127.0.0.1:4173/**。按 Ctrl+C 停止。需要 Python 3 和支持 WebGL 的现代浏览器；源码独立运行需要访问原有 CDN，不建议双击 HTML。Node 工具统一版本为 **26.10.0**，游戏本身不需要 Node 后端或 npm 安装。

## 操作与成绩

A/D 或左右方向键移动，Space 跳跃；手机可使用页面触控按钮。躲避尖刺与顶部天花板，尽量抵达更深楼层。

排行榜主要指标：楼层优先，其次等级与用时。独立运行时，记录保存在当前浏览器的 localStorage，清除站点数据会清除本机记录。
