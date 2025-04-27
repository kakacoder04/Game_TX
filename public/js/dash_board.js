document.addEventListener('DOMContentLoaded', () => {
    // Toggle sidebar
    const toggleSidebar = document.getElementById('toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    const contentArea = document.getElementById('content-area');

    toggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-collapsed');
        contentArea.classList.toggle('content-expanded');
    });

    // Tabs functionality
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', function(event) {
            event.preventDefault();
            tabs.forEach(t => {
                t.classList.remove('active', 'border-primary', 'text-primary');
                t.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            });
            tabContents.forEach(c => {
                c.classList.remove('active');
                c.classList.add('hidden');
            });
            this.classList.add('active', 'border-primary', 'text-primary');
            this.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            const contentId = this.id.replace('-tab', '-content');
            const targetContent = document.getElementById(contentId);
            if (targetContent) {
                targetContent.classList.add('active');
                targetContent.classList.remove('hidden');
                if (contentId === 'history-content') {
                    fetchHistory();
                } else if (contentId === 'deposit-content') {
                    fetchDeposits();
                } else if (contentId === 'withdraw-content') {
                    fetchWithdrawals();
                }
            }
        });
    });

    // Logout functionality
    document.getElementById('logout').addEventListener('click', async (event) => {
        event.preventDefault();
        try {
            console.log('Bắt đầu yêu cầu đăng xuất');
            const response = await fetch('/logout', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Cache-Control': 'no-cache' }
            });
            console.log('Trạng thái /logout:', response.status);
            let data;
            try {
                data = await response.json();
                console.log('Phản hồi /logout:', data);
            } catch (jsonError) {
                console.error('Lỗi parse JSON:', jsonError);
                data = { message: 'Phản hồi server không hợp lệ', redirect: '/' };
            }
            if (response.ok) {
                showToast('success', data.message);
                setTimeout(() => {
                    const redirectUrl = data.redirect || '/';
                    console.log('Chuyển hướng đến:', redirectUrl);
                    window.location.href = redirectUrl;
                }, 1000);
            } else if (response.status === 401 || response.status === 403) {
                console.warn('Phiên đăng nhập không hợp lệ, chuyển hướng về /');
                showToast('error', 'Phiên đăng nhập đã hết hạn');
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else {
                console.error('Lỗi từ server:', data.message);
                showToast('error', data.message || 'Đăng xuất thất bại');
            }
        } catch (error) {
            console.error('Lỗi khi đăng xuất:', error);
            showToast('error', 'Lỗi kết nối server khi đăng xuất');
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        }
    });

    // Fetch and display overview stats
    async function fetchOverviewStats() {
        try {
            console.log('Bắt đầu lấy dữ liệu /admin/overview-stats');
            const response = await fetch('/admin/overview-stats', {
                credentials: 'include',
                headers: { 'Cache-Control': 'no-cache' }
            });
            console.log('Trạng thái /admin/overview-stats:', response.status);
            if (response.status === 401 || response.status === 403) {
                console.warn('Chuyển hướng về trang chủ do lỗi xác thực');
                window.location.href = '/';
                return;
            }
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Dữ liệu nhận được:', data);
            console.log('totalMembers:', data.totalMembers);
    
            const totalDepositsElement = document.querySelector('#total-deposits.stats-value');
            const totalWithdrawalsElement = document.querySelector('#total-withdrawals.stats-value');
            const pendingTransactionsElement = document.querySelector('#pending-transactions.stats-value');
            const totalMembersElement = document.querySelector('#total-members.stats-value');
    
            if (!totalMembersElement) {
                console.error('Không tìm thấy phần tử #total-members.stats-value');
                showToast('error', 'Lỗi giao diện: Không tìm thấy phần tử tổng thành viên');
                return;
            }
    
            totalDepositsElement.textContent = `${Number(data.totalDeposits || 0).toLocaleString('vi-VN')} ₫`;
            totalWithdrawalsElement.textContent = `${Number(data.totalWithdrawals || 0).toLocaleString('vi-VN')} ₫`;
            pendingTransactionsElement.textContent = data.pendingTransactions || 0;
            totalMembersElement.textContent = data.totalMembers || 0;
    
            console.log('Đã gán totalMembers:', data.totalMembers);
            if (data.totalMembers === 0) {
                console.warn('totalMembers là 0, kiểm tra phản hồi server');
                showToast('warning', 'Tổng thành viên là 0, vui lòng kiểm tra dữ liệu');
            } else {
                console.log('Hiển thị totalMembers thành công:', data.totalMembers);
            }
        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu tổng quan:', error);
            showToast('error', 'Lỗi kết nối server: ' + error.message);
        }
    }

    // Fetch and display deposit transactions
    async function fetchDeposits() {
        try {
            const statusFilter = document.querySelector('#deposit-status-filter.filter-select').value;
            const dateFilter = document.querySelector('#deposit-date-filter.filter-date').value;
            let url = '/admin/deposits';
            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);
            if (dateFilter) params.append('date', dateFilter);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url, { credentials: 'include' });
            console.log('Trạng thái /admin/deposits:', response.status);
            if (response.status === 401 || response.status === 403) {
                console.warn('Chuyển hướng về trang chủ do lỗi xác thực');
                window.location.href = '/';
                return;
            }
            const data = await response.json();
            console.log('Dữ liệu nạp tiền:', data);
            if (response.ok) {
                const tbody = document.querySelector('#deposit-table-body.table-body');
                tbody.innerHTML = '';
                data.forEach(tx => {
                    const statusClass = tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                       tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                                       'bg-red-100 text-red-800';
                    const statusText = tx.status === 'pending' ? 'Chờ xử lý' :
                                       tx.status === 'completed' ? 'Thành công' : 'Đã hủy';
                    const row = `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#TX${tx.id}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center">
                                    <div class="flex-shrink-0 h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white">
                                        <i class="fas fa-user"></i>
                                    </div>
                                    <div class="ml-4">
                                        <div class="text-sm font-medium text-gray-900">${tx.username}</div>
                                        <div class="text-sm text-gray-500">ID: ${tx.user_id}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${Number(tx.amount).toLocaleString('vi-VN')} ₫</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center">
                                    <i class="fas fa-university text-2xl text-green-700 mr-2"></i>
                                    <span class="text-sm">${tx.bank_name || 'N/A'}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(tx.created_at).toLocaleString('vi-VN')}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${statusText}</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                ${tx.status === 'pending' ? `
                                    <button onclick="processTransaction(${tx.id}, 'completed')" class="text-primary hover:text-blue-700 mr-3">Xác nhận</button>
                                    <button onclick="processTransaction(${tx.id}, 'rejected')" class="text-red-500 hover:text-red-700">Từ chối</button>
                                ` : `<button class="text-gray-500 hover:text-gray-700 mr-3" disabled>Đã xử lý</button>`}
                            </td>
                        </tr>
                    `;
                    tbody.insertAdjacentHTML('beforeend', row);
                });
                document.querySelector('#deposit-pagination-info.pagination-info').textContent = `Hiển thị 1 đến ${data.length} của ${data.length} kết quả gần nhất`;
            } else {
                console.error('Lỗi từ server:', data.message);
                showToast('error', 'Không thể tải danh sách nạp tiền: ' + (data.message || 'Lỗi không xác định'));
            }
        } catch (error) {
            console.error('Lỗi khi lấy danh sách nạp tiền:', error);
            showToast('error', 'Lỗi kết nối server khi lấy danh sách nạp tiền');
        }
    }

    // Fetch and display withdrawal transactions
    async function fetchWithdrawals() {
        try {
            const statusFilter = document.querySelector('#withdraw-status-filter.filter-select').value;
            const dateFilter = document.querySelector('#withdraw-date-filter.filter-date').value;
            let url = '/admin/withdrawals';
            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);
            if (dateFilter) params.append('date', dateFilter);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url, { credentials: 'include' });
            console.log('Trạng thái /admin/withdrawals:', response.status);
            if (response.status === 401 || response.status === 403) {
                console.warn('Chuyển hướng về trang chủ do lỗi xác thực');
                window.location.href = '/';
                return;
            }
            const data = await response.json();
            console.log('Dữ liệu rút tiền:', data);
            if (response.ok) {
                const tbody = document.querySelector('#withdraw-table-body.table-body');
                tbody.innerHTML = '';
                data.forEach(tx => {
                    const statusClass = tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                       tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                                       'bg-red-100 text-red-800';
                    const statusText = tx.status === 'pending' ? 'Chờ xử lý' :
                                       tx.status === 'completed' ? 'Thành công' : 'Đã hủy';
                    const row = `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#TXW${tx.id}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center">
                                    <div class="flex-shrink-0 h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white">
                                        <i class="fas fa-user"></i>
                                    </div>
                                    <div class="ml-4">
                                        <div class="text-sm font-medium text-gray-900">${tx.username}</div>
                                        <div class="text-sm text-gray-500">ID: ${tx.user_id}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${Number(tx.amount).toLocaleString('vi-VN')} ₫</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center">
                                    <i class="fas fa-university text-2xl text-green-700 mr-2"></i>
                                    <span class="text-sm">${tx.bank_name || 'N/A'}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                ${tx.account_holder || 'N/A'}<br>${tx.account_number || 'N/A'}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(tx.created_at).toLocaleString('vi-VN')}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${statusText}</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                ${tx.status === 'pending' ? `
                                    <button onclick="processTransaction(${tx.id}, 'completed')" class="text-primary hover:text-blue-700 mr-3">Xác nhận</button>
                                    <button onclick="processTransaction(${tx.id}, 'rejected')" class="text-red-500 hover:text-red-700">Từ chối</button>
                                ` : `<button class="text-gray-500 hover:text-gray-700 mr-3" disabled>Đã xử lý</button>`}
                            </td>
                        </tr>
                    `;
                    tbody.insertAdjacentHTML('beforeend', row);
                });
                document.querySelector('#withdraw-pagination-info.pagination-info').textContent = `Hiển thị 1 đến ${data.length} của ${data.length} kết quả gần nhất`;
            } else {
                console.error('Lỗi từ server:', data.message);
                showToast('error', 'Không thể tải danh sách rút tiền: ' + (data.message || 'Lỗi không xác định'));
            }
        } catch (error) {
            console.error('Lỗi khi lấy danh sách rút tiền:', error);
            showToast('error', 'Lỗi kết nối server khi lấy danh sách rút tiền');
        }
    }

    // Fetch and display transaction history
    async function fetchHistory() {
        try {
            const typeFilter = document.querySelector('#history-type-filter.filter-select').value;
            const startDate = document.querySelector('#history-start-date.filter-date').value;
            const endDate = document.querySelector('#history-end-date.filter-date').value;
            let url = '/admin/history';
            const params = new URLSearchParams();
            if (typeFilter && typeFilter !== '') params.append('type', typeFilter.toLowerCase());
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url, { credentials: 'include' });
            console.log('Trạng thái /admin/history:', response.status);
            if (response.status === 401 || response.status === 403) {
                console.warn('Chuyển hướng về trang chủ do lỗi xác thực');
                window.location.href = '/';
                return;
            }
            const data = await response.json();
            console.log('Dữ liệu lịch sử:', data);
            if (response.ok) {
                const tbody = document.querySelector('#history-table-body.table-body');
                tbody.innerHTML = '';
                data.forEach(tx => {
                    const statusClass = tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                       tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                                       'bg-red-100 text-red-800';
                    const statusText = tx.status === 'pending' ? 'Chờ xử lý' :
                                       tx.status === 'completed' ? 'Thành công' : 'Đã hủy';
                    const typeText = tx.type === 'deposit' ? 'Nạp tiền' : 'Rút tiền';
                    const row = `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#TX${tx.id}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center">
                                    <div class="flex-shrink-0 h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white">
                                        <i class="fas fa-user"></i>
                                    </div>
                                    <div class="ml-4">
                                        <div class="text-sm font-medium text-gray-900">${tx.username}</div>
                                        <div class="text-sm text-gray-500">ID: ${tx.user_id}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${typeText}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${Number(tx.amount).toLocaleString('vi-VN')} ₫</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center">
                                    <i class="fas fa-university text-2xl text-green-700 mr-2"></i>
                                    <span class="text-sm">${tx.bank_name || 'N/A'}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(tx.created_at).toLocaleString('vi-VN')}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${statusText}</span>
                            </td>
                        </tr>
                    `;
                    tbody.insertAdjacentHTML('beforeend', row);
                });
                document.querySelector('#history-pagination-info.pagination-info').textContent = `Hiển thị 1 đến ${data.length} của ${data.length} kết quả gần nhất`;
            } else {
                console.error('Lỗi từ server:', data.message);
                showToast('error', 'Không thể tải lịch sử giao dịch: ' + (data.message || 'Lỗi không xác định'));
            }
        } catch (error) {
            console.error('Lỗi khi lấy lịch sử giao dịch:', error);
            showToast('error', 'Lỗi kết nối server khi lấy lịch sử giao dịch');
        }
    }

    // Process transaction (approve/reject)
    window.processTransaction = async function(transactionId, status) {
        try {
            const response = await fetch('/admin/process-transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactionId, status }),
                credentials: 'include'
            });
            const data = await response.json();
            console.log('Kết quả xử lý giao dịch:', data);
            if (response.ok) {
                showToast('success', data.message);
                fetchDeposits();
                fetchWithdrawals();
                fetchOverviewStats();
            } else {
                console.error('Lỗi từ server:', data.message);
                showToast('error', data.message || 'Lỗi khi xử lý giao dịch');
            }
        } catch (error) {
            console.error('Lỗi khi xử lý giao dịch:', error);
            showToast('error', 'Lỗi kết nối server khi xử lý giao dịch');
        }
    };

    // Show toast notification
    function showToast(type, message) {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast notification ${type === 'success' ? 'toast-success' : 'toast-error'}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2"></i>
            <span>${message}</span>
        `;
        toastContainer.appendChild(toast);

        // Auto-remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.add('notification-exit');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Filter event listeners
    document.querySelector('#deposit-status-filter.filter-select').addEventListener('change', fetchDeposits);
    document.querySelector('#deposit-date-filter.filter-date').addEventListener('change', fetchDeposits);
    document.querySelector('#withdraw-status-filter.filter-select').addEventListener('change', fetchWithdrawals);
    document.querySelector('#withdraw-date-filter.filter-date').addEventListener('change', fetchWithdrawals);
    document.querySelector('#history-type-filter.filter-select').addEventListener('change', fetchHistory);
    document.querySelector('#history-start-date.filter-date').addEventListener('change', fetchHistory);
    document.querySelector('#history-end-date.filter-date').addEventListener('change', fetchHistory);

    // Initial data fetch
    fetchOverviewStats();
    fetchDeposits();
    fetchWithdrawals();

    setInterval(fetchOverviewStats, 30000); 
});