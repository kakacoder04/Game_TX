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

    // Change Admin Password
    document.getElementById('change-admin-password').addEventListener('click', async () => {
        Swal.fire({
            title: 'Đổi Mật Khẩu Admin',
            html: `
                <div class="mb-4 text-left">
                    <label for="swal-password" class="block text-sm font-medium text-gray-700 mb-1">
                        Mật khẩu mới
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
                if (!password) {
                    Swal.showValidationMessage('Hãy nhập mật khẩu!');
                    return false;
                }
                return password;
            },
            didOpen: () => {
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
                    const response = await fetch('/admin/change-admin-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ newPassword }),
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
    });

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
});