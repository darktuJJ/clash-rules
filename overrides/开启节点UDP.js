// ============================================================
// 【Clash Party 本地覆写·模板】为指定节点开启 UDP
// 原因：节点 udp:false 时，所有发往代理组的 UDP（如 WebRTC/STUN）会回落 DIRECT，暴露真实 IP。
// AnyTLS 等协议可以把 UDP 封装在 TCP 里传输（UDP over TCP），开启后 UDP 也走代理。
// 用法：把 <AI主力节点> 换成实际节点名；Clash Party → 覆写 → 新建 JS → 粘贴，
//       放在会生成 IN-PORT 规则的覆写之前。
// 验证：打开 https://browserleaks.com/webrtc ，应该只看到节点出口 IP。
// 如果服务端不支持 UDP，请停用本覆写，并保留 AI分流覆写.yaml 里的 STUN 拦截规则。
// ============================================================
function main(config) {
  const target = '<AI主力节点>'
  for (const p of config.proxies || []) {
    if (p.name === target) p.udp = true
  }
  return config
}
