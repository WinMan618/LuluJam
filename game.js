// 噜噜让一让 游戏入口文件
const canvas = wx.createCanvas()
const context = canvas.getContext('2d')

// 获取屏幕宽高及设备像素比
const sysInfo = wx.getSystemInfoSync()
const windowWidth = sysInfo.windowWidth
const windowHeight = sysInfo.windowHeight
const dpr = sysInfo.pixelRatio

// 高清屏幕适配：将物理像素放大，再用 scale 缩回逻辑像素
canvas.width = windowWidth * dpr
canvas.height = windowHeight * dpr
context.scale(dpr, dpr)

// 响应式网格计算
const maxCols = 8;
const maxRows = 10;
const padding = 6; // 增大间距，让布局更宽松
const gridSize = Math.floor((windowWidth - 20 - (maxCols - 1) * padding) / maxCols);

const directions = ['up', 'down', 'left', 'right'];

const animalTypes = {
  'cat': { type: 'cat', color: '#ff9ff3', darkColor: '#f368e0' },
  'bear': { type: 'bear', color: '#feca57', darkColor: '#ff9f43' },
  'frog': { type: 'frog', color: '#1dd1a1', darkColor: '#10ac84' },
  'pig': { type: 'pig', color: '#c8d6e5', darkColor: '#8395a7' },
  'elephant': { type: 'elephant', color: '#a4b0be', darkColor: '#747d8c' },
  'turtle': { type: 'turtle', color: '#badc58', darkColor: '#6ab04c' },
  'hedgehog': { type: 'hedgehog', color: '#ffbe76', darkColor: '#f0932b' }
};

function generateLevel(levelIndex) {
  let attempts = 0;
  while (attempts < 100) {
    attempts++;
    
    let w = levelIndex === 0 ? 4 : (levelIndex === 1 ? 7 : maxCols);
    let h = levelIndex === 0 ? 4 : (levelIndex === 1 ? 10 : maxRows);
    
    let grid = Array(h).fill(null).map(() => Array(w).fill(-1));
    let blockList = [];
    let blockId = 0;
    
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (grid[r][c] === -1) {
          let emptyProb = Math.max(0.02, 0.15 - levelIndex * 0.03); // 空白率急剧下降，布局更紧凑
          if (Math.random() < emptyProb && w > 4) continue;

          let longProb = Math.min(0.85, 0.2 + levelIndex * 0.1); // 长条动物出现概率大幅提升
          let isLong = Math.random() < longProb;
          let isElephant = levelIndex >= 5 && Math.random() < 0.15; // 第6关引入大象 2x2
          
          let bw = 1, bh = 1;
          let type = Math.random() < 0.5 ? 'pig' : 'frog';
          
          if (isElephant) {
             let canFit = true;
             for(let ir=0; ir<2; ir++) {
                for(let ic=0; ic<2; ic++) {
                   if (r+ir >= h || c+ic >= w || grid[r+ir][c+ic] !== -1) canFit = false;
                }
             }
             if (canFit) {
                bw = 2; bh = 2;
                type = 'elephant';
             } else {
                isElephant = false;
             }
          }
          
          if (!isElephant && isLong) {
            let maxLen = Math.random() < 0.3 ? 3 : 2; 
            if (Math.random() < 0.5) {
              while (bw < maxLen && c + bw < w && grid[r][c+bw] === -1) bw++;
            } else {
              while (bh < maxLen && r + bh < h && grid[r+bh][c] === -1) bh++;
            }
            if (bw > 1) type = bw === 3 ? 'bear' : 'cat';
            if (bh > 1) type = bh === 3 ? 'bear' : 'cat';
          }
          
          let block = { id: blockId++, r, c, w: bw, h: bh, type };
          blockList.push(block);
          
          for(let ir = r; ir < r + bh; ir++) {
            for(let ic = c; ic < c + bw; ic++) {
              grid[ir][ic] = block.id;
            }
          }
        }
      }
    }
    
    let remaining = [...blockList];
    let assigned = [];
    let deadlock = false;
    
    function canSlideOut(b, dir) {
      if (dir === 'up') {
        for (let r = 0; r < b.r; r++) {
          for (let c = b.c; c < b.c + b.w; c++) {
             if (grid[r][c] !== -1 && grid[r][c] !== b.id) return false;
          }
        }
      } else if (dir === 'down') {
        for (let r = b.r + b.h; r < h; r++) {
          for (let c = b.c; c < b.c + b.w; c++) {
             if (grid[r][c] !== -1 && grid[r][c] !== b.id) return false;
          }
        }
      } else if (dir === 'left') {
        for (let c = 0; c < b.c; c++) {
          for (let r = b.r; r < b.r + b.h; r++) {
             if (grid[r][c] !== -1 && grid[r][c] !== b.id) return false;
          }
        }
      } else if (dir === 'right') {
        for (let c = b.c + b.w; c < w; c++) {
          for (let r = b.r; r < b.r + b.h; r++) {
             if (grid[r][c] !== -1 && grid[r][c] !== b.id) return false;
          }
        }
      }
      return true;
    }
    
    while(remaining.length > 0) {
      let slidable = [];
      for (let b of remaining) {
        let possibleDirs = [];
        
        // 强制约束：长条动物只能顺着其体长的方向移动（不能横向平移螃蟹步）
        let allowedDirs = directions;
        if (b.w > b.h) allowedDirs = ['left', 'right'];
        else if (b.h > b.w) allowedDirs = ['up', 'down'];
        
        for (let d of allowedDirs) {
          if (canSlideOut(b, d)) possibleDirs.push(d);
        }
        if (possibleDirs.length > 0) {
          slidable.push({ block: b, dirs: possibleDirs });
        }
      }
      
      if (slidable.length === 0) {
        deadlock = true;
        break; 
      }
      
      let choice = slidable[Math.floor(Math.random() * slidable.length)];
      let b = choice.block;
      
      b.dir = choice.dirs[Math.floor(Math.random() * choice.dirs.length)];
      
      for(let r = b.r; r < b.r + b.h; r++) {
        for(let c = b.c; c < b.c + b.w; c++) {
          grid[r][c] = -1;
        }
      }
      
      remaining = remaining.filter(x => x.id !== b.id);
      assigned.push(b);
    }
    
    if (!deadlock) {
      // 进阶机制：给深层动物绑绳子，外层动物给剪刀
      if (levelIndex >= 3 && assigned.length > 10) {
        let maxRopes = Math.min(3, 1 + Math.floor((levelIndex - 3) / 2)); 
        let deepTargetIndex = Math.floor(Math.random() * Math.min(5, assigned.length * 0.2));
        assigned[deepTargetIndex].ropes = maxRopes;
        let outerBlocks = assigned.slice(Math.floor(assigned.length / 2));
        outerBlocks.sort(() => 0.5 - Math.random());
        for(let i = 0; i < maxRopes; i++) {
          if (outerBlocks[i]) outerBlocks[i].tool = 'scissors';
        }
      }
      
      // 第8关引入贪睡龟 (Sleeping Turtle)
      if (levelIndex >= 7) {
         let turtlesCount = Math.min(3, 1 + Math.floor((levelIndex - 7)/3));
         let smallBlocks = assigned.filter(b => b.w === 1 && b.h === 1 && !b.ropes && !b.tool);
         smallBlocks.sort(() => 0.5 - Math.random());
         for(let i=0; i<turtlesCount; i++) {
             if (smallBlocks[i]) {
                 smallBlocks[i].type = 'turtle';
                 smallBlocks[i].isSleeping = true;
             }
         }
      }
      
      // 第10关引入炸弹刺猬 (Bomb Hedgehog)
      if (levelIndex >= 9) {
         let bombCount = Math.min(2, 1 + Math.floor((levelIndex - 9)/4));
         // 不要放在最外围，避免直接飞走
         let smallBlocks = assigned.filter(b => b.w === 1 && b.h === 1 && !b.ropes && !b.tool && !b.isSleeping);
         let midBlocks = smallBlocks.slice(Math.floor(smallBlocks.length * 0.2), Math.floor(smallBlocks.length * 0.8));
         midBlocks.sort(() => 0.5 - Math.random());
         for(let i=0; i<bombCount; i++) {
             if (midBlocks[i]) {
                 midBlocks[i].type = 'hedgehog';
                 midBlocks[i].bombVal = 2; // 默认允许被撞2次，第3次爆炸
             }
         }
      }

      const cOffset = Math.floor((maxCols - w) / 2);
      const rOffset = Math.floor((maxRows - h) / 2);
      assigned.forEach(b => {
        b.c += cOffset;
        b.r += rOffset;
      });
      return {
        name: `第 ${levelIndex + 1} 关`,
        layout: assigned
      };
    }
  }
  
  return {
    name: `第 ${levelIndex + 1} 关 (保底)`,
    layout: [{r: 5, c: 4, w: 1, h: 1, dir: 'up', type: 'pig'}]
  };
}

// 简易音效管理器
const AudioManager = {
  playFly() { },
  playClear() {
     if (wx.vibrateShort) wx.vibrateShort({ type: 'medium' });
  },
  playCombo(count) {
     if (wx.vibrateShort) wx.vibrateShort({ type: 'heavy' });
  },
  playCut() {
     if (wx.vibrateLong) wx.vibrateLong();
  },
  playError() {
     if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  }
};

let currentLevelIndex = wx.getStorageSync('LuluJam_Level') || 0;
let blocks = [];
let hasShownRopeTutorial = false;

// 连击系统状态
let comboCount = 0;
let lastClearTime = 0;
let comboTexts = [];

// 分享变现相关状态
let shareCount = wx.getStorageSync('LuluJam_ShareCount') || 0;
let isPendingShare = false;
let shareStartTime = 0;

wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
wx.onShareAppMessage(() => {
  return {
    title: '哎呀，这只猪卡死我了！快来帮我挪一下！',
    imageUrl: '' 
  };
});

wx.onShow(() => {
  if (isPendingShare) {
    isPendingShare = false;
    let timeDiff = Date.now() - shareStartTime;
    
    // 假分享判定：离开微信小游戏必须超过 2.5 秒
    if (timeDiff > 2500) {
      shareCount++;
      wx.setStorageSync('LuluJam_ShareCount', shareCount);
      useShuffleProp();
      wx.showToast({ title: '洗牌成功！', icon: 'success' });
    } else {
      wx.showModal({
        title: '分享失败',
        content: '请不要频繁取消，试着真心分享给不同的微信群或好友吧！',
        showCancel: false,
        confirmText: '我知道了'
      });
    }
  }
});

const propButton = {
  x: windowWidth / 2 - 80,
  y: windowHeight - 90,
  width: 160,
  height: 50,
  text: '🎲 魔法洗牌'
};

function initLevel(levelIdx) {
  blocks = [];
  
  const levelConfig = generateLevel(levelIdx);
  
  const gridWidth = maxCols * gridSize + (maxCols - 1) * padding;
  const gridHeight = maxRows * gridSize + (maxRows - 1) * padding;
  const startX = (windowWidth - gridWidth) / 2;
  const startY = (windowHeight - gridHeight) / 2 - 20;

  levelConfig.layout.forEach((item, index) => {
    const x = startX + item.c * (gridSize + padding);
    const y = startY + item.r * (gridSize + padding);
    
    const w = item.w * gridSize + (item.w - 1) * padding;
    const h = item.h * gridSize + (item.h - 1) * padding;
    
    const animal = animalTypes[item.type] || animalTypes['pig'];
    
    blocks.push({
      id: `block-${index}`,
      startX: x, 
      startY: y,
      x: x,
      y: y,
      width: w,
      height: h,
      baseSize: gridSize, 
      type: animal.type,
      color: animal.color,
      darkColor: animal.darkColor,
      direction: item.dir, 
      ropes: item.ropes || 0,     // 绳子数量
      tool: item.tool || null,    // 道具（如：'scissors'）
      isSleeping: item.isSleeping || false,
      bombVal: item.bombVal || 0,
      shakeTimer: 0,              // 抖动动画计时器
      speed: Math.max(10, gridSize * 0.4), 
      state: 'idle', 
      trail: []
    });
  });
  
  blocks.levelName = levelConfig.name;
  
  // 教学提示：首次遇到绳子机制时弹出
  if (levelIdx === 3 && !hasShownRopeTutorial) {
    hasShownRopeTutorial = true;
    setTimeout(() => {
      wx.showModal({
        title: '新机制：绳索与剪刀',
        content: '有的动物被绳子绑住无法移动。\n\n你需要先让头顶带有【✂️剪刀】的动物成功逃离，才能解开全场的绳子！',
        showCancel: false,
        confirmText: '明白了',
        confirmColor: '#09BB07'
      });
    }, 500); // 延迟500ms，让玩家先看清底下的画面
  }
}

initLevel(currentLevelIndex);

function checkCollision(b1, b2) {
  const margin = 2; 
  return b1.x + margin < b2.x + b2.width - margin &&
         b1.x + b1.width - margin > b2.x + margin &&
         b1.y + margin < b2.y + b2.height - margin &&
         b1.y + b1.height - margin > b2.y + margin;
}

function isOffScreen(obj) {
  return obj.x + obj.width < 0 || obj.x > windowWidth || obj.y + obj.height < 0 || obj.y > windowHeight;
}

function useShuffleProp() {
  const idleBlocks = blocks.filter(b => b.state === 'idle');
  idleBlocks.sort(() => 0.5 - Math.random());
  const picked = idleBlocks.slice(0, 3);
  
  picked.forEach(b => {
    let newDir = directions[Math.floor(Math.random() * directions.length)];
    while(newDir === b.direction && directions.length > 1) {
       newDir = directions[Math.floor(Math.random() * directions.length)];
    }
    b.direction = newDir;
    b.state = 'returning';
    setTimeout(() => { b.state = 'idle'; }, 150);
  });
}

let touchStartX = 0;
let touchStartY = 0;
let isAdPlaying = false; 
let isGameOver = false;

function triggerGameOver() {
  isGameOver = true;
  wx.vibrateLong();
  wx.showToast({ title: '💣 炸弹爆炸！', icon: 'error', duration: 2000 });
  
  setTimeout(() => {
     isGameOver = false;
     initLevel(currentLevelIndex); // 重新开始本关
  }, 1500);
}

wx.onTouchStart((e) => {
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
});

wx.onTouchEnd((e) => {
  if (isAdPlaying || isGameOver) return; 

  const touch = e.changedTouches[0];
  const tx = touch.clientX;
  const ty = touch.clientY;

  if (Math.abs(tx - touchStartX) > 20 || Math.abs(ty - touchStartY) > 20) return;

  if (blocks.length === 0) {
    currentLevelIndex++;
    wx.setStorageSync('LuluJam_Level', currentLevelIndex);
    initLevel(currentLevelIndex);
    return;
  }

  if (
    tx >= propButton.x && tx <= propButton.x + propButton.width &&
    ty >= propButton.y && ty <= propButton.y + propButton.height &&
    blocks.length > 0 
  ) {
    if (shareCount === 0) {
      // 第 1 次点击：触发假分享套路
      shareStartTime = Date.now();
      isPendingShare = true;
      wx.shareAppMessage({
        title: '这关实在太难了，谁来帮我挪一下这头猪！'
      });
    } else {
      // 第 2 次及以后：永久变成看广告
      wx.showModal({
        title: '使用魔法洗牌',
        content: '观看一段视频广告即可随机改变3个小动物的方向，帮您破局！',
        confirmText: '看视频',
        confirmColor: '#09BB07',
        cancelText: '取消',
        success(res) {
          if (res.confirm) {
            isAdPlaying = true;
            wx.showLoading({ title: '广告加载中...', mask: true });
            // 模拟广告播放成功
            setTimeout(() => {
              wx.hideLoading();
              isAdPlaying = false;
              useShuffleProp();
              wx.showToast({ title: '洗牌成功！', icon: 'success' });
            }, 1500);
          }
        }
      });
    }
    return; 
  }

  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (
      b.state === 'idle' &&
      tx >= b.x &&
      tx <= b.x + b.width &&
      ty >= b.y &&
      ty <= b.y + b.height
    ) {
      if (b.isSleeping) {
        b.shakeTimer = 8;
        AudioManager.playError();
        wx.showToast({ title: '还在睡觉！快去撞醒它', icon: 'none', duration: 1500 });
      } else if (b.ropes > 0) {
        // 有绳子不能飞，只播放抖动反馈
        b.shakeTimer = 8;
        AudioManager.playError();
        
        // 操作失败的玩法解释
        wx.showToast({ 
          title: '被绑住了！请先找到 ✂️ 剪刀', 
          icon: 'none', 
          duration: 1500 
        });
      } else {
        b.state = 'flying';
        b.trail = [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }];
        AudioManager.playFly();
      }
      break; 
    }
  }
});

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
}

// 绘制尖头方块，直观指示方向
function drawPointyRect(ctx, x, y, w, h, r, dir) {
  ctx.beginPath();
  let pw = (dir === 'up' || dir === 'down') ? w : h;
  let pointD = pw * 0.35; // 尖头所占的深度比例
  
  if (dir === 'up') {
    ctx.moveTo(x + r, y + h);
    ctx.lineTo(x + w - r, y + h);
    ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    ctx.lineTo(x + w, y + pointD);
    ctx.lineTo(x + w/2, y); // 尖头
    ctx.lineTo(x, y + pointD);
    ctx.lineTo(x, y + h - r);
    ctx.quadraticCurveTo(x, y + h, x + r, y + h);
  } else if (dir === 'down') {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - pointD);
    ctx.lineTo(x + w/2, y + h); // 尖头
    ctx.lineTo(x, y + h - pointD);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  } else if (dir === 'left') {
    ctx.moveTo(x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + pointD, y + h);
    ctx.lineTo(x, y + h/2); // 尖头
    ctx.lineTo(x + pointD, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  } else if (dir === 'right') {
    ctx.moveTo(x, y + r);
    ctx.lineTo(x, y + h - r);
    ctx.quadraticCurveTo(x, y + h, x + r, y + h);
    ctx.lineTo(x + w - pointD, y + h);
    ctx.lineTo(x + w, y + h/2); // 尖头
    ctx.lineTo(x + w - pointD, y);
    ctx.lineTo(x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
  }
  ctx.fill();
}

function drawPropButton(ctx) {
  if (blocks.length === 0) return; 

  ctx.fillStyle = '#ff7f50';
  drawRoundRect(ctx, propButton.x, propButton.y + 5, propButton.width, propButton.height, 25);
  ctx.fillStyle = shareCount === 0 ? '#1dd1a1' : '#ffa502'; // 首充(分享)用绿色，之后用橙色
  drawRoundRect(ctx, propButton.x, propButton.y, propButton.width, propButton.height, 25);
  
  ctx.fillStyle = 'white';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(propButton.text, propButton.x + propButton.width / 2, propButton.y + propButton.height / 2);
  
  const badgeX = propButton.x + propButton.width - 40;
  const badgeY = propButton.y - 8;
  ctx.fillStyle = shareCount === 0 ? '#0984e3' : '#ff4757';
  drawRoundRect(ctx, badgeX, badgeY, 65, 20, 10);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 11px Arial';
  ctx.fillText(shareCount === 0 ? '↗️ 分享' : '▶ 视频', badgeX + 32, badgeY + 10);
}

function draw3DAnimalBlock(ctx, b) {
  const scale = b.baseSize / 64;
  
  const r = 16 * scale; 
  let depth = 12 * scale; 
  let drawX = b.x;
  let drawY = b.y;
  
  // 抖动动画
  if (b.shakeTimer > 0) {
    drawX += (Math.random() - 0.5) * 6; 
    drawY += (Math.random() - 0.5) * 6;
  }
  
  if (b.state === 'flying') {
    drawY -= 8 * scale; 
    depth += 8 * scale;
  } else if (b.state === 'returning') {
    drawY += 6 * scale; 
    depth -= 6 * scale;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  drawPointyRect(ctx, drawX + 4 * scale, drawY + depth + 4 * scale, b.width, b.height, r, b.direction);

  ctx.fillStyle = b.state === 'returning' ? '#e74c3c' : b.darkColor;
  drawPointyRect(ctx, drawX, drawY + depth, b.width, b.height, r, b.direction);

  ctx.fillStyle = b.state === 'returning' ? '#ff7675' : b.color;
  drawPointyRect(ctx, drawX, drawY, b.width, b.height, r, b.direction);

  ctx.save();
  ctx.translate(drawX + b.width / 2, drawY + b.height / 2);
  
  if (b.direction === 'right') ctx.rotate(Math.PI / 2);
  else if (b.direction === 'down') ctx.rotate(Math.PI);
  else if (b.direction === 'left') ctx.rotate(-Math.PI / 2);
  
  // 由于头部变尖，将视觉中心稍微向后偏移，使五官看起来居中
  let localBase = (b.direction === 'up' || b.direction === 'down') ? b.width : b.height;
  ctx.translate(0, (localBase / scale) * 0.08);

  // 稍微缩小五官比例，让小动物在方块内留有舒适的空白边距
  ctx.scale(scale * 0.85, scale * 0.85);
  
  const hh = 32; 

  if (b.type === 'cat') {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.moveTo(-16, -hh + 8); ctx.lineTo(-24, -hh - 8); ctx.lineTo(-4, -hh + 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, -hh + 8); ctx.lineTo(24, -hh - 8); ctx.lineTo(4, -hh + 8); ctx.fill();
    ctx.fillStyle = b.darkColor;
    ctx.beginPath(); ctx.moveTo(-16, -hh + 8); ctx.lineTo(-20, -hh - 4); ctx.lineTo(-8, -hh + 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, -hh + 8); ctx.lineTo(20, -hh - 4); ctx.lineTo(8, -hh + 8); ctx.fill();
  } else if (b.type === 'bear') {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(-18, -hh + 6, 10, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(18, -hh + 6, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = b.darkColor;
    ctx.beginPath(); ctx.arc(-18, -hh + 6, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(18, -hh + 6, 5, 0, Math.PI*2); ctx.fill();
  } else if (b.type === 'frog') {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(-15, -hh + 4, 12, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(15, -hh + 4, 12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(-15, -hh + 4, 8, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(15, -hh + 4, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath(); ctx.arc(-15, -hh + 2, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(15, -hh + 2, 4, 0, Math.PI*2); ctx.fill();
  } else if (b.type === 'elephant') {
    ctx.fillStyle = b.color;
    drawRoundRect(ctx, -20, -10, 40, 30, 8);
    ctx.fillStyle = b.darkColor;
    drawRoundRect(ctx, -6, 0, 12, 24, 6);
    ctx.fillStyle = '#2d3436';
    ctx.beginPath(); ctx.arc(-10, -2, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -2, 4, 0, Math.PI*2); ctx.fill();
  } else if (b.type === 'turtle') {
    ctx.fillStyle = b.darkColor;
    ctx.beginPath(); ctx.arc(0, 4, 14, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath(); ctx.arc(-6, 2, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, 2, 3, 0, Math.PI*2); ctx.fill();
  } else if (b.type === 'hedgehog') {
    ctx.fillStyle = b.darkColor;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffeaa7';
    ctx.beginPath(); ctx.arc(0, 4, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath(); ctx.arc(-4, 2, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, 2, 3, 0, Math.PI*2); ctx.fill();
  }

  if (b.type !== 'frog' && b.type !== 'elephant' && b.type !== 'turtle' && b.type !== 'hedgehog') {
    ctx.fillStyle = '#2d3436';
    ctx.beginPath(); ctx.arc(-12, -8, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -8, 4, 0, Math.PI*2); ctx.fill();
  }

  if (b.type === 'pig') {
    ctx.fillStyle = '#ff7675';
    drawRoundRect(ctx, -12, -2, 24, 14, 6);
    ctx.fillStyle = '#d63031';
    ctx.beginPath(); ctx.arc(-5, 5, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, 5, 2.5, 0, Math.PI*2); ctx.fill();
  } else if (b.type === 'bear') {
    ctx.fillStyle = '#ffeaa7';
    ctx.beginPath(); ctx.arc(0, 4, 12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
  } else if (b.type === 'cat') {
    ctx.fillStyle = '#ff7675';
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(-22, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(-22, 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 2); ctx.lineTo(22, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 6); ctx.lineTo(22, 10); ctx.stroke();
  }
  
  if (b.isSleeping) {
     ctx.font = 'bold 24px Arial';
     ctx.fillStyle = '#ffffff';
     ctx.shadowColor = 'rgba(0,0,0,0.5)';
     ctx.shadowBlur = 4;
     ctx.fillText('💤', 15, -20);
     ctx.shadowColor = 'transparent';
  }
  
  if (b.bombVal > 0) {
     ctx.font = 'bold 20px Arial';
     ctx.fillStyle = '#ff4757';
     ctx.shadowColor = 'rgba(255,255,255,0.8)';
     ctx.shadowBlur = 4;
     ctx.fillText(`💣 ${b.bombVal}`, 0, -20);
     ctx.shadowColor = 'transparent';
  }

  // 方向箭头（如果是绳索状态，稍微半透明表示不可操作）
  ctx.fillStyle = b.ropes > 0 ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(-14, -2);
  ctx.lineTo(-5, -2);
  ctx.lineTo(-5, 14);
  ctx.lineTo(5, 14);
  ctx.lineTo(5, -2);
  ctx.lineTo(14, -2);
  ctx.fill();

  // 画绳子
  if (b.ropes > 0) {
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#5c4033'; 
    // 根据方向动态获取本地坐标系的边界
    let localW = (b.direction === 'up' || b.direction === 'down') ? b.width / scale : b.height / scale;
    
    for (let i = 0; i < b.ropes; i++) {
       let yOffset = (i - (b.ropes - 1) / 2) * 18; 
       ctx.beginPath();
       ctx.moveTo(-localW/2, yOffset);
       ctx.lineTo(localW/2, yOffset);
       ctx.stroke();
       
       // 绳子纹理高光
       ctx.lineWidth = 2;
       ctx.strokeStyle = '#cd853f';
       ctx.beginPath();
       ctx.moveTo(-localW/2, yOffset - 2);
       ctx.lineTo(localW/2, yOffset - 2);
       ctx.stroke();
       
       ctx.beginPath();
       ctx.moveTo(-localW/2, yOffset + 2);
       ctx.lineTo(localW/2, yOffset + 2);
       ctx.stroke();
    }
  }

  // 画剪刀图标
  if (b.tool === 'scissors') {
     // 撤销自身的旋转，保证剪刀永远正向显示
     ctx.rotate(
       b.direction === 'right' ? -Math.PI / 2 :
       b.direction === 'down' ? -Math.PI :
       b.direction === 'left' ? Math.PI / 2 : 0
     );
     
     let localW = b.width / scale;
     let localH = b.height / scale;
     
     let iconX = localW / 2 - 20;
     let iconY = -localH / 2 + 20;
     
     ctx.fillStyle = 'rgba(255,255,255,0.95)';
     ctx.shadowColor = 'rgba(0,0,0,0.4)';
     ctx.shadowBlur = 6;
     ctx.beginPath();
     ctx.arc(iconX, iconY, 18, 0, Math.PI*2);
     ctx.fill();
     ctx.shadowColor = 'transparent'; 
     
     ctx.font = '24px Arial';
     ctx.fillStyle = '#000';
     ctx.textAlign = 'center';
     ctx.textBaseline = 'middle';
     ctx.fillText('✂️', iconX, iconY + 1);
  }

  ctx.restore();
}

function loop() {
  context.clearRect(0, 0, windowWidth, windowHeight);
  // 绘制舒适的柔和背景渐变 (护眼暖绿色调)
  let bgGradient = context.createLinearGradient(0, 0, 0, windowHeight);
  bgGradient.addColorStop(0, '#f1f8e9'); // 极浅的草绿色
  bgGradient.addColorStop(1, '#dcedc8'); // 稍深的草绿色
  context.fillStyle = bgGradient; 
  context.fillRect(0, 0, windowWidth, windowHeight);
  
  // 绘制柔和的点阵背景，增加精致的“手账本”质感且绝不刺眼
  context.fillStyle = 'rgba(0, 0, 0, 0.04)';
  for(let i=0; i<windowWidth/30; i++) {
    for(let j=0; j<windowHeight/30; j++) {
      context.beginPath(); 
      context.arc(i*30 + 15, j*30 + 15, 1.5, 0, Math.PI*2); 
      context.fill();
    }
  }
  
  context.fillStyle = 'rgba(45, 52, 54, 0.8)';
  context.font = 'bold 20px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.fillText('噜噜让一让', windowWidth / 2, 35);
  
  context.font = '14px Arial';
  context.fillText(blocks.levelName || '', windowWidth / 2, 60);

  if (isGameOver) {
    context.fillStyle = 'rgba(255, 0, 0, 0.3)';
    context.fillRect(0, 0, windowWidth, windowHeight);
  }

  if (blocks.length === 0) {
    context.fillStyle = '#1dd1a1';
    context.font = 'bold 32px Arial';
    context.textBaseline = 'middle';
    context.fillText('✨ 关卡完成！', windowWidth / 2, windowHeight / 2 - 20);
    context.fillStyle = '#2d3436';
    context.font = '14px Arial';
    context.fillText('点击屏幕进入下一关', windowWidth / 2, windowHeight / 2 + 20);
  }

  for (let i = blocks.length - 1; i >= 0; i--) {
    let b = blocks[i];
    
    if (b.shakeTimer > 0) b.shakeTimer--;

    if (b.state === 'flying') {
      if (b.direction === 'up') b.y -= b.speed;
      else if (b.direction === 'down') b.y += b.speed;
      else if (b.direction === 'left') b.x -= b.speed;
      else if (b.direction === 'right') b.x += b.speed;
      
      b.trail.push({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

      let hitTarget = null;
      for (let j = 0; j < blocks.length; j++) {
        if (i !== j) { 
          if (checkCollision(b, blocks[j])) {
            hitTarget = blocks[j];
            break;
          }
        }
      }

      if (hitTarget) {
        b.state = 'returning';
        b.trail = []; 
        
        hitTarget.shakeTimer = 8;
        AudioManager.playError();
        
        if (hitTarget.isSleeping) {
           hitTarget.isSleeping = false;
           wx.showToast({ title: '🐢 被撞醒了！', icon: 'none', duration: 1000 });
        }
        
        if (hitTarget.bombVal > 0) {
           hitTarget.bombVal--;
           if (hitTarget.bombVal === 0) {
              triggerGameOver();
           } else {
              wx.showToast({ title: `⚠️ 炸弹还剩 ${hitTarget.bombVal} 次`, icon: 'none', duration: 1000 });
           }
        }
      } else if (isOffScreen(b)) {
        // 方块完全飞出屏幕被销毁
        blocks.splice(i, 1);
        
        // 连击判定
        let now = Date.now();
        if (now - lastClearTime < 1200) {
          comboCount++;
          if (comboCount > 1) {
            comboTexts.push({
               x: b.x + b.width / 2,
               y: b.y,
               text: `Combo x${comboCount}!`,
               life: 45,
               maxLife: 45,
               color: comboCount >= 5 ? '#feca57' : '#ff9ff3'
            });
            AudioManager.playCombo(comboCount);
          }
        } else {
          comboCount = 1;
          AudioManager.playClear();
        }
        lastClearTime = now;
        
        // 剪刀结算：断开全场绳子
        if (b.tool === 'scissors') {
          let ropesCut = false;
          for(let k=0; k<blocks.length; k++) {
             if (blocks[k].ropes > 0) {
                 blocks[k].ropes--;
                 ropesCut = true;
             }
          }
          if (ropesCut) {
             wx.showToast({ title: '✂️ 绳索解开', icon: 'none', duration: 800 });
             AudioManager.playCut();
          }
        }
      }

    } else if (b.state === 'returning') {
      let dx = b.startX - b.x;
      let dy = b.startY - b.y;
      
      if (Math.abs(dx) <= b.speed && Math.abs(dy) <= b.speed) {
        b.x = b.startX;
        b.y = b.startY;
        b.state = 'idle'; 
      } else {
        if (dx > 0) b.x += b.speed;
        if (dx < 0) b.x -= b.speed;
        if (dy > 0) b.y += b.speed;
        if (dy < 0) b.y -= b.speed;
      }
    }
  }

  for (let b of blocks) {
    if (b.state === 'flying' && b.trail.length > 0) {
      context.beginPath();
      context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      context.lineWidth = Math.min(b.width, b.height) * 0.6; 
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.moveTo(b.trail[0].x, b.trail[0].y);
      for (let i = 1; i < b.trail.length; i++) {
        context.lineTo(b.trail[i].x, b.trail[i].y);
      }
      context.stroke();
    }
  }

  for (let b of blocks) {
    draw3DAnimalBlock(context, b);
  }

  // 渲染连击飘字特效
  for (let i = comboTexts.length - 1; i >= 0; i--) {
    let ct = comboTexts[i];
    ct.life--;
    if (ct.life <= 0) {
      comboTexts.splice(i, 1);
      continue;
    }
    context.save();
    let alpha = ct.life / ct.maxLife;
    context.globalAlpha = alpha;
    let floatY = ct.y - (ct.maxLife - ct.life) * 1.5;
    
    context.font = 'bold 28px Arial';
    context.textAlign = 'center';
    context.lineWidth = 4;
    context.strokeStyle = 'white';
    context.strokeText(ct.text, ct.x, floatY);
    context.fillStyle = ct.color;
    context.fillText(ct.text, ct.x, floatY);
    context.restore();
  }

  drawPropButton(context);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
