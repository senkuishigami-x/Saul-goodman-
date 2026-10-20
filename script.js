(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);

  const input = $('#message-input');
  const messages = $('#messages');
  const sendButton = $('#send-button');
  const micButton = $('#mic-button');
  const stopButton = $('#stop-button');
  const stage = $('#avatar-stage');
  const statusLabel = $('#status-label');
  const orbLabel = $('#orb-label');
  const connectionLabel = $('#connection-label');
  const toast = $('#toast');

  // Add your deployed backend URL here later.
  // Example: https://your-subaru-api.example.com
  // Never put your private API key in this file.
  const API_BASE_URL = 'https://saul-goodman-81en.onrender.com';

  let toastTimer;
  let recognition = null;
  let isBusy = false;

  function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2600);
  }

  function setState(state, label) {
    if (stage) stage.dataset.state = state;
    if (statusLabel) statusLabel.textContent = label;

    if (orbLabel) {
      orbLabel.textContent = ({
        idle: 'SUBARU IS HERE',
        listening: "I'M LISTENING",
        thinking: 'GIVE ME A SECOND',
        speaking: "I'M SPEAKING"
      })[state] || 'SUBARU IS HERE';
    }
  }

  function appendMessage(role, text) {
    const article = document.createElement('article');

    article.className =
      `message ${role === 'user' ? 'user-message' : 'assistant-message'}`;

    article.innerHTML = `
      <div class="message-avatar">S<span>.</span></div>
      <div class="bubble-wrap">
        <div class="message-name">
          ${role === 'user' ? 'YOU' : 'SUBARU'}
          <span>· ${role === 'user' ? 'MESSAGE' : 'RESPONSE'}</span>
        </div>
        <div class="bubble"></div>
      </div>
    `;

    // textContent prevents messages from being interpreted as HTML.
    $('.bubble', article).textContent = text;

    messages.appendChild(article);
    messages.scrollTop = messages.scrollHeight;

    return article;
  }

  // Browser speech output.
  // The actual voice depends on the voices installed on your device.
  function chooseVoice() {
    if (!('speechSynthesis' in window)) return null;

    const voices = window.speechSynthesis.getVoices();

    return (
      voices.find(v =>
        /en-IN/i.test(v.lang) &&
        /google|natural|neural/i.test(v.name)
      ) ||
      voices.find(v => /en-IN/i.test(v.lang)) ||
      voices.find(v =>
        /^en(-|$)/i.test(v.lang) &&
        /google|natural|neural/i.test(v.name)
      ) ||
      voices.find(v => /^en(-|$)/i.test(v.lang)) ||
      null
    );
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      showToast('Speech output is not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = chooseVoice();

    if (voice) utterance.voice = voice;

    utterance.lang = voice?.lang || 'en-IN';
    utterance.rate = 1.02;
    utterance.pitch = 0.88;
    utterance.volume = 1;

    utterance.onstart = () => {
      setState('speaking', 'SPEAKING');
    };

    utterance.onend = () => {
      setState(
        'idle',
        API_BASE_URL ? 'AI ONLINE' : 'LOCAL MODE'
      );
    };

    utterance.onerror = () => {
      setState(
        'idle',
        API_BASE_URL ? 'AI ONLINE' : 'LOCAL MODE'
      );
    };

    window.speechSynthesis.speak(utterance);
  }

  // Honest fallback while the AI backend is disconnected.
  function localReply(text) {
    const message = text.toLowerCase();

    if (/^(hi|hey|hello|yo)\b/.test(message)) {
      return "Hey. Subaru here. I'm listening. What's on your mind?";
    }

    if (/\bwho are you\b|\bwhat are you\b/.test(message)) {
      return "I'm Subaru, your personal assistant. My interface is running, but my full AI brain still needs the secure backend connection.";
    }

    if (/\bhelp\b|\bwhat can you do\b/.test(message)) {
      return "I can receive your messages and use your browser's speech features. Once the backend is connected, I'll be able to use a real AI model for conversation and reasoning. Right now, I'm in local mode.";
    }

    return "I received your message. My AI backend isn't connected yet, so I won't pretend to have fully analysed it. Connect the backend to activate my real AI reasoning.";
  }

  // Real AI requests go to your separate backend.
  async function askAI(text) {
    if (!API_BASE_URL) {
      return {
        reply: localReply(text),
        connected: false
      };
    }

    const response = await fetch(
      `${API_BASE_URL.replace(/\/$/, '')}/api/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: text
        })
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));

      throw new Error(
        data.error || `Backend returned HTTP ${response.status}.`
      );
    }

    const data = await response.json();

    if (typeof data.reply !== 'string' || !data.reply.trim()) {
      throw new Error('The AI backend returned an empty response.');
    }

    return {
      reply: data.reply.trim(),
      connected: true
    };
  }

  async function sendMessage(value = input.value) {
    const text = value.trim();

    if (!text || isBusy) return;

    appendMessage('user', text);

    input.value = '';
    input.style.height = 'auto';

    isBusy = true;
    sendButton.disabled = true;

    setState('thinking', 'THINKING');

    try {
      const result = await askAI(text);

      appendMessage('assistant', result.reply);

      connectionLabel.textContent = result.connected
        ? 'AI CONNECTED'
        : 'LOCAL MODE · AI NOT CONNECTED';

      if (result.connected) {
        speak(result.reply);
      } else {
        setState('idle', 'LOCAL MODE');
      }
    } catch (error) {
      appendMessage(
        'assistant',
        `I couldn't reach my AI brain: ${error.message}\n\nCheck that the backend is running and its URL is configured correctly.`
      );

      setState('idle', 'CONNECTION ERROR');

      showToast('Could not connect to Subaru’s AI backend.');
    } finally {
      isBusy = false;
      sendButton.disabled = false;
      input.focus();
    }
  }

  sendButton.addEventListener('click', () => {
    sendMessage();
  });

  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';

    input.style.height =
      `${Math.min(input.scrollHeight, 150)}px`;
  });

  // Stop voice output.
  stopButton.addEventListener('click', () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setState(
      'idle',
      API_BASE_URL ? 'AI ONLINE' : 'LOCAL MODE'
    );
  });

  // Voice input.
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();

    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState('listening', 'LISTENING');
      micButton.classList.add('listening');
    };

    recognition.onresult = event => {
      input.value = event.results[0][0].transcript;
      sendMessage();
    };

    recognition.onerror = () => {
      showToast('Could not hear that clearly. Try again or type.');
    };

    recognition.onend = () => {
      micButton.classList.remove('listening');

      if (stage.dataset.state === 'listening') {
        setState(
          'idle',
          API_BASE_URL ? 'AI ONLINE' : 'LOCAL MODE'
        );
      }
    };

    micButton.addEventListener('click', () => {
      try {
        recognition.start();
      } catch {
        showToast('Voice recognition is already active.');
      }
    });
  } else {
    micButton.addEventListener('click', () => {
      showToast('Voice input may require Chrome on Android.');
    });
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {};
  }

  // Initial state.
  connectionLabel.textContent = API_BASE_URL
    ? 'AI CONNECTED'
    : 'LOCAL MODE · AI NOT CONNECTED';

  setState(
    'idle',
    API_BASE_URL ? 'AI ONLINE' : 'LOCAL MODE'
  );
})();
