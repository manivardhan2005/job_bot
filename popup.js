// popup.js — FormFill AI v4

const STORAGE_KEY = 'formfill_profile';

// All field IDs — must match popup.html exactly
const TEXT_FIELDS = [
  // Personal tab
  'firstName','lastName','email','phone','whatsapp','dob','gender',
  'city','state','pincode','nationality',
  'linkedin','github','portfolio',
  'workAuth','visaRequired','currentCTC','expectedCTC',
  'noticePeriod','availability','workType','relocate','preferredCities','disability',
  // Career tab
  'jobTitle','experience','currentCompany','currentDesignation','empType','industry',
  'currentRoleDesc','prevRoleDesc',
  'educationDegree','educationBranch','college','gradYear','gpa','class12','class10',
  'languages','aiStack','frameworks','cloudTools','certifications',
  'project1','project2','project3',
  'summary','whySwitching','strength','weakness','fiveYear','achievements',
  // Settings tab
  'apiKey'
];
const LICENSE_API = 'https://formfill-api.amitmishra4447.workers.dev';
const TOGGLE_FIELDS = ['autoDetect','fillGoogleForms','showHighlights'];

// ── Tab switching ────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
    tab.classList.add('on');
    const panelEl = document.getElementById('tab-' + tab.dataset.tab);
    if (panelEl) panelEl.classList.add('on');
  });
});

// ── Toggle API key visibility ────────────────────────────────────────────
document.getElementById('toggleKey').addEventListener('click', () => {
  const inp = document.getElementById('apiKey');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});

// ── Skills tag input ─────────────────────────────────────────────────────
let skills = [];

document.getElementById('skillsInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,$/, '');
    if (val && !skills.includes(val)) { skills.push(val); renderSkills(); }
    e.target.value = '';
  }
});

function renderSkills() {
  const c = document.getElementById('skillsTags');
  c.innerHTML = skills.map((s, i) =>
    `<span class="stag" data-i="${i}">${escHtml(s)} ✕</span>`
  ).join('');
  c.querySelectorAll('.stag').forEach(t => {
    t.onclick = () => { skills.splice(+t.dataset.i, 1); renderSkills(); };
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}



// ── Resume: Analyze with Groq ───────────────────────────────────────────
document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const text = (document.getElementById('resumeText').value || '').trim();
  const preview = document.getElementById('resumePreview');

  if (text.length < 80) {
    preview.textContent = '⚠ Please paste your resume text first (at least a few lines).';
    return;
  }

  const stored = await new Promise(r => chrome.storage.local.get(['device_id', 'license_key', STORAGE_KEY], r));
  const apiKey = (stored[STORAGE_KEY]?.apiKey || '').trim();

  if (!apiKey.startsWith('gsk_')) {
    preview.textContent = '⚠ Please add your Groq API key in the Settings tab first.';
    return;
  }
  
  // Get or create device ID
  let deviceId = stored.device_id;
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    await new Promise(r => chrome.storage.local.set({ device_id: deviceId }, r));
  }

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Analyzing…';
  preview.textContent = '🤖 Analyzing resume…';

  try {
    const resp = await fetch(`${LICENSE_API}/api/analyze-resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId,
      },
      body: JSON.stringify({
        license_key: stored.license_key || '',
        apiKey,
        resumeText: text.substring(0, 6000),
      })
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    const summary = data.summary || 'Could not parse resume.';
    preview.textContent = summary;

    // Save raw text + AI summary
    await new Promise(r => chrome.storage.local.set({
      formfill_resume: { name: 'pasted_resume.txt', text, isPdf: false },
      formfill_resume_summary: summary
    }, r));

    preview.textContent = '✓ Saved!\n\n' + summary;
  } catch (err) {
    preview.textContent = '❌ Error: ' + err.message;
  }

  btn.disabled = false;
  btn.textContent = '🤖 Analyze & Save';
});

document.getElementById('clearResumeBtn').addEventListener('click', () => {
  if (confirm('Clear saved resume text?')) {
    document.getElementById('resumeText').value = '';
    document.getElementById('resumePreview').textContent = 'Resume cleared.';
    chrome.storage.local.remove(['formfill_resume', 'formfill_resume_summary']);
  }
});

// ── Save profile ─────────────────────────────────────────────────────────
document.getElementById('saveBtn').addEventListener('click', saveProfile);

function getFormData() {
  const profile = {};
  TEXT_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) profile[id] = el.value.trim();
  });
  TOGGLE_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) profile[id] = el.checked;
  });
  profile.skills = [...skills];
  return profile;
}

function saveProfile() {
  const profile = getFormData();

  // If resume text is present, save it too
  const resumeTextEl = document.getElementById('resumeText');
  if (resumeTextEl && resumeTextEl.value.trim().length > 50) {
    chrome.storage.local.set({
      formfill_resume: { name: 'pasted_resume.txt', text: resumeTextEl.value.trim(), isPdf: false }
    });
  }

  chrome.storage.local.set({ [STORAGE_KEY]: profile }, () => {
    showSaved();
    updatePill();
  });
}

function showSaved() {
  const el = document.getElementById('ss');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function updatePill() {
  const key = (document.getElementById('apiKey')?.value || '').trim();
  const pill = document.getElementById('pill');
  if (key.startsWith('gsk_')) {
    pill.textContent = 'READY ✦';
    pill.className = 'pill ok';
  } else {
    pill.textContent = 'No Key';
    pill.className = 'pill no';
  }
}

// ── Run agent on current tab ─────────────────────────────────────────────
document.getElementById('runBtn').addEventListener('click', async () => {
  saveProfile();
  await new Promise(r => setTimeout(r, 250));
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { action: 'triggerFill' });
  window.close();
});

// ── Clear all data ───────────────────────────────────────────────────────
document.getElementById('clearData').addEventListener('click', () => {
  if (confirm('This will delete your entire saved profile and resume. Are you sure?')) {
    chrome.storage.local.clear(() => {
      skills = [];
      loadProfile();
    });
  }
});

// ── Load saved profile ───────────────────────────────────────────────────
function loadProfile() {
  chrome.storage.local.get(
    [STORAGE_KEY, 'formfill_resume', 'formfill_resume_summary'],
    result => {
      const p = result[STORAGE_KEY] || {};

      TEXT_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (el && p[id]) el.value = p[id];
      });
      TOGGLE_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (el && p[id] !== undefined) el.checked = p[id];
      });

      skills = Array.isArray(p.skills) ? p.skills : [];
      renderSkills();
      updatePill();

      // Load resume text
      const resume = result['formfill_resume'];
      if (resume && resume.text) {
        document.getElementById('resumeText').value = resume.text;
      }
      const summary = result['formfill_resume_summary'];
      if (summary) {
        document.getElementById('resumePreview').textContent = summary;
      }
    }
  );
}

loadProfile();

// Premium logic completely removed.
