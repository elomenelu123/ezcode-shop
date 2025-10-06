import { config } from './config.js';

// ==================== DOM ELEMENTS ====================
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuBtn');
const newChatBtn = document.getElementById('newChatBtn');
const clearBtn = document.getElementById('clearBtn');
const themeBtn = document.getElementById('themeBtn');
const messagesContainer = document.getElementById('messagesContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const charCount = document.getElementById('charCount');
const chatHistory = document.getElementById('chatHistory');
const chatTitle = document.getElementById('chatTitle');

// ==================== STATE ====================
let conversations = [];
let currentConversationId = null;
let conversationHistory = [];

// Load from localStorage
loadConversations();

// ==================== MENU TOGGLE (MOBILE) ====================
menuBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('active');
});

// ==================== NEW CHAT ====================
newChatBtn?.addEventListener('click', () => {
    createNewChat();
});

function createNewChat() {
    currentConversationId = Date.now();
    conversationHistory = [];
    
    // Clear messages
    messagesContainer.innerHTML = '';
    messagesContainer.appendChild(welcomeScreen);
    
    // Update title
    chatTitle.textContent = 'AiMan';
    
    // Clear input
    messageInput.value = '';
    messageInput.focus();
    
    // Close sidebar on mobile
    sidebar.classList.remove('active');
}

// ==================== CLEAR CHAT ====================
clearBtn?.addEventListener('click', () => {
    if (confirm('Czy na pewno chcesz wyczyścić obecną rozmowę?')) {
        conversationHistory = [];
        messagesContainer.innerHTML = '';
        messagesContainer.appendChild(welcomeScreen);
        chatTitle.textContent = 'AiMan';
    }
});

// ==================== THEME TOGGLE ====================
themeBtn?.addEventListener('click', () => {
    // Możesz dodać light mode później
    alert('Light mode - wkrótce! 🌞');
});

// ==================== QUICK PROMPTS ====================
document.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', () => {
        const prompt = card.dataset.prompt;
        messageInput.value = prompt;
        sendMessage();
    });
});

// ==================== INPUT HANDLING ====================
messageInput?.addEventListener('input', () => {
    // Auto resize
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
    
    // Update char count
    charCount.textContent = messageInput.value.length;
    
    // Enable/disable send button
    sendBtn.disabled = !messageInput.value.trim();
});

messageInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn?.addEventListener('click', sendMessage);

// ==================== SEND MESSAGE ====================
async function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // Hide welcome screen
    if (welcomeScreen.parentElement === messagesContainer) {
        welcomeScreen.remove();
    }
    
    // Add user message
    addMessage(message, 'user');
    
    // Save to history
    conversationHistory.push({
        role: 'user',
        parts: [{ text: message }]
    });
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    charCount.textContent = '0';
    sendBtn.disabled = true;
    
    // Show typing indicator
    const typingId = showTypingIndicator();
    
    try {
        // Call AI
        const response = await callGeminiAPI(conversationHistory);
        
        // Remove typing
        removeTypingIndicator(typingId);
        
        // Add AI response
        addMessage(response, 'ai');
        
        // Save to history
        conversationHistory.push({
            role: 'model',
            parts: [{ text: response }]
        });
        
        // Save conversation
        saveConversation(message);
        
    } catch (error) {
        console.error('Błąd AI:', error);
        removeTypingIndicator(typingId);
        addMessage('Przepraszam, wystąpił błąd. Sprawdź czy masz klucz API w config.js', 'ai');
    }
    
    messageInput.focus();
}

// ==================== ADD MESSAGE ====================
function addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = type === 'user' ? '👤' : '⚡';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ==================== TYPING INDICATOR ====================
let typingCounter = 0;

function showTypingIndicator() {
    const id = ++typingCounter;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    messageDiv.dataset.typingId = id;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '⚡';
    
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.innerHTML = '<span></span><span></span><span></span>';
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(typing);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    return id;
}

function removeTypingIndicator(id) {
    const typing = messagesContainer.querySelector(`[data-typing-id="${id}"]`);
    if (typing) typing.remove();
}

// ==================== GEMINI API ====================
async function callGeminiAPI(history) {
    const API_KEY = config.geminiApiKey;
    
    if (!API_KEY || API_KEY === 'TWOJ_GEMINI_API_KEY') {
        throw new Error('Skonfiguruj klucz API w pliku config.js\nPobierz z: https://makersuite.google.com/app/apikey');
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: history,
            generationConfig: {
                temperature: 0.9,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
            }
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API Error');
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// ==================== CONVERSATION MANAGEMENT ====================
function saveConversation(firstMessage) {
    const title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
    
    // Find existing or create new
    let conv = conversations.find(c => c.id === currentConversationId);
    
    if (!conv) {
        conv = {
            id: currentConversationId,
            title: title,
            messages: conversationHistory,
            timestamp: Date.now()
        };
        conversations.unshift(conv);
    } else {
        conv.messages = conversationHistory;
        conv.timestamp = Date.now();
    }
    
    // Keep only last 20 conversations
    if (conversations.length > 20) {
        conversations = conversations.slice(0, 20);
    }
    
    // Save to localStorage
    localStorage.setItem('aimanConversations', JSON.stringify(conversations));
    
    // Update UI
    renderChatHistory();
    
    // Update title
    chatTitle.textContent = title;
}

function loadConversations() {
    const saved = localStorage.getItem('aimanConversations');
    if (saved) {
        conversations = JSON.parse(saved);
        renderChatHistory();
    }
}

function renderChatHistory() {
    chatHistory.innerHTML = '';
    
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'chat-item';
        if (conv.id === currentConversationId) {
            item.classList.add('active');
        }
        item.textContent = conv.title;
        
        item.addEventListener('click', () => {
            loadConversation(conv.id);
        });
        
        chatHistory.appendChild(item);
    });
}

function loadConversation(id) {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    
    currentConversationId = id;
    conversationHistory = [...conv.messages];
    
    // Clear and render messages
    messagesContainer.innerHTML = '';
    
    conv.messages.forEach(msg => {
        const type = msg.role === 'user' ? 'user' : 'ai';
        addMessage(msg.parts[0].text, type);
    });
    
    // Update title
    chatTitle.textContent = conv.title;
    
    // Update active state
    renderChatHistory();
    
    // Close sidebar on mobile
    sidebar.classList.remove('active');
}

// ==================== INITIALIZE ====================
messageInput?.focus();
