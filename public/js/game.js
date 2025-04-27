// Hàm lấy thông tin người dùng
let balance = 0;
async function fetchUser_Info() {
    try {
        const response = await fetch('/user-info', { method: 'GET', credentials: 'include' });
        if (!response.ok) throw new Error('Không thể lấy thông tin người dùng');
        const data = await response.json();
        document.getElementById('balance').textContent = data.balance.toLocaleString();
        balance = data.balance;
        const usernameElement = document.getElementById('username');
        if (usernameElement) usernameElement.textContent = data.username;
    } catch (error) {
        console.error('Lỗi:', error);
    }
}

window.onload = fetchUser_Info;

// Game state
let currentBet = 0;
let selectedChip = 100;
let bets = {
    tai: 0, xiu: 0, even: 0, odd: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0,
    11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0, 17: 0
};
let gameState = 'betting';
let countdownInterval;
let soundEnabled = true;
let betHistory = [];

// DOM elements
const balanceEl = document.getElementById('balance');
const countdownEl = document.getElementById('countdown');
const resultTextEl = document.getElementById('result-text');
const resultSumEl = document.getElementById('result-sum');
const dice1El = document.getElementById('dice1');
const dice2El = document.getElementById('dice2');
const dice3El = document.getElementById('dice3');
const helpModal = document.getElementById('help-modal');
const helpBtn = document.getElementById('help-btn');
const closeHelpBtn = document.getElementById('close-help');
const soundBtn = document.getElementById('sound-btn');
const resetBetBtn = document.getElementById('reset-bet');
const viewBetsBtn = document.getElementById('view-bets');
const closeBetHistoryBtn = document.getElementById('close-bet-history');
const betHistoryModal = document.getElementById('bet-history-modal');
const betHistoryList = document.getElementById('bet-history-list');
const logoutButton = document.getElementById('logout-button');
const soundElements = {
    diceRoll: document.getElementById('dice-roll-sound'),
    win: document.getElementById('win-sound'),
    lose: document.getElementById('lose-sound'),
    chip: document.getElementById('chip-sound')
};

// Initialize game
async function initGame() {
    updateBalance();
    await restoreBets();
    startCountdown();
    updateChart();
    await loadBetHistory();

    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            selectedChip = chip.dataset.value === 'ALL' ? 'ALL' : parseInt(chip.dataset.value);
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('glow'));
            chip.classList.add('glow');
            playSound(soundElements.chip);
        });
    });

    document.getElementById('tai-bet').addEventListener('click', () => placeBet('tai'));
    document.getElementById('xiu-bet').addEventListener('click', () => placeBet('xiu'));
    document.getElementById('even-bet').addEventListener('click', () => placeBet('even'));
    document.getElementById('odd-bet').addEventListener('click', () => placeBet('odd'));
    for (let i = 4; i <= 17; i++) {
        document.getElementById(`bet-${i}`).addEventListener('click', () => placeBet(i.toString()));
    }

    helpBtn.addEventListener('click', () => helpModal.classList.remove('hidden'));
    closeHelpBtn.addEventListener('click', () => helpModal.classList.add('hidden'));
    soundBtn.addEventListener('click', toggleSound);
    resetBetBtn.addEventListener('click', clearBets);
    viewBetsBtn.addEventListener('click', showBetHistory);
    closeBetHistoryBtn.addEventListener('click', () => betHistoryModal.classList.add('hidden'));

    logoutButton.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/logout', { method: 'POST' });
            const data = await response.json();
            if (response.ok) {
                Swal.fire({ icon: 'success', title: 'Thành công', text: data.message }).then(() => {
                    window.location.href = '/';
                });
            } else {
                Swal.fire({ icon: 'error', title: 'Lỗi', text: data.message });
            }
        } catch (error) {
            console.error('Lỗi khi đăng xuất:', error);
            Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Đã xảy ra lỗi khi đăng xuất' });
        }
    });

    document.querySelector('.chip').click();
}

// Countdown và hiển thị kết quả
async function startCountdown() {
    clearInterval(countdownInterval);
    const res = await fetch('/api/get-start-time');
    const { startTime } = await res.json();
    countdownInterval = setInterval(async () => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        const countdown = 36 - elapsed;
        updateCountdown(countdown);
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            await fetchAndShowResults();
        }
    }, 1000);
}

function updateCountdown(countdown) {
    countdownEl.textContent = countdown;
    countdownEl.classList.remove('bg-green-600', 'bg-yellow-600', 'bg-red-600'); // Xóa tất cả lớp màu trước
    if (countdown <= 5) {
        countdownEl.classList.add('bg-red-600');
    } else if (countdown <= 10) {
        countdownEl.classList.add('bg-yellow-600');
    } else {
        countdownEl.classList.add('bg-green-600');
    }
}

// Place bet
async function placeBet(type) {
    if (gameState !== 'betting') return;
    let betAmount = selectedChip === 'ALL' ? balance : selectedChip;
    if (parseInt(countdownEl.textContent) <= 5) {
        Swal.fire({ icon: 'warning', title: 'Đã muộn', text: 'Không thể đặt cược khi còn 5 giây hoặc ít hơn.' });
        return;
    }
    if (balance < betAmount) {
        Swal.fire({ icon: 'error', title: 'Không đủ tiền', text: `Bạn không đủ tiền để đặt cược ${betAmount.toLocaleString()} VND.` });
        return;
    }

    const res = await fetch('/api/place-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, betAmount }),
        credentials: 'include'
    });
    const data = await res.json();
    if (res.ok) {
        balance = data.balance;
        bets[type] += betAmount;
        currentBet += betAmount;
        updateBalance();
        updateBetDisplay(type);
        playSound(soundElements.chip);
    } else {
        Swal.fire({ icon: 'error', title: 'Lỗi', text: data.message });
    }
}

// Lấy và hiển thị kết quả từ server
async function fetchAndShowResults() {
    if (gameState !== 'betting') return;
    gameState = 'rolling';
    dice1El.classList.add('rolling');
    dice2El.classList.add('rolling');
    dice3El.classList.add('rolling');
    resultTextEl.textContent = 'Đang lắc...';
    playSound(soundElements.diceRoll);

    setTimeout(async () => {
        gameState = 'results';
        dice1El.classList.remove('rolling');
        dice2El.classList.remove('rolling');
        dice3El.classList.remove('rolling');

        const res = await fetch('/api/process-round', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        const data = await res.json();

        if (res.ok) {
            const { dice1, dice2, dice3, sum, result, balance: newBalance, winnings } = data;

            updateDiceFace(dice1El, dice1);
            updateDiceFace(dice2El, dice2);
            updateDiceFace(dice3El, dice3);

            resultTextEl.textContent = result;
            resultSumEl.textContent = `Tổng: ${sum}`;
            balance = newBalance;

            if (winnings > 0) {
                resultTextEl.classList.add('text-green-400');
                resultTextEl.classList.remove('text-red-400');
                playSound(soundElements.win);
            } else if (currentBet > 0) {
                resultTextEl.classList.add('text-red-400');
                resultTextEl.classList.remove('text-green-400');
                playSound(soundElements.lose);
            }

            // Cập nhật giao diện nhưng chưa reset ngay
            currentBet = 0;
            for (const type in bets) {
                bets[type] = 0;
                updateBetDisplay(type);
            }
            updateBalance();
            updateChart();
            await loadBetHistory();

            // Chờ 3 giây để người chơi xem kết quả trước khi reset và bắt đầu vòng mới
            setTimeout(() => {
                gameState = 'betting';
                resultTextEl.textContent = 'Chờ kết quả...';
                resultSumEl.textContent = 'Tổng: 0';
                resultTextEl.classList.remove('text-green-400', 'text-red-400');
                updateDiceFace(dice1El, 3);
                updateDiceFace(dice2El, 3);
                updateDiceFace(dice3El, 3);

                startCountdown(); // Bắt đầu vòng mới sau khi chờ
            }, 3000);
        } else {
            console.error('Lỗi từ server:', data.message);
            gameState = 'betting'; // Reset trạng thái nếu có lỗi
            startCountdown();
        }
    }, 3000); // Thời gian rolling vẫn là 3 giây
}

// Update dice face
function updateDiceFace(diceEl, value) {
    diceEl.innerHTML = '';
    for (let i = 0; i < value; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        diceEl.appendChild(dot);
    }
    switch (value) {
        case 1: diceEl.style.gridTemplateAreas = '". . ." ". g ." ". . ."'; break;
        case 2: diceEl.style.gridTemplateAreas = '"a . ." ". . ." ". . b"'; break;
        case 3: diceEl.style.gridTemplateAreas = '"a . ." ". g ." ". . b"'; break;
        case 4: diceEl.style.gridTemplateAreas = '"a . c" ". . ." "d . b"'; break;
        case 5: diceEl.style.gridTemplateAreas = '"a . c" ". g ." "d . b"'; break;
        case 6: diceEl.style.gridTemplateAreas = '"a . c" "e . f" "d . b"'; break;
        default: diceEl.style.gridTemplateAreas = '"a . c" "e g f" "d . b"';
    }
}

// Update bet display
function updateBetDisplay(type) {
    if (type === 'tai') document.getElementById('tai-total').textContent = bets.tai.toLocaleString();
    else if (type === 'xiu') document.getElementById('xiu-total').textContent = bets.xiu.toLocaleString();
    else if (type === 'even') document.getElementById('even-total').textContent = bets.even.toLocaleString();
    else if (type === 'odd') document.getElementById('odd-total').textContent = bets.odd.toLocaleString();
    else document.getElementById(`bet-${type}-total`).textContent = bets[type].toLocaleString();
}

// Update balance
function updateBalance() {
    balanceEl.textContent = balance.toLocaleString();
}

// Toggle sound
function toggleSound() {
    soundEnabled = !soundEnabled;
    soundBtn.innerHTML = soundEnabled ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>';
}

// Play sound
function playSound(sound) {
    if (soundEnabled) {
        sound.currentTime = 0;
        sound.play().catch(e => console.log('Sound playback prevented:', e));
    }
}

// Clear bets
async function clearBets() {
    let totalBet = 0;
    for (const type in bets) totalBet += bets[type];
    if (totalBet === 0) return;

    if (parseInt(countdownEl.textContent) <= 5 && currentBet > 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Không thể đặt lại cược',
            text: 'Khi còn 5 giây cuối, khóa cược.'
        });
        return;
    }

    try {
        const res = await fetch('/api/reset-bets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        const data = await res.json();

        if (res.ok) {
            balance = data.balance; // Cập nhật số dư từ server
            for (const type in bets) {
                bets[type] = 0;
                updateBetDisplay(type);
            }
            currentBet = 0;
            updateBalance();
        } 
    } catch (err) {
        console.error('Lỗi khi đặt lại cược:', err);
        Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: 'Đã xảy ra lỗi khi đặt lại cược'
        });
    }
}

// Load bet history from database
async function loadBetHistory() {
    try {
        const res = await fetch('/bet-history', { credentials: 'include' });
        if (!res.ok) throw new Error('Không thể lấy lịch sử cược');
        const data = await res.json();
        betHistory = data.map(item => ({
            type: item.bet_choice,
            amount: item.bet_amount,
            won: item.result === 'Thắng',
            winAmount: item.win_amount,
            timestamp: new Date(item.created_at)
        }));
        //showBetHistory();
    } catch (err) {
        console.error('Lỗi tải lịch sử cược:', err);
        betHistoryList.innerHTML = '<div class="text-red-400">Lỗi tải lịch sử cược</div>';
    }
}

// Show bet history
function showBetHistory() {
    betHistoryList.innerHTML = '';
    if (betHistory.length === 0) {
        betHistoryList.innerHTML = '<div class="text-gray-400">Chưa có lịch sử cược</div>';
        betHistoryModal.classList.remove('hidden');
        return;
    }

    betHistory.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'bg-gray-700 rounded-lg p-4 mb-2 text-sm flex flex-col space-y-2 hover:bg-gray-600 transition-all';

        const date = new Date(item.timestamp);
        const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`;

        const typeDiv = document.createElement('div');
        typeDiv.className = 'flex items-center space-x-2';
        const icon = document.createElement('i');
        icon.className = item.type === 'tai' ? 'fas fa-arrow-up text-red-400' :
                         item.type === 'xiu' ? 'fas fa-arrow-down text-blue-400' :
                         item.type === 'chan' ? 'fas fa-balance-scale text-yellow-400' :
                         item.type === 'le' ? 'fas fa-balance-scale text-yellow-400' :
                         'fas fa-dice text-purple-400';
        typeDiv.appendChild(icon);
        const typeText = document.createElement('span');
        typeText.textContent = item.type.toUpperCase();
        typeText.className = 'font-bold';
        typeDiv.appendChild(typeText);
        historyItem.appendChild(typeDiv);

        const amountDiv = document.createElement('div');
        amountDiv.className = 'flex items-center space-x-2';
        const amountIcon = document.createElement('i');
        amountIcon.className = 'fas fa-coins text-yellow-400';
        amountDiv.appendChild(amountIcon);
        const amountText = document.createElement('span');
        amountText.textContent = `Cược: ${item.amount.toLocaleString()} VND`;
        amountText.className = 'text-white';
        amountDiv.appendChild(amountText);
        historyItem.appendChild(amountDiv);

        const winDiv = document.createElement('div');
        winDiv.className = 'flex items-center space-x-2';
        const winIcon = document.createElement('i');
        winIcon.className = item.won ? 'fas fa-trophy text-green-400' : 'fas fa-times text-red-400';
        winDiv.appendChild(winIcon);
        const winText = document.createElement('span');
        winText.textContent = item.won ? `Thắng: +${item.winAmount.toLocaleString()} VND` : `Thua: -${item.amount.toLocaleString()} VND`;
        winText.className = item.won ? 'text-green-400' : 'text-red-400';
        winDiv.appendChild(winText);
        historyItem.appendChild(winDiv);

        const timeDiv = document.createElement('div');
        timeDiv.className = 'flex items-center space-x-2';
        const timeIcon = document.createElement('i');
        timeIcon.className = 'fas fa-clock text-gray-400';
        timeDiv.appendChild(timeIcon);
        const timeText = document.createElement('span');
        timeText.textContent = formattedDate;
        timeText.className = 'text-gray-400';
        timeDiv.appendChild(timeText);
        historyItem.appendChild(timeDiv);

        betHistoryList.appendChild(historyItem);
    });
    betHistoryModal.classList.remove('hidden');
}

// Update chart
async function updateChart() {
    try {
        const response = await fetch('/get-chart-results', { credentials: 'include' });
        if (!response.ok) throw new Error('Không thể lấy kết quả sơ đồ cầu');
        const results = await response.json();
        renderChart(results);
    } catch (error) {
        console.error('Lỗi:', error);
    }
}

function renderChart(results) {
    const chartContainer = document.getElementById('chart-container');
    chartContainer.innerHTML = '';
    let currentColumn = null;
    let lastResult = null;
    let columnCount = 0;

    // Lấy 50 cầu mới nhất và đảo ngược để hiển thị từ cũ đến mới
    results.reverse().forEach((item) => {
        if (lastResult === null || 
            (lastResult === 'TÀI' && (item.result === 'XỈU' || item.result === 'Ba mặt giống nhau')) ||
            (lastResult === 'XỈU' && (item.result === 'TÀI' || item.result === 'Ba mặt giống nhau')) ||
            (lastResult === 'Ba mặt giống nhau' && (item.result === 'TÀI' || item.result === 'XỈU'))) {
            if (columnCount >= 11) {
                // Xóa cột đầu tiên nếu vượt quá 11 cột
                chartContainer.removeChild(chartContainer.children[0]);
            } else {
                columnCount++;
            }
            currentColumn = document.createElement('div');
            currentColumn.className = 'chart-column';
            chartContainer.appendChild(currentColumn); // Thêm cột mới vào cuối
        }

        const chartItem = document.createElement('div');
        chartItem.className = 'chart-item';
        if (item.result === 'TÀI') chartItem.classList.add('tai');
        else if (item.result === 'XỈU') chartItem.classList.add('xiu');
        else chartItem.classList.add('triple');
        chartItem.textContent = item.sum;
        chartItem.title = `${item.dice1}, ${item.dice2}, ${item.dice3} = ${item.sum} (${item.result})`;
        currentColumn.appendChild(chartItem); // Thêm cầu vào cột hiện tại
        lastResult = item.result;
    });
}

// Khôi phục trạng thái cược từ server
async function restoreBets() {
    try {
        const res = await fetch('/api/get-current-bets', { credentials: 'include' });
        const currentBets = await res.json();
        currentBet = 0;
        for (const type in bets) bets[type] = 0;
        currentBets.forEach(bet => {
            bets[bet.bet_type] = bet.bet_amount;
            currentBet += bet.bet_amount;
            updateBetDisplay(bet.bet_type);
        });
    } catch (err) {
        console.error('Lỗi khôi phục trạng thái cược:', err);
    }
}

// Khởi động game
document.addEventListener('DOMContentLoaded', initGame);
