// API endpoints
const API_URL = '';

// Active state
let activeLead = null;
let refreshInterval = null;
let channelsList = [];

// DOM Elements
const cols = {
  SITUATION: document.getElementById('col-situation'),
  PROBLEM: document.getElementById('col-problem'),
  IMPLICATION: document.getElementById('col-implication'),
  NEED_PAYOFF: document.getElementById('col-payoff'),
  MEETING_SCHEDULED: document.getElementById('col-scheduled'),
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

// Simulator elements
const simulatorForm = document.getElementById('simulator-form');
const simChannelSelect = document.getElementById('sim-channel');
const simPhoneInput = document.getElementById('sim-phone');
const simNameInput = document.getElementById('sim-name');
const simMessageInput = document.getElementById('sim-message');
const simAudioToggle = document.getElementById('sim-audio-toggle');
const quickBtns = document.querySelectorAll('.quick-btn');

// Channel Selector in Header
const channelFilter = document.getElementById('channel-filter');

// Channel Form
const channelForm = document.getElementById('channel-form');
const chanNameInput = document.getElementById('chan-name');
const chanPhoneIdInput = document.getElementById('chan-phone-id');
const chanDisplayInput = document.getElementById('chan-display');
const chanTokenInput = document.getElementById('chan-token');

// Start up
document.addEventListener('DOMContentLoaded', async () => {
  await fetchChannels();
  fetchLeads();
  setupEventListeners();
  
  // Poll for updates every 3 seconds
  refreshInterval = setInterval(fetchLeads, 3000);
});

function setupEventListeners() {
  btnRefresh.addEventListener('click', fetchLeads);
  btnCloseChat.addEventListener('click', closeChatDrawer);
  drawerOverlay.addEventListener('click', closeChatDrawer);

  // Send manual override or client simulation message
  btnSendManual.addEventListener('click', sendManualMessage);
  
  const btnSendClient = document.getElementById('btn-send-client');
  if (btnSendClient) {
    btnSendClient.addEventListener('click', sendClientSimulationMessage);
  }

  manualMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendClientSimulationMessage(); // Pressing Enter sends as Client in simulation drawer!
    }
  });

  // Simulator Form Submit
  simulatorForm.addEventListener('submit', handleSimulateMessage);

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

  // Quick message simulator shortcuts
  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      simMessageInput.value = btn.getAttribute('data-text');
      if (!simNameInput.value) {
        simNameInput.value = 'Roberto Silva';
      }
    });
  });

  // Configure drag and drop listeners for columns
  Object.keys(cols).forEach(stage => {
    const colEl = cols[stage].parentElement;
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

    // Update Simulator dropdown
    if (simChannelSelect) {
      const selectedVal = simChannelSelect.value;
      simChannelSelect.innerHTML = '';
      channelsList.forEach(c => {
        simChannelSelect.innerHTML += `<option value="${c.phone_number_id}">${escapeHTML(c.name)} (${escapeHTML(c.display_phone_number)})</option>`;
      });
      if (channelsList.length === 0) {
        simChannelSelect.innerHTML = '<option value="default">Canal Padrão</option>';
      }
      simChannelSelect.value = selectedVal || simChannelSelect.firstElementChild?.value || 'default';
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
    cols[key].innerHTML = '';
  });

  // Count items
  const counts = { SITUATION: 0, PROBLEM: 0, IMPLICATION: 0, NEED_PAYOFF: 0, MEETING_SCHEDULED: 0 };

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
    const colParent = cols[key].parentElement;
    const countEl = colParent.querySelector('.card-count');
    if (countEl) countEl.innerText = counts[key];
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
      <span style="font-size:0.65rem; background:rgba(19, 141, 117, 0.2); color:#eff6ff; padding:1px 5px; border-radius:4px;">${escapeHTML(channelName)}</span>
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
  
  chatLeadCnpj.innerText = lead.has_cnpj ? lead.has_cnpj.toUpperCase() : 'Não identificado';
  chatLeadPlan.innerText = lead.current_plan ? lead.current_plan : 'Não identificado';
  chatLeadLives.innerText = lead.num_lives ? lead.num_lives : 'Não identificado';
  chatLeadHospitals.innerText = lead.preferred_hospitals ? lead.preferred_hospitals : 'Não identificado';
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
 * Send client simulation message from active chat drawer
 */
async function sendClientSimulationMessage() {
  if (!activeLead) return;
  const text = manualMessageInput.value.trim();
  if (!text) return;

  const inputEl = manualMessageInput;
  const btnSendClient = document.getElementById('btn-send-client');
  
  inputEl.disabled = true;
  if (btnSendClient) btnSendClient.disabled = true;

  try {
    const res = await fetch(`${API_URL}/api/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: activeLead.phone,
        name: activeLead.name || 'Cliente Simulado',
        text: text,
        isAudio: false,
        channelPhoneId: activeLead.channel_phone_id
      })
    });

    if (res.ok) {
      inputEl.value = '';
      // Exibe imediatamente o texto enviado pelo usuário no histórico
      await fetchChatHistory(activeLead.phone, activeLead.channel_phone_id);
      scrollToBottom();

      // Recarrega o lead (e a resposta do bot que vem após 1.5s)
      setTimeout(async () => {
        await fetchLeads();
        scrollToBottom();
      }, 1600);
    } else {
      alert('Erro ao enviar simulação de cliente');
    }
  } catch (err) {
    console.error('Error sending client simulation:', err);
  } finally {
    inputEl.disabled = false;
    if (btnSendClient) btnSendClient.disabled = false;
    inputEl.focus();
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
 * Handle Simulator Send Submission
 */
async function handleSimulateMessage() {
  const channelPhoneId = simChannelSelect.value;
  const phone = simPhoneInput.value.trim();
  const name = simNameInput.value.trim();
  const text = simMessageInput.value.trim();
  const isAudio = simAudioToggle.checked;

  if (!phone || !text) return;

  const btnSend = document.getElementById('btn-send-sim');
  btnSend.disabled = true;
  btnSend.innerText = 'Enviando...';

  try {
    const res = await fetch(`${API_URL}/api/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name, text, isAudio, channelPhoneId })
    });

    if (res.ok) {
      simMessageInput.value = '';
      // Wait for debouncer simulation + processing to reload leads
      setTimeout(async () => {
        await fetchLeads();
        btnSend.disabled = false;
        btnSend.innerText = 'Simular Envio';
      }, 2000);
    } else {
      alert('Erro ao simular envio de mensagem');
      btnSend.disabled = false;
      btnSend.innerText = 'Simular Envio';
    }
  } catch (error) {
    console.error('Error in simulator:', error);
    btnSend.disabled = false;
    btnSend.innerText = 'Simular Envio';
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
