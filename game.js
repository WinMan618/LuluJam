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
const maxCols = 10;
const maxRows = 12;
const padding = 12; // 缩小间距，使格子显得更大更紧凑
const gridSize = Math.floor((windowWidth - 20 - (maxCols - 1) * padding) / maxCols);

const directions = ['up', 'down', 'left', 'right'];

const animalTypes = {
  'cat': { type: 'cat', color: '#ff9ff3', darkColor: '#f368e0' },
  'dog': { type: 'dog', color: '#feca57', darkColor: '#ff9f43' },
  'frog': { type: 'frog', color: '#1dd1a1', darkColor: '#10ac84' },
  'pig': { type: 'pig', color: '#c8d6e5', darkColor: '#8395a7' },
  'elephant': { type: 'elephant', color: '#a4b0be', darkColor: '#747d8c' },
  'turtle': { type: 'turtle', color: '#badc58', darkColor: '#6ab04c' },
  'hedgehog': { type: 'hedgehog', color: '#ffbe76', darkColor: '#f0932b' }
};

function isTargetable(target, blocks) {
  for (let a of blocks) {
    if (a.id === target.id) continue;
    if (a.dir === 'up' && a.r > target.r && a.c < target.c + target.w && a.c + a.w > target.c) return true;
    if (a.dir === 'down' && a.r < target.r && a.c < target.c + target.w && a.c + a.w > target.c) return true;
    if (a.dir === 'left' && a.c > target.c && a.r < target.r + target.h && a.r + a.h > target.r) return true;
    if (a.dir === 'right' && a.c < target.c && a.r < target.r + target.h && a.r + a.h > target.r) return true;
  }
  return false;
}

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
            if (bw > 1) type = bw === 3 ? 'dog' : 'cat';
            if (bh > 1) type = bh === 3 ? 'dog' : 'cat';
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
         let smallBlocks = assigned.filter(b => b.w === 1 && b.h === 1 && !b.ropes && !b.tool && isTargetable(b, assigned));
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

// 游戏状态管理
let gameState = 'HOME'; // 'HOME', 'PLAYING', 'RANK'
const startButton = {
  x: windowWidth / 2 - 100,
  y: windowHeight / 2 + 20,
  width: 200,
  height: 60,
  text: '开始游戏'
};

const rankButton = {
  x: windowWidth / 2 - 100,
  y: windowHeight / 2 + 100,
  width: 200,
  height: 50,
  text: '🏆 好友排行榜'
};

const closeRankButton = {
  x: windowWidth / 2 - 60,
  y: windowHeight * 0.85 + 20,
  width: 120,
  height: 40,
  text: '❌ 关闭'
};

const openDataContext = wx.getOpenDataContext();
const sharedCanvas = openDataContext.canvas;
sharedCanvas.width = windowWidth;
sharedCanvas.height = windowHeight;

// 连击系统状态
let comboCount = 0;
let lastClearTime = 0;
let comboTexts = [];

// 默认支持右上角菜单分享，但不绑定游戏内奖励
wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
wx.onShareAppMessage(() => {
  return {
    title: '哎呀，这只猪卡死我了！快来帮我挪一下！',
    imageUrl: '' 
  };
});

const propButton = {
  x: windowWidth / 2 - 80,
  y: windowHeight - 90,
  width: 160,
  height: 50,
  text: '🎲 魔法洗牌'
};

const homeButton = {
  x: 20,
  y: 40,
  width: 90,
  height: 40,
  text: '🏠 首页'
};

function initLevel(levelIdx) {
  blocks = [];
  
  // 向子域发送最新分数
  if (typeof openDataContext !== 'undefined') {
    openDataContext.postMessage({
      command: 'updateScore',
      level: levelIdx
    });
  }
  
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

  if (gameState === 'HOME') {
    if (
      tx >= startButton.x && tx <= startButton.x + startButton.width &&
      ty >= startButton.y && ty <= startButton.y + startButton.height
    ) {
      gameState = 'PLAYING';
      AudioManager.playClear();
    }
    if (
      tx >= rankButton.x && tx <= rankButton.x + rankButton.width &&
      ty >= rankButton.y && ty <= rankButton.y + rankButton.height
    ) {
      gameState = 'RANK';
      AudioManager.playClear();
      openDataContext.postMessage({ command: 'showLeaderboard' });
    }
    return; 
  }

  if (gameState === 'RANK') {
    if (
      tx >= closeRankButton.x && tx <= closeRankButton.x + closeRankButton.width &&
      ty >= closeRankButton.y && ty <= closeRankButton.y + closeRankButton.height
    ) {
      gameState = 'HOME';
      AudioManager.playClear();
    }
    return;
  }

  if (blocks.length === 0) {
    currentLevelIndex++;
    wx.setStorageSync('LuluJam_Level', currentLevelIndex);
    initLevel(currentLevelIndex);
    return;
  }

  if (
    tx >= homeButton.x && tx <= homeButton.x + homeButton.width &&
    ty >= homeButton.y && ty <= homeButton.y + homeButton.height &&
    gameState === 'PLAYING'
  ) {
    gameState = 'HOME';
    AudioManager.playClear();
    return;
  }

  if (
    tx >= propButton.x && tx <= propButton.x + propButton.width &&
    ty >= propButton.y && ty <= propButton.y + propButton.height &&
    blocks.length > 0 
  ) {
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
  ctx.fillStyle = '#ffa502';
  drawRoundRect(ctx, propButton.x, propButton.y, propButton.width, propButton.height, 25);
  
  ctx.fillStyle = 'white';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(propButton.text, propButton.x + propButton.width / 2, propButton.y + propButton.height / 2);
  
  const badgeX = propButton.x + propButton.width - 40;
  const badgeY = propButton.y - 8;
  ctx.fillStyle = '#ff4757';
  drawRoundRect(ctx, badgeX, badgeY, 65, 20, 10);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('▶ 视频', badgeX + 32, badgeY + 10);
}

function drawHomeButton(ctx) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  drawRoundRect(ctx, homeButton.x, homeButton.y, homeButton.width, homeButton.height, 20);
  
  ctx.fillStyle = '#2d3436';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(homeButton.text, homeButton.x + homeButton.width / 2, homeButton.y + homeButton.height / 2);
}

function draw3DAnimalBlock(ctx, b, time = 0) {
  const scale = b.baseSize / 64;
  
  const r = 16 * scale; 
  let depth = 12 * scale; 
  let drawX = b.x;
  let drawY = b.y;
  
  if (b.state === 'flying') {
    drawY -= 8 * scale; 
    depth += 8 * scale;
  } else if (b.state === 'returning') {
    drawY += 6 * scale; 
    depth -= 6 * scale;
  }

  // --- 计算动画参数 ---
  let legSwing = 0;
  let tailWag = 0;
  let breatheY = 0;
  
  if (b.state === 'flying') {
    legSwing = Math.sin(time / 40) * 12 * scale;  // 腿摆动
    tailWag = Math.sin(time / 40) * 0.5;          // 尾巴摇
    breatheY = Math.abs(Math.sin(time / 40)) * 2 * scale; // 身体颠簸
  } else if (b.state === 'idle' && !b.isSleeping) {
    breatheY = Math.sin(time / 200) * 1.5 * scale; // 缓慢呼吸
  }

  // 腿和尾巴将在厚度与顶层之间绘制

  // 呼吸/颠簸对主体的Y偏移
  drawY -= breatheY;

  let bodyR = Math.min(b.width, b.height) / 2.2; // 让身体变成圆润的胶囊形，不再那么方

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  drawRoundRect(ctx, drawX + 4 * scale, drawY + depth + 4 * scale, b.width, b.height, bodyR);

  ctx.fillStyle = b.state === 'returning' ? '#e74c3c' : b.darkColor;
  drawRoundRect(ctx, drawX, drawY + depth, b.width, b.height, bodyR);

  // --- 绘制腿和尾巴 (夹在厚度和顶层之间，这样下侧的腿不会被厚度阴影遮挡) ---
  ctx.save();
  ctx.translate(drawX + b.width / 2, drawY + b.height / 2);
  if (b.direction === 'right') ctx.rotate(Math.PI / 2);
  else if (b.direction === 'down') ctx.rotate(Math.PI);
  else if (b.direction === 'left') ctx.rotate(-Math.PI / 2);
  
  let localW = (b.direction === 'up' || b.direction === 'down') ? b.width : b.height;
  let localH = (b.direction === 'up' || b.direction === 'down') ? b.height : b.width;
  
  // 腿 (使用比 darkColor 更深一点的颜色或者直接使用 darkColor)
  ctx.fillStyle = b.darkColor; 
  let legW = 12 * scale;
  let legH = 16 * scale;
  let legDistX = localW / 2 - 2 * scale; // 稍微缩回一点，让腿看起来连接着身体
  let legDistY = localH / 2 - 16 * scale;
  if (legDistY < 12 * scale) legDistY = 12 * scale; // 保证前后腿有足够的间距
  
  // 针对大象进行专属的腿部微调
  if (b.type === 'elephant') {
     legW = 22 * scale;   // 大象的腿更粗
     legH = 26 * scale;   // 大象的腿更长
     legDistX = localW / 2 - 14 * scale; // 大象身体非常圆润，腿需要往里多缩一点才能完全接上
     legDistY = localH / 2 - 26 * scale;
  }
  
  // 核心：处理 2.5D 深度遮挡问题
  // 对于在世界坐标中朝下（+Y，南侧）的腿或尾巴，它们会被身体的 3D 厚度层（depth）遮挡。
  // 因此必须将它们在世界 +Y 方向平移 depth 的距离，让它们延伸出厚度层！
  let drawLeg = (lx, ly) => {
      let worldY = 0;
      if (b.direction === 'right') worldY = lx;
      else if (b.direction === 'down') worldY = -ly;
      else if (b.direction === 'left') worldY = -lx;
      else if (b.direction === 'up') worldY = ly;
      
      let finalX = lx;
      let finalY = ly;
      if (worldY > 0) { // 位于南侧（下侧）
          if (b.direction === 'right') finalX += depth;
          else if (b.direction === 'down') finalY -= depth;
          else if (b.direction === 'left') finalX -= depth;
          else if (b.direction === 'up') finalY += depth;
      }
      drawRoundRect(ctx, finalX - legW/2, finalY - legH/2, legW, legH, 4 * scale);
  };

  // 左前, 右前, 左后, 右后 (交替摆动)
  drawLeg(-legDistX, -legDistY + legSwing);
  drawLeg(legDistX, -legDistY - legSwing);
  drawLeg(-legDistX, legDistY - legSwing);
  drawLeg(legDistX, legDistY + legSwing);

  // 尾巴
  let tailWorldY = 0;
  if (b.direction === 'up') tailWorldY = localH / 2; // 尾巴在尾部(+Y)，只有朝上时尾巴才在世界南侧
  let tailShiftY = tailWorldY > 0 ? depth : 0;
  
  ctx.save();
  ctx.translate(0, localH / 2 + tailShiftY);
  ctx.rotate(tailWag);
  if (b.type === 'pig') {
     ctx.strokeStyle = '#ff7675';
     ctx.lineWidth = 4 * scale;
     ctx.lineCap = 'round';
     ctx.beginPath(); ctx.arc(0, 6*scale, 4*scale, -Math.PI/2, Math.PI); ctx.stroke();
  } else if (b.type === 'cat') {
     ctx.fillStyle = b.color;
     drawRoundRect(ctx, -3*scale, 0, 6*scale, 20*scale, 3*scale);
  } else if (b.type === 'dog' || b.type === 'elephant' || b.type === 'hedgehog') {
     ctx.fillStyle = b.color;
     ctx.beginPath(); ctx.arc(0, 5*scale, 5*scale, 0, Math.PI*2); ctx.fill();
  } else if (b.type === 'turtle') {
     ctx.fillStyle = '#6ab04c';
     ctx.beginPath(); ctx.moveTo(-4*scale, 0); ctx.lineTo(4*scale, 0); ctx.lineTo(0, 10*scale); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
  // --- 结束腿和尾巴绘制 ---

  ctx.fillStyle = b.state === 'returning' ? '#ff7675' : b.color;
  drawRoundRect(ctx, drawX, drawY, b.width, b.height, bodyR);

  ctx.save();
  ctx.translate(drawX + b.width / 2, drawY + b.height / 2);
  
  if (b.direction === 'right') ctx.rotate(Math.PI / 2);
  else if (b.direction === 'down') ctx.rotate(Math.PI);
  else if (b.direction === 'left') ctx.rotate(-Math.PI / 2);
  
  // 将脸部移到身体的前端（头部）
  let localBase = (b.direction === 'up' || b.direction === 'down') ? b.width : b.height;
  let localLen = (b.direction === 'up' || b.direction === 'down') ? b.height : b.width;
  
  let faceShiftY = -(localLen / 2) + (22 * scale);
  if (faceShiftY > -(localBase / 2) * 0.1) {
      faceShiftY = -(localBase / 2) * 0.1; 
  }
  ctx.translate(0, faceShiftY);

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
  } else if (b.type === 'dog') {
    ctx.fillStyle = b.darkColor;
    drawRoundRect(ctx, -26, -hh + 8, 12, 24, 6);
    drawRoundRect(ctx, 14, -hh + 8, 12, 24, 6);
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
  } else if (b.type === 'dog') {
    ctx.fillStyle = '#ffeaa7';
    ctx.beginPath(); ctx.arc(0, 4, 12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath(); ctx.moveTo(-5, -1); ctx.lineTo(5, -1); ctx.lineTo(0, 4); ctx.fill();
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

  ctx.restore();

  // 移出 face 坐标系，在方块中心绘制剪刀
  if (b.tool === 'scissors') {
     ctx.save();
     ctx.translate(drawX + b.width / 2, drawY + b.height / 2);
     
     // 恢复原来的行为：让剪刀永远保持正向显示，不再跟随动物方向旋转
     
     ctx.fillStyle = 'rgba(255,255,255,0.95)';
     ctx.shadowColor = 'rgba(0,0,0,0.4)';
     ctx.shadowBlur = 6;
     ctx.beginPath();
     ctx.arc(0, 0, 26 * scale, 0, Math.PI*2); 
     ctx.fill();
     ctx.shadowColor = 'transparent'; 
     
     ctx.font = Math.floor(36 * scale) + 'px Arial';
     ctx.fillStyle = '#000';
     ctx.textAlign = 'center';
     ctx.textBaseline = 'middle';
     ctx.fillText('✂️', 0, 2 * scale);
     
     ctx.restore();
  }
}

function drawHome(ctx) {
  // 绘制标题
  ctx.fillStyle = '#2d3436';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('噜噜让一让', windowWidth / 2, windowHeight / 2 - 100);

  // 绘制副标题或关卡
  ctx.font = '20px Arial';
  ctx.fillStyle = '#636e72';
  ctx.fillText('当前: ' + (blocks.levelName || `第 ${currentLevelIndex + 1} 关`), windowWidth / 2, windowHeight / 2 - 40);

  // 绘制开始按钮阴影
  ctx.fillStyle = '#079e05';
  drawRoundRect(ctx, startButton.x, startButton.y + 6, startButton.width, startButton.height, 30);
  
  // 绘制开始按钮
  ctx.fillStyle = '#09BB07'; // 微信绿
  drawRoundRect(ctx, startButton.x, startButton.y, startButton.width, startButton.height, 30);
  
  ctx.fillStyle = 'white';
  ctx.font = 'bold 24px Arial';
  ctx.fillText(startButton.text, windowWidth / 2, startButton.y + startButton.height / 2);

  // 绘制排行榜按钮阴影
  ctx.fillStyle = '#d35400';
  drawRoundRect(ctx, rankButton.x, rankButton.y + 5, rankButton.width, rankButton.height, 25);
  
  // 绘制排行榜按钮
  ctx.fillStyle = '#e67e22'; // 橙色
  drawRoundRect(ctx, rankButton.x, rankButton.y, rankButton.width, rankButton.height, 25);
  
  ctx.fillStyle = 'white';
  ctx.font = 'bold 20px Arial';
  ctx.fillText(rankButton.text, windowWidth / 2, rankButton.y + rankButton.height / 2);
}

function drawRank(ctx) {
  // 绘制子域画布
  ctx.drawImage(sharedCanvas, 0, 0, windowWidth, windowHeight);
  
  // 绘制关闭按钮
  ctx.fillStyle = '#c0392b';
  drawRoundRect(ctx, closeRankButton.x, closeRankButton.y + 4, closeRankButton.width, closeRankButton.height, 20);
  ctx.fillStyle = '#e74c3c';
  drawRoundRect(ctx, closeRankButton.x, closeRankButton.y, closeRankButton.width, closeRankButton.height, 20);
  
  ctx.fillStyle = 'white';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(closeRankButton.text, windowWidth / 2, closeRankButton.y + closeRankButton.height / 2);
}

function loop() {
  let now = Date.now();
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
  
  if (gameState === 'HOME') {
    drawHome(context);
    requestAnimationFrame(loop);
    return;
  }

  if (gameState === 'RANK') {
    drawRank(context);
    requestAnimationFrame(loop);
    return;
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
        while (checkCollision(b, hitTarget)) {
          if (b.direction === 'up') b.y += 1;
          else if (b.direction === 'down') b.y -= 1;
          else if (b.direction === 'left') b.x += 1;
          else if (b.direction === 'right') b.x -= 1;
        }
        // 撞击后退回原位，而不是停在半路
        b.state = 'returning';
        b.trail = []; 
        
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
    draw3DAnimalBlock(context, b, now);
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
  if (gameState === 'PLAYING') {
    drawHomeButton(context);
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
