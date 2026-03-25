// Registration functionality with IndexedDB
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize the database
    try {
        await userDB.init();
    } catch (error) {
        console.error('Failed to initialize database:', error);
        showMessage('Database initialization failed', 'error');
    }

    // Check if user is already logged in
    if (userDB.isLoggedIn()) {
        showMessage(`You are already logged in as ${userDB.getCurrentUser()}`, 'info');
        // Optionally redirect to dashboard
        // window.location.href = 'dashboard.html';
    }

    // Handle registration form submission
    const registerForm = document.getElementById('registerForm');
    registerForm.addEventListener('submit', handleRegister);

    // Handle "Sign In" button click
    const goToLoginBtn = document.getElementById('goToLoginBtn');
    if (goToLoginBtn) {
        goToLoginBtn.addEventListener('click', goToLogin);
    }
});

async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Basic validation
    if (!username || !password || !confirmPassword) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    // Username length validation (max 8 characters as per HTML placeholder)
    if (username.length > 8) {
        showMessage('Username must be 8 characters or less', 'error');
        return;
    }

    // Username format validation
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showMessage('Username can only contain letters, numbers, and underscores', 'error');
        return;
    }

    // Password confirmation validation
    if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }

    // Password length validation (maximum 6 characters)
    if (password.length > 6) {
        showMessage('Password must be 6 characters or less', 'error');
        return;
    }

    // Password strength validation (minimum 1 character)
    if (password.length < 1) {
        showMessage('Password cannot be empty', 'error');
        return;
    }

    try {
        // Check for duplicate passwords
        showMessage('Checking password uniqueness...', 'info');
        const isDuplicate = await userDB.isPasswordDuplicate(password);
        
        if (isDuplicate) {
            showMessage('This password is already in use by another user. Please choose a different password.', 'error');
            return;
        }

        showMessage('Creating account...', 'info');
        
        const result = await userDB.registerUser(username, password);
        
        if (result.success) {
            showMessage(result.message, 'success');
            
            // Clear form
            document.getElementById('registerForm').reset();
            
            // Redirect to login page after successful registration
            setTimeout(() => {
                showMessage('Redirecting to login page...', 'info');
                window.location.href = 'login.html';
            }, 2000);
        }
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

function goToLogin() {
    window.location.href = 'login.html';
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

// Real-time password confirmation validation
document.addEventListener('DOMContentLoaded', function() {
    const passwordField = document.getElementById('password');
    const confirmPasswordField = document.getElementById('confirmPassword');
    
    function validatePasswordMatch() {
        if (confirmPasswordField.value && passwordField.value !== confirmPasswordField.value) {
            confirmPasswordField.setCustomValidity('Passwords do not match');
        } else {
            confirmPasswordField.setCustomValidity('');
        }
    }
    
    if (passwordField && confirmPasswordField) {
        passwordField.addEventListener('input', validatePasswordMatch);
        confirmPasswordField.addEventListener('input', validatePasswordMatch);
    }
});