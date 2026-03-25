// Login functionality with IndexedDB
console.log('login.js loaded');

// Make sure goToRegister is available globally
window.goToRegister = function() {
    console.log('goToRegister function called');
    try {
        window.location.href = 'register.html';
    } catch (error) {
        console.error('Error in goToRegister:', error);
        alert('Error navigating to register page: ' + error.message);
    }
};

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize the database
    try {
        await userDB.init();
        // Initialize admin user if it doesn't exist
        await userDB.initializeAdmin();
    } catch (error) {
        console.error('Failed to initialize database:', error);
        showMessage('Database initialization failed', 'error');
    }

    // Check if user is already logged in
    if (userDB.isLoggedIn()) {
        showMessage(`Welcome back, ${userDB.getCurrentUser()}!`, 'success');
        // Optionally redirect to dashboard or main page
        // window.location.href = 'dashboard.html';
    }

    // Handle login form submission
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', handleLogin);

    // Handle "Create Account" button click
    const goToRegisterBtn = document.getElementById('goToRegisterBtn');
    if (goToRegisterBtn) {
        goToRegisterBtn.addEventListener('click', goToRegister);
    }
});

async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // Basic validation
    if (!username || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    try {
        showMessage('Logging in...', 'info');
        
        const result = await userDB.loginUser(username, password);
        
        if (result.success) {
            showMessage(result.message, 'success');
            
            // Clear form
            document.getElementById('loginForm').reset();
            
            // Notify the extension about successful login
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'userLoggedIn',
                    data: {
                        user: result.user,
                        token: 'session-token-' + Date.now() // Simple token for demo
                    }
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Failed to notify extension:', chrome.runtime.lastError.message);
                    } else {
                        console.log('Extension notified of login:', response);
                    }
                });
            }
            
            // Redirect after successful login (you can customize this)
            setTimeout(() => {
                if (result.user.role === 'admin') {
                    showMessage(`Welcome Admin! Redirecting to admin dashboard...`, 'success');
                    window.location.href = 'admin.html';
                } else {
                    showMessage(`Welcome, ${username}! You are now logged in.`, 'success');
                    // Close the tab after successful login to return to extension
                    if (typeof chrome !== 'undefined' && chrome.tabs) {
                        chrome.tabs.getCurrent((tab) => {
                            if (tab) {
                                chrome.tabs.remove(tab.id);
                            }
                        });
                    } else {
                        // Fallback: just show success message
                        showMessage('Login successful! You can now close this tab.', 'success');
                    }
                }
            }, 1500);
        }
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

function goToRegister() {
    console.log('goToRegister function called');
    try {
        window.location.href = 'register.html';
    } catch (error) {
        console.error('Error in goToRegister:', error);
        alert('Error navigating to register page: ' + error.message);
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

// Logout function (can be called from other pages)
function logout() {
    userDB.logout();
    showMessage('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1000);
}