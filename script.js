    // ==================== 配置与默认值 ====================
    const DEFAULT_DATA = {
      name: '月月', petType: 'moon-cat', petAdopted: true, hunger: 80, energy: 70, clean: 75, intimacy: 65,
      exp: 350, gold: 1250, level: 3, lastDate: '', mood: 'calm', moodDate: '', moodRewardClaimed: true,
      goals: ['frontend','english','exercise'],
      achievements: {},
      // 自然行为新增字段（老存档自动用默认值补齐，不影响原有数据）
      lastTick: 0, sleeping: false, lastPet: 0, petCombo: 0, lastAmbient: 0, lastLowStatSpeech: 0,
    };
    const STORAGE_KEY = 'growthPetData';

    const SPEECHES = [
      '你来啦。','今天也慢慢来哦。','嗯，你在呀。',
      '可以摸摸我吗？','咕噜咕噜……','窗外的光挺好的。',
      '今天想做什么呢？','我在呢。','有点困了，眯一会儿。',
      '你的手好暖。','听到你回来，我尾巴动了一下。'
    ];
    const TIME_SPEECHES = {
      morning: ['早安。今天也慢慢开始吧。','你醒啦，我刚伸完懒腰。','早上好，早饭吃了没？'],
      noon: ['到饭点啦，记得吃午饭。','中午了，一起眯一会儿吧。','太阳正高，别忘了喝水。'],
      afternoon: ['下午的光有点暖，想打个盹。','我在窗边看了一会儿鸟。','这个时间，正好慢下来。'],
      evening: ['天快黑了，今天辛苦啦。','晚风有点凉，加件衣服吧。','月亮快出来了。'],
      night: ['还不睡吗？早点休息。','夜深了，我在。','困了就去睡吧，明天见。','这么晚了，别硬撑。']
    };
    const MOOD_SPEECHES = {
      happy:'你开心，我也开心。', calm:'这样静静待着，挺好。',
      sad:'难过的话，靠着我吧。', anxious:'先深呼吸，我在这儿。',
      angry:'消消气，我蹭蹭你。', tired:'累了就歇会儿。'
    };
    const INTIMACY_SPEECHES = {
      high:['有你在真好。','你一来，我就踏实了。','最喜欢你了。'],
      low:['我们……慢慢认识吧。','我有点认生。','你会一直对我好吗？']
    };
    const LOW_STAT_SPEECHES = {
      hunger:['肚子有点饿了。','有吃的吗？','该喂我啦。'],
      energy:['好困，撑不住了。','想睡了。','眼皮在打架。'],
      clean:['身上有点不舒服，想洗澡。','毛有点脏了。','帮我洗洗吧。']
    };
    const PET_REACT = {
      purr:['咕噜咕噜……','就是那里，舒服。','你的手好暖。','嗯，喜欢这样。','摸着摸着想睡了。'],
      annoyed:['好啦，别摸了。','够了哦。','哼，不理你了。','再摸要生气了。','毛都被你摸乱了。']
    };

    const ACTIONS = {
      feed:{ changes:{hunger:15}, speech:['吃饱了，谢谢。','这个好吃。','还要一点点。'], refuse:{when:d=>d.hunger>88, msg:['吃不下了。','已经很饱啦。']}, effect:'hearts', animation:'happy' },
      bath:{ changes:{clean:20}, speech:['洗得干干净净。','毛蓬起来了。','舒服，香香的。'], refuse:{when:d=>d.clean>90, msg:['我已经很干净啦。','不用洗。']}, effect:'bubbles', animation:'happy' },
      play:{ changes:{intimacy:12, energy:-10, hunger:-5}, speech:['它绕着你转圈。','抓到了，再来一次？','尾巴翘起来了。'], weak:{when:d=>d.energy<20, msg:['没力气了，不想动。','改天再玩吧。']}, effect:'stars', animation:'happy' },
      sleep:{ changes:{energy:25, hunger:-5}, speech:['它睡得很安心。','呼……呼……','蜷成一团，睡着了。'], effect:'zzz', animation:'sleep' },
      pet:{ changes:{intimacy:8}, speech:['它蹭了蹭你的手心。','咕噜咕噜，很享受。','眯起眼，很满足。'], effect:'hearts', animation:'happy' }
    };

    // ===== 自然行为工具：对话挑选 / 状态衰减 / 数字补间 =====
    let recentSpeeches = [];
    function rememberSpeech(s){ if(!s) return; recentSpeeches.push(s); while(recentSpeeches.length>6) recentSpeeches.shift(); }
    function pickFrom(arr){ if(!arr||!arr.length) return ''; const fresh=arr.filter(s=>recentSpeeches.includes(s)===false); const pool=fresh.length?fresh:arr; const c=pool[Math.floor(Math.random()*pool.length)]; rememberSpeech(c); return c; }
    function getTimeOfDay(){
      const h = new Date().getHours();
      if (h < 5)  return 'night';      // 0–4   深夜：不再误判成早上
      if (h < 11) return 'morning';    // 5–10  早上
      if (h < 14) return 'noon';       // 11–13 午间
      if (h < 18) return 'afternoon';  // 14–17 下午
      if (h < 22) return 'evening';    // 18–21 晚上
      return 'night';                  // 22–23 深夜
    }
    // 按优先级挑一句：危急状态 > 时段/心情 > 亲密度 > 通用，并避免立即重复
    function pickSpeech(data, opts){
      opts = opts || {};
      const pools = [];
      const lowKey = ['hunger','energy','clean'].find(k => (data[k]||0) < 30);
      if (lowKey) pools.push(LOW_STAT_SPEECHES[lowKey]);
      if (opts.pool) pools.push(opts.pool);
      if (opts.timeAware) pools.push(TIME_SPEECHES[getTimeOfDay()]);
      if (data.mood && MOOD_SPEECHES[data.mood]) pools.push([MOOD_SPEECHES[data.mood]]);
      pools.push((data.intimacy||0) >= 60 ? INTIMACY_SPEECHES.high : INTIMACY_SPEECHES.low);
      pools.push(SPEECHES);
      for (const pool of pools) {
        const fresh = pool.filter(s => !recentSpeeches.includes(s));
        const usePool = fresh.length ? fresh : pool;
        const c = usePool[Math.floor(Math.random()*usePool.length)];
        if (c) { rememberSpeech(c); return c; }
      }
      return SPEECHES[0];
    }
    function clampStat(v){ return Math.max(0, Math.min(100, Math.round(v))); }
    // 真实时间衰减：饱腹/精力/清洁随时间下降，睡觉时改为回精力
    const DECAY = { hunger:1/180, energy:1/240, clean:1/300, intimacy:1/900 };
    function applyDecay(data, now){
      const last = data.lastTick || now;
      const elapsed = Math.min(6*3600, Math.max(0, (now - last)/1000));
      if (data.sleeping) {
        data.energy = clampStat((data.energy||0) + elapsed*1.6);
        data.hunger = clampStat((data.hunger||0) - elapsed*DECAY.hunger*0.5);
        data.clean  = clampStat((data.clean||0)  - elapsed*DECAY.clean *0.5);
      } else {
        data.hunger   = clampStat((data.hunger||0)   - elapsed*DECAY.hunger);
        data.energy   = clampStat((data.energy||0)   - elapsed*DECAY.energy);
        data.clean    = clampStat((data.clean||0)    - elapsed*DECAY.clean);
        data.intimacy = clampStat((data.intimacy||0) - elapsed*DECAY.intimacy);
      }
      data.lastTick = now;
      return data;
    }
    // 数字补间（经验/金币滚动累加，不再瞬间跳变）
    function tweenNumber(el, to, dur){
      dur = dur || 550;
      const from = parseInt(el.textContent) || 0;
      if (from === to) return;
      const start = performance.now();
      if (el._tween) cancelAnimationFrame(el._tween);
      (function step(t){
        const p = Math.min(1, (t - start)/dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(from + (to - from)*eased);
        if (p < 1) el._tween = requestAnimationFrame(step);
      })(performance.now());
    }

    // ==================== 宠物信息库 ====================
    const PET_INFO = {
      'cloud-rabbit': { emoji: '🐰', name: '棉花糖', desc: '温柔敏感，会陪你慢慢变好。', reason: '你需要一个温柔、不催促你，但会一直陪着你的伙伴。', avatarClass: 'rabbit' },
      'sun-dog': { emoji: '🐶', name: '小太阳', desc: '热情活泼，会给你很多正能量。', reason: '你适合一个能带动你、鼓励你、让生活更有活力的伙伴。', avatarClass: 'dog' },
      'star-fox': { emoji: '🦊', name: '星野', desc: '聪明清醒，会监督你完成计划。', reason: '你需要一个清醒又聪明的伙伴，陪你制定计划、完成目标。', avatarClass: 'fox' },
      'moon-cat': { emoji: '🐱', name: '月月', desc: '安静神秘，会在夜晚陪你思考。', reason: '你适合一个安静陪伴型伙伴，在你焦虑或疲惫时陪着你。', avatarClass: 'cat' },
    };

    const ANSWER_TO_PET = { A: 'cloud-rabbit', B: 'sun-dog', C: 'star-fox', D: 'moon-cat' };
    const TIEBREAK_PRIORITY = ['C', 'A', 'D', 'B'];

    // ==================== 测试题数据 ====================
    const QUIZ_QUESTIONS = [
      { question: '周末有一天完全空闲，你最想做什么？', options: [{ key: 'A', text: '安静休息' }, { key: 'B', text: '看剧娱乐' }, { key: 'C', text: '学新东西' }, { key: 'D', text: '出门探索' }] },
      { question: '你希望宠物更像什么？', options: [{ key: 'A', text: '温柔陪伴者' }, { key: 'B', text: '活泼开心果' }, { key: 'C', text: '聪明监督者' }, { key: 'D', text: '安静守护者' }] },
      { question: '遇到困难时，你通常会？', options: [{ key: 'A', text: '先逃避一下' }, { key: 'B', text: '找人聊聊' }, { key: 'C', text: '查资料解决' }, { key: 'D', text: '自己硬撑' }] },
      { question: '你现在最想提升什么？', options: [{ key: 'A', text: '情绪稳定' }, { key: 'B', text: '生活自律' }, { key: 'C', text: '学习能力' }, { key: 'D', text: '身材健康' }] },
      { question: '你最需要宠物给你什么？', options: [{ key: 'A', text: '安慰' }, { key: 'B', text: '鼓励' }, { key: 'C', text: '计划' }, { key: 'D', text: '陪伴' }] },
    ];

    // ==================== DOM 元素引用 ====================
    const welcomePage = document.getElementById('welcomePage');
    const quizPage = document.getElementById('quizPage');
    const resultPage = document.getElementById('resultPage');
    const choicePage = document.getElementById('choicePage');
    const mainPage = document.getElementById('mainPage');
    const allPages = [welcomePage, quizPage, resultPage, choicePage, mainPage];

    const petNameInput = document.getElementById('petNameInput');
    const petSpeech = document.getElementById('petSpeech');
    const petArea = document.getElementById('petArea');
    const pet = document.getElementById('pet');
    const petEmojiDisplay = document.getElementById('petEmojiDisplay');
    const petIcon = document.getElementById('petIcon');
    const resetBtn = document.getElementById('resetBtn');

    const startQuizBtn = document.getElementById('startQuizBtn');
    const quizCard = document.getElementById('quizCard');
    const quizProgressText = document.getElementById('quizProgressText');
    const quizProgressFill = document.getElementById('quizProgressFill');
    const quizLabel = document.getElementById('quizLabel');
    const quizQuestion = document.getElementById('quizQuestion');
    const quizOptions = document.getElementById('quizOptions');

    const resultCard = document.getElementById('resultCard');
    const resultAvatar = document.getElementById('resultAvatar');
    const resultName = document.getElementById('resultName');
    const resultDesc = document.getElementById('resultDesc');
    const resultReason = document.getElementById('resultReason');
    const resultAdoptBtn = document.getElementById('resultAdoptBtn');
    const resultChooseBtn = document.getElementById('resultChooseBtn');

    const choiceGrid = document.getElementById('choiceGrid');

    const bars = {
      hunger:   { bar: document.getElementById('hungerBar'),   val: document.getElementById('hungerVal') },
      energy:   { bar: document.getElementById('energyBar'),   val: document.getElementById('energyVal') },
      clean:    { bar: document.getElementById('cleanBar'),    val: document.getElementById('cleanVal') },
      intimacy: { bar: document.getElementById('intimacyBar'), val: document.getElementById('intimacyVal') },
    };

    // 经验/金币 DOM
    const expValueEl = document.getElementById('expValue');
    const goldValueEl = document.getElementById('goldValue');

    // 等级/经验条 DOM
    const levelBadge = document.getElementById('levelBadge');
    const expBarFill = document.getElementById('expBarFill');
    const expBarText = document.getElementById('expBarText');

    // 日期显示 DOM
    const planDateEl = document.getElementById('planDate');

    // 心情按钮 DOM
    const moodButtonsEl = document.getElementById('moodButtons');

    // 成长目标 DOM
    const goalGridEl = document.getElementById('goalGrid');
    const goalSaveBtn = document.getElementById('goalSaveBtn');

    // 升级弹窗 DOM
    const levelupOverlay = document.getElementById('levelupOverlay');
    const levelupLevelText = document.getElementById('levelupLevelText');

    // 成就弹窗 DOM
    const achievementPopupOverlay = document.getElementById('achievementPopupOverlay');
    const achievementPopupTitle = document.getElementById('achievementPopupTitle');
    const achievementPopupDesc = document.getElementById('achievementPopupDesc');

    // 成就定义
    const ACHIEVEMENTS = {
      first_meeting: { name: '初次相遇', desc: '第一次领养宠物', icon: '🐾' },
      today_start:   { name: '今日启动', desc: '完成第一个今日任务', icon: '📌' },
      persistence:   { name: '小小坚持', desc: '完成 3 个今日任务', icon: '⭐' },
      close_friend:  { name: '亲密伙伴', desc: '亲密度达到 50', icon: '💞' },
      beginner:      { name: '成长新手', desc: '宠物达到 Lv.2', icon: '📈' },
      plan_master:   { name: '计划达人', desc: '完成全部今日任务', icon: '🎉' },
    };

    // ==================== 测试题状态 ====================
    let currentQuestionIndex = 0;
    let quizAnswers = [];

    // ==================== 数据管理 ====================
    function loadData() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return { ...DEFAULT_DATA, ...JSON.parse(saved) };
      } catch (e) { console.warn('数据加载失败，使用默认值', e); }
      return { ...DEFAULT_DATA };
    }

    function saveData(data) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
      catch (e) { console.warn('数据保存失败', e); }
    }

    // ==================== 页面切换 ====================
    function showPage(pageToShow) {
      allPages.forEach(p => p.classList.remove('active'));
      pageToShow.classList.add('active');
    }

    function checkAdoptStatus() {
      const data = loadData();
      if (data.petAdopted) {
        renderMainPage(data);
        showPage(mainPage);
      } else {
        showPage(welcomePage);
      }
    }

    // ==================== 主页面渲染 ====================
    function renderMainPage(data) {
      // 真实时间衰减：离开期间宠物也会饿/困/脏（跨刷新按时间差计算）
      data = applyDecay(data, Date.now());
      if (data.sleeping && (data.energy || 0) >= 95) data.sleeping = false;
      saveData(data);

      const petInfo = PET_INFO[data.petType] || PET_INFO['cloud-rabbit'];
      petEmojiDisplay.textContent = petInfo.emoji;
      petIcon.textContent = petInfo.emoji;
      petNameInput.value = data.name;
      renderBars(data);
      // 渲染经验和金币
      expValueEl.textContent = data.exp || 0;
      goldValueEl.textContent = data.gold || 0;
      // 渲染等级和经验条
      updateLevelAndExp(data.exp || 0);
      // 检查每日重置
      checkDailyReset();
      // 智能开场白：危急状态优先喊，否则按时段问候
      const lowKey = ['hunger','energy','clean'].find(k => (data[k]||0) < 30);
      petSpeech.textContent = lowKey ? pickFrom(LOW_STAT_SPEECHES[lowKey]) : pickSpeech(data, { timeAware:true });
      // 恢复睡眠状态（不再是固定唤醒）
      setSleeping(!!data.sleeping);
      // 恢复当天选择的心情
      renderSavedMood(data.mood || '');
      // 恢复已保存的成长目标
      renderSavedGoals(data.goals || []);
      // 恢复成就状态
      renderAchievements(data.achievements || {});
      // 检查成就解锁（新成就才弹窗）
      checkAchievements(data);
    }

    function getBarClass(value) {
      if (value > 70) return 'stat-health';
      if (value >= 30) return 'stat-warning';
      return 'stat-danger';
    }

    function renderBars(data) {
      ['hunger', 'energy', 'clean', 'intimacy'].forEach(key => {
        const value = data[key] || 0;
        const { bar, val } = bars[key];
        bar.style.width = value + '%';
        bar.className = 'stat-bar-fill ' + getBarClass(value);
        val.textContent = value;
      });
      // 同步侧栏小卡片的亲密度
      const miniText = document.getElementById('miniIntimacyText');
      const miniBar = document.getElementById('miniIntimacyBar');
      if (miniText) miniText.textContent = (data.intimacy || 0) + '/100';
      if (miniBar) miniBar.style.width = (data.intimacy || 0) + '%';
    }

    function updateSpeech(text) {
      petSpeech.textContent = text;
      petSpeech.classList.add('updated');
      setTimeout(() => petSpeech.classList.remove('updated'), 300);
    }

    // ==================== 成就系统 ====================
    // 渲染成就卡片状态（从 localStorage 恢复）
    function renderAchievements(achievements) {
      const grid = document.getElementById('achievementGrid');
      if (!grid) return;
      const cards = grid.querySelectorAll('.achievement-card');
      const keys = Object.keys(ACHIEVEMENTS);
      cards.forEach((card, i) => {
        const key = keys[i];
        if (!key) return;
        const iconEl = card.querySelector('.achievement-icon');
        if (iconEl) iconEl.textContent = ACHIEVEMENTS[key].icon;
        if (achievements && achievements[key]) {
          card.classList.remove('locked');
          card.classList.add('unlocked');
        } else {
          card.classList.remove('unlocked');
          card.classList.add('locked');
        }
      });
    }

    // 解锁单个成就
    function unlockAchievement(key) {
      const data = loadData();
      if (!data.achievements) data.achievements = {};
      if (data.achievements[key]) return; // 已解锁，不重复

      data.achievements[key] = true;
      saveData(data);

      // 更新 UI
      renderAchievements(data.achievements);

      // 显示弹窗
      const ach = ACHIEVEMENTS[key];
      if (!ach) return;
      achievementPopupTitle.textContent = ach.name;
      achievementPopupDesc.textContent = ach.desc;
      document.querySelector('.achievement-popup-emoji').textContent = ach.icon;
      achievementPopupOverlay.classList.add('show');

      // 3 秒后自动关闭
      setTimeout(() => {
        achievementPopupOverlay.classList.remove('show');
      }, 3000);
    }

    // 检查所有成就条件
    function checkAchievements(data) {
      if (!data.achievements) data.achievements = {};

      // 1. 初次相遇：petAdopted 为 true
      if (data.petAdopted) unlockAchievement('first_meeting');

      // 2. 今日启动：今天完成至少 1 个任务
      const completedCount = (dailyTasks || []).filter(t => t.completed).length;
      if (completedCount >= 1) unlockAchievement('today_start');

      // 3. 小小坚持：今天完成至少 3 个任务
      if (completedCount >= 3) unlockAchievement('persistence');

      // 4. 亲密伙伴：亲密度达到 50
      if ((data.intimacy || 0) >= 50) unlockAchievement('close_friend');

      // 5. 成长新手：宠物达到 Lv.2
      if (getLevel(data.exp || 0) >= 2) unlockAchievement('beginner');

      // 6. 计划达人：完成全部任务
      const totalTasks = (dailyTasks || []).length;
      if (totalTasks > 0 && completedCount >= totalTasks) unlockAchievement('plan_master');
    }

    // ==================== 推荐逻辑 ====================
    function calculateRecommendation(answers) {
      const counts = { A: 0, B: 0, C: 0, D: 0 };
      answers.forEach(a => { if (counts[a] !== undefined) counts[a]++; });
      const maxCount = Math.max(counts.A, counts.B, counts.C, counts.D);
      for (const letter of TIEBREAK_PRIORITY) {
        if (counts[letter] === maxCount) return ANSWER_TO_PET[letter];
      }
      return 'cloud-rabbit';
    }

    function showResult() {
      const petType = calculateRecommendation(quizAnswers);
      const petInfo = PET_INFO[petType];
      resultAvatar.textContent = petInfo.emoji;
      resultAvatar.className = 'result-pet-avatar ' + petInfo.avatarClass;
      resultName.textContent = petInfo.name;
      resultDesc.textContent = petInfo.desc;
      resultReason.textContent = petInfo.reason;
      showPage(resultPage);
    }

    // ==================== 领养保存 ====================
    function adoptPet(petType) {
      const petInfo = PET_INFO[petType];
      if (!petInfo) return;
      const currentData = loadData();
      currentData.petType = petType;
      currentData.petAdopted = true;
      currentData.name = petInfo.name;
      saveData(currentData);
      renderMainPage(currentData);
      showPage(mainPage);
    }

    // ==================== 测试题逻辑 ====================
    function startQuiz() {
      currentQuestionIndex = 0;
      quizAnswers = [];
      renderQuestion();
      showPage(quizPage);
    }

    function renderQuestion() {
      const q = QUIZ_QUESTIONS[currentQuestionIndex];
      const total = QUIZ_QUESTIONS.length;
      const current = currentQuestionIndex + 1;

      quizProgressText.textContent = `第 ${current} / ${total} 题`;
      quizProgressFill.style.width = (current / total * 100) + '%';
      quizLabel.textContent = `QUESTION ${current}`;
      quizQuestion.textContent = q.question;
      quizOptions.innerHTML = '';

      quizCard.classList.remove('slide-in');
      void quizCard.offsetWidth;
      quizCard.classList.add('slide-in');

      q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.innerHTML = `<span class="quiz-option-letter">${opt.key}</span><span class="quiz-option-text">${opt.text}</span>`;

        btn.addEventListener('click', () => {
          quizAnswers.push(opt.key);
          btn.style.borderColor = '#ff9a9e';
          btn.style.background = 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%)';

          setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex < total) {
              renderQuestion();
            } else {
              showResult();
            }
          }, 200);
        });

        quizOptions.appendChild(btn);
      });
    }

    // ==================== 自由选择页面 ====================
    function showChoicePage() {
      choiceGrid.innerHTML = '';
      Object.entries(PET_INFO).forEach(([type, info]) => {
        const card = document.createElement('div');
        card.className = 'choice-pet-card';
        card.innerHTML = `
          <div class="choice-pet-emoji">${info.emoji}</div>
          <div class="choice-pet-name">${info.name}</div>
          <div class="choice-pet-desc">${info.desc}</div>
          <button class="choice-pet-btn ${info.avatarClass}" data-pet-type="${type}">选择它</button>
        `;
        const selectBtn = card.querySelector('.choice-pet-btn');
        selectBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          adoptPet(type);
        });
        choiceGrid.appendChild(card);
      });
      showPage(choicePage);
    }

    // ==================== 特效系统 ====================
    function spawnEffect(type) {
      const count = 6;
      const emojis = {
        hearts: ['💖', '💕', '💗', '❤️', '🩷', '💝'],
        bubbles: ['🫧', '✨', '💧', '🫧', '✨', '💫'],
        stars: ['⭐', '✨', '💫', '🌟', '⚡', '💥'],
      };
      const list = emojis[type] || emojis.hearts;

      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const particle = document.createElement('div');
          particle.className = 'effect-particle';
          particle.textContent = list[Math.floor(Math.random() * list.length)];
          const rect = petArea.getBoundingClientRect();
          const x = Math.random() * rect.width;
          const y = Math.random() * rect.height * 0.6 + rect.height * 0.2;
          particle.style.left = x + 'px';
          particle.style.top = y + 'px';
          particle.style.fontSize = (16 + Math.random() * 12) + 'px';
          petArea.appendChild(particle);
          setTimeout(() => particle.remove(), 1000);
        }, i * 100);
      }
    }

    // ==================== 互动按钮逻辑 ====================
    function doAction(actionKey) {
      const action = ACTIONS[actionKey];
      if (!action) return;
      let data = loadData();

      // 睡觉是状态切换：再点一次=醒；精力回满也会自然醒
      if (actionKey === 'sleep') {
        if (data.sleeping) {
          data.sleeping = false; saveData(data); setSleeping(false);
          updateSpeech(pickFrom(['醒啦，伸个懒腰。','再让我睡会儿嘛。','精神多了。']));
        } else {
          data.sleeping = true; saveData(data); setSleeping(true);
          updateSpeech(pickFrom(action.speech));
        }
        return;
      }

      // 其它照顾动作会先把猫唤醒
      if (data.sleeping) { data.sleeping = false; setSleeping(false); saveData(data); }

      // 像真猫一样会拒绝：吃饱了不再吃、已经很干净不再洗
      if (action.refuse && action.refuse.when(data)) {
        updateSpeech(pickFrom(action.refuse.msg));
        playPetAnimation('happy');
        return;
      }
      // 状态疲弱时效果打折：太累还玩，亲密度收益减半且不同台词
      const weak = !!(action.weak && action.weak.when(data));

      const changes = Object.assign({}, action.changes);
      if (weak && changes.intimacy) changes.intimacy = Math.round(changes.intimacy / 2);
      for (const [key, delta] of Object.entries(changes)) {
        data[key] = clampStat((data[key] || 0) + delta);
      }
      saveData(data);
      renderBars(data);
      updateSpeech(weak ? pickFrom(action.weak.msg) : pickFrom(action.speech));
      if (action.effect !== 'zzz') spawnEffect(action.effect);
      playPetAnimation(action.animation);
      // 检查成就解锁
      checkAchievements(data);
    }

    function playPetAnimation(type) {
      pet.classList.remove('bouncing', 'happy', 'sleeping');
      if (type === 'happy') {
        void pet.offsetWidth;
        pet.classList.add('happy');
        setTimeout(() => pet.classList.remove('happy'), 800);
      }
    }

    function setSleeping(sleeping) {
      pet.classList.toggle('sleeping', sleeping);
    }

    // ==================== 今日成长计划逻辑 ====================

    // 各成长目标对应的任务模板
    const GOAL_TASKS = {
      frontend: [
        { name: '学习 HTML/CSS/JS 30 分钟', exp: 30, gold: 20 },
        { name: '完成一个小页面练习', exp: 25, gold: 15 },
      ],
      english: [
        { name: '背单词 20 个', exp: 20, gold: 15 },
        { name: '听力练习 20 分钟', exp: 20, gold: 15 },
      ],
      exercise: [
        { name: '快走或跳操 20 分钟', exp: 25, gold: 15 },
        { name: '拉伸 10 分钟', exp: 15, gold: 10 },
      ],
      sleep: [
        { name: '23:30 前准备睡觉', exp: 20, gold: 15 },
        { name: '明天起床后打卡', exp: 15, gold: 10 },
      ],
      organize: [
        { name: '整理桌面 10 分钟', exp: 15, gold: 10 },
        { name: '清理一个文件夹或相册', exp: 15, gold: 10 },
      ],
      emotion: [
        { name: '写下今天的情绪', exp: 10, gold: 10 },
        { name: '做 3 分钟深呼吸', exp: 10, gold: 10 },
      ],
    };

    // 默认任务（没有选择目标时）
    const DEFAULT_TASKS = [
      { name: '前端学习 30 分钟', exp: 30, gold: 20 },
      { name: '英语学习 20 分钟', exp: 20, gold: 15 },
      { name: '运动 20 分钟', exp: 25, gold: 15 },
      { name: '整理房间 10 分钟', exp: 10, gold: 10 },
    ];

    // 每日任务 DOM
    const planListEl = document.getElementById('planList');

    // 根据用户目标生成任务列表（最多 4 个）
    function generateTasks(goals) {
      if (!goals || goals.length === 0) {
        return DEFAULT_TASKS.map(t => ({ ...t, completed: false }));
      }
      // 从不同目标轮流取任务组合
      const tasks = [];
      const goalOrder = [...goals];
      let idx = 0;
      while (tasks.length < 4) {
        const goal = goalOrder[idx % goalOrder.length];
        const template = GOAL_TASKS[goal];
        if (!template) break;
        const taskIdx = Math.floor(tasks.length / goalOrder.length);
        if (taskIdx < template.length) {
          tasks.push({ ...template[taskIdx], completed: false });
        } else {
          // 目标的所有任务取完了，跳过
        }
        idx++;
        // 如果遍历了一圈没有新增任务，说明全部取完
        if (tasks.length === 0 || idx >= goalOrder.length * 2) {
          // 不足 4 个，用默认任务补齐
          for (const dt of DEFAULT_TASKS) {
            if (tasks.length >= 4) break;
            if (!tasks.find(t => t.name === dt.name)) {
              tasks.push({ ...dt, completed: false });
            }
          }
          break;
        }
      }
      return tasks.slice(0, 4);
    }

    // 当前任务列表（运行时）
    let dailyTasks = [];

    // 渲染任务列表到页面
    function renderPlanList() {
      planListEl.innerHTML = '';
      dailyTasks.forEach((task, i) => {
        const div = document.createElement('div');
        div.className = 'plan-task' + (task.completed ? ' completed' : '');
        div.dataset.taskIndex = i;
        div.innerHTML = `
          <div class="plan-task-left">
            <div class="plan-task-name">${task.name}</div>
            <div class="plan-task-reward">奖励经验 +${task.exp} 金币 +${task.gold}</div>
          </div>
          <button class="plan-task-btn">${task.completed ? '✅ 已完成' : '完成'}</button>
        `;
        if (task.completed) {
          div.querySelector('.plan-task-btn').classList.add('done');
        }
        planListEl.appendChild(div);
      });
      updatePlanProgress();
    }

    // 更新进度显示
    function updatePlanProgress() {
      const doneCount = dailyTasks.filter(t => t.completed).length;
      const total = dailyTasks.length || 1;
      document.getElementById('planProgressText').textContent = `今日完成：${doneCount} / ${total}`;
      document.getElementById('planProgressFill').style.width = (doneCount / total * 100) + '%';
    }

    // 保存今日任务到 localStorage
    function saveDailyTasks() {
      const data = loadData();
      data.dailyTasks = dailyTasks;
      saveData(data);
    }

    // 根据目标生成并显示今日计划
    function buildTodayPlan(goals) {
      dailyTasks = generateTasks(goals);
      saveDailyTasks();
      renderPlanList();
    }

    // 增加经验并更新显示
    function addExp(amount) {
      const data = loadData();
      const oldLevel = getLevel(data.exp || 0);
      data.exp = (data.exp || 0) + amount;
      const newLevel = getLevel(data.exp);
      data.level = newLevel;
      saveData(data);
      tweenNumber(expValueEl, data.exp);
      updateLevelAndExp(data.exp);
      bumpValue(expValueEl);

      // 升级时播放庆祝动画
      if (newLevel > oldLevel) {
        showLevelUpAnimation(newLevel);
        // 升级后检查成就
        checkAchievements(data);
      }
    }

    // 增加金币并更新显示
    function addGold(amount) {
      const data = loadData();
      data.gold = (data.gold || 0) + amount;
      saveData(data);
      tweenNumber(goldValueEl, data.gold);
      bumpValue(goldValueEl);
    }

    // 数值变化弹跳动画
    function bumpValue(el) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
      setTimeout(() => el.classList.remove('bump'), 350);
    }

    // 根据总经验计算等级
    function getLevel(exp) {
      return Math.floor(exp / 100) + 1;
    }

    // 当前等级内的经验进度（0-99）
    function getExpInLevel(exp) {
      return exp % 100;
    }

    // 更新等级和经验条显示
    function updateLevelAndExp(exp) {
      const level = getLevel(exp);
      const currentExp = getExpInLevel(exp);
      levelBadge.textContent = `Lv.${level}`;
      expBarFill.style.width = currentExp + '%';
      expBarText.textContent = `${currentExp}/100`;
    }

    // 显示升级庆祝动画
    function showLevelUpAnimation(newLevel) {
      // 设置等级文字
      levelupLevelText.textContent = `Lv.${newLevel}`;

      // 显示弹窗
      levelupOverlay.classList.add('show');

      // 播放星星粒子特效
      spawnEffect('stars');
      setTimeout(() => spawnEffect('stars'), 400);

      // 宠物开心动画
      playPetAnimation('happy');

      // 3秒后自动消失
      setTimeout(() => {
        levelupOverlay.classList.remove('show');
      }, 3000);
    }

    // 获取今天的日期字符串 YYYY-MM-DD
    function getTodayStr() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // 检查并执行每日重置
    function checkDailyReset() {
      const today = getTodayStr();
      const data = loadData();

      // 保存今天日期
      if (data.lastDate !== today) {
        // 新的一天，重置所有每日状态
        data.mood = '';
        data.moodDate = '';
        data.moodRewardClaimed = false;
        saveData(data);
        resetMoodUI();
        // 重新生成今日任务
        buildTodayPlan(data.goals || []);
      } else {
        // 同一天，恢复已保存的任务状态
        dailyTasks = data.dailyTasks || [];
        renderPlanList();
      }

      // 显示今天日期
      planDateEl.textContent = today;

      // 更新保存的日期
      data.lastDate = today;
      saveData(data);

      // 同步 hero 区日期显示
      const heroDate = document.getElementById('heroDateText');
      if (heroDate) {
        const d = new Date();
        heroDate.textContent = d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日';
      }
    }

    // ==================== 今日心情逻辑 ====================

    // 心情回应文案
    const MOOD_RESPONSES = {
      happy: '太好了，看到你开心我也开心。',
      calm: '平静的一天也很好，不急。',
      sad: '难过也没关系，我陪着你。',
      anxious: '先深呼吸，不用一下子做完，慢慢来。',
      angry: '别急，先缓一缓。',
      tired: '辛苦了，今天就慢一点吧。',
    };

    // 重置心情按钮 UI
    function resetMoodUI() {
      moodButtonsEl.querySelectorAll('.mood-btn').forEach(btn => {
        btn.classList.remove('selected');
      });
    }

    // 渲染保存的心情状态
    function renderSavedMood(mood) {
      resetMoodUI();
      if (mood) {
        const btn = moodButtonsEl.querySelector(`[data-mood="${mood}"]`);
        if (btn) btn.classList.add('selected');
      }
    }

    // 选择心情
    function selectMood(moodKey) {
      const data = loadData();

      // 更新选中状态
      renderSavedMood(moodKey);

      // 更新宠物话语
      updateSpeech(MOOD_RESPONSES[moodKey] || '');

      // 保存心情到 localStorage
      data.mood = moodKey;
      data.moodDate = getTodayStr();

      // 每天只能获得一次心情属性奖励
      // 如果今天已经领取过，只更新文字，不加属性
      if (!data.moodRewardClaimed) {
        // 根据心情类型增加对应属性
        const moodBonuses = {
          happy:   { intimacy: 5 },
          calm:    { energy: 5 },
          sad:     { intimacy: 8 },
          anxious: { energy: 5, intimacy: 5 },
          angry:   { intimacy: 5 },
          tired:   { energy: 10 },
        };
        const bonus = moodBonuses[moodKey] || {};
        for (const [key, delta] of Object.entries(bonus)) {
          data[key] = Math.min(100, (data[key] || 0) + delta);
        }
        data.moodRewardClaimed = true;
        saveData(data);
        renderBars(data);
        playPetAnimation('happy');
      } else {
        // 重复切换，只保存心情，不加属性
        saveData(data);
      }
    }

    // 绑定心情按钮点击事件
    moodButtonsEl.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectMood(btn.dataset.mood);
      });
    });

    // ==================== 成长目标逻辑 ====================

    // 渲染已保存的目标选中状态
    function renderSavedGoals(goals) {
      goalGridEl.querySelectorAll('.goal-card').forEach(card => {
        const goal = card.dataset.goal;
        card.classList.toggle('selected', goals.includes(goal));
      });
    }

    // 保存目标
    function saveGoals() {
      const selectedGoals = [];
      goalGridEl.querySelectorAll('.goal-card.selected').forEach(card => {
        selectedGoals.push(card.dataset.goal);
      });
      const data = loadData();

      // 如果目标有变化，询问是否重新生成今日计划
      const oldGoals = data.goals || [];
      const goalsChanged = JSON.stringify(oldGoals.sort()) !== JSON.stringify(selectedGoals.sort());

      data.goals = selectedGoals;

      if (goalsChanged && oldGoals.length > 0) {
        if (confirm('目标已更新，是否重新生成今日成长计划？')) {
          dailyTasks = generateTasks(selectedGoals);
          data.dailyTasks = dailyTasks;
          saveData(data);
          renderPlanList();
        }
      }

      saveData(data);
      updateSpeech('目标记下啦。');
    }

    // 绑定目标卡片点击（选中/取消）
    goalGridEl.querySelectorAll('.goal-card').forEach(card => {
      card.addEventListener('click', () => {
        card.classList.toggle('selected');
      });
    });

    // 绑定保存按钮
    goalSaveBtn.addEventListener('click', () => {
      saveGoals();
    });

    // 绑定任务按钮点击事件（事件委托到 planList）
    planListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.plan-task-btn');
      if (!btn) return;
      const card = btn.closest('.plan-task');
      const index = parseInt(card.dataset.taskIndex);

      // 如果已经完成，不重复执行
      if (dailyTasks[index] && dailyTasks[index].completed) return;

      // 标记为已完成
      dailyTasks[index].completed = true;
      saveDailyTasks();

      // 按钮和卡片变样式
      btn.classList.add('done');
      btn.textContent = '✅ 已完成';
      card.classList.add('completed');

      // 增加经验和金币
      const task = dailyTasks[index];
      addExp(task.exp);
      addGold(task.gold);

      // 亲密度 +5
      const data = loadData();
      data.intimacy = Math.min(100, (data.intimacy || 0) + 5);
      saveData(data);
      renderBars(data);

      // 宠物说话
      updateSpeech('完成啦，干得好。');

      // 星星特效
      spawnEffect('stars');

      // 宠物开心动画
      playPetAnimation('happy');

      // 更新进度
      updatePlanProgress();

      // 检查成就解锁
      const data2 = loadData();
      checkAchievements(data2);
    });

    // ==================== 事件绑定 ====================
    startQuizBtn.addEventListener('click', startQuiz);

    resultAdoptBtn.addEventListener('click', () => {
      adoptPet(calculateRecommendation(quizAnswers));
    });

    resultChooseBtn.addEventListener('click', () => {
      showChoicePage();
    });

    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action) {
          doAction(action);
          const ripple = document.createElement('span');
          ripple.className = 'btn-ripple';
          ripple.style.cssText = 'left:50%;top:50%;width:40px;height:40px;margin-left:-20px;margin-top:-20px;';
          btn.appendChild(ripple);
          setTimeout(() => ripple.remove(), 500);
        }
      });
    });

    // 商店购买：扣金币、加属性、给反馈
    document.querySelectorAll('.shop-item').forEach(item => {
      item.addEventListener('click', () => {
        const stat = item.dataset.stat;
        const amount = parseInt(item.dataset.amount, 10) || 0;
        const cost = parseInt(item.dataset.cost, 10) || 0;
        let data = loadData();
        if ((data.gold || 0) < cost) {
          updateSpeech(pickFrom(['金币不太够呢。','还差一点点金币。']));
          return;
        }
        data.gold = (data.gold || 0) - cost;
        if (stat) data[stat] = clampStat((data[stat] || 0) + amount);
        saveData(data);
        tweenNumber(goldValueEl, data.gold);
        renderBars(data);
        updateSpeech(pickFrom(['谢谢你！','好开心，谢谢。','嘿嘿，喜欢。']));
        spawnEffect('hearts');
        playPetAnimation('happy');
        checkAchievements(data);
      });
    });

    // 尚未上线的入口：给个温柔的回应，而不是静默无反应
    document.querySelectorAll('[data-soon]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        updateSpeech(pickFrom(['这个还没准备好哦。','再等等我呀。','很快就会有的。']));
      });
    });

    petArea.addEventListener('click', (e) => {
      let data = loadData();
      // 睡着时点一下 = 轻轻唤醒（不再无响应）
      if (data.sleeping || pet.classList.contains('sleeping')) {
        data.sleeping = false; saveData(data); setSleeping(false);
        updateSpeech(pickFrom(['唔……醒啦？','被你弄醒了。','再让我睡会儿。']));
        return;
      }
      const now = Date.now();
      // 连击combo：1.3秒内连续摸累加，超过5次猫会烦
      data.petCombo = (now - (data.lastPet || 0) < 1300) ? (data.petCombo || 0) + 1 : 1;
      data.lastPet = now;

      if (data.petCombo > 5) {
        // 摸太频繁 → 烦躁，亲密度 -1
        data.intimacy = clampStat((data.intimacy || 0) - 1);
        saveData(data); renderBars(data);
        updateSpeech(pickFrom(PET_REACT.annoyed));
        pet.classList.remove('bouncing','happy'); void pet.offsetWidth;
        pet.classList.add('happy'); setTimeout(() => pet.classList.remove('happy'), 500);
        checkAchievements(data);
        return;
      }
      // 正常抚摸 → 咕噜咕噜 + 亲密度 +1
      pet.classList.remove('bouncing','happy'); void pet.offsetWidth;
      pet.classList.add('bouncing'); setTimeout(() => pet.classList.remove('bouncing'), 500);
      spawnEffect('hearts');
      if (data.intimacy < 100) data.intimacy = clampStat((data.intimacy || 0) + 1);
      saveData(data); renderBars(data);
      updateSpeech(pickFrom(PET_REACT.purr));
      checkAchievements(data);
    });

    petNameInput.addEventListener('change', () => {
      let data = loadData();
      const newName = petNameInput.value.trim();
      if (newName) { data.name = newName; saveData(data); }
      else { petNameInput.value = data.name; }
    });

    resetBtn.addEventListener('click', () => {
      if (confirm('确定重置吗？这会清空所有进度，无法恢复。')) {
        localStorage.removeItem(STORAGE_KEY);
        setSleeping(false);
        quizAnswers = [];
        currentQuestionIndex = 0;
        dailyTasks = [];
        // 重置心情
        resetMoodUI();
        // 重置目标
        goalGridEl.querySelectorAll('.goal-card').forEach(card => {
          card.classList.remove('selected');
        });
        checkAdoptStatus();
      }
    });

    // ===== Real photo kitten subtle motion =====
    function setupRealPhotoCatMotion() {
      if (!petArea || !pet) return;
      let raf = null;
      const maxX = 7;
      const maxY = 4;
      const maxR = 1.2;
      function resetLook() {
        petArea.style.setProperty('--look-x', '0px');
        petArea.style.setProperty('--look-y', '0px');
        petArea.style.setProperty('--look-r', '0deg');
      }
      petArea.addEventListener('mousemove', (event) => {
        const rect = petArea.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const nx = Math.max(-1, Math.min(1, (event.clientX - cx) / (rect.width / 2)));
        const ny = Math.max(-1, Math.min(1, (event.clientY - cy) / (rect.height / 2)));
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          petArea.style.setProperty('--look-x', (nx * maxX).toFixed(1) + 'px');
          petArea.style.setProperty('--look-y', (ny * maxY).toFixed(1) + 'px');
          petArea.style.setProperty('--look-r', (nx * maxR).toFixed(2) + 'deg');
        });
      });
      petArea.addEventListener('mouseleave', resetLook);
      function randomBlink() {
        if (pet.classList.contains('sleeping')) {
          setTimeout(randomBlink, 1800 + Math.random() * 2200);
          return;
        }
        pet.classList.add('blinking');
        setTimeout(() => pet.classList.remove('blinking'), 220);
        setTimeout(randomBlink, 3600 + Math.random() * 5200);
      }
      setTimeout(randomBlink, 1600);
    }

    // ==================== 生命循环：随时间衰减 + 自然醒 + 自言自语 ====================
    function startLifeLoop() {
      setInterval(() => {
        let data = loadData();
        if (!data.petAdopted) return;
        const now = Date.now();

        // 睡够了自然醒（精力回满）
        if (data.sleeping && (data.energy || 0) >= 95) {
          data.sleeping = false; saveData(data); setSleeping(false);
          updateSpeech(pickFrom(['醒啦，精神多了。','睡得真香。']));
        }

        data = applyDecay(data, now);
        saveData(data);
        renderBars(data);

        // 饿/困/脏时主动提醒（60s 节流，不刷屏）
        const lowKey = ['hunger','energy','clean'].find(k => (data[k]||0) < 30);
        if (lowKey && !data.sleeping && now - (data.lastLowStatSpeech || 0) > 60000) {
          data.lastLowStatSpeech = now; saveData(data);
          updateSpeech(pickFrom(LOW_STAT_SPEECHES[lowKey]));
          return;
        }
        // 状态良好时偶尔自言自语（约 60~90s 一次），显得它真的活着
        if (!data.sleeping && (data.hunger||0) >= 30 && (data.energy||0) >= 30 && (data.clean||0) >= 30
            && now - (data.lastAmbient || 0) > 60000 && Math.random() < 0.5) {
          data.lastAmbient = now; saveData(data);
          updateSpeech(pickSpeech(data, { timeAware:true }));
        }
      }, 30000);
    }

    // ==================== 初始化 ====================
    setupRealPhotoCatMotion();
    startLifeLoop();
    checkAdoptStatus();
