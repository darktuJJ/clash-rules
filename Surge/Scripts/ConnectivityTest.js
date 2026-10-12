/*
网络延迟面板
原作者：@yibeizipeini，@小白脸 重写，TributePaulWalker 修改
本仓库修改：请求方式由 POST 改为 HEAD（只测延迟，不发送请求体）；请求失败时显示「失败」。

用法：
[Panel]
网络延迟 = script-name=网络延迟,update-interval=60

[Script]
网络延迟 = type=generic,timeout=30,script-path=https://raw.githubusercontent.com/darktuJJ/clash-surge-rules/main/Surge/Scripts/ConnectivityTest.js
*/

// 需要测试的站点
const targets = {
  Baidu: 'https://www.baidu.com',
  Google: 'https://www.google.com/generate_204',
  Github: 'https://www.github.com',
  Youtube: 'https://www.youtube.com/',
};

(async () => {
  const results = await Promise.all(Object.keys(targets).map(test));
  $done({
    title: '网络延迟',
    content: results.join('\n'),
    icon: 'bolt.horizontal.icloud',
    'icon-color': '#5AC8FA',
  });
})();

// 测一次请求耗时
function test(name) {
  return new Promise((resolve) => {
    const start = Date.now();
    $httpClient.head({ url: targets[name], timeout: 5 }, (err) => {
      const cost = err ? '失败' : Date.now() - start + ' ms';
      resolve(name + '\xa0\xa0\xa0\t: ' + cost);
    });
  });
}
