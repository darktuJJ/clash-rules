**简体中文** · [English](README.en.md)

# clash-rules

一份面向 [mihomo](https://github.com/MetaCubeX/mihomo)（Clash Meta）的 ACL4SSR 规则模板修正版，并附带几份可选的 [Clash Party](https://github.com/mihomo-party-org/clash-party) 覆写模板：DNS / QUIC 防护、AI 分流策略组、节点 UDP 开关。

规则模板基于 [mihomo-party-org/override-hub](https://github.com/mihomo-party-org/override-hub) 的 `ACL4SSR_Online_Full_WithIcon.yaml`。它**只修正上游在 mihomo 下不生效或有副作用的地方**，策略组和规则顺序都和上游一致，可以直接替换上游地址使用。

## 目录

- [功能](#features)
- [文件结构](#file-structure)
- [快速开始](#quick-start)
- [可选覆写](#overrides)
- [覆写顺序](#override-order)
- [验证](#verification)
- [常见问题](#faq)
- [同步上游](#sync-upstream)
- [致谢](#credits)
- [许可证](#license)

<a id="features"></a>
## 功能

### 规则模板修正

修改的地方在 YAML 里都有 `【修改】` 注释。

| # | 位置 | 上游 | 本仓库 | 原因 |
|---|------|------|--------|------|
| 1 | `rule-providers.ChinaCompanyIp.behavior` | `ipcidr` | `classical` | 列表是 `IP-CIDR,…,no-resolve` 这种 classical 写法。按 ipcidr 解析时每行都报 `invalid Ipcidr`，最后一条也加载不上；改完后能正常加载（mihomo v1.19.27 实测 208 条） |
| 2 | `rule-providers.ChinaDomain.behavior` | `domain` | `classical` | 列表里混有 IP 段等 classical 规则，按 domain 解析时这些规则不生效 |
| 3 | `rules` 中的 `RULE-SET,ChinaCompanyIp` | — | 追加 `no-resolve` | 纯 IP 规则集，没必要为未命中的域名先做 DNS 解析 |
| 4 | `rules` 中的 `GEOIP,CN` | — | 追加 `no-resolve` | 域名请求到这里直接交给 `MATCH`，少一次 DNS 解析和等待 |
| 5 | `ChinaMedia` / `ProxyMedia` / `Download` 规则集 | ACL4SSR 原始列表 | 本仓库 [`ACL4SSR/`](ACL4SSR/) 下的精简版 | 去掉了 mihomo 不支持的 `URL-REGEX` 规则（来自 Surge / Quantumult X 写法），避免加载时报错 |

> **第 4 条的副作用**：没被前面 `ChinaDomain` 等规则命中的国内域名，原来会先解析成 IP 再按 GEOIP 直连，现在会直接走「漏网之鱼」。如果你希望国内站点尽量直连，可以去掉这里的 `no-resolve`。

### 可选的 Clash Party 覆写

[`overrides/`](overrides/) 下是 Clash Party 本地覆写模板。它们**不会随规则模板自动生效**，需要按需手动添加：

- **DNS 与 QUIC 防护**：用 fake-ip 模式，境外 DNS 通过代理走 DoT，国内 DNS 用 doh.pub 和阿里 DoH 互为备份；拒绝 UDP 443（QUIC），让浏览器回落到 TCP，便于按规则分流。
- **AI 分流**：新增「AI专线」（手动选择）和「Cursor链路」（故障自动切换）两个策略组，把 OpenAI、Anthropic、Gemini、xAI、Perplexity 等 AI 服务统一走同一个出口；附带常用直连规则和 STUN 拦截（防 WebRTC 泄漏真实 IP）。
- **节点 UDP 开关**：给指定节点打开 `udp: true`，避免 UDP 流量回落直连。

<a id="file-structure"></a>
## 文件结构

```
.
├── ACL4SSR_Online_Full_WithIcon.yaml   # 修正后的规则模板（主文件）
├── ACL4SSR/                            # 去掉 URL-REGEX 后的规则列表
│   ├── ChinaMedia.list
│   ├── ProxyMedia.list
│   └── Download.list
└── overrides/                          # 可选的 Clash Party 本地覆写模板
    ├── DNS与QUIC防护.yaml
    ├── AI分流覆写.yaml               # AI 分流策略组 + 直连 / 代理规则
    └── 开启节点UDP.js
```

<a id="quick-start"></a>
## 快速开始

规则模板的 raw 地址：

```
https://raw.githubusercontent.com/darktuJJ/clash-rules/main/ACL4SSR_Online_Full_WithIcon.yaml
```

### 方式一：Sub-Store（推荐）

1. 在 Sub-Store 中打开你的「组合订阅 / 文件」。
2. 把规则模板地址从上游：
   ```
   https://raw.githubusercontent.com/mihomo-party-org/override-hub/main/yaml/ACL4SSR_Online_Full_WithIcon.yaml
   ```
   换成上面本仓库的地址。
3. 保存，然后在 Clash Party 中更新一次对应订阅。

### 方式二：Clash Party 直接引用

Clash Party →「覆写」→ 新建「远程 YAML」→ 填入上面的 raw 地址 → 挂到要使用的订阅上。

### 其他 mihomo 客户端

任何支持 mihomo 内核、能引用远程配置模板的客户端都可以使用；把它当作 ACL4SSR 模板的替代品即可。

<a id="overrides"></a>
## 可选覆写

使用方法：Clash Party →「覆写」→ 新建 YAML 或 JS → 粘贴文件内容 → 挂到对应订阅上。

| 文件 | 作用 | 建议作用范围 |
|------|------|--------------|
| [`DNS与QUIC防护.yaml`](overrides/DNS与QUIC防护.yaml) | 用 `dns!` 整段替换 DNS 配置，并前插 `UDP 443 → REJECT` | 任何订阅都可以挂（依赖 ACL4SSR 模板自带的「漏网之鱼」策略组） |
| [`AI分流覆写.yaml`](overrides/AI分流覆写.yaml) | AI 分流策略组、直连 / AI / 其他代理规则、STUN 拦截 | 只挂在使用本规则模板的订阅上，不要设为全局 |
| [`开启节点UDP.js`](overrides/开启节点UDP.js) | 为指定节点开启 UDP | 同上 |

### 占位符

模板里尖括号包起来的名称是占位符，**必须换成你订阅中真实存在的节点名或策略组名**（名称要完全一致），否则配置会加载失败：

| 占位符 | 含义 |
|--------|------|
| `<AI主力节点>` | AI 服务固定使用的节点，建议选一个稳定、IP 不常变的节点 |
| `<Polymarket节点A>` / `<Polymarket节点B>` | 示例：为特定网站及其子域名指定不同出口；不需要的话可以直接删掉这几条规则 |

另外：

- 模板里的 `美国节点`、`日本节点`、`狮城节点`、`台湾节点`、`手动切换`、`节点选择` 都是 ACL4SSR 模板自带的策略组，不需要替换。
- 直连部分有一条注释掉的 `example.com` 示例，可以改成你自己的内网服务或 NAS 域名。
- 直连、AI 和代理规则是一份常用默认值，可以按需增删。

<a id="override-order"></a>
## 覆写顺序

Clash Party 的 `+rules` 是**前插**的：越晚应用的覆写，它的规则排得越靠前。同一订阅上推荐的顺序是：

```
[监听端口类覆写] → AI分流覆写.yaml → [会生成 IN-PORT 规则的覆写] → DNS与QUIC防护.yaml（最后）
```

`开启节点UDP.js` 放在会生成 IN-PORT 规则的覆写之前即可。这样排的效果：

- `UDP 443 → REJECT` 一定是第一条规则；
- 各监听端口的 IN-PORT 分流优先于个人规则；
- 每个文件内部的规则顺序原样保留。例如 Gemini 相关的 `*.googleapis.com` 子域名写在 `googleapis.com → 节点选择` 之前，所以一定走 AI 策略组。

<a id="verification"></a>
## 验证

- **规则集**：Clash Party →「规则集」中 `ChinaCompanyIp`、`ChinaDomain` 的规则数大于 0。
- **规则**：「规则」列表末尾是 `GEOIP,CN,全球直连,no-resolve` 和 `MATCH,漏网之鱼`；挂了 DNS 覆写的话，第一条应该是 `AND,((NETWORK,UDP),(DST-PORT,443)),REJECT`。
- **配置校验**：`mihomo -t -f ACL4SSR_Online_Full_WithIcon.yaml` 应该通过，并且没有 `invalid Ipcidr` 一类的警告。
- **WebRTC**：打开 <https://browserleaks.com/webrtc>，只应看到节点的出口 IP。
- **DNS**：用 <https://browserleaks.com/dns> 等页面确认境外 DNS 查询经过代理。

<a id="faq"></a>
## 常见问题

**加了覆写后配置加载失败？**
多半是占位符没有替换，或者节点名和订阅里的不完全一致。另一个常见原因是把只适用于本模板的覆写设成了全局，其他订阅里没有这些策略组。

**国内网站反而走了代理？**
这是修正第 4 条的副作用。去掉 `GEOIP,CN` 规则里的 `no-resolve`，或者把常用国内域名加进直连规则。

**某些网站或游戏的 UDP 不通？**
DNS 覆写会拒绝 UDP 443（QUIC），浏览器通常会自动回落到 TCP。如果某个应用必须使用 QUIC，删掉这条规则，或在它之前加一条针对该应用的放行规则。

**WebRTC 仍然泄漏真实 IP？**
确认节点支持 UDP，并已用 `开启节点UDP.js` 打开；如果节点不支持 UDP，保留 STUN 拦截规则。

**和上游的规则有什么不同？**
只有[功能](#features)一节表格里列出的几处修正，其余和上游一致。

<a id="sync-upstream"></a>
## 同步上游

```bash
# 1. 拉取上游最新版
curl -fsSL -o /tmp/upstream.yaml \
  https://raw.githubusercontent.com/mihomo-party-org/override-hub/main/yaml/ACL4SSR_Online_Full_WithIcon.yaml

# 2. 对比（忽略注释行）
diff <(grep -v '^\s*#' /tmp/upstream.yaml) <(grep -v '^\s*#' ACL4SSR_Online_Full_WithIcon.yaml)

# 3. 用上游覆盖本仓库文件，重新做「规则模板修正」中的改动，并更新文件头部的同步日期

# 4. 校验
mihomo -t -f ACL4SSR_Online_Full_WithIcon.yaml
```

如果上游已经自己修好了某一处，同步时把对应的修正去掉，并更新上面的表格。

<a id="credits"></a>
## 致谢

- [ACL4SSR/ACL4SSR](https://github.com/ACL4SSR/ACL4SSR)：规则列表
- [mihomo-party-org/override-hub](https://github.com/mihomo-party-org/override-hub)：`ACL4SSR_Online_Full_WithIcon.yaml` 模板
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo)：内核
- [mihomo-party-org/clash-party](https://github.com/mihomo-party-org/clash-party)：客户端
- [Koolson/Qure](https://github.com/Koolson/Qure) 等：策略组图标

<a id="license"></a>
## 许可证

本仓库自己的内容采用 [MIT 许可证](LICENSE)。上游的规则列表和模板归各自作者所有，适用其各自的许可条款。
