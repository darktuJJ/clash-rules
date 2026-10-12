# clash-surge-rules

这是我自己维护的 mihomo（Clash Meta）规则配置，基于 mihomo-party-org/override-hub 的
`ACL4SSR_Online_Full_WithIcon.yaml`。**只修正上游文件本身的问题**，其余保持和上游一致。

## 用途

- 在 Sub-Store 里作为「组合订阅」的规则模板，替换原来的上游地址。
- 修正上游在 mihomo 下实际不生效、或者会多做一次 DNS 解析的规则。
- 个人定制（AI 分流、专用策略组等）**不放进规则文件**，而是放在 Clash Party 本地覆写里。
  已脱敏的参考模板见 [`overrides/`](overrides/)。

## 上游来源

- 上游文件：<https://raw.githubusercontent.com/mihomo-party-org/override-hub/main/yaml/ACL4SSR_Online_Full_WithIcon.yaml>
- 上游仓库：<https://github.com/mihomo-party-org/override-hub>
- 本仓库首次同步日期：2026-10-12

## 修改清单

改动处在文件里都用 `【修改】` 注释标出。

| # | 位置 | 上游原样 | 修改后 | 原因 |
|---|------|----------|--------|------|
| 1 | `rule-providers.ChinaCompanyIp.behavior` | `ipcidr` | `classical` | 列表每一行都是 `IP-CIDR,x.x.x.x/x,no-resolve` 这种 classical 写法。按 ipcidr 解析时，mihomo 每行报一次 `invalid Ipcidr`，最后一条都加载不上。改成 classical 后，mihomo v1.19.27 实测加载 **208 条** |
| 2 | `rules` | `RULE-SET,ChinaCompanyIp,全球直连` | 末尾加 `,no-resolve` | 纯 IP 规则集，没必要为没命中的域名先做一次 DNS 解析 |
| 3 | `rules` | `GEOIP,CN,全球直连` | 末尾加 `,no-resolve` | 同上：域名请求走到这里直接交给 `MATCH,漏网之鱼`，不再多一次 DNS 解析和等待 |

> 第 3 条的副作用：没被前面 `ChinaDomain` 等规则命中的国内域名，以前会先解析成 IP，再按 GEOIP 判断要不要直连；
> 现在会直接走「漏网之鱼」。如果你希望国内站点尽量直连，可以把第 3 条改回去。

**验证方法**：用 mihomo v1.19.27 分别加载修改前、修改后两个版本。
- 修改前：`ChinaCompanyIp` 规则数为 0，日志里有 208 条 `invalid Ipcidr`。
- 修改后：规则数为 208，没有任何警告，`mihomo -t` 校验通过。

## 使用方法

### 在 Sub-Store 中使用（推荐）

1. 打开 Sub-Store，找到正在用的「组合订阅 / 文件」。
2. 找到原来填写上游规则模板的那一项，它的值是：
   ```
   https://raw.githubusercontent.com/mihomo-party-org/override-hub/main/yaml/ACL4SSR_Online_Full_WithIcon.yaml
   ```
3. 改成本仓库的地址：
   ```
   https://raw.githubusercontent.com/darktuJJ/clash-surge-rules/main/ACL4SSR_Online_Full_WithIcon.yaml
   ```
4. 保存后，在 Clash Party 里手动更新一次对应的订阅。
5. 检查是否生效：
   - Clash Party →「规则集」里 `ChinaCompanyIp` 的规则数大于 0；
   - 「规则」列表末尾显示 `GEOIP,CN,全球直连,no-resolve`。

### 在 Clash Party 中直接使用（备选）

如果不经过 Sub-Store：Clash Party →「覆写」→ 新建「远程 YAML」→ 填上面的 raw 地址，然后挂到对应订阅上。

## 本地覆写参考模板（overrides/）

**这些是 Clash Party 本地覆写的模板，已经脱敏，不会随规则文件自动生效。**
使用前需要先把占位符（`<AI主力节点>` 等）换成你订阅里真实的节点名，再粘贴进 Clash Party 的「覆写」。

| 文件 | 说明 | 作用范围 | 在订阅覆写列表中的位置 |
|------|------|----------|------------------------|
| `个人合并覆写.yaml` | 新增「AI专线」「Cursor链路」两个策略组；合并了直连、DeepSeek 直连、AI、Cursor、其他代理规则；拦截 STUN | 不勾选全局，只挂在用 ACL4SSR 模板的订阅上 | 监听端口类覆写之后、会生成 IN-PORT 规则的覆写之前 |
| `DNS与QUIC防护.yaml` | `dns!` 整段替换：fake-ip，境外 DNS 经「漏网之鱼」走 DoT，国内用 doh.pub + 阿里 DoH（互为备份，含 direct-nameserver）；拒绝 UDP 443（QUIC） | 每个订阅都可以挂 | 最后 |
| `开启节点UDP.js` | 给指定节点打开 `udp: true`，避免 UDP 回落直连 | 同「个人合并覆写」 | 会生成 IN-PORT 规则的覆写之前 |

### 为什么顺序重要

Clash Party 的 `+rules` 是**前插**：越晚应用的覆写，它的规则排得越靠前。所以：

- 「DNS与QUIC防护」放在最后，`UDP 443 → REJECT` 才会是第一条规则；
- 会生成 IN-PORT 规则的覆写放在「个人合并覆写」之后，各监听端口的分流才会优先于个人规则；
- 「个人合并覆写」里 Gemini 相关的 `*.googleapis.com` 子域名写在 `googleapis.com → 节点选择` 之前，
  而且整个文件内部的顺序会原样保留，所以 Gemini API 一定走 AI专线。

### 合并说明（和旧的分散覆写相比）

- 原来的 DeepSeek 直连脚本做了三件事：把 DeepSeek 规则插到最前、从 TUN 排除列表里删掉 python.exe、往 fake-ip-filter 里加域名。
  - 第一件：改成 YAML 前插规则，效果相同；
  - 第二件：当前 TUN 排除列表里本来就没有 python.exe，属于空操作，已删掉；
  - 第三件：会被「DNS与QUIC防护」里的 `dns!` 整段覆盖，从来没有真正生效过，已删掉。
- 去掉了重复规则（例如重复写了两次的 aliyun.com，以及已经被 `DOMAIN-SUFFIX` 覆盖的单个子域名）。
- Polymarket：更具体的 `data-api.polymarket.com` 原来排在 `polymarket.com` 后面，永远匹配不到，现在挪到了前面。
- 原「AI规则」里直接指定的节点，统一改成「AI专线」策略组。

## 以后同步上游

```bash
# 1. 拉取上游最新版
curl -fsSL -o /tmp/upstream.yaml \
  https://raw.githubusercontent.com/mihomo-party-org/override-hub/main/yaml/ACL4SSR_Online_Full_WithIcon.yaml

# 2. 对比上游和本仓库（忽略所有注释行）
diff <(grep -v '^\s*#' /tmp/upstream.yaml) <(grep -v '^\s*#' ACL4SSR_Online_Full_WithIcon.yaml)

# 3. 用上游覆盖本仓库文件，重新做「修改清单」里的 3 处改动，并更新文件头部的「同步日期」

# 4. 可选：用 mihomo 校验
mihomo -t -f ACL4SSR_Online_Full_WithIcon.yaml

# 5. 提交并推送
git commit -am "同步上游 ACL4SSR_Online_Full_WithIcon.yaml（YYYY-MM-DD）并重新应用修正"
git push
```

如果上游以后自己修好了某一处（比如 `ChinaCompanyIp` 改成了 classical），同步时就把对应的改动去掉，并更新修改清单。

## Surge 托管配置（Surge/）

`Surge/` 目录是给 Surge（iOS / macOS 通用）用的托管配置模板，同样经 Sub-Store 生成。
**模板里没有任何私人信息**：节点由 Sub-Store 填进 `#{proxies}` 占位符，托管链接只写在 Sub-Store 里。

| 文件 | 说明 |
|------|------|
| `Surge/Surge.conf` | 配置模板：策略组、规则集与顺序对齐 Clash 模板 `ACL4SSR_Online_Full_WithIcon.yaml`（规则集用 raw.githubusercontent 地址），并移植了个人覆写里的通用部分（「AI专线」「Cursor链路」、STUN 拦截、AI / Cursor 域名） |
| `Surge/Sub-Store脚本.js` | Sub-Store 文件脚本：填入组合订阅节点，并加上 `#!MANAGED-CONFIG` 首行 |
| `Surge/Scripts/` | 面板/脚本：网络延迟、配置重载、机场信息（已审阅并汉化） |
| `Surge/本地模块示例.sgmodule` | 本地模块示例：私人域名、内网网段等放这里 |

### 1. 在 Sub-Store 里新建文件

1. Sub-Store →「文件」→ 新建：
   - 名称：`surge.conf`
   - 类型：文件
   - 来源：远程，地址填
     ```
     https://raw.githubusercontent.com/darktuJJ/clash-surge-rules/main/Surge/Surge.conf
     ```
   - 合并来源：不合并
2. 「脚本操作」里粘贴 `Surge/Sub-Store脚本.js` 的全部内容。
3. 保存后复制这个文件的下载链接，回到脚本，把 `MANAGED_URL` 的占位文本 `这里填你的 Sub-Store 文件链接` 换成它，再保存。
   如果组合订阅不叫「组合订阅」，同时改 `COLLECTION_NAME`。
4. 预览一下，确认首行是 `#!MANAGED-CONFIG ...`，`[Proxy]` 下面是节点。

### 2. 在 iPhone / Mac 上订阅

Surge →「配置」→「从 URL 下载配置」，填上一步的 Sub-Store 文件链接。之后每 12 小时自动更新（`interval=43200`），
也可以在配置列表里手动更新。iPhone 和 Mac 用同一个链接即可。

### 3. MITM 证书只在本地生成

模板只开了 `duckduckgo.com`（Safari 搜索快捷指令）和 `sub.store` 的解密。每台设备各自在 Surge →「HTTPS 解密」→
「生成新的 CA 证书」并安装信任。托管配置是只读的，Surge 会把证书存进本地（模块或本地配置），
**证书和 `ca-passphrase` / `ca-p12` 绝对不要提交到仓库**。HTTP-API 密码同理，只在本地设置。

### 4. 本地模块放私人规则

把 `Surge/本地模块示例.sgmodule` 的内容复制到 Surge →「模块」→「新建本地模块」，把 `你的DDNS域名`、`你的内网网段`
换成自己的内容并启用。模块里的规则会排在配置规则前面。

> 注意：Surge 模块**不能**新增或修改策略组，模块里的规则也**只能用 DIRECT / REJECT**。
> 因此「指定某个节点」的私人规则、机场流量信息（`http://sub.info?url=...`）策略组都放不进模块，
> 需要在设备本地另建配置（例如用 `#!include` 引用托管配置的 `[Proxy]`，自己写 `[Proxy Group]` / `[Rule]`）。

### 5. 策略组对照

策略组名称与 Clash 模板一致（节点选择、手动切换、自动选择、电报消息、OpenAi、AI-UNHK、油管视频、奈飞视频……漏网之鱼，
以及 香港/日本/美国/台湾/狮城/韩国/奈飞节点）。Surge 额外有「谷歌云」智能组（自建 GCP 节点）和个人覆写移植的「AI专线」「Cursor链路」。
Clash 的 `GLOBAL` 组在 Surge 里没有对应，已省略。
