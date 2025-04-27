document.addEventListener('DOMContentLoaded', async () => {
    const depositTab = document.getElementById('deposit-tab');
    const withdrawTab = document.getElementById('withdraw-tab');
    const depositContent = document.getElementById('deposit-content');
    const withdrawContent = document.getElementById('withdraw-content');
    const copyButtons = document.querySelectorAll('.fa-copy');
    const bankCards = document.querySelectorAll('.bank-card');
    const depositButton = document.getElementById('deposit-submit');
    const withdrawButton = document.getElementById('withdraw-submit');
    const depositAmountInput = document.getElementById('deposit-amount');
    const transactionCodeInput = document.getElementById('deposit-transaction-code');
    const withdrawAmountInput = document.getElementById('withdraw-amount');
    const withdrawBankSelect = document.getElementById('withdraw-bank');
    const withdrawAccountNumberInput = document.getElementById('withdraw-account-number');
    const withdrawAccountHolderInput = document.getElementById('withdraw-account-holder');
    const depositHistoryTable = document.getElementById('deposit-history-table');
    const withdrawHistoryTable = document.getElementById('withdraw-history-table');
    const recentWithdrawHistory = document.getElementById('recent-withdraw-history');

    let selectedBank = null;
    let userId = null;

    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }

    // Lấy thông tin user và cập nhật số dư
    const balanceSpan = document.getElementById('user-balance');
    try {
        const response = await fetch('/user-info', {
            method: 'GET',
            credentials: 'include'
        });
        if (response.ok) {
            const userData = await response.json();
            userId = userData.id;
            transactionCodeInput.value = `NAP${userId}`;
            if (balanceSpan) {
                balanceSpan.textContent = formatCurrency(userData.balance);
            }
        } else {
            console.error('Không thể lấy thông tin user');
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: 'Không thể lấy thông tin người dùng. Vui lòng đăng nhập lại.',
                confirmButtonColor: '#3085d6'
            });
        }
    } catch (error) {
        console.error('Lỗi khi lấy user info:', error);
        if (balanceSpan) {
            balanceSpan.textContent = 'Lỗi tải số dư';
        }
    }

    // Trong nr.js, thêm vào sau phần lấy thông tin user
    function startBalancePolling() {
        setInterval(async () => {
            try {
                const response = await fetch('/user-info', {
                    method: 'GET',
                    credentials: 'include'
                });
                if (response.ok) {
                    const userData = await response.json();
                    if (balanceSpan) {
                        balanceSpan.textContent = formatCurrency(userData.balance);
                    }
                }
            } catch (error) {
                console.error('Lỗi khi cập nhật số dư:', error);
            }
        }, 200); // Kiểm tra mỗi 5 giây
    }

    // Gọi hàm này sau khi lấy thông tin user lần đầu
    startBalancePolling();

    // Hàm định dạng ngày giờ
    function formatDateTime(dateTime) {
        const date = new Date(dateTime);
        return date.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    // Hàm định dạng số tiền
    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }

    // Hàm định dạng trạng thái
    function formatStatus(status) {
        switch (status) {
            case 'pending':
                return '<span class="text-yellow-600">Đang xử lý</span>';
            case 'completed':
                return '<span class="text-green-600">Hoàn thành</span>';
            case 'rejected':
                return '<span class="text-red-600">Thất bại</span>';
            default:
                return status;
        }
    }

    // Hàm lấy lịch sử giao dịch
    async function loadTransactionHistory(type, tableBody, limit = 20) {
        try {
            const response = await fetch(`/api/transaction-history?type=${type}`, {
                method: 'GET',
                credentials: 'include'
            });
            if (response.ok) {
                const transactions = await response.json();
                tableBody.innerHTML = '';

                if (transactions.length === 0) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="${type === 'deposit' ? 5 : 6}" class="px-6 py-4 text-center text-gray-500">
                                Chưa có giao dịch ${type === 'deposit' ? 'nạp' : 'rút'} nào
                            </td>
                        </tr>
                    `;
                    return;
                }

                transactions.slice(0, limit).forEach(tx => {
                    const row = document.createElement('tr');
                    if (type === 'deposit') {
                        row.innerHTML = `
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatDateTime(tx.created_at)}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${tx.bank_name || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${tx.transaction_code || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatCurrency(tx.amount)}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">${formatStatus(tx.status)}</td>
                        `;
                    } else {
                        row.innerHTML = `
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatDateTime(tx.created_at)}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${tx.bank_name || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${tx.account_number || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${tx.account_holder || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatCurrency(tx.amount)}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">${formatStatus(tx.status)}</td>
                        `;
                    }
                    tableBody.appendChild(row);
                });
            } else {
                console.error(`Không thể lấy lịch sử ${type}`);
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="${type === 'deposit' ? 5 : 6}" class="px-6 py-4 text-center text-red-500">
                            Lỗi khi tải lịch sử giao dịch
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error(`Lỗi khi lấy lịch sử ${type}:`, error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="${type === 'deposit' ? 5 : 6}" class="px-6 py-4 text-center text-red-500">
                        Lỗi khi tải lịch sử giao dịch
                    </td>
                </tr>
            `;
        }
    }

    // Hàm tải 4 giao dịch rút mới nhất
    async function loadRecentWithdrawHistory() {
        try {
            const response = await fetch('/api/transaction-history?type=withdraw', {
                method: 'GET',
                credentials: 'include'
            });
            if (response.ok) {
                const transactions = await response.json();
                recentWithdrawHistory.innerHTML = '';

                if (transactions.length === 0) {
                    recentWithdrawHistory.innerHTML = `
                        <div class="text-center text-gray-500 py-4">
                            Chưa có giao dịch rút nào
                        </div>
                    `;
                    return;
                }

                transactions.slice(0, 4).forEach(tx => {
                    const div = document.createElement('div');
                    div.className = 'flex items-center justify-between p-2 bg-gray-50 rounded';
                    div.innerHTML = `
                        <div>
                            <p class="font-medium">${tx.bank_name || '-'}</p>
                            <p class="text-sm text-gray-500">${tx.account_number ? '****' + tx.account_number.slice(-4) : '-'}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-medium text-green-600">${formatCurrency(tx.amount)}</p>
                            <p class="text-xs text-gray-500">${formatDateTime(tx.created_at)}</p>
                        </div>
                    `;
                    recentWithdrawHistory.appendChild(div);
                });
            } else {
                console.error('Không thể lấy lịch sử rút gần đây');
                recentWithdrawHistory.innerHTML = `
                    <div class="text-center text-red-500 py-4">
                        Lỗi khi tải lịch sử rút gần đây
                    </div>
                `;
            }
        } catch (error) {
            console.error('Lỗi khi lấy lịch sử rút gần đây:', error);
            recentWithdrawHistory.innerHTML = `
                <div class="text-center text-red-500 py-4">
                    Lỗi khi tải lịch sử rút gần đây
                </div>
            `;
        }
    }

    // Tab switching
    function activateDepositTab() {
        depositTab.classList.add('tab-active');
        depositTab.classList.remove('text-gray-500');
        withdrawTab.classList.remove('tab-active');
        withdrawTab.classList.add('text-gray-500');
        depositContent.classList.remove('hidden');
        withdrawContent.classList.add('hidden');
        loadTransactionHistory('deposit', depositHistoryTable);
    }

    function activateWithdrawTab() {
        withdrawTab.classList.add('tab-active');
        withdrawTab.classList.remove('text-gray-500');
        depositTab.classList.remove('tab-active');
        depositTab.classList.add('text-gray-500');
        withdrawContent.classList.remove('hidden');
        depositContent.classList.add('hidden');
        loadTransactionHistory('withdraw', withdrawHistoryTable);
        loadRecentWithdrawHistory(); // Tải 4 giao dịch rút mới nhất
    }

    depositTab.addEventListener('click', activateDepositTab);
    withdrawTab.addEventListener('click', activateWithdrawTab);

    // Mặc định hiển thị tab Nạp tiền và tải lịch sử nạp
    activateDepositTab();

    // Copy to clipboard
    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const input = button.parentElement.querySelector('input');
            input.select();
            document.execCommand('copy');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                button.innerHTML = originalText;
            }, 2000);
        });
    });

    // Bank card selection for deposit
    bankCards.forEach(card => {
        card.addEventListener('click', () => {
            bankCards.forEach(c => c.classList.remove('border-blue-500', 'bg-blue-50'));
            card.classList.add('border-blue-500', 'bg-blue-50');
            selectedBank = card.dataset.bankId;
        });
    });

    // Xử lý nạp tiền
    depositButton.addEventListener('click', async () => {
        const amount = parseFloat(depositAmountInput.value);
        const transactionCode = transactionCodeInput.value.trim();

        if (!selectedBank) {
            Swal.fire({
                icon: 'warning',
                title: 'Lỗi',
                text: 'Vui lòng chọn ngân hàng!',
                confirmButtonColor: '#3085d6'
            });
            return;
        }
        if (!amount || amount < 10000) {
            Swal.fire({
                icon: 'warning',
                title: 'Lỗi',
                text: 'Số tiền nạp tối thiểu là 10,000 VND!',
                confirmButtonColor: '#3085d6'
            });
            return;
        }
        if (!transactionCode || transactionCode !== `NAP${userId}`) {
            Swal.fire({
                icon: 'warning',
                title: 'Lỗi',
                text: 'Mã giao dịch không hợp lệ!',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        try {
            const response = await fetch('/api/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ amount, bankName: selectedBank, transactionCode })
            });

            const result = await response.json();
            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Thành công',
                    text: 'Yêu cầu nạp tiền đã được gửi, vui lòng chờ xử lý.',
                    confirmButtonColor: '#3085d6'
                }).then(() => {
                    depositAmountInput.value = '';
                    bankCards.forEach(c => c.classList.remove('border-blue-500', 'bg-blue-50'));
                    selectedBank = null;
                    loadTransactionHistory('deposit', depositHistoryTable);
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Lỗi',
                    text: result.message || 'Lỗi khi gửi yêu cầu nạp tiền.',
                    confirmButtonColor: '#3085d6'
                });
            }
        } catch (error) {
            console.error('Lỗi khi gửi yêu cầu nạp tiền:', error);
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: 'Đã xảy ra lỗi. Vui lòng thử lại.',
                confirmButtonColor: '#3085d6'
            });
        }
    });

    // Xử lý rút tiền
    withdrawButton.addEventListener('click', async () => {
        const amount = parseFloat(withdrawAmountInput.value);
        const bankName = withdrawBankSelect.value;
        const accountNumber = withdrawAccountNumberInput.value.trim();
        const accountHolder = withdrawAccountHolderInput.value.trim();

        if (!amount || amount > 50000000) {
            Swal.fire({
                icon: 'warning',
                title: 'Lỗi',
                text: 'Số tiền rút tối đa 50,000,000 VND!',
                confirmButtonColor: '#3085d6'
            });
            return;
        }
        if (!bankName) {
            Swal.fire({
                icon: 'warning',
                title: 'Lỗi',
                text: 'Vui lòng chọn ngân hàng!',
                confirmButtonColor: '#3085d6'
            });
            return;
        }
        if (!accountNumber) {
            Swal.fire({
                icon: 'warning',
                title: 'Lỗi',
                text: 'Vui lòng nhập số tài khoản!',
                confirmButtonColor: '#3085d6'
            });
            return;
        }
        if (!accountHolder) {
            Swal.fire({
                icon: 'warning',
                title: 'Lỗi',
                text: 'Vui lòng nhập tên chủ tài khoản!',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        try {
            const response = await fetch('/api/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ amount, bankName, accountNumber, accountHolder })
            });

            const result = await response.json();
            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Thành công',
                    text: 'Yêu cầu rút tiền đã được gửi, vui lòng chờ xử lý.',
                    confirmButtonColor: '#3085d6'
                }).then(() => {
                    withdrawAmountInput.value = '';
                    withdrawBankSelect.value = '';
                    withdrawAccountNumberInput.value = '';
                    withdrawAccountHolderInput.value = '';
                    loadTransactionHistory('withdraw', withdrawHistoryTable);
                    loadRecentWithdrawHistory(); // Cập nhật 4 giao dịch rút mới nhất
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Lỗi',
                    text: result.message || 'Lỗi khi gửi yêu cầu rút tiền.',
                    confirmButtonColor: '#3085d6'
                });
            }
        } catch (error) {
            console.error('Lỗi khi gửi yêu cầu rút tiền:', error);
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: 'Đã xảy ra lỗi. Vui lòng thử lại.',
                confirmButtonColor: '#3085d6'
            });
        }
    });

    const copyButton = document.querySelector('#deposit-transaction-code + button');
    if (copyButton) {
        copyButton.addEventListener('click', async () => {
            const input = document.getElementById('deposit-transaction-code');
            if (input && input.value) {
                try {
                    await navigator.clipboard.writeText(input.value);
                    const originalHTML = copyButton.innerHTML;
                    copyButton.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        copyButton.innerHTML = originalHTML;
                    }, 2000);
                } catch (err) {
                    console.error('Lỗi khi sao chép:', err);
                    Swal.fire({
                        icon: 'error',
                        title: 'Lỗi',
                        text: 'Không thể sao chép nội dung!',
                        confirmButtonColor: '#3085d6'
                    });
                }
            }
        });
    }
});