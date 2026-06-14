// API endpoints
const API_URL = '';

// Active state
let activeLead = null;
let refreshInterval = null;
let channelsList = [];
let selectedFileToUpload = null;

// Admin Credentials
const CREDENTIALS = {
  '@huddy': 'Prime2026.',
  '@perelli': 'Perelli2026.',
  '@admin': 'PerelliAdmin.'
};

// DOM Elements
const cols = {
  SITUATION: document.getElementById('col-situation'),
  NEED_PAYOFF: document.getElementById('col-payoff'),
  MEETING_SCHEDULED: document.getElementById('col-scheduled'),
  CONVERTED: document.getElementById('col-converted'),
};

const btnRefresh = document.getElementById('btn-refresh');
const chatDrawer = document.getElementById('chat-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const btnCloseChat = document.getElementById('btn-close-chat');

// Chat Drawer detail fields
const chatLeadName = document.getElementById('chat-lead-name');
const chatLeadPhone = document.getElementById('chat-lead-phone');
const chatLeadStage = document.getElementById('chat-lead-stage');
const chatLeadCnpj = document.getElementById('chat-lead-cnpj');
const chatLeadPlan = document.getElementById('chat-lead-plan');
const chatLeadLives = document.getElementById('chat-lead-lives');
const chatLeadHospitals = document.getElementById('chat-lead-hospitals');
const chatHistoryContainer = document.getElementById('chat-history-container');
const manualMessageInput = document.getElementById('manual-message-input');
const btnSendManual = document.getElementById('btn-send-manual');

// Channel Selector in Header
const channelFilter = document.getElementById('channel-filter');

// Channel Form
const channelForm = document.getElementById('channel-form');
const chanNameInput = document.getElementById('chan-name');
const chanPhoneIdInput = document.getElementById('chan-phone-id');
const chanDisplayInput = document.getElementById('chan-display');
const chanTokenInput = document.getElementById('chan-token');
const channelsTableBody = document.getElementById('channels-table-body');

// Navigation Tabs
const navTabs = document.querySelectorAll('.nav-tab');
const tabViews = document.querySelectorAll('.tab-view');

// Theme Switcher Button
const btnThemeToggle = document.getElementById('btn-theme-toggle');

// Document Form & Upload
const uploadDropzone = document.getElementById('upload-dropzone');
const fileUploadInput = document.getElementById('file-upload-input');
const fileNamePreview = document.getElementById('file-name-preview');
const btnUploadFile = document.getElementById('btn-upload-file');
const uploadStatus = document.getElementById('upload-status');
const documentsTableBody = document.getElementById('documents-table-body');

// Login Elements
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginUser = document.getElementById('login-user');
const loginPass = document.getElementById('login-pass');
const loginError = document.getElementById('login-error');

// Start up
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await checkLogin();
  setupEventListeners();
});

async function initializeDashboard() {
  await fetchChannels();
  await fetchLeads();
  await fetchDocuments();
  
  // Poll for updates every 3 seconds
  if (!refreshInterval) {
    refreshInterval = setInterval(fetchLeads, 3000);
  }
}

async function checkLogin() {
  const token = sessionStorage.getItem('adminToken');
  if (!token) {
    loginOverlay.classList.remove('hidden');
    // Fetch channels anyway to show something if needed
    await fetchChannels();
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.valid) {
        loginOverlay.classList.add('hidden');
        await initializeDashboard();
        return;
      }
    }
  } catch (err) {
    console.error('Error verifying token:', err);
  }

  sessionStorage.removeItem('adminToken');
  loginOverlay.classList.remove('hidden');
  await fetchChannels();
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    btnThemeToggle.innerHTML = '🌙 Tema Dark';
  } else {
    document.body.classList.remove('light-theme');
    btnThemeToggle.innerHTML = '☀️ Tema Clean';
  }
}

function setupEventListeners() {
  // Theme Toggle listener
  btnThemeToggle.addEventListener('click', () => {
    if (document.body.classList.contains('light-theme')) {
      document.body.classList.remove('light-theme');
      btnThemeToggle.innerHTML = '☀️ Tema Clean';
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.add('light-theme');
      btnThemeToggle.innerHTML = '🌙 Tema Dark';
      localStorage.setItem('theme', 'light');
    }
  });

  // Login Submit listener
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = loginUser.value.trim();
    const password = loginPass.value.trim();

    const btnLogin = document.getElementById('btn-login');
    btnLogin.disabled = true;
    btnLogin.innerText = 'Autenticando...';
    loginError.innerText = '';

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem('adminToken', data.token);
        sessionStorage.setItem('adminUser', username);
        loginOverlay.classList.add('hidden');
        loginError.innerText = '';
        await initializeDashboard();
      } else {
        const data = await res.json();
        loginError.innerText = data.error || 'Usuário ou senha incorretos.';
      }
    } catch (err) {
      console.error('Login error:', err);
      loginError.innerText = 'Erro ao conectar com o servidor.';
    } finally {
      btnLogin.disabled = false;
      btnLogin.innerText = 'Fazer Login';
    }
  });

  // Navigation Tabs switching
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-target');
      
      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      tabViews.forEach(view => {
        if (view.id === target) {
          view.classList.remove('hidden');
        } else {
          view.classList.add('hidden');
        }
      });

      if (target === 'view-documents') {
        fetchDocuments();
      } else if (target === 'view-channels') {
        fetchChannels();
      } else if (target === 'view-crm') {
        fetchLeads();
      }
    });
  });

  // CRM Board control listeners
  btnRefresh.addEventListener('click', fetchLeads);
  btnCloseChat.addEventListener('click', closeChatDrawer);
  drawerOverlay.addEventListener('click', closeChatDrawer);

  // Send manual override
  btnSendManual.addEventListener('click', sendManualMessage);
  
  manualMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendManualMessage();
    }
  });

  // Channel Form Submit
  if (channelForm) {
    channelForm.addEventListener('submit', handleSaveChannel);
  }

  // Filter Leads by Channel selection
  if (channelFilter) {
    channelFilter.addEventListener('change', () => {
      fetchLeads();
    });
  }

  // Drag & Drop Upload Zone listeners
  if (uploadDropzone) {
    uploadDropzone.addEventListener('click', () => {
      fileUploadInput.click();
    });

    fileUploadInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleSelectedFile(e.target.files[0]);
      }
    });

    uploadDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadDropzone.classList.add('dragover');
    });

    uploadDropzone.addEventListener('dragleave', () => {
      uploadDropzone.classList.remove('dragover');
    });

    uploadDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleSelectedFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (btnUploadFile) {
    btnUploadFile.addEventListener('click', handleUploadFile);
  }

  // Configure drag and drop listeners for columns
  Object.keys(cols).forEach(stage => {
    const colEl = cols[stage]?.parentElement;
    if (colEl) {
      colEl.addEventListener('dragover', (e) => {
        e.preventDefault();
      });
      colEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        const leadDataJson = e.dataTransfer.getData('text/plain');
        if (!leadDataJson) return;
        
        const lead = JSON.parse(leadDataJson);
        if (lead.stage === stage) return; // Same stage, do nothing

        console.log(`[DRAG & DROP] Moving ${lead.name} from ${lead.stage} to ${stage}`);
        await updateLeadStage(lead.phone, lead.channel_phone_id, stage);
      });
    }
  });
}

/**
 * Fetch registered WhatsApp channels
 */
async function fetchChannels() {
  try {
    const res = await fetch(`${API_URL}/api/channels`);
    if (!res.ok) throw new Error('Failed to fetch channels');
    channelsList = await res.json();
    
    // Update Header filter dropdown
    if (channelFilter) {
      const selectedVal = channelFilter.value;
      channelFilter.innerHTML = '<option value="">Todos os canais</option>';
      channelsList.forEach(c => {
        channelFilter.innerHTML += `<option value="${c.phone_number_id}">${escapeHTML(c.name)} (${escapeHTML(c.display_phone_number)})</option>`;
      });
      channelFilter.value = selectedVal;
    }

    // Render channels in active channels table
    if (channelsTableBody) {
      channelsTableBody.innerHTML = '';
      if (channelsList.length === 0) {
        channelsTableBody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align: center; color: var(--text-secondary);">Nenhum canal de WhatsApp cadastrado.</td>
          </tr>
        `;
      } else {
        channelsList.forEach(c => {
          channelsTableBody.innerHTML += `
            <tr>
              <td><strong>${escapeHTML(c.name)}</strong></td>
              <td>${escapeHTML(c.display_phone_number)} (ID: ${escapeHTML(c.phone_number_id)})</td>
              <td><span style="color: var(--success-accent); font-weight: 600;">● Conectado</span></td>
            </tr>
          `;
        });
      }
    }
  } catch (error) {
    console.error('Error fetching channels:', error);
  }
}

/**
 * Handle new channel registration
 */
async function handleSaveChannel() {
  const phone_number_id = chanPhoneIdInput.value.trim();
  const display_phone_number = chanDisplayInput.value.trim();
  const name = chanNameInput.value.trim();
  const access_token = chanTokenInput.value.trim();

  const btn = document.getElementById('btn-save-chan');
  btn.disabled = true;
  btn.innerText = 'Salvando...';

  try {
    const res = await fetch(`${API_URL}/api/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number_id, display_phone_number, access_token, name })
    });

    if (res.ok) {
      chanPhoneIdInput.value = '';
      chanDisplayInput.value = '';
      chanNameInput.value = '';
      chanTokenInput.value = '';
      await fetchChannels();
      alert('Canal de WhatsApp salvo com sucesso!');
    } else {
      const err = await res.json();
      alert(`Erro: ${err.error || 'Falha ao salvar canal'}`);
    }
  } catch (error) {
    console.error('Error registering channel:', error);
    alert('Erro ao conectar com a API.');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Salvar Canal';
  }
}

/**
 * Fetch all leads and render them on the Kanban board
 */
async function fetchLeads() {
  // Only fetch if logged in
  if (!sessionStorage.getItem('adminToken')) return;

  try {
    const channelId = channelFilter ? channelFilter.value : '';
    const url = channelId ? `${API_URL}/api/leads?channelPhoneId=${channelId}` : `${API_URL}/api/leads`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch leads');
    const leads = await res.json();
    renderKanban(leads);

    // If active chat drawer is open, refresh it as well
    if (activeLead) {
      const currentLead = leads.find(l => l.phone === activeLead.phone && l.channel_phone_id === activeLead.channel_phone_id);
      if (currentLead) {
        activeLead = currentLead;
        updateDrawerDetails(currentLead);
        await fetchChatHistory(currentLead.phone, currentLead.channel_phone_id);
      }
    }
  } catch (error) {
    console.error('Error fetching leads:', error);
  }
}

/**
 * Render lead cards into corresponding columns
 */
function renderKanban(leads) {
  // Clear columns
  Object.keys(cols).forEach(key => {
    if (cols[key]) cols[key].innerHTML = '';
  });

  // Count items
  const counts = { SITUATION: 0, NEED_PAYOFF: 0, MEETING_SCHEDULED: 0, CONVERTED: 0 };

  leads.forEach(lead => {
    const stage = lead.stage || 'SITUATION';
    if (cols[stage]) {
      counts[stage]++;
      const card = createLeadCard(lead);
      cols[stage].appendChild(card);
    }
  });

  // Update counts in DOM
  Object.keys(cols).forEach(key => {
    if (cols[key]) {
      const colParent = cols[key].parentElement;
      const countEl = colParent.querySelector('.card-count');
      if (countEl) countEl.innerText = counts[key] || 0;
    }
  });
}

/**
 * Create HTML Element for Kanban Lead Card
 */
function createLeadCard(lead) {
  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.setAttribute('draggable', 'true');
  
  // Format metadata CNPJ status preview
  let cnpjText = lead.has_cnpj ? `CNPJ: ${lead.has_cnpj.toUpperCase()}` : 'CNPJ: Não qualificado';
  if (lead.preferred_hospitals) {
    cnpjText += ` | Hosp: ${lead.preferred_hospitals}`;
  }

  // Get channel display
  const channel = channelsList.find(c => c.phone_number_id === lead.channel_phone_id);
  const channelName = channel ? channel.name : 'Padrão';

  const timeString = lead.updated_at ? formatTime(new Date(lead.updated_at)) : '--:--';

  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div class="card-lead-name">${escapeHTML(lead.name || 'Cliente Sem Nome')}</div>
      <span style="font-size:0.65rem; background:rgba(19, 141, 117, 0.2); color:var(--text-primary); padding:1px 5px; border-radius:4px;">${escapeHTML(channelName)}</span>
    </div>
    <div class="card-lead-phone">${escapeHTML(lead.phone)}</div>
    <div class="card-lead-cart-preview">${escapeHTML(cnpjText)}</div>
    <div class="card-footer">
      <span>${timeString}</span>
      <span class="card-total">${lead.current_plan ? escapeHTML(lead.current_plan) : 'S/ Plano'}</span>
    </div>
  `;

  // Dragstart setup
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(lead));
  });

  // Open Live Chat drawer on click
  card.addEventListener('click', () => {
    openChatDrawer(lead);
  });

  return card;
}

/**
 * Open Chat Drawer and load history
 */
async function openChatDrawer(lead) {
  activeLead = lead;
  updateDrawerDetails(lead);
  chatDrawer.classList.add('active');
  await fetchChatHistory(lead.phone, lead.channel_phone_id);
  scrollToBottom();
}

function updateDrawerDetails(lead) {
  const channel = channelsList.find(c => c.phone_number_id === lead.channel_phone_id);
  const channelLabel = channel ? `${channel.name} (${channel.display_phone_number})` : 'Padrão';

  chatLeadName.innerText = lead.name || 'Cliente Sem Nome';
  chatLeadPhone.innerHTML = `${escapeHTML(lead.phone)} <span style="font-size:0.75rem; color:var(--text-secondary);">Canal: ${escapeHTML(channelLabel)}</span>`;
  chatLeadStage.innerText = lead.stage;
  
  if (chatLeadCnpj) chatLeadCnpj.innerText = lead.has_cnpj ? lead.has_cnpj.toUpperCase() : 'Não qualificado';
  if (chatLeadPlan) chatLeadPlan.innerText = lead.current_plan ? lead.current_plan : 'Não qualificado';
  if (chatLeadLives) chatLeadLives.innerText = lead.num_lives ? lead.num_lives : 'Não qualificado';
  if (chatLeadHospitals) chatLeadHospitals.innerText = lead.preferred_hospitals ? lead.preferred_hospitals : 'Não qualificado';
}

function closeChatDrawer() {
  activeLead = null;
  chatDrawer.classList.remove('active');
}

/**
 * Fetch message log history for selected lead
 */
async function fetchChatHistory(phone, channelPhoneId) {
  try {
    const res = await fetch(`${API_URL}/api/leads/${phone}/messages?channelPhoneId=${channelPhoneId || 'default'}`);
    if (!res.ok) throw new Error('Failed to fetch chat history');
    const messages = await res.json();
    renderChatHistory(messages);
  } catch (error) {
    console.error('Error fetching chat history:', error);
  }
}

/**
 * Render messages inside chat drawer including media files
 */
function renderChatHistory(messages) {
  chatHistoryContainer.innerHTML = '';
  messages.forEach(msg => {
    const msgEl = document.createElement('div');
    msgEl.className = `chat-message ${msg.sender}`;
    
    // Message Text Content
    msgEl.innerHTML = escapeHTML(msg.text).replace(/\n/g, '<br>');
    
    // Rich Media Content Render
    if (msg.media) {
      let mediaHtml = '';
      const type = msg.media.type;
      const url = msg.media.url;
      const filename = msg.media.filename || 'arquivo.pdf';

      if (type === 'image') {
        mediaHtml = `
          <div class="chat-media-preview">
            <a href="${url}" target="_blank">🖼️ Imagem Enviada</a>
            <img src="${url}" alt="Imagem do SDR">
          </div>
        `;
      } else if (type === 'video') {
        mediaHtml = `
          <div class="chat-media-preview">
            <a href="${url}" target="_blank">🎥 Vídeo Enviado</a>
            <video src="${url}" controls preload="metadata"></video>
          </div>
        `;
      } else if (type === 'audio') {
        mediaHtml = `
          <div class="chat-media-preview">
            <span>🎵 Mensagem de Voz</span>
            <audio src="${url}" controls preload="metadata"></audio>
          </div>
        `;
      } else if (type === 'document') {
        mediaHtml = `
          <div class="chat-media-preview">
            📁 Documento: <a href="${url}" target="_blank">${escapeHTML(filename)}</a>
          </div>
        `;
      }
      msgEl.innerHTML += mediaHtml;
    }

    chatHistoryContainer.appendChild(msgEl);
  });
}

/**
 * Send manual override message
 */
async function sendManualMessage() {
  if (!activeLead) return;
  const text = manualMessageInput.value.trim();
  if (!text) return;

  btnSendManual.disabled = true;
  try {
    const res = await fetch(`${API_URL}/api/leads/${activeLead.phone}/manual-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text, 
        channelPhoneId: activeLead.channel_phone_id 
      })
    });

    if (res.ok) {
      manualMessageInput.value = '';
      await fetchLeads(); // Force reload leads & chat details
      scrollToBottom();
    } else {
      alert('Erro ao enviar mensagem manual');
    }
  } catch (err) {
    console.error('Error sending manual message:', err);
  } finally {
    btnSendManual.disabled = false;
  }
}

/**
 * Move lead stage manually
 */
async function updateLeadStage(phone, channelPhoneId, stage) {
  try {
    const res = await fetch(`${API_URL}/api/leads/${phone}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        stage, 
        channelPhoneId 
      })
    });
    if (res.ok) {
      await fetchLeads();
    } else {
      alert('Erro ao atualizar estágio do lead');
    }
  } catch (error) {
    console.error('Error updating stage:', error);
  }
}

/**
 * Document Drag & Drop File Handlers
 */
function handleSelectedFile(file) {
  selectedFileToUpload = file;
  fileNamePreview.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  btnUploadFile.disabled = false;
  uploadStatus.innerText = '';
  uploadStatus.className = 'upload-status';
}

async function handleUploadFile() {
  if (!selectedFileToUpload) return;

  btnUploadFile.disabled = true;
  uploadStatus.innerText = 'Enviando documento e sincronizando com o Git (isso pode levar alguns segundos)...';
  uploadStatus.className = 'upload-status info';

  try {
    const filenameEncoded = encodeURIComponent(selectedFileToUpload.name);
    const res = await fetch(`/api/upload-document?filename=${filenameEncoded}`, {
      method: 'POST',
      body: selectedFileToUpload
    });

    if (res.ok) {
      const data = await res.json();
      uploadStatus.innerText = '✅ Documento enviado e commitado com sucesso!';
      uploadStatus.className = 'upload-status success';
      
      // Clear selected file
      selectedFileToUpload = null;
      fileNamePreview.innerText = 'Nenhum arquivo selecionado';
      fileUploadInput.value = '';
      btnUploadFile.disabled = true;

      // Reload files list
      await fetchDocuments();
    } else {
      const err = await res.json();
      uploadStatus.innerText = `❌ Erro no upload: ${err.error || 'Falha desconhecida'}`;
      uploadStatus.className = 'upload-status error';
      btnUploadFile.disabled = false;
    }
  } catch (error) {
    console.error('Error uploading document:', error);
    uploadStatus.innerText = '❌ Erro ao enviar o arquivo para o servidor.';
    uploadStatus.className = 'upload-status error';
    btnUploadFile.disabled = false;
  }
}

async function fetchDocuments() {
  if (!documentsTableBody) return;

  try {
    const res = await fetch(`${API_URL}/api/documents`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    const docs = await res.json();

    documentsTableBody.innerHTML = '';
    if (docs.length === 0) {
      documentsTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--text-secondary);">Nenhum documento na pasta /documentos.</td>
        </tr>
      `;
    } else {
      docs.forEach(doc => {
        const sizeKB = (doc.size / 1024).toFixed(1);
        const sizeText = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
        documentsTableBody.innerHTML += `
          <tr>
            <td><strong>${escapeHTML(doc.name)}</strong></td>
            <td>${sizeText}</td>
            <td><a href="${escapeHTML(doc.url)}" target="_blank">🔗 Visualizar / Baixar</a></td>
          </tr>
        `;
      });
    }
  } catch (error) {
    console.error('Error fetching documents:', error);
  }
}

// Helpers
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function formatTime(date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  setTimeout(() => {
    chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
  }, 50);
}
