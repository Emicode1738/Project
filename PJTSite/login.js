document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('login-form');
  const username = document.getElementById('username');
  const password = document.getElementById('password');
  const clientMsg = document.getElementById('client-error');
  const loginBtn = form.querySelector('button[type="submit"]');

  function showError(msg) {
    clientMsg.classList.remove('success');
    clientMsg.classList.add('error');
    clientMsg.textContent = msg;
    clientMsg.style.display = 'block';
  }

  function showSuccess(msg) {
    clientMsg.classList.remove('error');
    clientMsg.classList.add('success');
    clientMsg.textContent = msg;
    clientMsg.style.display = 'block';
  }

  function clearMsg() {
    clientMsg.textContent = '';
    clientMsg.style.display = 'none';
  }

  // Show server-provided messages if present (harmless fallback)
  const params = new URLSearchParams(window.location.search);
  if (params.has('error')) showError(params.get('error'));
  else if (params.has('success')) showSuccess(params.get('success'));

  // Live input filtering: allow only letters and numbers, max 8
  username.addEventListener('input', function (e) {
    const raw = username.value;
    // Remove any non-alphanumeric characters
    let filtered = raw.replace(/[^A-Za-z0-9]/g, '');
    if (filtered.length > 8) filtered = filtered.slice(0, 8);
    if (filtered !== raw) {
      username.value = filtered;
      showError('Only letters and numbers allowed; max 8 characters.');
      // Clear the message after a short delay so it doesn't stick
      setTimeout(() => { if (clientMsg.classList.contains('error')) clearMsg(); }, 2200);
    }
  });

  // Form submission: client-side validation then server-side auth
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearMsg();

    const userVal = username.value.trim();
    const passVal = password.value;

    // Client-side validation
    const userRegex = /^[A-Za-z0-9]{1,8}$/;
    if (!userRegex.test(userVal)) {
      showError('Username must be 1–8 characters and contain only letters and numbers.');
      return;
    }

    if (passVal.length === 0) {
      showError('Password is required.');
      return;
    }

    if (passVal.length > 10) {
      showError('Password must be at most 10 characters.');
      return;
    }

    // Disable button during submission
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';

    try {
      // Local authentication (no server needed)
      const validUsers = {
        'danielle': 'password123',
        'admin': 'admin123'
      };

      const userKey = userVal.toLowerCase();
      if (validUsers[userKey] && validUsers[userKey] === passVal) {
        showSuccess(`Welcome ${userVal}! You are now signed in.`);
        // Persist logged-in state for the extension popup
        chrome.storage.local.set({
          loggedIn: {
            username: userVal,
            token: 'local-token-' + Date.now(),
            userId: Math.random().toString(36).substr(2, 9)
          }
        }, () => {
          console.log('User logged in:', userVal);
          // Close this tab after login
          setTimeout(() => window.close(), 1500);
        });
      } else {
        showError('Invalid username or password');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
      }
    } catch (err) {
      showError('Error: ' + err.message);
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    }
  });
});
