(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const STORAGE = {
    tasks: 'subaru.tasks.v1',
    memory: 'subaru.memory.v1'
  };

  const promptInput = $('#prompt-input');
  const responseArea = $('#response-area');
  const coreState = $('#core-state');
  const toast = $('#toast');

  let toastTimer;

  // LOCAL STORAGE
  function readStore(key, fallback = []) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      showToast('Browser storage is unavailable.');
      return false;
    }
  }

  // SECURITY: ESCAPE HTML
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  // NOTIFICATIONS
  function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  function setCoreState(state) {
    if (coreState) coreState.textContent = state;
  }

  // NAVIGATION
  function showView(name) {
    $$('.view').forEach(view => {
      view.classList.toggle(
        'active-view',
        view.dataset.panel === name
      );
    });

    $$('.rail-button').forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.view === name
      );
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  $$('[data-view]').forEach(button => {
    button.addEventListener('click', () => {
      showView(button.dataset.view);
    });
  });

  // RESPONSE DISPLAY
  function addResponse(userText, responseText, label = 'LOCAL REASONING') {
    const placeholder = $('.response-placeholder', responseArea);

    if (placeholder) placeholder.remove();

    const card = document.createElement('article');
    card.className = 'response-message';

    card.innerHTML = `
      <div class="message-meta">${escapeHTML(label)}</div>
      <div class="message-body"></div>
      <div class="message-actions">
        <button class="small-action" data-action="save">
          SAVE AS MEMORY
        </button>
        <button class="small-action" data-action="task">
          ADD AS TASK
        </button>
      </div>
    `;

    $('.message-body', card).textContent = responseText;

    $('[data-action="save"]', card).addEventListener('click', () => {
      addMemory(userText, true);
    });

    $('[data-action="task"]', card).addEventListener('click', () => {
      addTask(userText);
      showView('tasks');
    });

    responseArea.prepend(card);
  }

  // SUBARU LOCAL REASONING ENGINE
  function localReasoning(raw) {
    const text = raw.trim();
    const lower = text.toLowerCase();

    const tasks = readStore(STORAGE.tasks);
    const memory = readStore(STORAGE.memory);

    if (/^(hi|hello|hey|yo|good morning|good afternoon|good evening)\b/.test(lower)) {
      return `Hey. SUBARU is online.

I'm ready to help you organise tasks, structure decisions, and save useful notes.

My current reasoning engine runs locally in your browser. Live AI integration has not been connected yet.`;
    }

    if (/\b(help|what can you do|capabilities|commands)\b/.test(lower)) {
      return `SUBARU CAPABILITIES

• Organise decisions into goals, options, and risks.
• Add and manage tasks.
• Save useful information as memory notes.
• Accept voice input when supported by your browser.
• Retrieve saved notes from this browser.

CURRENT LIMITATIONS

I cannot yet browse the internet, control other applications, or contact a live AI model from this page.

Those capabilities require additional integrations.`;
    }

    if (/\b(task|todo|to-do|remind|remember to|organise|organize)\b/.test(lower)) {
      return `Let's turn that into an actionable task.

Suggested next step:
${text}

Use ADD AS TASK below to add this request to your task list.

Note: this prototype does not send background notifications yet.`;
    }

    if (/\b(decide|decision|choose|choice|should i|pros and cons|what should)\b/.test(lower)) {
      return `DECISION ANALYSIS

1. GOAL
Identify the outcome that matters most.

2. OPTIONS
List at least two realistic choices.

3. CONSTRAINTS
Consider time, money, effort, and other people affected.

4. RISKS
Identify what could go wrong and whether the decision can be reversed.

5. NEXT ACTION
Choose the smallest useful step that gives you more information.

YOUR SITUATION
"${text}"

I can structure your thinking, but this local prototype cannot yet use a live AI model to analyse complex situations in depth.`;
    }

    if (/\b(plan|schedule|today|week|study|study plan)\b/.test(lower)) {
      const openTasks = tasks.filter(task => !task.done);

      const notes = memory
        .slice(0, 3)
        .map(item => `• ${item.text}`)
        .join('\n');

      return `PLANNING MODE

1. Choose your most important outcome.
2. Divide it into tasks of roughly 20–45 minutes.
3. Start with the highest-priority task.
4. Leave time for breaks and unexpected delays.
5. Review your progress at the end.

OPEN TASKS: ${openTasks.length}
${notes ? `\nSAVED CONTEXT:\n${notes}` : ''}

Tell me your deadline and available time for a more specific plan.`;
    }

    if (/\b(memory|saved|what do you know|what do you remember)\b/.test(lower)) {
      if (!memory.length) {
        return `LOCAL MEMORY

No notes have been saved yet.

Open Memory to save preferences, useful information, or context.

Your notes are stored in this browser.`;
      }

      return `LOCAL MEMORY

${memory.map((item, index) =>
        `${index + 1}. ${item.text}`
      ).join('\n')}

These notes are stored in this browser.`;
    }

    return `MESSAGE RECEIVED

"${text}"

A useful starting point:

• Define the desired outcome.
• Separate known facts from assumptions.
• Identify realistic options.
• Consider possible risks.
• Choose one useful next action.

This is the early SUBARU prototype. The interface, local task manager, and memory system work independently of a live AI model.

A secure backend and AI integration will be needed for more advanced reasoning.`;
  }

  // MESSAGE SUBMISSION
  function submitPrompt(value = promptInput.value) {
    const text = value.trim();

    if (!text) {
      showToast('Type a message first.');
      promptInput.focus();
      return;
    }

    setCoreState('THINKING');

    const sendButton = $('#send-button');

    if (sendButton) sendButton.disabled = true;

    setTimeout(() => {
      addResponse(text, localReasoning(text));

      promptInput.value = '';

      if (sendButton) sendButton.disabled = false;

      setCoreState('STANDING BY');
    }, 320);
  }

  $('#send-button').addEventListener('click', () => {
    submitPrompt();
  });

  promptInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitPrompt();
    }
  });

  $$('.quick-chip').forEach(button => {
    button.addEventListener('click', () => {
      promptInput.value = button.dataset.prompt;
      submitPrompt();
    });
  });

  // VOICE INPUT
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  const voiceButton = $('#voice-button');

  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();

    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      voiceButton.classList.add('listening');
      setCoreState('LISTENING');
      showToast('Listening...');
    };

    recognition.onresult = event => {
      promptInput.value = event.results[0][0].transcript;
      setCoreState('STANDING BY');
      submitPrompt();
    };

    recognition.onerror = () => {
      showToast('Voice input stopped. Try typing instead.');
    };

    recognition.onend = () => {
      voiceButton.classList.remove('listening');

      if (coreState.textContent === 'LISTENING') {
        setCoreState('STANDING BY');
      }
    };

    voiceButton.addEventListener('click', () => {
      try {
        recognition.start();
      } catch {
        showToast('Voice input is already active.');
      }
    });
  } else {
    voiceButton.addEventListener('click', () => {
      showToast(
        'Voice input is unavailable in this browser. Try Chrome or type your message.'
      );
    });
  }

  // TASK MANAGER
  function addTask(text) {
    const clean = String(text || '').trim();

    if (!clean) return;

    const tasks = readStore(STORAGE.tasks);

    tasks.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text: clean,
      done: false,
      createdAt: new Date().toISOString()
    });

    if (writeStore(STORAGE.tasks, tasks)) {
      renderTasks();
      showToast('Task added.');
    }
  }

  function renderTasks() {
    const tasks = readStore(STORAGE.tasks);
    const list = $('#task-list');

    list.innerHTML = '';

    tasks.forEach(task => {
      const item = document.createElement('div');

      item.className = `task-item${task.done ? ' done' : ''}`;

      item.innerHTML = `
        <button class="task-check"
          aria-label="${task.done ? 'Mark incomplete' : 'Mark complete'}">
          ${task.done ? '✓' : ''}
        </button>

        <div class="task-text"></div>

        <button class="delete-button" aria-label="Delete task">
          ×
        </button>
      `;

      $('.task-text', item).textContent = task.text;

      $('.task-check', item).addEventListener('click', () => {
        const updated = readStore(STORAGE.tasks).map(current =>
          current.id === task.id
            ? { ...current, done: !current.done }
            : current
        );

        writeStore(STORAGE.tasks, updated);
        renderTasks();
      });

      $('.delete-button', item).addEventListener('click', () => {
        const updated = readStore(STORAGE.tasks).filter(
          current => current.id !== task.id
        );

        writeStore(STORAGE.tasks, updated);
        renderTasks();
        showToast('Task deleted.');
      });

      list.append(item);
    });

    const openCount = tasks.filter(task => !task.done).length;

    $('#task-count').textContent =
      `${openCount} OPEN TASK${openCount === 1 ? '' : 'S'}`;

    $('#tasks-empty').style.display =
      tasks.length ? 'none' : 'block';
  }

  $('#task-form').addEventListener('submit', event => {
    event.preventDefault();

    const input = $('#task-input');

    if (!input.value.trim()) return;

    addTask(input.value);
    input.value = '';
  });

  $('#clear-completed').addEventListener('click', () => {
    const remaining = readStore(STORAGE.tasks).filter(
      task => !task.done
    );

    writeStore(STORAGE.tasks, remaining);
    renderTasks();
    showToast('Completed tasks cleared.');
  });

  // LOCAL MEMORY
  function addMemory(text, quiet = false) {
    const clean = String(text || '').trim();

    if (!clean) {
      showToast('Write a note first.');
      return;
    }

    const memories = readStore(STORAGE.memory);

    memories.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text: clean,
      createdAt: new Date().toISOString()
    });

    if (writeStore(STORAGE.memory, memories)) {
      renderMemories();

      showToast(
        quiet
          ? 'Saved to local memory.'
          : 'Memory saved on this device.'
      );
    }
  }

  function renderMemories() {
    const memories = readStore(STORAGE.memory);
    const list = $('#memory-list');

    list.innerHTML = '';

    memories.forEach(memory => {
      const item = document.createElement('article');

      item.className = 'memory-item';

      const date = new Date(memory.createdAt);

      item.innerHTML = `
        <div class="memory-content">
          <p></p>
          <div class="memory-date"></div>
        </div>

        <button class="delete-button" aria-label="Delete memory">
          ×
        </button>
      `;

      $('.memory-content p', item).textContent = memory.text;

      $('.memory-date', item).textContent =
        Number.isNaN(date.getTime())
          ? 'SAVED NOTE'
          : `SAVED ${date.toLocaleDateString()}`;

      $('.delete-button', item).addEventListener('click', () => {
        const updated = readStore(STORAGE.memory).filter(
          note => note.id !== memory.id
        );

        writeStore(STORAGE.memory, updated);
        renderMemories();
        showToast('Memory deleted.');
      });

      list.append(item);
    });

    $('#memory-empty').style.display =
      memories.length ? 'none' : 'block';
  }

  $('#memory-form').addEventListener('submit', event => {
    event.preventDefault();

    const input = $('#memory-input');

    if (!input.value.trim()) return;

    addMemory(input.value);
    input.value = '';
  });

  // INITIALISE SUBARU
  renderTasks();
  renderMemories();

})();
