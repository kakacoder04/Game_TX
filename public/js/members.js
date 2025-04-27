document.addEventListener('DOMContentLoaded', () => {
    // Toggle sidebar
    const toggleSidebar = document.getElementById('toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    const contentArea = document.getElementById('content-area');

    toggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-collapsed');
        contentArea.classList.toggle('content-expanded');
    });

    // Logout functionality
    document.getElementById('logout').addEventListener('click', async (event) => {
        event.preventDefault();
        try {
            const response = await fetch('/logout', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await response.json();
            if (response.ok) {
                showToast('success', data.message);
                setTimeout(() => {
                    window.location.href = data.redirect || '/';
                }, 1000);
            } else {
                showToast('error', data.message || 'Đăng xuất thất bại');
            }
        } catch (error) {
            showToast('error', 'Lỗi kết nối server khi đăng xuất');
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        }
    });

    // Fetch and display members
    async function fetchMembers() {
        try {
            const searchUsername = document.getElementById('search-username').value;
            const statusFilter = document.getElementById('status-filter').value;
            let url = '/admin/members';
            const queryParams = new URLSearchParams();
            if (searchUsername) {
                queryParams.append('username', searchUsername);
            }
            if (statusFilter) {
                queryParams.append('status', statusFilter);
            }
            if (queryParams.toString()) {
                url += `?${queryParams.toString()}`;
            }

            const response = await fetch(url, { credentials: 'include' });
            if (response.status === 401 || response.status === 403) {
                window.location.href = '/';
                return;
            }
            const data = await response.json();
            if (response.ok) {
                const tbody = document.getElementById('members-table-body');
                tbody.innerHTML = '';
                data.forEach(user => {
                    const statusClass = user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                    const statusText = user.is_active ? 'Hoạt động' : 'Bị khóa';
                    const row = `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.id}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.username}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${Number(user.balance).toLocaleString('vi-VN')} ₫</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${statusText}</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div class="flex space-x-2">
                                    <button onclick="changePassword(${user.id})" class="min-w-[80px] px-4 py-2 bg-primary text-white rounded-lg shadow-sm hover:bg-blue-600 transition duration-200 text-sm font-semibold text-center">
                                        Đổi MK
                                    </button>
                                    <button onclick="toggleAccountStatus(${user.id}, ${user.is_active})" class="min-w-[90px] px-4 py-2 ${user.is_active ? 'bg-red-500' : 'bg-green-500'} text-white rounded-lg shadow-sm hover:${user.is_active ? 'bg-red-600' : 'bg-green-600'} transition duration-200 text-sm font-semibold text-center">
                                        ${user.is_active ? 'Khóa' : 'Mở khóa'}
                                    </button>
                                    <button onclick="deleteAccount(${user.id})" class="min-w-[80px] px-4 py-2 bg-red-600 text-white rounded-lg shadow-sm hover:bg-red-700 transition duration-200 text-sm font-semibold text-center">
                                        Xóa
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                    tbody.insertAdjacentHTML('beforeend', row);
                });
                document.getElementById('members-pagination-info').textContent = `Hiển thị 1 đến ${data.length} của ${data.length} kết quả`;
            } else {
                showToast('error', data.message || 'Không thể tải danh sách thành viên');
            }
        } catch (error) {
            showToast('error', 'Lỗi kết nối server khi tải danh sách thành viên');
        }
    }

    // Change password with SweetAlert2
    window.changePassword = async function(userId) {
        Swal.fire({
            title: 'Đổi Mật Khẩu',
            html: `
                <div class="mb-4 text-left">
                    <label for="swal-password" class="block text-sm font-medium text-gray-700 mb-1">
                        Mật khẩu mới (tối thiểu 8 ký tự)
                    </label>
                    <div class="relative">
                        <input 
                            type="password" 
                            id="swal-password" 
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white shadow-sm transition duration-200"
                            placeholder="Nhập mật khẩu mới"
                        >
                        <span id="toggle-password" class="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-500 hover:text-gray-700 transition duration-200">
                            <i class="fas fa-eye"></i>
                        </span>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Xác Nhận',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#3b82f6',
            cancelButtonColor: '#ef4444',
            width: '32rem',
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.95)',
            backdrop: 'rgba(0, 0, 0, 0.5)',
            preConfirm: () => {
                const password = document.getElementById('swal-password').value;
                if (!password || password.length < 8) {
                    Swal.showValidationMessage('Mật khẩu phải có ít nhất 8 ký tự!');
                    return false;
                }
                return password;
            },
            didOpen: () => {
                // Toggle password visibility
                const togglePassword = document.getElementById('toggle-password');
                const passwordInput = document.getElementById('swal-password');
                togglePassword.addEventListener('click', () => {
                    const isPassword = passwordInput.type === 'password';
                    passwordInput.type = isPassword ? 'text' : 'password';
                    togglePassword.innerHTML = `<i class="fas ${isPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
                });
            },
            customClass: {
                popup: 'rounded-2xl shadow-xl',
                title: 'text-xl font-bold text-gray-800 mb-2',
                htmlContainer: 'text-sm',
                confirmButton: 'px-6 py-2 rounded-lg text-white font-semibold hover:bg-blue-700 transition duration-200',
                cancelButton: 'px-6 py-2 rounded-lg text-white font-semibold hover:bg-red-500 transition duration-200',
                validationMessage: 'text-sm text-red-500 mt-2'
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const newPassword = result.value;
                try {
                    const response = await fetch('/admin/change-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, newPassword }),
                        credentials: 'include'
                    });
                    const data = await response.json();
                    if (response.ok) {
                        showToast('success', data.message);
                    } else {
                        showToast('error', data.message || 'Lỗi khi đổi mật khẩu');
                    }
                } catch (error) {
                    showToast('error', 'Lỗi kết nối server khi đổi mật khẩu');
                }
            }
        });
    };

    // Toggle account status
    window.toggleAccountStatus = async function(userId, isActive) {
        try {
            const response = await fetch('/admin/toggle-account-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, isActive: !isActive }),
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok) {
                showToast('success', data.message);
                fetchMembers();
            } else {
                showToast('error', data.message || 'Lỗi khi thay đổi trạng thái tài khoản');
            }
        } catch (error) {
            showToast('error', 'Lỗi kết nối server khi thay đổi trạng thái tài khoản');
        }
    };

    // Delete account with SweetAlert2
    window.deleteAccount = async function(userId) {
        const result = await Swal.fire({
            title: 'Bạn Có Chắc?',
            text: 'Tài khoản này sẽ bị xóa vĩnh viễn!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Xóa',
            cancelButtonText: 'Hủy',
            customClass: {
                popup: 'rounded-xl shadow-lg',
                title: 'text-lg font-semibold text-gray-800',
                htmlContainer: 'text-sm text-gray-600',
                confirmButton: 'px-4 py-2 rounded-lg text-white font-medium',
                cancelButton: 'px-4 py-2 rounded-lg text-white font-medium'
            }
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch('/admin/delete-account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId }),
                    credentials: 'include'
                });
                const data = await response.json();
                if (response.ok) {
                    showToast('success', data.message);
                    fetchMembers();
                } else {
                    showToast('error', data.message || 'Lỗi khi xóa tài khoản');
                }
            } catch (error) {
                showToast('error', 'Lỗi kết nối server khi xóa tài khoản');
            }
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

        setTimeout(() => {
            toast.classList.add('notification-exit');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Search and filter event listeners
    document.getElementById('search-username').addEventListener('input', fetchMembers);
    document.getElementById('status-filter').addEventListener('change', fetchMembers);

    // Initial data fetch
    fetchMembers();
});