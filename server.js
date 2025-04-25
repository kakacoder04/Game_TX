const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

const app = express();
const port = 3000;

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'win68'
});

db.connect(err => {
    if (err) throw err;
    console.log('Kết nối MySQL thành công!');
});

function ensureAuthenticated(req, res, next) {
    if (req.session.user && req.session.user.id) next();
    else res.status(401).sendFile(path.join(__dirname, 'public', 'unauthorized.html'));
}

function ensureAdmin(req, res, next) {
    if (req.session.user && req.session.user.is_admin) next();
    else res.status(403).json({ message: 'Truy cập bị từ chối: Yêu cầu quyền quản trị' });
}

app.get('/check-session', (req, res) => {
    if (req.session.user) {
        res.json({ 
            isAuthenticated: true, 
            isAdmin: req.session.user.is_admin,
            username: req.session.user.username
        });
    } else {
        res.json({ isAuthenticated: false });
    }
});

app.get('/', (req, res) => {
    if (req.session.user) {
        if (req.session.user.is_admin) {
            return res.redirect('/admin');
        } else {
            return res.redirect('/game');
        }
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', ensureAuthenticated, ensureAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/register', (req, res) => {
    const { username, password, email } = req.body;
    const checkQuery = 'SELECT * FROM users WHERE username = ? OR email = ?';
    db.query(checkQuery, [username, email], (err, results) => {
        if (err) return res.status(500).send('Lỗi server');
        if (results.length > 0) return res.status(400).send('Tài khoản hoặc email đã tồn tại');
        const insertQuery = 'INSERT INTO users (username, password, email, balance) VALUES (?, ?, ?, ?)';
        db.query(insertQuery, [username, password, email, 0], (err) => {
            if (err) return res.status(500).send('Đăng ký thất bại');
            res.send('Đăng ký thành công');
        });
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], (err, results) => {
        if (err) return res.status(500).send('Lỗi server');
        
        if (results.length === 0) {
            return res.status(401).json({ message: 'Tài khoản không tồn tại' });
        }
        
        const user = results[0];
        
        if (!user.is_active) {
            return res.status(403).json({ message: 'Tài khoản đã bị khóa' });
        }
        
        if (user.password !== password) {
            return res.status(401).json({ message: 'Sai mật khẩu' });
        }
        
        req.session.user = user;
        res.json({ 
            message: 'Đăng nhập thành công', 
            username: user.username, 
            balance: user.balance, 
            isAdmin: user.is_admin 
        });
    });
});

app.get('/user-info', ensureAuthenticated, (req, res) => {
    const user = req.session.user;
    res.json({ id: user.id, username: user.username, email: user.email, balance: user.balance, isAdmin: user.is_admin });
});

app.post('/update-balance', ensureAuthenticated, (req, res) => {
    const { newBalance } = req.body;
    const userId = req.session.user.id;
    const query = 'UPDATE users SET balance = ? WHERE id = ?';
    db.query(query, [newBalance, userId], (err) => {
        if (err) return res.status(500).json({ message: 'Lỗi server' });
        req.session.user.balance = newBalance;
        res.json({ message: 'Cập nhật số dư thành công', newBalance });
    });
});

app.get('/get-balance', ensureAuthenticated, (req, res) => {
    res.json({ balance: req.session.user.balance });
});

let startTime = Date.now();
const countdownDuration = 36 * 1000;
setInterval(() => {
    startTime = Date.now();
}, countdownDuration);

app.get('/api/get-start-time', (req, res) => res.json({ startTime }));

// Store manually set dice values
let nextDice = null;

function rollDice() {
    if (nextDice) {
        const dice = { ...nextDice };
        nextDice = null; // Reset after using
        return dice;
    }
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const dice3 = Math.floor(Math.random() * 6) + 1;
    return { dice1, dice2, dice3 };
}

function saveChartResult(dice1, dice2, dice3, sum, result) {
    const query = 'INSERT INTO chart_results (dice1, dice2, dice3, sum, result) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [dice1, dice2, dice3, sum, result], (err) => {
        if (err) throw err;
        const countQuery = 'SELECT COUNT(*) AS count FROM chart_results';
        db.query(countQuery, (err, countResult) => {
            if (err) throw err;
            const count = countResult[0].count;
            if (count > 50) {
                const deleteQuery = 'DELETE FROM chart_results ORDER BY id ASC LIMIT ?';
                db.query(deleteQuery, [count - 50], (err) => {
                    if (err) throw err;
                });
            }
        });
    });
}

function autoRollAndSave() {
    const { dice1, dice2, dice3 } = rollDice();
    const sum = dice1 + dice2 + dice3;
    let result = '';
    const isTriple = dice1 === dice2 && dice2 === dice3;
    if (isTriple) result = 'Ba mặt giống nhau';
    else if (sum >= 11 && sum <= 17) result = 'TÀI';
    else result = 'XỈU';
    saveChartResult(dice1, dice2, dice3, sum, result);
}

app.get('/get-chart-results', ensureAuthenticated, (req, res) => {
    const query = 'SELECT * FROM chart_results ORDER BY timestamp DESC LIMIT 50';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ message: 'Lỗi server' });
        res.json(results);
    });
});

app.post('/api/place-bet', ensureAuthenticated, (req, res) => {
    const { type, betAmount } = req.body;
    const userId = req.session.user.id;
    let balance = req.session.user.balance;

    if (balance < betAmount) return res.status(400).json({ message: 'Không đủ số dư' });

    balance -= betAmount;
    req.session.user.balance = balance;

    const checkBetQuery = 'SELECT * FROM current_bets WHERE user_id = ? AND bet_type = ?';
    db.query(checkBetQuery, [userId, type], (err, results) => {
        if (err) return res.status(500).json({ message: 'Lỗi server khi kiểm tra cược' });

        if (results.length > 0) {
            const newBetAmount = results[0].bet_amount + betAmount;
            const updateBetQuery = 'UPDATE current_bets SET bet_amount = ? WHERE user_id = ? AND bet_type = ?';
            db.query(updateBetQuery, [newBetAmount, userId, type], (err) => {
                if (err) return res.status(500).json({ message: 'Lỗi server khi cập nhật cược' });

                const updateBalanceQuery = 'UPDATE users SET balance = ? WHERE id = ?';
                db.query(updateBalanceQuery, [balance, userId], (err) => {
                    if (err) return res.status(500).json({ message: 'Lỗi server khi cập nhật số dư' });
                    res.json({ balance });
                });
            });
        } else {
            const insertBetQuery = 'INSERT INTO current_bets (user_id, bet_type, bet_amount) VALUES (?, ?, ?)';
            db.query(insertBetQuery, [userId, type, betAmount], (err) => {
                if (err) return res.status(500).json({ message: 'Lỗi server khi lưu cược' });

                const updateBalanceQuery = 'UPDATE users SET balance = ? WHERE id = ?';
                db.query(updateBalanceQuery, [balance, userId], (err) => {
                    if (err) return res.status(500).json({ message: 'Lỗi server khi cập nhật số dư' });
                    res.json({ balance });
                });
            });
        }
    });
});

app.post('/api/reset-bets', ensureAuthenticated, async (req, res) => {
    const userId = req.session.user.id;

    try {
        const betsQuery = 'SELECT SUM(bet_amount) AS totalBet FROM current_bets WHERE user_id = ?';
        db.query(betsQuery, [userId], (err, result) => {
            if (err) return res.status(500).json({ message: 'Lỗi server khi lấy cược hiện tại' });

            const totalBet = result[0].totalBet || 0;

            const newBalance = req.session.user.balance + totalBet;
            const updateBalanceQuery = 'UPDATE users SET balance = ? WHERE id = ?';
            db.query(updateBalanceQuery, [newBalance, userId], (err) => {
                if (err) return res.status(500).json({ message: 'Lỗi server khi cập nhật số dư' });

                const deleteBetsQuery = 'DELETE FROM current_bets WHERE user_id = ?';
                db.query(deleteBetsQuery, [userId], (err) => {
                    if (err) return res.status(500).json({ message: 'Lỗi server khi xóa cược' });

                    req.session.user.balance = newBalance;
                    res.json({ balance: newBalance });
                });
            });
        });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
});

app.get('/api/get-current-bets', ensureAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const query = 'SELECT bet_type, bet_amount FROM current_bets WHERE user_id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Lỗi server' });
        res.json(results);
    });
});

function saveBetHistory(userId, betChoice, betAmount, won, winAmount, callback) {
    const insertQuery = `
        INSERT INTO bet_history (user_id, bet_amount, bet_choice, result, win_amount, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    `;
    db.query(insertQuery, [userId, betAmount, betChoice, won ? 'Thắng' : 'Thua', winAmount], (err, result) => {
        if (err) return callback(err);

        const deleteOldQuery = `
            DELETE FROM bet_history
            WHERE user_id = ?
            AND id NOT IN (
                SELECT id FROM (
                    SELECT id FROM bet_history
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT 20
                ) AS recent
            )
        `;
        db.query(deleteOldQuery, [userId, userId], (err) => {
            if (err) return callback(err);
            callback(null, result);
        });
    });
}

function processAllBets() {
    db.query('SELECT * FROM chart_results ORDER BY timestamp DESC LIMIT 1', (err, results) => {
        if (err) {
            console.error('Lỗi khi lấy kết quả xúc xắc:', err);
            return;
        }
        if (results.length === 0) {
            console.error('Chưa có kết quả xúc xắc');
            return;
        }
        const { dice1, dice2, dice3, sum, result } = results[0];
        const isTriple = dice1 === dice2 && dice2 === dice3;
        const isEven = sum % 2 === 0;

        db.query('SELECT * FROM current_bets', (err, currentBets) => {
            if (err) {
                console.error('Lỗi khi lấy cược:', err);
                return;
            }

            const betsByUser = {};
            currentBets.forEach(bet => {
                if (!betsByUser[bet.user_id]) {
                    betsByUser[bet.user_id] = {
                        tai: 0, xiu: 0, even: 0, odd: 0
                    };
                    for (let i = 4; i <= 17; i++) betsByUser[bet.user_id][i] = 0;
                }
                betsByUser[bet.user_id][bet.bet_type] = bet.bet_amount;
            });

            for (const userId in betsByUser) {
                const bets = betsByUser[userId];
                let winnings = 0, winoe = 0, winningss = 0;

                if (!isTriple) {
                    if (bets.tai > 0 && bets.xiu > 0 && sum >= 11 && sum <= 17) {
                        winnings += bets.tai * 1.95;
                    } else if (bets.tai > 0 && bets.xiu > 0 && sum >= 4 && sum <= 10) {
                        winnings += bets.xiu * 1.95;
                    } else if (sum >= 11 && sum <= 17 && bets.tai > 0) {
                        winnings += bets.tai * 1.95;
                    } else if (sum >= 4 && sum <= 10 && bets.xiu > 0) {
                        winnings += bets.xiu * 1.95;
                    }
                }

                if (bets.even > 0 && bets.odd > 0 && isEven) {
                    winoe += bets.even * 1.95;
                } else if (bets.even > 0 && bets.odd > 0 && !isEven) {
                    winoe += bets.odd * 1.95;
                } else if (isEven && bets.even > 0) {
                    winoe += bets.even * 1.95;
                } else if (!isEven && bets.odd > 0) {
                    winoe += bets.odd * 1.95;
                }

                for (let i = 4; i <= 17; i++) {
                    if (bets[i] > 0 && i !== sum) {
                        saveBetHistory(userId, `tổng ${i}`, bets[i], false, 0, (err) => {
                            if (err) console.error('Lỗi khi lưu lịch sử cược:', err);
                        });
                    }
                }

                if (bets[sum] > 0) {
                    let multiplier = sum === 4 || sum === 17 ? 50 : sum === 5 || sum === 16 ? 18 :
                                     sum === 6 || sum === 15 ? 14 : sum === 7 || sum === 14 ? 12 :
                                     sum === 8 || sum === 13 ? 8 : 6;
                    winningss += bets[sum] * multiplier;
                }

                const totalWinnings = winnings + winoe + winningss;

                if (winnings > 0) {
                    if (bets.xiu > 0 && bets.tai > 0 && sum >= 11 && sum <= 17) {
                        saveBetHistory(userId, 'tài', bets.tai, true, bets.tai * 0.95, () => {});
                        saveBetHistory(userId, 'xỉu', bets.xiu, false, 0, () => {});
                    } else if (bets.xiu > 0 && bets.tai > 0 && sum >= 4 && sum <= 10) {
                        saveBetHistory(userId, 'tài', bets.tai, false, 0, () => {});
                        saveBetHistory(userId, 'xỉu', bets.xiu, true, bets.xiu * 0.95, () => {});
                    } else if (bets.tai > 0) {
                        saveBetHistory(userId, 'tài', bets.tai, true, winnings - bets.tai, () => {});
                    } else if (bets.xiu > 0) {
                        saveBetHistory(userId, 'xỉu', bets.xiu, true, winnings - bets.xiu, () => {});
                    }
                } else {
                    if (bets.tai > 0) saveBetHistory(userId, 'tài', bets.tai, false, 0, () => {});
                    if (bets.xiu > 0) saveBetHistory(userId, 'xỉu', bets.xiu, false, 0, () => {});
                }

                if (winoe > 0) {
                    if (bets.even > 0 && bets.odd > 0 && isEven) {
                        saveBetHistory(userId, 'chẵn', bets.even, true, bets.even * 0.95, () => {});
                        saveBetHistory(userId, 'lẻ', bets.odd, false, 0, () => {});
                    } else if (bets.even > 0 && bets.odd > 0 && !isEven) {
                        saveBetHistory(userId, 'chẵn', bets.even, false, 0, () => {});
                        saveBetHistory(userId, 'lẻ', bets.odd, true, bets.odd * 0.95, () => {});
                    } else if (isEven && bets.even > 0) {
                        saveBetHistory(userId, 'chẵn', bets.even, true, winoe - bets.even, () => {});
                    } else if (!isEven && bets.odd > 0) {
                        saveBetHistory(userId, 'lẻ', bets.odd, true, winoe - bets.odd, () => {});
                    }
                } else {
                    if (bets.even > 0) saveBetHistory(userId, 'chẵn', bets.even, false, 0, () => {});
                    if (bets.odd > 0) saveBetHistory(userId, 'lẻ', bets.odd, false, 0, () => {});
                }

                if (bets[sum] > 0) {
                    saveBetHistory(userId, `tổng ${sum}`, bets[sum], true, winningss, () => {});
                }

                db.query('SELECT balance FROM users WHERE id = ?', [userId], (err, userResult) => {
                    if (err) {
                        console.error('Lỗi khi lấy số dư:', err);
                        return;
                    }
                    const currentBalance = userResult[0].balance;
                    const newBalance = currentBalance + totalWinnings;

                    db.query('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId], (err) => {
                        if (err) console.error('Lỗi khi cập nhật số dư:', err);
                    });
                });
            }

            db.query('DELETE FROM current_bets', (err) => {
                if (err) console.error('Lỗi khi xóa cược:', err);
            });
        });
    });
}

app.post('/api/deposit', ensureAuthenticated, (req, res) => {
    const { amount, bankName, transactionCode } = req.body;
    const userId = req.session.user.id;

    if (!userId) {
        console.error('Lỗi: userId không tồn tại trong session');
        return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ' });
    }
    if (!amount || amount < 10000) {
        return res.status(400).json({ message: 'Số tiền nạp tối thiểu là 10,000 VND' });
    }
    if (!bankName) {
        return res.status(400).json({ message: 'Vui lòng chọn ngân hàng' });
    }

    if (!transactionCode || transactionCode !== `NAP${userId}`) {
        return res.status(400).json({ message: 'Mã giao dịch không hợp lệ' });
    }

    const query = `
        INSERT INTO transactions (user_id, type, amount, bank_name, transaction_code, status)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.query(query, [userId, 'deposit', amount, bankName, transactionCode, 'pending'], (err) => {
        if (err) {
            console.error('Lỗi khi lưu giao dịch nạp:', err);
            return res.status(500).json({ message: 'Lỗi server: Không thể lưu giao dịch' });
        }
        res.json({ message: 'Yêu cầu nạp tiền đã được gửi' });
    });
});

app.post('/api/withdraw', ensureAuthenticated, (req, res) => {
    const { amount, bankName, accountNumber, accountHolder } = req.body;
    const userId = req.session.user.id;

    if (!userId) {
        console.error('Lỗi: userId không tồn tại trong session');
        return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ' });
    }
    if (!amount || amount > 50000000) {
        return res.status(400).json({ message: 'Số tiền rút không quá 50,000,000 VND' });
    }
    if (!bankName || !accountNumber || !accountHolder) {
        return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin ngân hàng' });
    }

    db.query('SELECT balance FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) {
            console.error('Lỗi khi kiểm tra số dư:', err);
            return res.status(500).json({ message: 'Lỗi server' });
        }
        const balance = results[0].balance;
        if (balance < amount) {
            return res.status(400).json({ message: 'Số dư không đủ' });
        }

        const newBalance = balance - amount;
        db.query('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId], (err) => {
            if (err) {
                console.error('Lỗi khi cập nhật số dư:', err);
                return res.status(500).json({ message: 'Lỗi server khi cập nhật số dư' });
            }

            const query = `
                INSERT INTO transactions (user_id, type, amount, bank_name, account_number, account_holder, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            db.query(query, [userId, 'withdraw', amount, bankName, accountNumber, accountHolder, 'pending'], (err) => {
                if (err) {
                    console.error('Lỗi khi lưu giao dịch rút:', err);
                    return res.status(500).json({ message: 'Lỗi server khi lưu giao dịch' });
                }

                req.session.user.balance = newBalance;
                res.json({ message: 'Yêu cầu rút tiền đã được gửi', balance: newBalance });
            });
        });
    });
});

app.get('/api/transaction-history', ensureAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const type = req.query.type;
    
    let query = `
        SELECT type, amount, status, created_at, bank_name, transaction_code, account_number, account_holder
        FROM transactions
        WHERE user_id = ?
    `;
    const queryParams = [userId];

    if (type === 'deposit' || type === 'withdraw') {
        query += ` AND type = ?`;
        queryParams.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT 20`;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Lỗi khi lấy lịch sử giao dịch:', err);
            return res.status(500).json({ message: 'Lỗi server' });
        }
        res.json(results);
    });
});

// Admin Endpoints
app.get('/admin/overview-stats', ensureAuthenticated, ensureAdmin, async (req, res) => {
    res.set('Cache-Control', 'no-store');

    try {
        const queryAsync = (sql) => {
            return new Promise((resolve, reject) => {
                db.query(sql, (err, result) => {
                    if (err) reject(err);
                    else resolve(result[0]);
                });
            });
        };

        const totalDepositsResult = await queryAsync(
            'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = "deposit" AND status = "completed"'
        );
        const totalWithdrawalsResult = await queryAsync(
            'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = "withdraw" AND status = "completed"'
        );
        const pendingTransactionsResult = await queryAsync(
            'SELECT COUNT(*) AS count FROM transactions WHERE status = "pending"'
        );
        const totalMembersResult = await queryAsync(
            'SELECT COUNT(*) AS count FROM users'
        );

        const response = {
            totalDeposits: Number(totalDepositsResult.total || 0),
            totalWithdrawals: Number(totalWithdrawalsResult.total || 0),
            pendingTransactions: Number(pendingTransactionsResult.count || 0),
            totalMembers: Number(totalMembersResult.count || 0)
        };

        res.json(response);
    } catch (err) {
        console.error('Lỗi khi lấy thống kê:', err);
        res.status(500).json({ message: 'Lỗi server khi lấy thống kê' });
    }
});

app.get('/admin/deposits', ensureAuthenticated, ensureAdmin, (req, res) => {
    const { status, date } = req.query;
    let query = `
        SELECT t.id, t.user_id, t.amount, t.bank_name, t.transaction_code, t.status, t.created_at, u.username
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        WHERE t.type = 'deposit'
    `;
    const queryParams = [];

    if (status) {
        query += ` AND t.status = ?`;
        queryParams.push(status);
    }
    if (date) {
        query += ` AND DATE(t.created_at) = ?`;
        queryParams.push(date);
    }

    query += ` ORDER BY t.created_at DESC LIMIT 50`;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Lỗi khi lấy danh sách nạp tiền:', err);
            return res.status(500).json({ message: 'Lỗi server khi lấy danh sách nạp tiền' });
        }
        res.json(results);
    });
});

app.get('/admin/withdrawals', ensureAuthenticated, ensureAdmin, (req, res) => {
    const { status, date } = req.query;
    let query = `
        SELECT t.id, t.user_id, t.amount, t.bank_name, t.account_number, t.account_holder, t.status, t.created_at, u.username
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        WHERE t.type = 'withdraw'
    `;
    const queryParams = [];

    if (status) {
        query += ` AND t.status = ?`;
        queryParams.push(status);
    }
    if (date) {
        query += ` AND DATE(t.created_at) = ?`;
        queryParams.push(date);
    }

    query += ` ORDER BY t.created_at DESC LIMIT 50`;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Lỗi khi lấy danh sách rút tiền:', err);
            return res.status(500).json({ message: 'Lỗi server khi lấy danh sách rút tiền' });
        }
        res.json(results);
    });
});

app.get('/admin/history', ensureAuthenticated, ensureAdmin, (req, res) => {
    const { type, startDate, endDate } = req.query;
    let query = `
        SELECT t.id, t.user_id, t.type, t.amount, t.bank_name, t.account_number, t.account_holder, t.status, t.created_at, u.username
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        WHERE 1=1
    `;
    const queryParams = [];

    if (type === 'deposit' || type === 'withdraw') {
        query += ` AND t.type = ?`;
        queryParams.push(type);
    }
    if (startDate) {
        query += ` AND t.created_at >= ?`;
        queryParams.push(startDate);
    }
    if (endDate) {
        query += ` AND t.created_at <= ?`;
        queryParams.push(`${endDate} 23:59:59`);
    }

    query += ` ORDER BY t.created_at DESC LIMIT 50`;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Lỗi khi lấy lịch sử giao dịch:', err);
            return res.status(500).json({ message: 'Lỗi server khi lấy lịch sử giao dịch' });
        }
        res.json(results);
    });
});

app.post('/admin/process-transaction', ensureAuthenticated, ensureAdmin, (req, res) => {
    const { transactionId, status } = req.body;

    if (!transactionId || !['completed', 'rejected'].includes(status)) {
        console.warn('Dữ liệu không hợp lệ:', { transactionId, status });
        return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    completeTransaction(transactionId, status, (err) => {
        if (err) {
            console.error('Lỗi khi xử lý giao dịch:', err);
            return res.status(500).json({ message: err.message || 'Lỗi server khi xử lý giao dịch' });
        }
        res.json({ message: `Giao dịch đã được ${status === 'completed' ? 'xác nhận' : 'từ chối'} thành công` });
    });
});

function completeTransaction(transactionId, status, callback) {
    db.query('SELECT * FROM transactions WHERE id = ?', [transactionId], (err, results) => {
        if (err || results.length === 0) {
            console.error('Giao dịch không tồn tại:', transactionId);
            return callback(err || new Error('Giao dịch không tồn tại'));
        }
        const transaction = results[0];
        if (transaction.status !== 'pending') {
            console.warn('Giao dịch đã được xử lý:', transactionId);
            return callback(new Error('Giao dịch đã được xử lý'));
        }

        if (status === 'completed' && transaction.type === 'deposit') {
            db.query('UPDATE users SET balance = balance + ? WHERE id = ?', [transaction.amount, transaction.user_id], (err) => {
                if (err) {
                    console.error('Lỗi khi cập nhật số dư:', err);
                    return callback(err);
                }
                db.query('UPDATE transactions SET status = ? WHERE id = ?', [status, transactionId], (err) => {
                    if (err) {
                        console.error('Lỗi khi cập nhật trạng thái giao dịch:', err);
                        return callback(err);
                    }
                    callback(null);
                });
            });
        } else if (status === 'rejected' && transaction.type === 'withdraw') {
            db.query('UPDATE users SET balance = balance + ? WHERE id = ?', [transaction.amount, transaction.user_id], (err) => {
                if (err) {
                    console.error('Lỗi khi hoàn tiền:', err);
                    return callback(err);
                }
                db.query('UPDATE transactions SET status = ? WHERE id = ?', [status, transactionId], (err) => {
                    if (err) {
                        console.error('Lỗi khi cập nhật trạng thái giao dịch:', err);
                        return callback(err);
                    }
                    callback(null);
                });
            });
        } else {
            db.query('UPDATE transactions SET status = ? WHERE id = ?', [status, transactionId], (err) => {
                if (err) {
                    console.error('Lỗi khi cập nhật trạng thái giao dịch:', err);
                    return callback(err);
                }
                callback(null);
            });
        }
    });
}

app.post('/api/process-round', ensureAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    db.query('SELECT * FROM chart_results ORDER BY timestamp DESC LIMIT 1', (err, results) => {
        if (err) return res.status(500).json({ message: 'Lỗi server khi lấy kết quả xúc xắc' });
        if (results.length === 0) return res.status(404).json({ message: 'Chưa có kết quả' });
        const { dice1, dice2, dice3, sum, result } = results[0];

        db.query('SELECT bet_type, bet_amount FROM current_bets WHERE user_id = ?', [userId], (err, currentBets) => {
            if (err) return res.status(500).json({ message: 'Lỗi server khi lấy cược' });

            let bets = { tai: 0, xiu: 0, even: 0, odd: 0 };
            for (let i = 4; i <= 17; i++) bets[i] = 0;
            currentBets.forEach(bet => bets[bet.bet_type] = bet.bet_amount);

            let winnings = 0, winoe = 0, winningss = 0;
            const isTriple = dice1 === dice2 && dice2 === dice3;
            const isEven = sum % 2 === 0;

            if (!isTriple) {
                if (bets.tai > 0 && bets.xiu > 0 && sum >= 11 && sum <= 17) {
                    winnings += bets.tai * 1.95;
                } else if (bets.tai > 0 && bets.xiu > 0 && sum >= 4 && sum <= 10) {
                    winnings += bets.xiu * 1.95;
                } else if (sum >= 11 && sum <= 17 && bets.tai > 0) {
                    winnings += bets.tai * 1.95;
                } else if (sum >= 4 && sum <= 10 && bets.xiu > 0) {
                    winnings += bets.xiu * 1.95;
                }
            }

            if (bets.even > 0 && bets.odd > 0 && isEven) {
                winoe += bets.even * 1.95;
            } else if (bets.even > 0 && bets.odd > 0 && !isEven) {
                winoe += bets.odd * 1.95;
            } else if (isEven && bets.even > 0) {
                winoe += bets.even * 1.95;
            } else if (!isEven && bets.odd > 0) {
                winoe += bets.odd * 1.95;
            }

            for (let i = 4; i <= 17; i++) {
                if (bets[i] > 0 && i !== sum) {
                    saveBetHistory(userId, `tổng ${i}`, bets[i], false, 0, (err) => {
                        if (err) throw err;
                    });
                }
            }

            if (bets[sum] > 0) {
                let multiplier = sum === 4 || sum === 17 ? 50 : sum === 5 || sum === 16 ? 18 : sum === 6 || sum === 15 ? 14 : sum === 7 || sum === 14 ? 12 : sum === 8 || sum === 13 ? 8 : 6;
                winningss += bets[sum] * multiplier;
            }

            const totalWinnings = winnings + winoe + winningss;
            let balance = req.session.user.balance + totalWinnings;

            db.query('UPDATE users SET balance = ? WHERE id = ?', [balance, userId], (err) => {
                if (err) return res.status(500).json({ message: 'Lỗi server khi cập nhật số dư' });

                req.session.user.balance = balance;

                let pendingSaves = 0;
                const totalBets = Object.keys(bets).filter(key => bets[key] > 0).length;

                if (totalBets === 0) {
                    db.query('DELETE FROM current_bets WHERE user_id = ?', [userId], (err) => {
                        if (err) throw err;
                        res.json({ dice1, dice2, dice3, sum, result, balance, winnings: totalWinnings });
                    });
                    return;
                }

                const checkCompletion = () => {
                    if (--pendingSaves === 0) {
                        db.query('DELETE FROM current_bets WHERE user_id = ?', [userId], (err) => {
                            if (err) throw err;
                            res.json({ dice1, dice2, dice3, sum, result, balance, winnings: totalWinnings });
                        });
                    }
                };

                if (winnings > 0) {
                    if (bets.xiu > 0 && bets.tai > 0 && sum >= 11 && sum <= 17) {
                        pendingSaves += 2;
                        saveBetHistory(userId, 'tài', bets.tai, true, bets.tai * 0.95, checkCompletion);
                        saveBetHistory(userId, 'xỉu', bets.xiu, false, 0, checkCompletion);
                    } else if (bets.xiu > 0 && bets.tai > 0 && sum >= 4 && sum <= 10) {
                        pendingSaves += 2;
                        saveBetHistory(userId, 'tài', bets.tai, false, 0, checkCompletion);
                        saveBetHistory(userId, 'xỉu', bets.xiu, true, bets.xiu * 0.95, checkCompletion);
                    } else if (bets.tai > 0) {
                        pendingSaves++;
                        saveBetHistory(userId, 'tài', bets.tai, true, winnings - bets.tai, checkCompletion);
                    } else if (bets.xiu > 0) {
                        pendingSaves++;
                        saveBetHistory(userId, 'xỉu', bets.xiu, true, winnings - bets.xiu, checkCompletion);
                    }
                } else {
                    if (bets.tai > 0) {
                        pendingSaves++;
                        saveBetHistory(userId, 'tài', bets.tai, false, 0, checkCompletion);
                    }
                    if (bets.xiu > 0) {
                        pendingSaves++;
                        saveBetHistory(userId, 'xỉu', bets.xiu, false, 0, checkCompletion);
                    }
                }

                if (winoe > 0) {
                    if (bets.even > 0 && bets.odd > 0 && isEven) {
                        pendingSaves += 2;
                        saveBetHistory(userId, 'chẵn', bets.even, true, bets.even * 0.95, checkCompletion);
                        saveBetHistory(userId, 'lẻ', bets.odd, false, 0, checkCompletion);
                    } else if (bets.even > 0 && bets.odd > 0 && !isEven) {
                        pendingSaves += 2;
                        saveBetHistory(userId, 'chẵn', bets.even, false, 0, checkCompletion);
                        saveBetHistory(userId, 'lẻ', bets.odd, true, bets.odd * 0.95, checkCompletion);
                    } else if (isEven && bets.even > 0) {
                        pendingSaves++;
                        saveBetHistory(userId, 'chẵn', bets.even, true, winoe - bets.even, checkCompletion);
                    } else if (!isEven && bets.odd > 0) {
                        pendingSaves++;
                        saveBetHistory(userId, 'lẻ', bets.odd, true, winoe - bets.odd, checkCompletion);
                    }
                } else {
                    if (bets.even > 0) {
                        pendingSaves++;
                        saveBetHistory(userId, 'chẵn', bets.even, false, 0, checkCompletion);
                    }
                    if (bets.odd > 0) {
                        pendingSaves++;
                        saveBetHistory(userId, 'lẻ', bets.odd, false, 0, checkCompletion);
                    }
                }

                if (bets[sum] > 0) {
                    pendingSaves++;
                    saveBetHistory(userId, `tổng ${sum}`, bets[sum], true, winningss, checkCompletion);
                }
            });
        });
    });
});

// New endpoint for game management page
app.get('/game-management', ensureAuthenticated, ensureAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game_management.html'));
});

// New endpoint to get total bets
app.get('/admin/bet-totals', ensureAuthenticated, ensureAdmin, (req, res) => {
    const query = `
        SELECT bet_type, SUM(bet_amount) AS total
        FROM current_bets
        GROUP BY bet_type
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Lỗi khi lấy tổng tiền cược:', err);
            return res.status(500).json({ message: 'Lỗi server khi lấy tổng tiền cược' });
        }
        const totals = {
            tai: 0,
            xiu: 0,
            even: 0,
            odd: 0
        };
        for (let i = 4; i <= 17; i++) totals[i] = 0;
        results.forEach(row => {
            totals[row.bet_type] = Number(row.total || 0);
        });
        res.json(totals);
    });
});

// New endpoint to set dice for next round
app.post('/admin/set-dice', ensureAuthenticated, ensureAdmin, (req, res) => {
    const { dice1, dice2, dice3 } = req.body;
    if (!dice1 || !dice2 || !dice3 ||
        dice1 < 1 || dice1 > 6 ||
        dice2 < 1 || dice2 > 6 ||
        dice3 < 1 || dice3 > 6) {
        return res.status(400).json({ message: 'Giá trị xúc xắc không hợp lệ' });
    }
    nextDice = { dice1, dice2, dice3 };
    res.json({ message: 'Kết quả xúc xắc cho lượt tiếp theo đã được cài đặt' });
});

setInterval(() => {
    autoRollAndSave();
    setTimeout(() => {
        processAllBets();
    }, 5000);
}, countdownDuration);

app.get('/bet-history', ensureAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const query = 'SELECT bet_amount, bet_choice, result, win_amount, created_at FROM bet_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20';
    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Lỗi server' });
        res.json(results);
    });
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).send('Đăng xuất thất bại');
        res.json({ message: 'Đăng xuất thành công' });
    });
});

app.get('/forgot', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'fpass.html'));
});

app.get('/game', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.get('/nr', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'nr.html'));
});

app.get('/members', ensureAuthenticated, ensureAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'members.html'));
});

app.get('/settings', ensureAuthenticated, ensureAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/admin/members', ensureAuthenticated, ensureAdmin, (req, res) => {
    const { username, status } = req.query;
    let query = 'SELECT id, username, email, balance, is_active FROM users WHERE is_admin = FALSE';
    const queryParams = [];

    if (username) {
        query += ' AND username LIKE ?';
        queryParams.push(`%${username}%`);
    }
    if (status === 'active') {
        query += ' AND is_active = TRUE';
    } else if (status === 'locked') {
        query += ' AND is_active = FALSE';
    }

    query += ' ORDER BY id DESC LIMIT 50';

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Lỗi khi lấy danh sách thành viên:', err);
            return res.status(500).json({ message: 'Lỗi server khi lấy danh sách thành viên' });
        }
        res.json(results);
    });
});

app.post('/admin/change-password', ensureAuthenticated, ensureAdmin, (req, res) => {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    const query = 'UPDATE users SET password = ? WHERE id = ? AND is_admin = FALSE';
    db.query(query, [newPassword, userId], (err, result) => {
        if (err) {
            console.error('Lỗi khi đổi mật khẩu:', err);
            return res.status(500).json({ message: 'Lỗi server khi đổi mật khẩu' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }
        res.json({ message: 'Đổi mật khẩu thành công' });
    });
});

app.post('/admin/change-admin-password', ensureAuthenticated, ensureAdmin, (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) {
        return res.status(400).json({ message: 'Hãy nhập mật khẩu' });
    }

    const userId = req.session.user.id;
    const query = 'UPDATE users SET password = ? WHERE id = ? AND is_admin = TRUE';
    db.query(query, [newPassword, userId], (err, result) => {
        if (err) {
            console.error('Lỗi khi đổi mật khẩu admin:', err);
            return res.status(500).json({ message: 'Lỗi server khi đổi mật khẩu admin' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài khoản admin' });
        }
        res.json({ message: 'Đổi mật khẩu admin thành công' });
    });
});

app.post('/admin/toggle-account-status', ensureAuthenticated, ensureAdmin, (req, res) => {
    const { userId, isActive } = req.body;
    if (!userId || isActive === undefined) {
        return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    const query = 'UPDATE users SET is_active = ? WHERE id = ? AND is_admin = FALSE';
    db.query(query, [isActive, userId], (err, result) => {
        if (err) {
            console.error('Lỗi khi thay đổi trạng thái tài khoản:', err);
            return res.status(500).json({ message: 'Lỗi server khi thay đổi trạng thái tài khoản' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }
        res.json({ message: `Tài khoản đã được ${isActive ? 'mở khóa' : 'khóa'} thành công` });
    });
});

app.post('/admin/delete-account', ensureAuthenticated, ensureAdmin, (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    // Xóa dữ liệu liên quan trước
    const deleteRelatedQueries = [
        'DELETE FROM current_bets WHERE user_id = ?',
        'DELETE FROM bet_history WHERE user_id = ?',
        'DELETE FROM transactions WHERE user_id = ?'
    ];

    let queriesCompleted = 0;
    const totalQueries = deleteRelatedQueries.length;

    deleteRelatedQueries.forEach(query => {
        db.query(query, [userId], (err) => {
            if (err) {
                console.error('Lỗi khi xóa dữ liệu liên quan:', err);
                return res.status(500).json({ message: 'Lỗi server khi xóa dữ liệu liên quan' });
            }
            queriesCompleted++;
            if (queriesCompleted === totalQueries) {
                // Xóa tài khoản người dùng
                const deleteUserQuery = 'DELETE FROM users WHERE id = ? AND is_admin = FALSE';
                db.query(deleteUserQuery, [userId], (err, result) => {
                    if (err) {
                        console.error('Lỗi khi xóa tài khoản:', err);
                        return res.status(500).json({ message: 'Lỗi server khi xóa tài khoản' });
                    }
                    if (result.affectedRows === 0) {
                        return res.status(404).json({ message: 'Không tìm thấy người dùng' });
                    }
                    res.json({ message: 'Xóa tài khoản và dữ liệu liên quan thành công' });
                });
            }
        });
    });
});

app.listen(port, () => {
    console.log(`Server chạy tại http://localhost:${port}`);
});