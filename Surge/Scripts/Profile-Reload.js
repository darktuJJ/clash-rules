/*
配置重载面板
原作者：Pysta（https://github.com/mieqq/mieqq），TributePaulWalker 修改

用法：
[Panel]
配置重载 = title=配置重载,content=配置重载,style=info,script-name=配置重载,update-interval=-1

[Script]
配置重载 = type=generic,script-path=https://raw.githubusercontent.com/darktuJJ/clash-surge-rules/main/Surge/Scripts/Profile-Reload.js
*/

// 通过 Surge 本地 HTTP API 重新加载当前配置
$httpAPI('POST', '/v1/profiles/reload', {}, () => {
  $notification.post('配置重载', '配置重载成功', '');
  $done({
    title: '配置重载',
    content: '配置重载成功',
    icon: 'terminal',
    'icon-color': '#5AC8FA',
  });
});
