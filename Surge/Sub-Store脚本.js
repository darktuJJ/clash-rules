/*
Sub-Store 文件脚本：把组合订阅的节点填进 Surge 模板，并加上托管配置首行

用法：
1. 在 Sub-Store「文件」里新建 surge.conf，来源为远程：
   https://raw.githubusercontent.com/darktuJJ/clash-surge-rules/main/Surge/Surge.conf
2. 在该文件的「脚本操作」里粘贴本脚本；
3. 把下面的 MANAGED_URL 改成这个文件自己的 Sub-Store 下载链接（只在 Sub-Store 里改，不要提交到仓库）。

参考：https://github.com/sub-store-org/Sub-Store/blob/master/scripts/demo.js
*/

// ↓↓↓ 在 Sub-Store 里填写，仓库中保持占位文本 ↓↓↓
const MANAGED_URL = '这里填你的 Sub-Store 文件链接';
// 组合订阅名称
const COLLECTION_NAME = '组合订阅';
// 托管配置更新间隔（秒），43200 = 12 小时
const INTERVAL = 43200;

// 文件内容：优先使用上一步操作的结果，否则用原始文件
let conf = $content ?? $files[0];

// 输出组合订阅的 Surge 格式节点（每行一个）
const proxies = await produceArtifact({
  type: 'collection',
  name: COLLECTION_NAME,
  platform: 'Surge',
});

if (!/^#\{proxies\}[ \t]*$/m.test(conf)) {
  throw new Error('模板中找不到 #{proxies} 占位符');
}
if (!proxies || !proxies.trim()) {
  throw new Error('没有取到「' + COLLECTION_NAME + '」的节点，请检查组合订阅名称');
}
conf = conf.replace(/^#\{proxies\}[ \t]*$/m, () => proxies.trim());

// 去掉模板里可能残留的 MANAGED-CONFIG 行，再在首行加上
conf = conf.replace(/^#!MANAGED-CONFIG.*\r?\n/m, '');
if (MANAGED_URL.startsWith('http')) {
  conf = `#!MANAGED-CONFIG ${MANAGED_URL} interval=${INTERVAL} strict=false\n` + conf;
} else {
  console.log('[Surge] WARN: 未填写 MANAGED_URL，本次不添加托管配置首行');
}

$content = conf;
