// Admin dashboard functionality
document.addEventListener('DOMContentLoaded', async function() {
    // Check if user is logged in and is admin
    if (!userDB.isLoggedIn()) {
        showMessage('Please log in to access the admin dashboard', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    // Initialize the database
    try {
        await userDB.init();
    } catch (error) {
        console.error('Failed to initialize database:', error);
        showMessage('Database initialization failed', 'error');
        return;
    }

    // Check if current user is admin
    if (!userDB.isAdmin()) {
        showMessage('Access denied. Admin privileges required.', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    // Set admin name
    document.getElementById('adminName').textContent = userDB.getCurrentUser();

    // Load users
    await loadUsers();
    
    // Add event listener for logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});

async function loadUsers() {
    const loadingDiv = document.getElementById('loadingUsers');
    const tableContainer = document.getElementById('usersTableContainer');
    const noUsersDiv = document.getElementById('noUsers');
    const tableBody = document.getElementById('usersTableBody');

    try {
        // Show loading
        loadingDiv.style.display = 'block';
        tableContainer.style.display = 'none';
        noUsersDiv.style.display = 'none';

        // Get all users
        const users = await userDB.getAllUsers();

        // Hide loading
        loadingDiv.style.display = 'none';

        if (users.length === 0) {
            noUsersDiv.style.display = 'block';
            return;
        }

        // Clear table body
        tableBody.innerHTML = '';

        // Populate table
        users.forEach(async (user) => {
            const row = document.createElement('tr');
            
            const usernameCell = document.createElement('td');
            usernameCell.textContent = user.username;
            
            // Password cell
            const passwordCell = document.createElement('td');
            const passwordSpan = document.createElement('span');
            passwordSpan.className = 'password-cell';
            passwordSpan.textContent = user.rawPassword || 'N/A';
            passwordCell.appendChild(passwordSpan);
            
            const roleCell = document.createElement('td');
            const roleBadge = document.createElement('span');
            roleBadge.className = `role-badge role-${user.role || 'user'}`;
            roleBadge.textContent = (user.role || 'user').toUpperCase();
            roleCell.appendChild(roleBadge);
            
            const createdCell = document.createElement('td');
            const createdDate = new Date(user.createdAt);
            createdCell.textContent = createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString();
            
            const actionsCell = document.createElement('td');
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = 'Delete';
            
            const changePasswordBtn = document.createElement('button');
            changePasswordBtn.className = 'change-password-btn';
            changePasswordBtn.textContent = 'Change Password';
            changePasswordBtn.onclick = () => changeUserPassword(user.username);
            
            // Disable delete button for current admin user
            if (user.username === userDB.getCurrentUser()) {
                deleteBtn.disabled = true;
                deleteBtn.title = 'Cannot delete your own account';
            } else {
                deleteBtn.onclick = () => confirmDeleteUser(user.username);
            }
            
            actionsCell.appendChild(deleteBtn);
            actionsCell.appendChild(changePasswordBtn);
            
            row.appendChild(usernameCell);
            row.appendChild(passwordCell);
            row.appendChild(roleCell);
            row.appendChild(createdCell);
            row.appendChild(actionsCell);
            
            tableBody.appendChild(row);
        });

        tableContainer.style.display = 'block';

    } catch (error) {
        console.error('Failed to load users:', error);
        showMessage('Failed to load users: ' + error.message, 'error');
        loadingDiv.style.display = 'none';
    }
}

function confirmDeleteUser(username) {
    const confirmed = confirm(`Are you sure you want to delete user "${username}"?\n\nThis action cannot be undone and will permanently remove the user's account and all associated data.`);
    
    if (confirmed) {
        deleteUser(username);
    }
}

async function deleteUser(username) {
    try {
        showMessage(`Deleting user "${username}"...`, 'info');
        
        const result = await userDB.deleteUser(username);
        
        if (result.success) {
            showMessage(result.message, 'success');
            // Reload users table
            await loadUsers();
        }
    } catch (error) {
        console.error('Failed to delete user:', error);
        showMessage('Failed to delete user: ' + error.message, 'error');
    }
}

async function changeUserPassword(username) {
    const newPassword = prompt(`Enter new password for user "${username}":`);
    
    if (newPassword === null) {
        return; // User cancelled
    }
    
    if (!newPassword || newPassword.trim().length === 0) {
        showMessage('Password cannot be empty', 'error');
        return;
    }
    
    if (newPassword.length > 6) {
        showMessage('Password must be 6 characters or less', 'error');
        return;
    }
    
    try {
        showMessage(`Changing password for user "${username}"...`, 'info');
        
        const result = await userDB.changeUserPassword(username, newPassword);
        
        if (result.success) {
            showMessage(result.message, 'success');
            // Reload users table to show updated password
            await loadUsers();
        }
    } catch (error) {
        console.error('Failed to change password:', error);
        showMessage('Failed to change password: ' + error.message, 'error');
    }
}

function logout() {
    const confirmed = confirm('Are you sure you want to logout?');
    if (confirmed) {
        userDB.logout();
        showMessage('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }
}

function showMessage(message, type = 'info') {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    
    // Clear message after 5 seconds
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = 'message';
    }, 5000);
}