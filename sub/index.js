const sharedCanvas = wx.getSharedCanvas();
const context = sharedCanvas.getContext('2d');
const sysInfo = wx.getSystemInfoSync();
sharedCanvas.width = sysInfo.windowWidth;
sharedCanvas.height = sysInfo.windowHeight;

let friendData = [];
let isLoading = false;

function drawLeaderboard() {
  const width = sharedCanvas.width;
  const height = sharedCanvas.height;
  
  context.clearRect(0, 0, width, height);

  // Background for the leaderboard (dark overlay)
  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  context.fillRect(0, 0, width, height);

  // Panel
  const panelW = width * 0.8;
  const panelH = height * 0.7;
  const panelX = (width - panelW) / 2;
  const panelY = (height - panelH) / 2;

  context.fillStyle = '#ffffff';
  
  function fillRoundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + w - r, y);
    context.quadraticCurveTo(x + w, y, x + w, y + r);
    context.lineTo(x + w, y + h - r);
    context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    context.lineTo(x + r, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.fill();
  }
  fillRoundRect(panelX, panelY, panelW, panelH, 20);

  // Title
  context.fillStyle = '#2d3436';
  context.font = 'bold 24px Arial';
  context.textAlign = 'center';
  context.fillText('🏆 好友排行榜', width / 2, panelY + 40);

  // List friends
  if (isLoading) {
    context.fillStyle = '#636e72';
    context.font = '16px Arial';
    context.fillText('数据加载中...', width / 2, panelY + 120);
    return;
  }

  if (friendData.length === 0) {
    context.fillStyle = '#636e72';
    context.font = '16px Arial';
    context.fillText('暂无好友数据...', width / 2, panelY + 120);
    return;
  }

  // Draw up to 6 friends for simplicity
  const itemHeight = 60;
  const startY = panelY + 80;
  for (let i = 0; i < Math.min(friendData.length, 6); i++) {
    const item = friendData[i];
    const itemY = startY + i * itemHeight;

    // Rank number
    context.fillStyle = (i === 0) ? '#f1c40f' : ((i === 1) ? '#bdc3c7' : ((i === 2) ? '#d35400' : '#636e72'));
    context.font = 'bold 20px Arial';
    context.textAlign = 'left';
    context.fillText(i + 1, panelX + 20, itemY + 35);

    // Avatar
    if (item.avatarUrl) {
      let avatarImage = wx.createImage();
      avatarImage.src = item.avatarUrl;
      avatarImage.onload = () => {
        // Redraw only the avatar part
        context.drawImage(avatarImage, panelX + 50, itemY + 10, 40, 40);
      };
    }

    // Nickname
    context.fillStyle = '#2d3436';
    context.font = '16px Arial';
    let nickName = item.nickname || 'Unknown';
    if (nickName.length > 6) nickName = nickName.substring(0, 6) + '...';
    context.textAlign = 'left';
    context.fillText(nickName, panelX + 100, itemY + 35);

    // Score (Level)
    let score = 0;
    if (item.KVDataList && item.KVDataList.length > 0) {
      const kv = item.KVDataList.find(k => k.key === 'level');
      if (kv) score = parseInt(kv.value) || 0;
    }
    context.fillStyle = '#09BB07';
    context.font = 'bold 18px Arial';
    context.textAlign = 'right';
    context.fillText(`第 ${score + 1} 关`, panelX + panelW - 20, itemY + 35);
  }
}

wx.onMessage((data) => {
  if (data.command === 'updateScore') {
    wx.setUserCloudStorage({
      KVDataList: [{ key: 'level', value: data.level.toString() }],
      success: () => { console.log('Upload score success'); }
    });
  } else if (data.command === 'showLeaderboard') {
    isLoading = true;
    drawLeaderboard();
    
    wx.getFriendCloudStorage({
      keyList: ['level'],
      success: (res) => {
        isLoading = false;
        friendData = res.data || [];
        // Sort by level descending
        friendData.sort((a, b) => {
          let scoreA = 0, scoreB = 0;
          if (a.KVDataList && a.KVDataList.length > 0) {
            let kvA = a.KVDataList.find(k => k.key === 'level');
            if (kvA) scoreA = parseInt(kvA.value) || 0;
          }
          if (b.KVDataList && b.KVDataList.length > 0) {
            let kvB = b.KVDataList.find(k => k.key === 'level');
            if (kvB) scoreB = parseInt(kvB.value) || 0;
          }
          return scoreB - scoreA;
        });
        drawLeaderboard();
      },
      fail: (err) => {
        console.error('getFriendCloudStorage fail', err);
        isLoading = false;
        drawLeaderboard();
      }
    });
  }
});
