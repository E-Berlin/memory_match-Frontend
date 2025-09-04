/* ====== 全局状态 ====== */
let username = "";
let users = {};          // 本地“账号-密码”
let records = [];        // 排行榜：{ username, ms }
let firstCard = null;
let lockBoard = false;
let startTime = 0;
let timerInterval = null;

/* ====== 工具：格式化毫秒 -> 00:00:00（分:秒:百分秒） ====== */
function formatMs(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const hundredths = Math.floor((ms % 1000) / 10);
    const m = String(minutes).padStart(2, "0");
    const s = String(seconds).padStart(2, "0");
    const h = String(hundredths).padStart(2, "0");
    return `${m}:${s}:${h}`;
}

/* ====== 账号 ====== */
document.getElementById("registerBtn").addEventListener("click", () => {
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value;

    fetch("https://memory-match-backend.onrender.com/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass })
    })
        .then(res => res.json())
        .then(data => {
            document.getElementById("login-msg").innerText = data.msg;
        });
});

document.getElementById("loginBtn").addEventListener("click", () => {
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value;

    fetch("https://memory-match-backend.onrender.com/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass })
    })
        .then(res => res.json())
        .then(data => {
            document.getElementById("login-msg").innerText = data.msg;
            if (data.success) {
                username = user;
                document.getElementById("login-box").style.display = "none";
                document.getElementById("game-box").style.display = "block";
                updateLeaderboard();
            }
        });
});

/* ====== 开始游戏 ====== */
document.getElementById("startBtn").addEventListener("click", startGame);

function startGame() {
    // 清状态
    firstCard = null;
    lockBoard = false;

    // 计时清零 + 启动
    const scoreDiv = document.getElementById("score");
    scoreDiv.innerText = "用时: 00:00:00";
    scoreDiv.style.color = "#000";
    startTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        scoreDiv.innerText = `用时: ${formatMs(elapsed)}`;
    }, 50);

    // 生成牌
    const numbers = Array.from({ length: 8 }, (_, i) => i + 1).flatMap(n => [n, n]);
    numbers.sort(() => Math.random() - 0.5);

    const boardDiv = document.getElementById("board");
    boardDiv.innerHTML = "";

    numbers.forEach((num, i) => {
        const card = document.createElement("div");
        card.className = "card";
        card.dataset.num = num;
        card.dataset.index = i;

        // 双面结构
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front"></div>
                <div class="card-back"><span class="num">${num}</span></div>
            </div>
        `;

        card.addEventListener("click", flipCard);
        boardDiv.appendChild(card);
    });
}

function flipCard() {
    if (this.classList.contains("flipped") || lockBoard) return;

    this.classList.add("flipped");

    if (!firstCard) {
        firstCard = this;
        return;
    }

    // 第二张
    if (firstCard.dataset.num === this.dataset.num) {
        // 匹配成功
        firstCard = null;
        checkGameEnd();
    } else {
        // 不匹配：锁板 + 回翻
        lockBoard = true;
        const prev = firstCard; // 保存引用，避免 setTimeout 中 firstCard 被改成 null
        setTimeout(() => {
            this.classList.remove("flipped");
            prev.classList.remove("flipped");
            firstCard = null;
            lockBoard = false;
        }, 800);
    }
}

/* ====== 结束判定 ====== */
function checkGameEnd() {
    // 所有牌都翻开了吗？
    if (document.querySelectorAll(".card:not(.flipped)").length === 0) {
        if (timerInterval) clearInterval(timerInterval);

        const elapsedMs = Date.now() - startTime;

        // 保护：没有登录名时给个占位
        const name = username || "Guest";

        // 写入排行榜
        records.push({ username: name, ms: elapsedMs });
        records.sort((a, b) => a.ms - b.ms);

        // 显示最终成绩
        document.getElementById("score").innerText = `用时: ${formatMs(elapsedMs)}`;

        fetch("https://memory-match-backend.onrender.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, ms: elapsedMs })
        })
            // 刷新榜
            .then(() => updateLeaderboard());
    }
}

/* ====== 排行榜 ====== */
function updateLeaderboard() {
    fetch("https://memory-match-backend.onrender.com/leaderboard")
        .then(res => res.json())
        .then(data => {
            const lb = document.getElementById("leaderboard");
            lb.innerHTML = "";
            data.forEach((item, i) => {
                const li = document.createElement("li");
                li.innerText = `${i + 1}. ${item.username} 用时: ${formatMs(item.ms)}`;
                lb.appendChild(li);
            });
        });
}

// ================== 动态背景（山 + 云） ==================
const canvas = document.getElementById("mountain-canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let t = 0;

// 初始化一些云
const clouds = [];
for (let i = 0; i < 5; i++) {
    clouds.push({
        x: Math.random() * canvas.width,
        y: Math.random() * 150 + 30, // 高度范围
        speed: Math.random() * 0.3 + 0.2,
        size: Math.random() * 40 + 40
    });
}

function drawCloud(cloud) {
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (let i = 0; i < 5; i++) {
        let offsetX = Math.cos(i) * cloud.size * 0.6;
        let offsetY = Math.sin(i) * cloud.size * 0.2;
        ctx.ellipse(cloud.x + offsetX, cloud.y + offsetY, cloud.size, cloud.size * 0.6, 0, 0, Math.PI * 2);
    }
    ctx.fill();
}

function drawMountains() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制云
    clouds.forEach(cloud => {
        drawCloud(cloud);
        cloud.x += cloud.speed;
        if (cloud.x - cloud.size > canvas.width) {
            cloud.x = -cloud.size;
            cloud.y = Math.random() * 150 + 30;
        }
    });

    // 多层山峦
    drawLayer("#555", 150, 0.002, 80);
    drawLayer("#888", 100, 0.003, 50);
    drawLayer("#bbb", 60, 0.004, 30);

    t += 0.01;
    requestAnimationFrame(drawMountains);
}

function drawLayer(color, baseHeight, speed, amplitude) {
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);

    for (let x = 0; x <= canvas.width; x += 10) {
        let y = canvas.height - baseHeight
            - Math.sin((x * 0.01) + (t * speed * 200)) * amplitude;
        ctx.lineTo(x, y);
    }

    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
}

drawMountains();