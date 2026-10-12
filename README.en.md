[简体中文](README.md) · **English**

# clash-rules

A fixed-up ACL4SSR rule template for [mihomo](https://github.com/MetaCubeX/mihomo) (Clash Meta), plus a few optional [Clash Party](https://github.com/mihomo-party-org/clash-party) override templates: DNS / QUIC protection, AI routing groups, and a per-node UDP switch.

The template is based on `ACL4SSR_Online_Full_WithIcon.yaml` from [mihomo-party-org/override-hub](https://github.com/mihomo-party-org/override-hub). It **only fixes things that don't work, or have side effects, under mihomo**. Proxy groups and rule order are unchanged, so it is a drop-in replacement for the upstream URL.

## Contents

- [Features](#features)
- [File structure](#file-structure)
- [Quick start](#quick-start)
- [Optional overrides](#overrides)
- [Override order](#override-order)
- [Verification](#verification)
- [FAQ](#faq)
- [Syncing with upstream](#sync-upstream)
- [Credits](#credits)
- [License](#license)

<a id="features"></a>
## Features

### Fixes to the rule template

Every change is marked with a `【修改】` comment in the YAML.

| # | Location | Upstream | This repo | Why |
|---|----------|----------|-----------|-----|
| 1 | `rule-providers.ChinaCompanyIp.behavior` | `ipcidr` | `classical` | The list uses classical lines like `IP-CIDR,…,no-resolve`. Parsed as ipcidr, every line logs `invalid Ipcidr` and nothing loads; after the fix it loads normally (208 rules with mihomo v1.19.27) |
| 2 | `rule-providers.ChinaDomain.behavior` | `domain` | `classical` | The list mixes in IP ranges and other classical rules, which are ignored under domain behavior |
| 3 | `RULE-SET,ChinaCompanyIp` in `rules` | — | adds `no-resolve` | IP-only rule set; no need to resolve unmatched domains first |
| 4 | `GEOIP,CN` in `rules` | — | adds `no-resolve` | Domain requests fall straight through to `MATCH`, saving a DNS lookup and its delay |
| 5 | `ChinaMedia` / `ProxyMedia` / `Download` rule sets | original ACL4SSR lists | trimmed copies in [`ACL4SSR/`](ACL4SSR/) | Removes `URL-REGEX` rules (Surge / Quantumult X syntax) that mihomo doesn't support, avoiding load errors |

> **Side effect of fix 4:** Chinese domains not matched by `ChinaDomain` and similar rules used to be resolved and sent direct via GEOIP; now they go to the `漏网之鱼` (final) group. If you want Chinese sites to go direct as much as possible, remove that `no-resolve`.

### Optional Clash Party overrides

[`overrides/`](overrides/) contains local override templates for Clash Party. They **are not applied automatically** with the rule template; add them yourself if you want them:

- **DNS & QUIC protection:** fake-ip mode; foreign DNS goes over DoT through the proxy, while Chinese DNS uses doh.pub and AliDNS DoH as backups for each other. It also rejects UDP 443 (QUIC) so browsers fall back to TCP and follow your rules.
- **AI routing:** adds two groups, `AI专线` (manual select) and `Cursor链路` (automatic failover), so OpenAI, Anthropic, Gemini, xAI, Perplexity and other AI services share one exit. Also includes common direct rules and STUN blocking (prevents WebRTC from leaking your real IP).
- **Per-node UDP switch:** sets `udp: true` on a chosen node so UDP traffic doesn't fall back to direct.

<a id="file-structure"></a>
## File structure

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
## Quick start

Raw URL of the rule template:

```
https://raw.githubusercontent.com/darktuJJ/clash-rules/main/ACL4SSR_Online_Full_WithIcon.yaml
```

### Option 1: Sub-Store (recommended)

1. Open your collection subscription / file in Sub-Store.
2. Replace the upstream template URL:
   ```
   https://raw.githubusercontent.com/mihomo-party-org/override-hub/main/yaml/ACL4SSR_Online_Full_WithIcon.yaml
   ```
   with this repository's URL above.
3. Save, then update that subscription once in Clash Party.

### Option 2: Reference it directly in Clash Party

Clash Party → Overrides → new **Remote YAML** → paste the raw URL above → attach it to the subscription you want.

### Other mihomo clients

Any client that runs the mihomo core and can load a remote config template will work; use this file in place of the ACL4SSR template.

<a id="overrides"></a>
## Optional overrides

How to use: Clash Party → Overrides → new YAML or JS → paste the file contents → attach it to a subscription.

| File | Purpose | Suggested scope |
|------|---------|-----------------|
| [`DNS与QUIC防护.yaml`](overrides/DNS与QUIC防护.yaml) | Replaces the whole DNS section with `dns!` and prepends `UDP 443 → REJECT` | Any subscription (relies on the `漏网之鱼` group from the ACL4SSR template) |
| [`AI分流覆写.yaml`](overrides/AI分流覆写.yaml) | AI routing groups, direct / AI / other proxy rules, STUN blocking | Only subscriptions that use this template; don't make it global |
| [`开启节点UDP.js`](overrides/开启节点UDP.js) | Enables UDP on a chosen node | Same as above |

### Placeholders

Names in angle brackets are placeholders. **Replace them with node or group names that actually exist in your subscription** (exact match), or the config will fail to load:

| Placeholder | Meaning |
|-------------|---------|
| `<AI主力节点>` | The node AI services should always use; pick a stable one whose IP doesn't change often |
| `<Polymarket节点A>` / `<Polymarket节点B>` | Example of giving a site and one of its subdomains different exits; delete these rules if you don't need them |

Also:

- `美国节点`, `日本节点`, `狮城节点`, `台湾节点`, `手动切换` and `节点选择` in the templates are groups that come with the ACL4SSR template; leave them as they are.
- The direct section has a commented-out `example.com` line; change it to your own LAN service or NAS domain.
- The direct, AI and proxy rules are common defaults; add or remove entries as needed.

<a id="override-order"></a>
## Override order

Clash Party's `+rules` **prepends**: the later an override is applied, the earlier its rules appear. Recommended order on a subscription:

```
[port listener overrides] → AI分流覆写.yaml → [overrides that generate IN-PORT rules] → DNS与QUIC防护.yaml (last)
```

Put `开启节点UDP.js` anywhere before the overrides that generate IN-PORT rules. With this order:

- `UDP 443 → REJECT` is always the first rule;
- IN-PORT routing for each listener takes priority over your own rules;
- rule order inside each file is preserved. For example, Gemini's `*.googleapis.com` subdomains come before `googleapis.com → 节点选择`, so they always use the AI group.

<a id="verification"></a>
## Verification

- **Rule sets:** in Clash Party → Rule Providers, `ChinaCompanyIp` and `ChinaDomain` show more than 0 rules.
- **Rules:** the rule list ends with `GEOIP,CN,全球直连,no-resolve` and `MATCH,漏网之鱼`; with the DNS override attached, the first rule is `AND,((NETWORK,UDP),(DST-PORT,443)),REJECT`.
- **Config check:** `mihomo -t -f ACL4SSR_Online_Full_WithIcon.yaml` passes with no `invalid Ipcidr`-style warnings.
- **WebRTC:** <https://browserleaks.com/webrtc> should show only your node's exit IP.
- **DNS:** use a page such as <https://browserleaks.com/dns> to confirm foreign DNS queries go through the proxy.

<a id="faq"></a>
## FAQ

**The config fails to load after adding an override?**
Usually a placeholder wasn't replaced, or a node name doesn't exactly match your subscription. Another common cause is making a template-specific override global, so other subscriptions lack those groups.

**Chinese sites are going through the proxy?**
That's the side effect of fix 4. Remove `no-resolve` from the `GEOIP,CN` rule, or add the domains you use to the direct rules.

**UDP doesn't work for some sites or games?**
The DNS override rejects UDP 443 (QUIC); browsers usually fall back to TCP. If an app really needs QUIC, remove that rule or add an allow rule for the app before it.

**WebRTC still leaks my real IP?**
Make sure the node supports UDP and that `开启节点UDP.js` enables it; if the node doesn't support UDP, keep the STUN blocking rules.

**How does this differ from upstream?**
Only the fixes listed in the [Features](#features) table; everything else matches upstream.

<a id="sync-upstream"></a>
## Syncing with upstream

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

If upstream fixes one of these issues itself, drop the matching fix when syncing and update the table above.

<a id="credits"></a>
## Credits

- [ACL4SSR/ACL4SSR](https://github.com/ACL4SSR/ACL4SSR): rule lists
- [mihomo-party-org/override-hub](https://github.com/mihomo-party-org/override-hub): the `ACL4SSR_Online_Full_WithIcon.yaml` template
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo): the core
- [mihomo-party-org/clash-party](https://github.com/mihomo-party-org/clash-party): the client
- [Koolson/Qure](https://github.com/Koolson/Qure) and others: group icons

<a id="license"></a>
## License

This repository's own content is licensed under the [MIT License](LICENSE). Upstream rule lists and templates belong to their respective authors and remain under their own terms.
