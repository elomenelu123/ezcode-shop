import { firebaseConfig, aiConfig, emailConfig } from './config.js';

// ==================== EMAILJS INITIALIZATION ====================
emailjs.init(emailConfig.publicKey);

// ==================== FIREBASE SETUP ====================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ==================== VERIFICATION STATE ====================
let verificationCode = null;
let verificationEmail = null;
let verificationName = null;
let verificationPassword = null;
let verificationTimer = null;
let verificationExpiry = null;

// ==================== AUTH STATE ====================
let isLoginMode = true;

onAuthStateChanged(auth, (user) => {
    if (user && window.location.pathname.includes('index.html')) {
        window.location.href = 'chat.html';
    } else if (!user && window.location.pathname.includes('chat.html')) {
        window.location.href = 'index.html';
    }
});

// ==================== DOM ELEMENTS ====================
const googleSignInBtn = document.getElementById('googleSignIn');
const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const nameInput = document.getElementById('name');
const nameGroup = document.getElementById('nameGroup');
const submitBtn = document.getElementById('submitBtn');
const switchModeBtn = document.getElementById('switchMode');
const formTitle = document.getElementById('formTitle');
const formSubtitle = document.getElementById('formSubtitle');
const switchText = document.getElementById('switchText');

// Verification Modal Elements
const verificationModal = document.getElementById('verificationModal');
const emailDisplay = document.getElementById('emailDisplay');
const codeInputs = document.querySelectorAll('.code-input');
const verifyCodeBtn = document.getElementById('verifyCodeBtn');
const resendCodeBtn = document.getElementById('resendCodeBtn');
const closeModalBtn = document.getElementById('closeModal');
const timerDisplay = document.getElementById('timerDisplay');

// ==================== CODE INPUT FUNCTIONALITY ====================
codeInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
        const value = e.target.value;
        
        // Only allow numbers
        if (!/^\d*$/.test(value)) {
            e.target.value = '';
            return;
        }
        
        // Add filled class
        if (value) {
            input.classList.add('filled');
            input.classList.remove('error');
            
            // Move to next input
            if (index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }
        } else {
            input.classList.remove('filled');
        }
        
        // Enable verify button if all filled
        const allFilled = Array.from(codeInputs).every(inp => inp.value);
        verifyCodeBtn.disabled = !allFilled;
    });
    
    // Handle backspace
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
            codeInputs[index - 1].focus();
        }
    });
    
    // Handle paste
    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 4);
        
        if (/^\d{4}$/.test(pastedData)) {
            pastedData.split('').forEach((char, i) => {
                if (codeInputs[i]) {
                    codeInputs[i].value = char;
                    codeInputs[i].classList.add('filled');
                }
            });
            verifyCodeBtn.disabled = false;
        }
    });
});

// ==================== GOOGLE SIGN IN ====================
if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
        try {
            googleSignInBtn.classList.add('loading');
            
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            
            localStorage.setItem('aimanUser', JSON.stringify({
                uid: user.uid,
                name: user.displayName,
                email: user.email,
                photo: user.photoURL
            }));
            
            window.location.href = 'chat.html';
            
        } catch (error) {
            console.error('Błąd logowania:', error);
            showMessage(getErrorMessage(error.code), 'error');
            googleSignInBtn.classList.remove('loading');
        }
    });
}

// ==================== EMAIL/PASSWORD AUTH ====================
if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const name = nameInput.value.trim();
        
        if (password.length < 6) {
            showMessage('Hasło musi mieć minimum 6 znaków', 'error');
            return;
        }
        
        try {
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
            
            if (isLoginMode) {
                // ========== LOGIN ==========
                const result = await signInWithEmailAndPassword(auth, email, password);
                
                localStorage.setItem('aimanUser', JSON.stringify({
                    uid: result.user.uid,
                    name: result.user.displayName || email.split('@')[0],
                    email: result.user.email,
                    photo: null
                }));
                
                window.location.href = 'chat.html';
                
            } else {
                // ========== REGISTER - SEND VERIFICATION CODE ==========
                if (!name) {
                    showMessage('Podaj swoje imię', 'error');
                    submitBtn.classList.remove('loading');
                    submitBtn.disabled = false;
                    return;
                }
                
                // Save data temporarily
                verificationEmail = email;
                verificationName = name;
                verificationPassword = password;
                
                // Generate and send code
                await sendVerificationCode(email, name);
                
                // Show modal
                openVerificationModal(email);
                
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
            
        } catch (error) {
            console.error('Błąd:', error);
            showMessage(getErrorMessage(error.code), 'error');
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });
}

// ==================== SEND VERIFICATION CODE ====================
async function sendVerificationCode(email, name) {
    // Generate 4-digit code
    verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Set expiry (10 minutes)
    verificationExpiry = Date.now() + (10 * 60 * 1000);
    
    console.log('🔐 Kod weryfikacyjny:', verificationCode); // DO TESTÓW - usuń to później!
    
    try {
        // Send email via EmailJS
        await emailjs.send(
            emailConfig.serviceId,
            emailConfig.templateId,
            {
                to_email: email,
                to_name: name,
                verification_code: verificationCode,
                app_name: 'AiMan'
            }
        );
        
        console.log('✅ Email wysłany!');
        return true;
        
    } catch (error) {
        console.error('❌ Błąd wysyłania emaila:', error);
        showMessage('Nie udało się wysłać kodu. Spróbuj ponownie.', 'error');
        throw error;
    }
}

// ==================== VERIFICATION MODAL ====================
function openVerificationModal(email) {
    emailDisplay.textContent = email;
    verificationModal.classList.add('active');
    
    // Clear inputs
    codeInputs.forEach(input => {
        input.value = '';
        input.classList.remove('filled', 'error', 'success');
    });
    
    // Focus first input
    codeInputs[0].focus();
    
    // Start timer
    startVerificationTimer();
    
    // Disable verify button
    verifyCodeBtn.disabled = true;
}

function closeVerificationModal() {
    verificationModal.classList.remove('active');
    stopVerificationTimer();
    
    // Clear data
    verificationCode = null;
    verificationEmail = null;
    verificationName = null;
    verificationPassword = null;
}

// ==================== VERIFICATION TIMER ====================
function startVerificationTimer() {
    stopVerificationTimer();
    
    verificationTimer = setInterval(() => {
        const remaining = verificationExpiry - Date.now();
        
        if (remaining <= 0) {
            stopVerificationTimer();
            timerDisplay.textContent = '0:00';
            timerDisplay.parentElement.classList.add('expired');
            showMessage('Kod wygasł. Wyślij ponownie.', 'error');
            verifyCodeBtn.disabled = true;
            return;
        }
        
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
    }, 1000);
}

function stopVerificationTimer() {
    if (verificationTimer) {
        clearInterval(verificationTimer);
        verificationTimer = null;
    }
}

// ==================== VERIFY CODE ====================
if (verifyCodeBtn) {
    verifyCodeBtn.addEventListener('click', async () => {
        const enteredCode = Array.from(codeInputs).map(input => input.value).join('');
        
        // Check if expired
        if (Date.now() > verificationExpiry) {
            showMessage('Kod wygasł. Wyślij ponownie.', 'error');
            codeInputs.forEach(input => input.classList.add('error'));
            return;
        }
        
        // Verify code
        if (enteredCode === verificationCode) {
            // SUCCESS!
            codeInputs.forEach(input => {
                input.classList.remove('error');
                input.classList.add('success');
            });
            
            verifyCodeBtn.classList.add('loading');
            
            try {
                // Create Firebase account
                const result = await createUserWithEmailAndPassword(
                    auth, 
                    verificationEmail, 
                    verificationPassword
                );
                
                // Update profile
                await updateProfile(result.user, {
                    displayName: verificationName
                });
                
                // Save user
                localStorage.setItem('aimanUser', JSON.stringify({
                    uid: result.user.uid,
                    name: verificationName,
                    email: verificationEmail,
                    photo: null
                }));
                
                // Close modal and redirect
                closeVerificationModal();
                window.location.href = 'chat.html';
                
            } catch (error) {
                console.error('Błąd tworzenia konta:', error);
                showMessage(getErrorMessage(error.code), 'error');
                verifyCodeBtn.classList.remove('loading');
            }
            
        } else {
            // WRONG CODE
            codeInputs.forEach(input => {
                input.classList.add('error');
                input.value = '';
                input.classList.remove('filled');
            });
            codeInputs[0].focus();
            showMessage('Nieprawidłowy kod. Spróbuj ponownie.', 'error');
        }
    });
}

// ==================== RESEND CODE ====================
if (resendCodeBtn) {
    resendCodeBtn.addEventListener('click', async () => {
        resendCodeBtn.disabled = true;
        resendCodeBtn.textContent = 'Wysyłanie...';
        
        try {
            await sendVerificationCode(verificationEmail, verificationName);
            
            // Reset timer
            verificationExpiry = Date.now() + (10 * 60 * 1000);
            timerDisplay.parentElement.classList.remove('expired');
            startVerificationTimer();
            
            // Clear inputs
            codeInputs.forEach(input => {
                input.value = '';
                input.classList.remove('filled', 'error', 'success');
            });
            codeInputs[0].focus();
            
            showMessage('Nowy kod został wysłany!', 'success');
            
            // Re-enable after 30 seconds
            setTimeout(() => {
                resendCodeBtn.disabled = false;
                resendCodeBtn.textContent = 'Wyślij ponownie';
            }, 30000);
            
        } catch (error) {
            resendCodeBtn.disabled = false;
            resendCodeBtn.textContent = 'Wyślij ponownie';
        }
    });
}

// ==================== CLOSE MODAL ====================
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeVerificationModal);
}

// Close on outside click
verificationModal?.addEventListener('click', (e) => {
    if (e.target === verificationModal) {
        closeVerificationModal();
    }
});

// ==================== SWITCH MODE ====================
if (switchModeBtn) {
    switchModeBtn.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        
        if (isLoginMode) {
            formTitle.textContent = 'Zaloguj się';
            formSubtitle.textContent = 'aby kontynuować do AiMan';
            submitBtn.querySelector('span').textContent = 'Zaloguj się';
            switchText.textContent = 'Nie masz konta?';
            switchModeBtn.textContent = 'Zarejestruj się';
            nameGroup.style.display = 'none';
            nameInput.removeAttribute('required');
        } else {
            formTitle.textContent = 'Utwórz konto';
            formSubtitle.textContent = 'i zacznij korzystać z AiMan';
            submitBtn.querySelector('span').textContent = 'Dalej';
            switchText.textContent = 'Masz już konto?';
            switchModeBtn.textContent = 'Zaloguj się';
            nameGroup.style.display = 'flex';
            nameInput.setAttribute('required', '');
        }
        
        authForm.reset();
        removeMessage();
    });
}

// ==================== CHAT PAGE (bez zmian) ====================
if (window.location.pathname.includes('chat.html')) {
    initChat();
}

function initChat() {
    const user = JSON.parse(localStorage.getItem('aimanUser'));
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameEl = document.getElementById('userName');
    const userInitialEl = document.getElementById('userInitial');
    const newChatBtn = document.getElementById('newChatBtn');
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    const messagesContainer = document.getElementById('messagesContainer');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const charCount = document.getElementById('charCount');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    if (userNameEl) userNameEl.textContent = user.name;
    if (userInitialEl) userInitialEl.textContent = user.name.charAt(0).toUpperCase();
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await auth.signOut();
            localStorage.removeItem('aimanUser');
            window.location.href = 'index.html';
        });
    }
    
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
    
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            messagesContainer.innerHTML = '';
            messagesContainer.appendChild(welcomeScreen);
            messageInput.value = '';
            messageInput.focus();
        });
    }
    
    document.querySelectorAll('.prompt-card').forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.dataset.prompt;
            messageInput.value = prompt;
            messageInput.focus();
            sendMessage();
        });
    });
    
    if (messageInput && charCount) {
        messageInput.addEventListener('input', () => {
            charCount.textContent = messageInput.value.length;
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
        });
    }
    
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    async function sendMessage() {
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        if (welcomeScreen && welcomeScreen.parentElement === messagesContainer) {
            welcomeScreen.remove();
        }
        
        addMessage(message, 'user');
        
        messageInput.value = '';
        messageInput.style.height = 'auto';
        charCount.textContent = '0';
        
        sendBtn.disabled = true;
        
        const typingId = showTypingIndicator();
        
        try {
            const response = await callGeminiAPI(message);
            removeTypingIndicator(typingId);
            addMessage(response, 'ai');
        } catch (error) {
            console.error('Błąd AI:', error);
            removeTypingIndicator(typingId);
            addMessage('Przepraszam, wystąpił błąd. Spróbuj ponownie.', 'ai');
        }
        
        sendBtn.disabled = false;
        messageInput.focus();
    }
    
    function addMessage(text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = type === 'user' ? user.name.charAt(0).toUpperCase() : '⚡';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = text;
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    let typingCounter = 0;
    
    function showTypingIndicator() {
        const id = ++typingCounter;
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai';
        typingDiv.dataset.typingId = id;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = '⚡';
        
        const typing = document.createElement('div');
        typing.className = 'typing';
        typing.innerHTML = '<span></span><span></span><span></span>';
        
        typingDiv.appendChild(avatar);
        typingDiv.appendChild(typing);
        
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return id;
    }
    
    function removeTypingIndicator(id) {
        const typingDiv = messagesContainer.querySelector(`[data-typing-id="${id}"]`);
        if (typingDiv) typingDiv.remove();
    }
}

// ==================== AI API ====================
async function callGeminiAPI(message) {
    const API_KEY = aiConfig.geminiApiKey;
    
    if (!API_KEY || API_KEY === 'TWOJ_GEMINI_API_KEY') {
        return 'Skonfiguruj klucz API w pliku config.js';
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: message }] }]
        })
    });
    
    if (!response.ok) throw new Error('API Error');
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// ==================== HELPER FUNCTIONS ====================
function showMessage(text, type) {
    removeMessage();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.id = 'authMessage';
    messageDiv.textContent = text;
    
    const authForm = document.getElementById('authForm');
    authForm.parentElement.insertBefore(messageDiv, authForm);
}

function removeMessage() {
    const existing = document.getElementById('authMessage');
    if (existing) existing.remove();
}

function getErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'Ten email jest już zarejestrowany',
        'auth/invalid-email': 'Nieprawidłowy adres email',
        'auth/user-not-found': 'Nie znaleziono użytkownika',
        'auth/wrong-password': 'Nieprawidłowe hasło',
        'auth/weak-password': 'Hasło jest za słabe',
        'auth/network-request-failed': 'Błąd połączenia',
        'auth/popup-closed-by-user': 'Logowanie anulowane',
        'auth/too-many-requests': 'Za dużo prób'
    };
    
    return messages[code] || 'Wystąpił błąd';
}
