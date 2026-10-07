# GoGoDown 项目架构

游戏由静态 HTML、CSS 和 JavaScript 文件组成，通过本地 HTTP 服务或 GameHub 运行，无需构建工具。

```text
Gogodown/
├─ index.html              页面结构、HUD、开始/结束弹窗、脚本加载顺序
├─ styles/
│  └─ game.css             覆盖 UI、HUD、排行榜和移动端触控样式
├─ js/
│  ├─ config.js            游戏平衡参数、速度、血量、平台概率、排行榜 key
│  ├─ audio.js             BGM、短音效预载、循环和播放控制
│  ├─ utils.js             随机数、插值、钳制、AABB 和权重选择
│  ├─ leaderboard.js       localStorage 排行榜读写与排序
│  ├─ gamehub.js           门户对局、公开榜单与返回首页接入
│  ├─ gamehub.js           门户对局、公开榜单与返回首页接入
│  └─ game.js              Three.js 场景、角色物理、平台生成、碰撞和主循环
└─ assets/
   └─ sounds/              BGM 和短音效资源
```

## 调参入口

- 速度和等级：`js/config.js` 的 `platform.baseScrollSpeed`、`levelFloorInterval`、`levelSpeedFactor`
- 楼层计分：`floorDistance`、`depthDriftFactor`、`fallDepthBonus`
- 角色手感：`player.moveSpeed`、`player.gravity`、`player.maxFallSpeed`
- 平台生成：`platform.widthFractions`、`platform.minGapY`、`platform.maxGapY`、`platform.maxStepX`
- 平台类型概率：`typeWeightsByLevel`
- 伤害规则：`health.max`、`invincibleDuration`、`ceilingDamageInterval`

## 后续扩展

- 加音效时先在 `config.js` 增加资源路径，再由 `audio.js` 统一播放。
- 新增平台类型时先扩展 `typeWeightsByLevel` 和 `createPlatform()` 的视觉装饰，再补碰撞效果。
- 如果要做多难度模式，优先在 `config.js` 中建立配置分支，避免复制 `game.js`。
