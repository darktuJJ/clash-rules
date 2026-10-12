/*
机场流量信息（精简版）
原作者：mieqq（https://github.com/mieqq/mieqq/blob/master/sub_info.js），TributePaulWalker 修改
本仓库修改：注释汉化；响应头格式异常时不再报错退出。

用法（订阅链接属于私人信息，请写在本地模块里，不要提交到仓库）：
[Proxy Group]
机场信息 = select, policy-path=http://sub.info?url=URL编码后的订阅链接&reset_day=1&alert=1&title=机场, update-interval=3600

[Script]
机场信息 = type=http-request,timeout=10,pattern=^http:\/\/sub\.info,script-path=https://raw.githubusercontent.com/darktuJJ/clash-surge-rules/main/Surge/Scripts/Sub_info_lite.js

参数说明：
- url：带流量信息（subscription-userinfo 响应头）的订阅链接，必须先 URL 编码后再填写；
- reset_day（或 due_day）：可选，每月流量重置日，例如 8 号就写 8，不填则不显示重置信息；
- expire：可选，订阅不带到期信息时手动指定，格式必须为 yyyy-MM-dd，例如 2026-02-01；
- alert：可选，开启后在流量用量超过 80%、重置前 2 天、流量已重置、套餐快到期时发送通知；
- title：可选，通知标题。有多个机场且需要通知时必须分别设置，否则通知计数会互相干扰。
*/

let now = new Date();
let today = now.getDate();
let month = now.getMonth();
let year = now.getFullYear();
let args = getArgs($request.url);
let resetDay = parseInt(args['due_day'] || args['reset_day']);
let resetDayLeft = getRemainingDays(resetDay);

(async () => {
  // 增强模式下稍等片刻，避免网络尚未就绪
  let isEnhanced = await isEnhancedMode();
  if (isEnhanced) await sleep(2000);
  let usage = await getDataInfo(args.url);
  if (!usage) {
    $done({});
    return;
  }
  let used = (usage.download || 0) + (usage.upload || 0);
  let total = usage.total;
  let expire = usage.expire || args.expire;
  // 每行信息伪装成一个本地 HTTP 节点，让 Surge 策略组里显示出来
  let localProxy = ['=http, localhost, 6152', '=http, 127.0.0.1, 6152', '=socks5,127.0.0.1, 6153'];
  let infoList = [`使用：${bytesToSize(used)} | ${bytesToSize(total)}`];

  if (resetDayLeft) {
    infoList.push(`重置：剩余${resetDayLeft}天`);
  }
  if (expire) {
    if (/^[\d.]+$/.test(expire)) expire *= 1000;
    infoList.push(`到期：${formatTime(expire)}`);
  }
  sendNotification(used / total, expire, infoList);
  let body = infoList.map((item, index) => item + localProxy[index]).join('\n');
  $done({ response: { body } });
})();

// 解析 sub.info 链接上的参数
function getArgs(url) {
  return Object.fromEntries(
    url
      .slice(url.indexOf('?') + 1)
      .split('&')
      .map((item) => item.split('='))
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
}

// 用 HEAD 请求读取订阅响应头里的 subscription-userinfo
function getUserInfo(url) {
  let request = { headers: { 'User-Agent': 'Quantumult%20X' }, url };
  return new Promise((resolve, reject) =>
    $httpClient.head(request, (err, resp) => {
      if (err != null) {
        reject(err);
        return;
      }
      if (resp.status !== 200) {
        reject('订阅链接不可用');
        return;
      }
      let header = Object.keys(resp.headers).find((key) => key.toLowerCase() === 'subscription-userinfo');
      if (header) {
        resolve(resp.headers[header]);
        return;
      }
      reject('订阅响应头不带流量信息');
    })
  );
}

async function getDataInfo(url) {
  const [err, data] = await getUserInfo(url)
    .then((data) => [null, data])
    .catch((err) => [err, null]);
  if (err) {
    console.log(err);
    return;
  }
  const pairs = String(data).match(/\w+=\d+/g);
  if (!pairs) {
    console.log('流量信息格式无法识别');
    return;
  }
  return Object.fromEntries(pairs.map((item) => item.split('=')).map(([k, v]) => [k, parseInt(v)]));
}

// 计算距离下次重置还有几天
function getRemainingDays(resetDay) {
  if (!resetDay) return 0;
  let daysInMonth = new Date(year, month + 1, 0).getDate();
  if (resetDay > today) daysInMonth = 0;
  return daysInMonth - today + resetDay;
}

function bytesToSize(bytes) {
  if (!bytes) return '0B';
  let k = 1024;
  let sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

function formatTime(time) {
  let dateObj = new Date(time);
  return dateObj.getFullYear() + '年' + (dateObj.getMonth() + 1) + '月' + dateObj.getDate() + '日';
}

function sendNotification(usageRate, expire, infoList) {
  if (!args.alert) return;
  let title = args.title || 'Sub Info';
  let subtitle = infoList[0];
  let body = infoList.slice(1).join('\n');
  usageRate = usageRate * 100;

  if (resetDay <= today) month += 1;
  let resetTime = new Date(year, month, resetDay);
  // 通知计数器（存在本地 $persistentStore），每月重置日清零
  let notifyCounter = JSON.parse($persistentStore.read(title) || '{}');
  if (!notifyCounter[resetTime]) {
    notifyCounter = {
      [resetTime]: { usageRate: 80, resetDayLeft: 3, expire: 31, resetDay: 1 },
    };
  }

  let count = notifyCounter[resetTime];

  if (usageRate > count.usageRate && resetDay != today) {
    $notification.post(`${title} | 剩余流量不足${Math.ceil(100 - usageRate)}%`, subtitle, body);
    while (usageRate > count.usageRate) {
      if (count.usageRate < 95) {
        count.usageRate += 5;
      } else {
        count.usageRate += 4;
      }
    }
  }
  if (resetDayLeft && resetDayLeft < count.resetDayLeft && resetDay != today) {
    $notification.post(`${title} | 流量将在${resetDayLeft}天后重置`, subtitle, body);
    count.resetDayLeft = resetDayLeft;
  }
  if (resetDay == today && count.resetDay && usageRate < 5) {
    $notification.post(`${title} | 流量已重置`, subtitle, body);
    count.resetDay = 0;
  }
  if (expire) {
    let diff = (new Date(expire) - now) / (1000 * 3600 * 24);
    if (diff < count.expire) {
      $notification.post(`${title} | 套餐剩余时间不足${Math.ceil(diff)}天`, subtitle, body);
      count.expire -= 5;
    }
  }
  $persistentStore.write(JSON.stringify(notifyCounter), title);
}

// 通过 Surge 本地 HTTP API 查询是否开启增强模式
function isEnhancedMode() {
  return new Promise((resolve) =>
    $httpAPI('GET', 'v1/features/enhanced_mode', null, (data) => {
      resolve(data && data.enabled);
    })
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
