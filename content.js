// content.js – FormFill AI Agent v3
// True agentic form filling with radio/checkbox support + rich DOM context

(function () {
  if (window.__formfillInjected) return;
  window.__formfillInjected = true;

  let profile = {};
  let resumeSummary = '';
  let floatingBtn = null;
  let panel = null;
  let isPanelOpen = false;
  let fillRunning = false;

  // ── Profile refresh ───────────────────────────────────────────────────────
  function refreshProfile() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getProfile' }, res => {
        if (chrome.runtime.lastError || !res) { resolve(); return; }
        profile = res.profile || {};
        const resume = res.resume;
        resumeSummary = res.resumeSummary ||
          (resume && !resume.isPdf && resume.text ? resume.text.substring(0, 2000) : '') || '';
        resolve();
      });
    });
  }

  async function init() {
    await refreshProfile();
    // Floating button auto-detect disabled per user request
    // if (profile.autoDetect !== false && isJobApplicationPage())
    //   setTimeout(showFloatingButton, 1000);
  }

  function isJobApplicationPage() {
    const url  = window.location.href.toLowerCase();
    const text = document.body.innerText.toLowerCase();
    const urlHints  = ['apply','application','job','career','hiring','recruit','workday',
      'greenhouse','lever','ashby','smartrecruiters','docs.google.com/forms','bamboohr',
      'jobvite','icims','taleo','successfactors','breezy','screenloop','rippling'];
    const textHints = ['first name','last name','email','phone','resume','cover letter',
      'work authorization','linkedin','years of experience','submit application','apply now'];
    const inputs = document.querySelectorAll('input:not([type=hidden]), textarea, select');
    return inputs.length >= 2 && (urlHints.some(h => url.includes(h)) || textHints.filter(h => text.includes(h)).length >= 2);
  }

  function isGoogleForm() {
    const url = window.location.href.toLowerCase();
    return url.includes('docs.google.com/forms') || url.includes('forms.google.com') ||
           !!document.querySelector('[data-params]');
  }

  function getGoogleFormLabel(el) {
    let container = el.closest('[role="listitem"]');
    if (!container) {
      let node = el.parentElement;
      for (let i = 0; i < 12 && node && node !== document.body; i++) {
        if (node.getAttribute('role') === 'listitem' || node.hasAttribute('data-item-id') || node.hasAttribute('data-params')) {
          container = node; break;
        }
        node = node.parentElement;
      }
    }
    if (!container) return null;
    // Strategy 1: [role="heading"] in question container
    const heading = container.querySelector('[role="heading"]');
    if (heading) {
      const spans = heading.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent.trim();
        if (text && text !== '*' && text.length > 1 && !span.getAttribute('aria-label')?.includes('Required')) return text;
      }
      const hText = heading.textContent.replace(/\*/g, '').trim();
      if (hText && hText.length > 1) return hText;
    }
    // Strategy 2: data-params contains question text
    const paramEl = container.querySelector('[data-params]');
    if (paramEl) {
      const params = paramEl.getAttribute('data-params');
      if (params) {
        const match = params.match(/,"([^"]{2,200})"/);
        if (match) return match[1];
      }
    }
    // Strategy 3: First substantial text block that isn't the input
    const allEls = container.querySelectorAll('span, div, p, h1, h2, h3, h4');
    for (const te of allEls) {
      if (te.querySelector('input, textarea, select')) continue;
      if (te.contains(el)) continue;
      const text = te.innerText?.trim();
      if (text && text.length > 2 && text.length < 200 && text !== '*' && !text.includes('\n')) return text;
    }
    return null;
  }

  // ── Floating button ───────────────────────────────────────────────────────
  function showFloatingButton() {
    if (floatingBtn) return;
    floatingBtn = document.createElement('div');
    floatingBtn.innerHTML = `
      <div id="__ff_fab" style="
        position:fixed;bottom:24px;right:24px;z-index:2147483647;
        background:linear-gradient(135deg,#6c63ff,#8b5cf6);
        color:#fff;border-radius:50px;padding:11px 20px;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:13px;font-weight:600;cursor:pointer;
        box-shadow:0 4px 24px rgba(108,99,255,0.55);
        display:flex;align-items:center;gap:9px;
        transition:all 0.25s;user-select:none;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
        Auto-Fill with AI
      </div>`;
    document.body.appendChild(floatingBtn);
    const fab = document.getElementById('__ff_fab');
    fab.onmouseenter = () => { fab.style.transform='translateY(-3px)'; fab.style.boxShadow='0 10px 32px rgba(108,99,255,0.65)'; };
    fab.onmouseleave = () => { fab.style.transform=''; fab.style.boxShadow='0 4px 24px rgba(108,99,255,0.55)'; };
    fab.onclick = () => isPanelOpen ? closePanel() : openPanel();
  }

  // ── Panel HTML ────────────────────────────────────────────────────────────
  function buildPanelHTML() {
    return `<style>
    #__ff_panel{position:fixed;top:0;right:0;height:100vh;width:380px;
      background:#0c0c14;border-left:1px solid #252535;z-index:2147483646;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      transform:translateX(100%);transition:transform 0.32s cubic-bezier(0.4,0,0.2,1);
      display:flex;flex-direction:column;box-shadow:-12px 0 50px rgba(0,0,0,0.6);}
    #__ff_panel *{box-sizing:border-box;margin:0;padding:0;}
    .ffp-head{padding:16px 18px 14px;background:linear-gradient(135deg,#131325,#1a1a35);
      border-bottom:1px solid #252535;display:flex;align-items:center;gap:11px;flex-shrink:0;}
    .ffp-logo{width:30px;height:30px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#6c63ff,#c084fc);}
    .ffp-logo svg{width:16px;height:16px;}
    .ffp-name{flex:1;}
    .ffp-title{font-size:14px;font-weight:700;color:#fff;letter-spacing:-0.2px;}
    .ffp-sub{font-size:10px;color:#6060a0;margin-top:1px;}
    .ffp-close{width:28px;height:28px;background:#1c1c30;border:1px solid #252535;
      border-radius:7px;cursor:pointer;color:#6060a0;font-size:15px;line-height:28px;
      text-align:center;transition:all 0.15s;flex-shrink:0;}
    .ffp-close:hover{background:#ff5577;color:#fff;border-color:#ff5577;}
    .ffp-body{flex:1;overflow-y:auto;padding:14px;padding-bottom:140px;}
    .ffp-card{background:#131325;border:1px solid #252535;border-radius:12px;overflow:hidden;margin-bottom:12px;}
    .ffp-card-head{padding:8px 14px;background:#1a1a35;border-bottom:1px solid #252535;
      font-size:10px;font-weight:700;letter-spacing:0.9px;text-transform:uppercase;
      color:#6060a0;display:flex;align-items:center;gap:7px;}
    .ffp-card-body{padding:10px 14px;}
    .ffp-page-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;
      border-radius:20px;font-size:11px;font-weight:600;
      background:rgba(108,99,255,0.12);border:1px solid rgba(108,99,255,0.3);color:#a0a0ff;}
    .ffp-page-badge.high{background:rgba(67,233,123,0.1);border-color:rgba(67,233,123,0.3);color:#43e97b;}
    .ffp-page-badge.low{background:rgba(255,100,100,0.1);border-color:rgba(255,100,100,0.3);color:#ff6464;}
    .ffp-page-type{font-size:12px;color:#8080b0;margin-top:7px;line-height:1.5;}
    .ffp-field{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);
      font-size:12px;align-items:flex-start;}
    .ffp-field:last-child{border-bottom:none;}
    .ffp-field-icon{font-size:13px;width:18px;text-align:center;flex-shrink:0;margin-top:1px;}
    .ffp-field-info{flex:1;min-width:0;}
    .ffp-field-label{color:#A0A0A0 !important;font-size:10px;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .ffp-field-value{color:#e0e0ff;word-break:break-word;line-height:1.5;}
    .ffp-field-reason{color:#4040a0;font-size:10px;margin-top:2px;line-height:1.4;font-style:italic;}
    .ffp-log{background:#0a0a12;border-radius:8px;padding:10px 12px;
      font-size:11px;line-height:1.7;max-height:200px;overflow-y:auto;}
    .ffp-log-line{display:flex;gap:6px;margin-bottom:1px;}
    .ffp-log-line .ts{color:#404060;flex-shrink:0;font-size:10px;}
    .ffp-log-line .msg{flex:1;}
    .ffp-log-line.info  .msg{color:#6c63ff;}
    .ffp-log-line.success .msg{color:#43e97b;}
    .ffp-log-line.error  .msg{color:#ff5577;}
    .ffp-log-line.ai    .msg{color:#fbbf24;}
    .ffp-log-line.skip  .msg{color:#404060;}
    .ffp-prog-wrap{height:4px;background:#1c1c30;border-radius:4px;overflow:hidden;margin-bottom:12px;}
    .ffp-prog-bar{height:100%;border-radius:4px;width:0%;
      background:linear-gradient(90deg,#6c63ff,#43e97b);transition:width 0.5s ease;}
    .ffp-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;}
    .ffp-stat{background:#131325;border:1px solid #252535;border-radius:10px;padding:10px 8px;text-align:center;}
    .ffp-stat-n{font-size:22px;font-weight:800;color:#6c63ff;line-height:1;}
    .ffp-stat-n.ai{color:#fbbf24;} .ffp-stat-n.skip{color:#505070;}
    .ffp-stat-l{font-size:10px;color:#505070;margin-top:3px;}
    .ffp-warn{background:rgba(255,85,119,0.08);border:1px solid rgba(255,85,119,0.25);
      border-radius:10px;padding:10px 12px;font-size:11px;color:#ff5577;
      line-height:1.6;margin-bottom:12px;display:none;}
    .ffp-btn{width:100%;padding:10px 16px;border-radius:9px;font-size:13px;font-weight:700;
      cursor:pointer;border:none;transition:all 0.2s;font-family:inherit;letter-spacing:0.2px;}
    .ffp-btn-primary{background:linear-gradient(135deg,#6c63ff,#8b5cf6) !important;color:#fff !important;}
    .ffp-btn-primary:hover:not(:disabled){opacity:0.88;transform:translateY(-1px);box-shadow:0 6px 20px rgba(108,99,255,0.4);}
    .ffp-btn-primary:disabled{opacity:0.4;cursor:not-allowed;transform:none;}
    .ffp-btn-secondary{background:#131325 !important;color:#a0a0c0 !important;border:1px solid #252535 !important;}
    .ffp-btn-secondary:hover{border-color:#6c63ff;color:#a0a0ff;}
    ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-thumb{background:#252535;border-radius:2px;}
    </style>
    <div id="__ff_panel">
      <div class="ffp-head">
        <div class="ffp-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
        </div>
        <div class="ffp-name">
          <div class="ffp-title">FormFill Agent</div>
          <div class="ffp-sub">AI-powered form filler</div>
        </div>
        <div class="ffp-close" id="__ff_close">✕</div>
      </div>
      <div class="ffp-body">
        <div class="ffp-warn" id="__ff_warn"></div>
        <div class="ffp-card">
          <div class="ffp-card-head"><span>🧠</span> Page Intelligence</div>
          <div class="ffp-card-body">
            <div id="__ff_page_badge" class="ffp-page-badge">Scanning…</div>
            <div id="__ff_page_type" class="ffp-page-type"></div>
          </div>
        </div>
        <div class="ffp-card">
          <div class="ffp-card-head"><span>📋</span> Fill Plan</div>
          <div class="ffp-card-body" id="__ff_plan_body">
            <div style="color:#404060;font-size:12px;">Click Run Agent to begin…</div>
          </div>
        </div>
        <div class="ffp-card">
          <div class="ffp-card-head"><span>⚡</span> Agent Log</div>
          <div class="ffp-card-body" style="padding:8px 10px;">
            <div class="ffp-log" id="__ff_log">
              <div class="ffp-log-line info"><span class="ts">--:--</span><span class="msg">Ready.</span></div>
            </div>
          </div>
        </div>
      </div>
      <div style="padding:14px 16px;border-top:1px solid #252535;flex-shrink:0;background:#0c0c14;display:flex;flex-direction:column;gap:8px;">
        <div class="ffp-stats">
          <div class="ffp-stat"><div class="ffp-stat-n" id="__ff_n_filled">0</div><div class="ffp-stat-l">Filled</div></div>
          <div class="ffp-stat"><div class="ffp-stat-n ai" id="__ff_n_ai">0</div><div class="ffp-stat-l">AI Crafted</div></div>
          <div class="ffp-stat"><div class="ffp-stat-n skip" id="__ff_n_skip">0</div><div class="ffp-stat-l">Skipped</div></div>
        </div>
        <div class="ffp-prog-wrap"><div class="ffp-prog-bar" id="__ff_prog"></div></div>
        <button class="ffp-btn ffp-btn-primary" id="__ff_run_btn">🤖 Run Agent</button>
        <button class="ffp-btn ffp-btn-secondary" id="__ff_clear_btn">✦ Clear Highlights</button>
      </div>
    </div>`;
  }

  function openPanel() {
    isPanelOpen = true;
    if (panel) { document.getElementById('__ff_panel').style.transform = 'translateX(0)'; return; }
    panel = document.createElement('div');
    panel.id = '__ff_panel_host';
    panel.innerHTML = buildPanelHTML();
    document.body.appendChild(panel);
    setTimeout(() => document.getElementById('__ff_panel').style.transform = 'translateX(0)', 30);
    document.getElementById('__ff_close').onclick     = closePanel;
    document.getElementById('__ff_run_btn').onclick   = runAgent;
    document.getElementById('__ff_clear_btn').onclick = clearHighlights;
  }

  function closePanel() {
    const p = document.getElementById('__ff_panel');
    if (p) p.style.transform = 'translateX(100%)';
    isPanelOpen = false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FIELD EXTRACTION — includes radio/checkbox groups, rich context
  // ═══════════════════════════════════════════════════════════════════════

  // Google Forms custom radio/checkbox/dropdown extraction
  // Google Forms often uses div[role="radio"], div[role="checkbox"], div[role="option"]
  // instead of native <input> elements, and dropdown menus via div[role="listbox"]
  function extractGoogleFormCustomGroups(radioGroups, checkGroups) {
    // Collect already-tracked native radio names to avoid duplicates
    const trackedNames = new Set([...Object.keys(radioGroups), ...Object.keys(checkGroups)]);

    // Find all question containers (role="listitem" is Google Forms' question wrapper)
    const questionContainers = document.querySelectorAll('[role="listitem"]');

    for (const container of questionContainers) {
      // Check for custom radio buttons: div[role="radio"] or div[data-value] within role="radiogroup"
      const radioGroupEl = container.querySelector('[role="radiogroup"]');
      const customRadios = container.querySelectorAll('[role="radio"]');
      const customCheckboxes = container.querySelectorAll('[role="checkbox"]');

      // Google Forms dropdown: [role="listbox"] with [role="option"] children
      const listbox = container.querySelector('[role="listbox"]');

      if (customRadios.length > 1 || radioGroupEl) {
        const radios = customRadios.length > 0 ? customRadios : (radioGroupEl ? radioGroupEl.querySelectorAll('[data-value]') : []);
        if (radios.length < 2) continue;

        const groupLabel = getGroupLabel(radios[0]) || getGoogleFormLabel(radios[0]) || 'choice field';
        const name = `gf_radio_${groupLabel.substring(0,30).replace(/\s+/g,'_')}`;
        if (trackedNames.has(name)) continue;

        const options = [];
        for (const r of radios) {
          const label = r.getAttribute('data-value') ||
                        r.getAttribute('aria-label') ||
                        r.innerText?.trim() ||
                        r.closest('label')?.innerText?.trim() || '';
          if (label) {
            options.push({ label, value: label, _el: r });
          }
        }

        if (options.length > 0) {
          radioGroups[name] = {
            name,
            groupLabel,
            options,
            type: 'radio',
            _firstEl: radios[0],
            _isGoogleFormCustom: true
          };
          trackedNames.add(name);
        }
      }

      if (customCheckboxes.length > 0) {
        const groupLabel = getGroupLabel(customCheckboxes[0]) || getGoogleFormLabel(customCheckboxes[0]) || 'choice field';
        const name = `gf_check_${groupLabel.substring(0,30).replace(/\s+/g,'_')}`;
        if (trackedNames.has(name)) continue;

        const options = [];
        for (const c of customCheckboxes) {
          const label = c.getAttribute('data-value') ||
                        c.getAttribute('aria-label') ||
                        c.innerText?.trim() ||
                        c.closest('label')?.innerText?.trim() || '';
          if (label) {
            options.push({ label, value: label, _el: c });
          }
        }

        if (options.length > 0) {
          checkGroups[name] = {
            name,
            groupLabel,
            options,
            type: 'checkbox',
            _firstEl: customCheckboxes[0],
            _isGoogleFormCustom: true
          };
          trackedNames.add(name);
        }
      }

      // Dropdown: Google Forms uses role="listbox" with role="option" children
      if (listbox && !customRadios.length && !customCheckboxes.length) {
        const optionEls = listbox.querySelectorAll('[role="option"]');
        if (optionEls.length < 2) continue;

        const groupLabel = getGroupLabel(listbox) || getGoogleFormLabel(listbox) || 'dropdown field';
        const name = `gf_select_${groupLabel.substring(0,30).replace(/\s+/g,'_')}`;
        if (trackedNames.has(name)) continue;

        const options = [];
        for (const o of optionEls) {
          const label = o.getAttribute('data-value') ||
                        o.innerText?.trim() || '';
          if (label && label !== 'Choose' && label !== 'Select') {
            options.push({ label, value: label, _el: o });
          }
        }

        if (options.length > 0) {
          // Treat dropdowns as radio groups (single select)
          radioGroups[name] = {
            name,
            groupLabel,
            options,
            type: 'radio',
            _firstEl: listbox,
            _isGoogleFormCustom: true,
            _isDropdown:        true
          };
          trackedNames.add(name);
        }
      }
    }
  }

  // Collects ALL interactive fields including radio groups and checkboxes
  function extractFields() {
    // Step 1: all standard inputs + textarea + select
    const standardEls = Array.from(document.querySelectorAll(
      'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]):not([type=file]),' +
      'textarea, select'
    )).filter(el =>
      el.offsetParent !== null &&
      !el.closest('#__ff_panel_host') &&
      getComputedStyle(el).display !== 'none' &&
      getComputedStyle(el).visibility !== 'hidden'
    );

    // Step 2: group radio buttons by name into single logical fields
    // and treat checkboxes as groups too
    const radioGroups = {};   // name → { groupLabel, options:[{label,value,el}], type:'radio' }
    const checkGroups = {};   // name → { groupLabel, options:[{label,value,el}], type:'checkbox' }
    const singles     = [];   // non-radio, non-checkbox elements

    for (const el of standardEls) {
      if (el.type === 'radio') {
        const name = el.name || el.id || Math.random().toString();
        if (!radioGroups[name]) {
          radioGroups[name] = {
            name,
            groupLabel: getGroupLabel(el),
            options:    [],
            type:       'radio',
            _firstEl:   el
          };
        }
        radioGroups[name].options.push({
          label: getOptionLabel(el),
          value: el.value || getOptionLabel(el),
          _el:   el
        });
      } else if (el.type === 'checkbox') {
        const name = el.name || el.id || Math.random().toString();
        if (!checkGroups[name]) {
          checkGroups[name] = {
            name,
            groupLabel: getGroupLabel(el),
            options:    [],
            type:       'checkbox',
            _firstEl:   el
          };
        }
        checkGroups[name].options.push({
          label: getOptionLabel(el),
          value: el.value || getOptionLabel(el),
          _el:   el
        });
      } else {
        singles.push(el);
      }
    }

    // Step 2b: Google Forms custom radio/checkbox/dropdown (div[role='radio'], div[role='option'], etc.)
    if (isGoogleForm()) {
      extractGoogleFormCustomGroups(radioGroups, checkGroups);
    }

    // Step 3: build unified field list
    const fields = [];
    let idx = 0;

    // Singles first (text, email, textarea, select, etc.)
    for (const el of singles) {
      const label        = getBestLabel(el);
      const surroundText = getSurroundingText(el, 300);
      let grpLabel       = getGroupLabel(el);
      if (grpLabel && (grpLabel.toLowerCase() === label.toLowerCase() || label.includes(grpLabel))) grpLabel = '';
      
      const options      = el.tagName === 'SELECT'
        ? Array.from(el.options).map(o => o.text.trim()).filter(Boolean)
        : [];

      fields.push({
        index:          idx++,
        label:          label,
        groupLabel:     grpLabel,
        type:           el.type || el.tagName.toLowerCase(),
        name:           el.name  || '',
        id:             el.id    || '',
        placeholder:    el.placeholder || '',
        options:        options,
        surroundingText: surroundText,
        required:       el.required || el.getAttribute('aria-required') === 'true',
        fieldCategory:  'single',
        _el:            el
      });
    }

    // Radio groups
    for (const grp of Object.values(radioGroups)) {
      fields.push({
        index:          idx++,
        label:          grp.groupLabel,
        type:           'radio-group',
        name:           grp.name,
        id:             grp._firstEl.id || '',
        placeholder:    '',
        options:        grp.options.map(o => o.label || o.value),
        surroundingText: getSurroundingText(grp._firstEl, 300),
        required:       grp._firstEl.required,
        fieldCategory:  'radio',
        _options:       grp.options,   // [{label,value,_el}]
        _el:            grp._firstEl
      });
    }

    // Checkbox groups
    for (const grp of Object.values(checkGroups)) {
      fields.push({
        index:          idx++,
        label:          grp.groupLabel,
        type:           'checkbox-group',
        name:           grp.name,
        id:             grp._firstEl.id || '',
        placeholder:    '',
        options:        grp.options.map(o => o.label || o.value),
        surroundingText: getSurroundingText(grp._firstEl, 300),
        required:       grp._firstEl.required,
        fieldCategory:  'checkbox',
        _options:       grp.options,
        _el:            grp._firstEl
      });
    }

    return fields;
  }

  // For radio/checkbox: find the group's question label by walking up the DOM
  function getGroupLabel(el) {
    // Google Forms: enhanced label extraction for radio/checkbox groups
    if (isGoogleForm()) {
      const gfLabel = getGoogleFormLabel(el);
      if (gfLabel) return gfLabel;
    }
    // Try fieldset > legend
    const fieldset = el.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) return legend.innerText.trim();
    }
    // Try role="group" with aria-labelledby
    const group = el.closest('[role="group"],[role="radiogroup"]');
    if (group) {
      const lbId = group.getAttribute('aria-labelledby');
      if (lbId) {
        const lbEl = document.getElementById(lbId);
        if (lbEl) return lbEl.innerText.trim();
      }
      const lbl = group.getAttribute('aria-label');
      if (lbl) return lbl;
    }
    // Walk up looking for a heading-like sibling before this group
    let node = el.parentElement;
    for (let i = 0; i < 6 && node; i++) {
      const prev = node.previousElementSibling;
      if (prev) {
        const t = prev.innerText?.trim();
        if (t && t.length > 3 && t.length < 150) return t;
      }
      // check parent for label-like text
      const heading = node.querySelector('h1,h2,h3,h4,label,p,span[class*="question"],div[class*="question"],div[class*="label"]');
      if (heading && heading !== el) {
        const t = heading.innerText?.trim();
        if (t && t.length > 3 && t.length < 150) return t;
      }
      node = node.parentElement;
    }
    return el.name || el.id || 'choice field';
  }

  // Get a radio/checkbox option's label
  function getOptionLabel(el) {
    // associated <label>
    if (el.id) {
      try {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) return lbl.innerText.replace(/\s+/g,' ').trim();
      } catch(e) {}
    }
    // next sibling text
    const next = el.nextElementSibling;
    if (next) {
      const t = next.innerText?.trim();
      if (t && t.length < 100) return t;
    }
    // parent label
    const parent = el.closest('label');
    if (parent) return parent.innerText.replace(/\s+/g,' ').trim();
    return el.value || '';
  }

  // Best label for standard inputs
  function getBestLabel(el) {
    // Google Forms: enhanced label extraction
    if (isGoogleForm()) {
      const gfLabel = getGoogleFormLabel(el);
      if (gfLabel) return gfLabel;
    }
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    const lbId = el.getAttribute('aria-labelledby');
    if (lbId) { const r = document.getElementById(lbId); if (r) return r.innerText.trim(); }
    if (el.id) {
      try {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) return lbl.innerText.trim();
      } catch(e) {}
    }
    const wrapLabel = el.closest('label');
    if (wrapLabel) return wrapLabel.innerText.replace(el.value || '', '').trim();
    // preceding sibling
    let node = el.previousElementSibling;
    while (node) {
      const t = node.innerText?.trim();
      if (t && t.length > 0 && t.length < 120) return t;
      node = node.previousElementSibling;
    }
    // parent text nodes / label-like children
    if (el.parentElement) {
      const firstText = el.parentElement.firstChild;
      if (firstText?.nodeType === 3 && firstText.textContent.trim()) return firstText.textContent.trim();
      const lbl2 = el.parentElement.querySelector('[class*="label"],[class*="question"],[data-label]');
      if (lbl2 && !lbl2.contains(el)) return lbl2.innerText.trim();
    }
    if (el.placeholder) return el.placeholder;
    if (el.name) return el.name.replace(/[_\-\[\]]/g,' ').trim();
    return el.type || 'field';
  }

  // Get meaningful surrounding text — critical for unlabeled fields
  function getSurroundingText(el, maxLen) {
    let node = el.parentElement;
    for (let i = 0; i < 7 && node && node !== document.body; i++) {
      const clone = node.cloneNode(true);
      clone.querySelectorAll('script,style,input,select,textarea,button').forEach(e => e.remove());
      const t = clone.innerText?.replace(/\s+/g,' ').trim();
      if (t && t.length > 15 && t.length < maxLen * 4) {
        return t.substring(0, maxLen);
      }
      node = node.parentElement;
    }
    return '';
  }

  function getPageText() {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,svg').forEach(e => e.remove());
    return (clone.innerText || '').replace(/\s+/g,' ').trim().substring(0, 2000);
  }

  // ── Compressed page context — extracts structured signals instead of raw text ──
  function extractPageContext(pageTitle, pageUrl, pageText) {
    let companyName = '';
    try { companyName = new URL(pageUrl).hostname.replace('www.','').split('.')[0]; } catch(e) {}

    // Extract job title from headings or title tag
    let jobTitle = '';
    const h1 = document.querySelector('h1');
    if (h1) jobTitle = h1.innerText.trim().substring(0, 100);
    if (!jobTitle) {
      const titleMatch = pageTitle.match(/^(.+?)(?:\s*[-–|@]\s*)/);
      if (titleMatch) jobTitle = titleMatch[1].trim().substring(0, 100);
    }

    // Extract key requirements — scan for tech keywords in page text
    const techKeywords = ['python','javascript','java','react','node','aws','docker','kubernetes',
      'sql','mongodb','tensorflow','pytorch','django','flask','typescript','golang','rust','c++',
      'machine learning','deep learning','data science','devops','ci/cd','agile','scrum',
      'ai','ml','nlp','computer vision','cloud','microservices','api','rest','graphql'];
    const pageTextLower = pageText.toLowerCase();
    const foundTech = techKeywords.filter(k => pageTextLower.includes(k));

    return { companyName, jobTitle, techKeywords: foundTech.slice(0, 15) };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SCREENSHOT-BASED VISION FALLBACK — when DOM labels are poor
  // ═══════════════════════════════════════════════════════════════════════

  function detectPoorLabels(fields) {
    if (fields.length === 0) return false;
    const poorCount = fields.filter(f => {
      const label = (f.label || '').toLowerCase().trim();
      return !label || label === 'text' || label === 'field' || label === 'textarea' ||
             label === 'input' || label === f.type || label.length <= 2;
    }).length;
    return poorCount / fields.length > 0.4;
  }

  function annotateFieldPositions(fields) {
    fields.forEach(f => {
      if (!f._el) return;
      const rect = f._el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const marker = document.createElement('div');
      marker.className = '__ff_field_marker';
      marker.textContent = f.index;
      marker.style.cssText = `
        position:fixed; z-index:2147483647;
        background:#ff0000; color:#fff; font-weight:bold;
        font-size:12px; width:22px; height:22px;
        border-radius:50%; display:flex; align-items:center;
        justify-content:center; pointer-events:none;
        font-family:monospace; border:2px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
        left:${Math.max(0, rect.left - 26)}px;
        top:${rect.top + rect.height / 2 - 11}px;
      `;
      document.body.appendChild(marker);
    });
  }

  function removeFieldAnnotations() {
    document.querySelectorAll('.__ff_field_marker').forEach(m => m.remove());
  }

  function requestScreenshot() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'captureScreenshot' }, res => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(res?.screenshot || null);
      });
    });
  }

  async function captureFormScreenshots(fields) {
    const captures = [];
    const vh = window.innerHeight;
    const savedScroll = window.scrollY;

    // Get absolute Y positions for each field
    const fieldPositions = fields
      .filter(f => f._el)
      .map(f => {
        const rect = f._el.getBoundingClientRect();
        return { field: f, absoluteY: savedScroll + rect.top };
      })
      .sort((a, b) => a.absoluteY - b.absoluteY);

    if (fieldPositions.length === 0) return [];

    // Group fields into viewport-sized chunks
    const groups = [];
    let currentStart = Math.max(0, fieldPositions[0].absoluteY - 80);
    let currentGroup = [];

    for (const fp of fieldPositions) {
      if (fp.absoluteY > currentStart + vh - 60) {
        if (currentGroup.length > 0) groups.push({ scrollY: currentStart, fields: [...currentGroup] });
        currentStart = Math.max(0, fp.absoluteY - 80);
        currentGroup = [fp.field];
      } else {
        currentGroup.push(fp.field);
      }
    }
    if (currentGroup.length > 0) groups.push({ scrollY: currentStart, fields: [...currentGroup] });

    // Capture each group
    for (const group of groups) {
      window.scrollTo(0, group.scrollY);
      await sleep(350);
      annotateFieldPositions(group.fields);
      await sleep(150);
      const screenshot = await requestScreenshot();
      removeFieldAnnotations();
      if (screenshot) {
        captures.push({ screenshot, fieldIndices: group.fields.map(f => f.index) });
      }
    }

    window.scrollTo(0, savedScroll);
    return captures;
  }

  function requestVisionIdentification(screenshots, profile, pageTitle, pageUrl) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({
        action: 'identifyFieldsWithVision',
        screenshots: screenshots.map(s => ({ screenshot: s.screenshot, fieldIndices: s.fieldIndices })),
        profile,
        pageTitle,
        pageUrl
      }, res => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(res);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LOCAL FACTUAL FILL — map field labels → profile keys (no LLM needed)
  // ═══════════════════════════════════════════════════════════════════════
  const FACTUAL_FIELD_MAP = [
    { patterns: [/first.?name/i],                           key: 'firstName' },
    { patterns: [/last.?name|surname|family.?name/i],       key: 'lastName' },
    { patterns: [/full.?name|^name$/i],                     get: p => `${(p.firstName||'')} ${(p.lastName||'')}`.trim() },
    { patterns: [/e[\-_\s]?mail/i],                         key: 'email' },
    { patterns: [/phone|mobile|contact.?no|contact.?number|cell|telephone/i], key: 'phone' },
    { patterns: [/whatsapp/i],                              key: 'whatsapp' },
    { patterns: [/date.?of.?birth|dob|birth.?date/i],       key: 'dob' },
    { patterns: [/\bgender\b|\bsex\b/i],                     key: 'gender' },
    { patterns: [/country.?of.?res|current.?country|^country$/i], get: p => {
      const nat = (p.nationality || '').trim().toLowerCase();
      const natToCountry = {'indian':'India','american':'United States','british':'United Kingdom','canadian':'Canada','australian':'Australia','german':'Germany','french':'France','japanese':'Japan','chinese':'China','korean':'South Korea','brazilian':'Brazil','mexican':'Mexico','spanish':'Spain','italian':'Italy','dutch':'Netherlands','russian':'Russia','singaporean':'Singapore','malaysian':'Malaysia','indonesian':'Indonesia','nepalese':'Nepal','sri lankan':'Sri Lanka','pakistani':'Pakistan','bangladeshi':'Bangladesh','emirati':'UAE','south african':'South Africa','irish':'Ireland','swiss':'Switzerland','swedish':'Sweden','filipino':'Philippines','thai':'Thailand','turkish':'Turkey','polish':'Poland','nigerian':'Nigeria','kenyan':'Kenya','ghanaian':'Ghana','saudi':'Saudi Arabia','israeli':'Israel','egyptian':'Egypt','portuguese':'Portugal','greek':'Greece','taiwanese':'Taiwan','vietnamese':'Vietnam','colombian':'Colombia','argentinian':'Argentina','chilean':'Chile','peruvian':'Peru','belgian':'Belgium','austrian':'Austria','danish':'Denmark','finnish':'Finland','norwegian':'Norway','czech':'Czech Republic','hungarian':'Hungary','romanian':'Romania','croatian':'Croatia','serbian':'Serbia','ukrainian':'Ukraine','belarusian':'Belarus'};
      return natToCountry[nat] || p.nationality || '';
    }},
    { patterns: [/^city$|current.?city|hometown/i],          key: 'city' },
    { patterns: [/^state$|province/i],                       key: 'state' },
    { patterns: [/pin.?code|zip.?code|postal/i],             key: 'pincode' },
    { patterns: [/nationality|citizenship/i],                key: 'nationality' },
    { patterns: [/linkedin/i],                               key: 'linkedin' },
    { patterns: [/github/i],                                 key: 'github' },
    { patterns: [/portfolio|website|personal.?site/i],       key: 'portfolio' },
    { patterns: [/work.?auth/i],                             key: 'workAuth' },
    { patterns: [/visa|sponsorship/i],                       key: 'visaRequired' },
    { patterns: [/current.?(ctc|salary|compensation)/i],     key: 'currentCTC' },
    { patterns: [/expected.?(ctc|salary|compensation)/i],    key: 'expectedCTC' },
    { patterns: [/notice.?period/i],                         key: 'noticePeriod' },
    { patterns: [/availab|earliest.?join|join.?date/i],      key: 'availability' },
    { patterns: [/work.?(mode|type|preference)|remote|onsite|hybrid/i], key: 'workType' },
    { patterns: [/relocat/i],                                key: 'relocate' },
    { patterns: [/preferred.?cit/i],                         key: 'preferredCities' },
    { patterns: [/disabilit/i],                              key: 'disability' },
    { patterns: [/job.?title|position.?title|role.?title|designation/i], key: 'jobTitle' },
    { patterns: [/total.?experience|years?.?of.?experience|work.?experience/i], key: 'experience' },
    { patterns: [/current.?company|present.?company|employer.?name/i], key: 'currentCompany' },
    { patterns: [/current.?designation|current.?role|current.?position/i], key: 'currentDesignation' },
    { patterns: [/employment.?(type|status)/i],              key: 'empType' },
    { patterns: [/industry/i],                               key: 'industry' },
    { patterns: [/degree|qualification|education/i],         key: 'educationDegree' },
    { patterns: [/speciali[sz]ation|branch|major/i],         key: 'educationBranch' },
    { patterns: [/college|university|institution/i],         key: 'college' },
    { patterns: [/graduat.*year|year.*graduat|passing.?year/i], key: 'gradYear' },
    { patterns: [/cgpa|gpa|percentage|marks/i],              key: 'gpa' },
    { patterns: [/skill|technologies|tech.?stack/i],         get: p => (p.skills||[]).join(', ') },
    { patterns: [/programming.?lang|coding.?lang/i],         key: 'languages' },
    { patterns: [/certif/i],                                 key: 'certifications' },
  ];

  function classifyAndFillLocally(fields, prof) {
    const localFills = [];    // fills done locally
    const llmFields  = [];    // fields that need LLM

    for (const field of fields) {
      const combined = `${field.label} ${field.name} ${field.placeholder}`.toLowerCase();
      let matched = false;

      for (const rule of FACTUAL_FIELD_MAP) {
        if (!rule.patterns.some(p => p.test(combined))) continue;
        const val = rule.get ? rule.get(prof) : (prof[rule.key] || '').toString().trim();
        if (!val) break; // profile value empty — let LLM handle

        // For select/radio/checkbox — fuzzy match against options
        if (field.options && field.options.length > 0) {
          const vl = val.toLowerCase();
          const optMatch = field.options.find(o => o.toLowerCase() === vl) ||
                           field.options.find(o => o.toLowerCase().includes(vl) || vl.includes(o.toLowerCase()));
          if (optMatch) {
            localFills.push({ index: field.index, value: optMatch, fieldType: field.type.includes('radio') ? 'radio' : field.type.includes('checkbox') ? 'checkbox' : 'select', skip: false, local: true });
            matched = true;
          }
        } else {
          localFills.push({ index: field.index, value: val, fieldType: 'factual', skip: false, local: true });
          matched = true;
        }
        break;
      }

      if (!matched) {
        llmFields.push(field);
      }
    }
    return { localFills, llmFields };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AGENT RUN
  // ═══════════════════════════════════════════════════════════════════════
  async function runAgent() {
    if (fillRunning) return;
    fillRunning = true;

    const btn = document.getElementById('__ff_run_btn');
    btn.disabled = true;
    btn.textContent = '⏳ Agent thinking…';

    document.getElementById('__ff_n_filled').textContent = '0';
    document.getElementById('__ff_n_ai').textContent     = '0';
    document.getElementById('__ff_n_skip').textContent   = '0';
    setProgress(0); clearLog(); hideWarn();

    log('info', 'Loading profile…');
    await refreshProfile();

    if (!profile.apiKey || !profile.apiKey.startsWith('gsk_')) {
      showWarn('⚠ Please add your Groq API key in the extension popup → Settings tab.');
      log('error', 'Missing or invalid Groq API key');
      fillRunning = false;
      btn.disabled = false;
      btn.textContent = '▶ Start AI Agent';
      return;
    }

    log('info', 'Extracting fields (including radio/checkbox groups)…');
    const allFields = extractFields();
    const pageTitle = document.title;
    const pageUrl   = window.location.href;
    const pageText  = getPageText();

    log('info', `Found ${allFields.length} logical fields on: "${pageTitle.substring(0,50)}"`);
    setProgress(10);

    // ── Phase 1: Local factual fill — no LLM needed ──────────────────────
    const serializedFields = allFields.map(({ _el, _options, ...rest }) => rest);
    let { localFills, llmFields } = classifyAndFillLocally(serializedFields, profile);

    log('success', `⚡ ${localFills.length} fields filled locally (no AI needed)`);
    log('info', `${llmFields.length} fields need AI analysis`);
    setProgress(15);

    // ── Phase 1.5: Vision fallback for poor/missing labels ───────────────
    let visionFills = [];
    if (detectPoorLabels(llmFields) && llmFields.length > 0) {
      log('ai', '📷 Labels unclear — capturing screenshot for visual analysis…');
      const llmFieldIndices = new Set(llmFields.map(f => f.index));
      const fieldsToCapture = allFields.filter(f => llmFieldIndices.has(f.index));

      const screenshots = await captureFormScreenshots(fieldsToCapture);
      if (screenshots.length > 0) {
        log('ai', `📷 Captured ${screenshots.length} screenshot(s), analyzing with vision model…`);
        setProgress(25);

        const visionRes = await requestVisionIdentification(screenshots, profile, pageTitle, pageUrl);

        if (visionRes?.identifiedFields && !visionRes.error) {
          let visionUpdated = 0;
          for (const idf of visionRes.identifiedFields) {
            const aField = allFields.find(f => f.index === idf.index);
            if (aField && idf.label) {
              aField.label = idf.label;
              visionUpdated++;
            }
          }

          // Re-classify with improved labels
          const updatedSerialized = allFields
            .filter(f => llmFieldIndices.has(f.index))
            .map(({ _el, _options, ...rest }) => rest);
          const reclass = classifyAndFillLocally(updatedSerialized, profile);

          if (reclass.localFills.length > 0) {
            localFills = [...localFills, ...reclass.localFills];
            log('success', `👁 Vision + local match: ${reclass.localFills.length} more fields filled from profile`);
          }

          // For fields vision identified but not locally matched — use vision's suggestedValue
          const locallyMatchedIndices = new Set(reclass.localFills.map(f => f.index));
          for (const idf of visionRes.identifiedFields) {
            if (!locallyMatchedIndices.has(idf.index) && idf.suggestedValue) {
              visionFills.push({
                index: idf.index, value: idf.suggestedValue,
                fieldType: 'factual', skip: false, local: true
              });
            }
          }

          if (visionFills.length > 0) {
            log('success', `👁 Vision suggested values for ${visionFills.length} additional fields`);
          }

          // Update llmFields to only remaining unmatched
          const allMatchedIndices = new Set([
            ...locallyMatchedIndices,
            ...visionFills.map(f => f.index)
          ]);
          llmFields = reclass.llmFields.filter(f => !allMatchedIndices.has(f.index));
          log('info', `👁 Vision: ${visionUpdated} labels identified, ${llmFields.length} fields still need LLM`);
        } else if (visionRes?.error) {
          log('error', `Vision fallback failed: ${visionRes.error}`);
        }

        if (visionRes?.tokenUsage) {
          const u = visionRes.tokenUsage;
          log('info', `📷 Vision tokens: ${u.prompt_tokens} in + ${u.completion_tokens} out = ${u.total_tokens}`);
        }
      }
    }
    setProgress(18);

    // If ALL fields are factual → skip LLM call entirely
    let agentRes = null;
    if (llmFields.length === 0) {
      log('success', '✅ All fields factual — skipping LLM call (0 tokens used)');
      agentRes = { plan: { pageType: 'Factual-only form', companyName: '', jobTitle: '', confidence: 'high', fills: [] } };
    } else {
      // ── Extract page context signals (compressed) ────────────────────
      const pageContext = extractPageContext(pageTitle, pageUrl, pageText);

      log('ai', `🧠 Agent analyzing ${llmFields.length} subjective fields… (${localFills.length} already filled locally)`);
      setProgress(20);

      agentRes = await new Promise(resolve =>
        chrome.runtime.sendMessage({
          action:       'agentAnalyzePage',
          fields:       llmFields,
          localFillCount: localFills.length,
          pageContext,
          pageTitle,
          pageUrl,
          pageText,
          profile,
          resumeSummary
        }, resolve)
      );
    }

    // Merge local fills + vision fills + LLM fills into unified plan
    // Local/vision fills take priority — LLM fills with duplicate indices are dropped
    if (agentRes && agentRes.plan) {
      const localIndices = new Set([...localFills, ...visionFills].map(f => f.index));
      const dedupedLLMFills = (agentRes.plan.fills || []).filter(f => !localIndices.has(f.index));
      agentRes.plan.fills = [...localFills, ...visionFills, ...dedupedLLMFills];
      agentRes.plan.fills.sort((a, b) => a.index - b.index);
    }

    // Log token savings
    if (agentRes?.tokenUsage) {
      const u = agentRes.tokenUsage;
      log('info', `📊 Tokens: ${u.prompt_tokens} in + ${u.completion_tokens} out = ${u.total_tokens} total`);
    }
    if (localFills.length > 0 && llmFields.length > 0) {
      log('info', `💰 Saved ~${Math.round(localFills.length / allFields.length * 100)}% tokens by filling ${localFills.length} fields locally`);
    }

    if (!agentRes || agentRes.error) {
      // ── Handle daily limit reached ─────────────────────────────────────
      if (agentRes?.error === 'limit_reached') {
        showWarn('🚀 ' + (agentRes.message || 'Daily free limit reached.'));
        log('error', agentRes.message || 'Daily limit reached');
        showUpgradeBanner();
        resetBtn(); return;
      }
      showWarn('⚠ Agent error: ' + (agentRes?.error || 'No response'));
      log('error', agentRes?.error || 'No response');
      if (agentRes?.raw) log('error', 'Raw: ' + agentRes.raw.substring(0,200));
      resetBtn(); return;
    }

    const plan = agentRes.plan;
    setProgress(60);
    updatePageBadge(plan.pageType || 'Job application form', plan.confidence || 'high');
    if (plan.companyName) log('ai', `🏢 Company: ${plan.companyName} | Role: ${plan.jobTitle || 'detected'}`);
    log('ai', `Detected: "${plan.pageType || 'form'}" | ${plan.fills?.length || 0} total fills`);

    renderPlan(plan.fills, allFields);
    setProgress(68);

    log('info', 'Executing fills…');
    let filled = 0, aiUsed = 0, skipped = 0;

    for (let i = 0; i < (plan.fills || []).length; i++) {
      const fill = plan.fills[i];
      const fieldMeta = allFields[fill.index];
      if (!fieldMeta) continue;

      setProgress(68 + (i / plan.fills.length) * 30);

      if (fill.skip || !fill.value || String(fill.value).trim() === '') {
        log('skip', `↷ "${(fieldMeta.label || '').substring(0,40)}": ${fill.reasoning || 'skipped'}`);
        skipped++;
        document.getElementById('__ff_n_skip').textContent = skipped;
        await sleep(20);
        continue;
      }

      // ── Handle premium-locked fields ─────────────────────────────────
      if (String(fill.value).trim() === '__PREMIUM_REQUIRED__') {
        log('skip', `⭐ "${(fieldMeta.label || '').substring(0,40)}": Premium required for AI answer`);
        skipped++;
        document.getElementById('__ff_n_skip').textContent = skipped;
        // Show premium badge next to the field
        if (fieldMeta._el) {
          const badge = document.createElement('div');
          badge.innerHTML = '⭐ <b>Premium</b> — AI answer requires paid plan';
          badge.style.cssText = 'font-size:11px;color:#f59e0b;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:6px;padding:4px 8px;margin-top:4px;font-family:system-ui,sans-serif;';
          fieldMeta._el.parentElement?.appendChild(badge);
        }
        updatePlanRow(fill.index, '⭐', '#f59e0b');
        await sleep(20);
        continue;
      }

      const success = executeFieldFill(fieldMeta, fill.value);
      if (success) {
        updatePlanRow(fill.index, '✓', fill.fieldType === 'subjective' ? '#fbbf24' : '#43e97b');
        const tag = fill.fieldType === 'subjective' ? '✦' : '✓';
        log(fill.fieldType === 'subjective' ? 'ai' : 'success',
          `${tag} "${(fieldMeta.label || '').substring(0,35)}" → "${String(fill.value).substring(0,55)}${String(fill.value).length>55?'…':''}"`);
        filled++;
        if (fill.fieldType === 'subjective') aiUsed++;
        document.getElementById('__ff_n_filled').textContent = filled;
        document.getElementById('__ff_n_ai').textContent     = aiUsed;
      } else {
        log('skip', `↷ "${(fieldMeta.label || '').substring(0,35)}": could not fill`);
        skipped++;
        document.getElementById('__ff_n_skip').textContent = skipped;
      }
      await sleep(40);
    }

    setProgress(100);
    log('success', `✅ Done! Filled: ${filled} | AI crafted: ${aiUsed} | Skipped: ${skipped}`);
    btn.disabled = false;
    btn.textContent = '🔄 Re-Run Agent';
    fillRunning = false;
  }

  function resetBtn() {
    const btn = document.getElementById('__ff_run_btn');
    if (btn) { btn.disabled = false; btn.textContent = '🤖 Run Agent'; }
    fillRunning = false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EXECUTE FILL — handles text/textarea/select/radio/checkbox
  // ═══════════════════════════════════════════════════════════════════════
  function executeFieldFill(fieldMeta, value) {
    const { type, fieldCategory, _el, _options } = fieldMeta;
    if (!_el) return false;

    try {
      // ── RADIO GROUP ──────────────────────────────────────────────────
      if (fieldCategory === 'radio' && _options) {
        const v = String(value).toLowerCase().trim();
        // Find the option whose label best matches the value
        const match =
          _options.find(o => o.label.toLowerCase() === v) ||
          _options.find(o => o.label.toLowerCase().includes(v)) ||
          _options.find(o => v.includes(o.label.toLowerCase()) && o.label.length > 1);
        if (match) {
          const isCustom = match._el.getAttribute('role') === 'radio' || match._el.getAttribute('role') === 'option';
          if (isCustom) {
            // Google Forms custom radio: click the element
            match._el.click();
            match._el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            match._el.checked = true;
            match._el.dispatchEvent(new Event('change', { bubbles: true }));
            match._el.dispatchEvent(new Event('click',  { bubbles: true }));
          }
          highlight(match._el);
          return true;
        }
        return false;
      }

      // ── CHECKBOX GROUP ───────────────────────────────────────────────
      if (fieldCategory === 'checkbox' && _options) {
        // value can be comma-separated list of options to check
        const wanted = String(value).toLowerCase().split(',').map(s => s.trim());
        let checked = 0;
        for (const opt of _options) {
          const ol = opt.label.toLowerCase();
          if (wanted.some(w => ol.includes(w) || w.includes(ol))) {
            const isCustom = opt._el.getAttribute('role') === 'checkbox';
            if (isCustom) {
              opt._el.click();
            } else {
              opt._el.checked = true;
            }
            opt._el.dispatchEvent(new Event('change', { bubbles: true }));
            highlight(opt._el);
            checked++;
          }
        }
        return checked > 0;
      }

      // ── SELECT ───────────────────────────────────────────────────────
      if (_el.tagName === 'SELECT') {
        const opts = Array.from(_el.options);
        const v    = String(value).toLowerCase().trim();
        const match =
          opts.find(o => o.text.toLowerCase() === v) ||
          opts.find(o => o.value.toLowerCase() === v) ||
          opts.find(o => o.text.toLowerCase().includes(v)) ||
          opts.find(o => v.includes(o.text.toLowerCase()) && o.text.trim().length > 1);
        if (match) {
          _el.value = match.value;
          _el.dispatchEvent(new Event('change', { bubbles: true }));
          highlight(_el);
          return true;
        }
        return false;
      }

      // ── TEXT / TEXTAREA / EMAIL / TEL / etc. ─────────────────────────
      const tag   = _el.tagName.toLowerCase();
      const proto = tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (nativeSetter) nativeSetter.call(_el, value);
      else _el.value = value;

      ['input','change'].forEach(e => _el.dispatchEvent(new Event(e, { bubbles: true, cancelable: true })));
      _el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      _el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      highlight(_el);
      return true;

    } catch(e) {
      return false;
    }
  }

  function highlight(el) {
    if (!el || profile.showHighlights === false) return;
    el.style.outline       = '2px solid #43e97b';
    el.style.outlineOffset = '2px';
    el.style.background    = 'rgba(67,233,123,0.05)';
  }

  function clearHighlights() {
    document.querySelectorAll('input,textarea,select').forEach(el => {
      el.style.outline = el.style.outlineOffset = el.style.background = '';
    });
    log('info', 'Highlights cleared.');
  }

  // ── Panel UI ──────────────────────────────────────────────────────────────
  function updatePageBadge(pageType, confidence) {
    const badge  = document.getElementById('__ff_page_badge');
    const typeEl = document.getElementById('__ff_page_type');
    if (!badge) return;
    const labels = { high: '✓ High Confidence', medium: '~ Medium Confidence', low: '⚠ Low Confidence' };
    badge.textContent = labels[confidence] || confidence;
    badge.className   = `ffp-page-badge ${confidence}`;
    if (typeEl) typeEl.textContent = pageType || '';
  }

  function renderPlan(fills, allFields) {
    const body = document.getElementById('__ff_plan_body');
    if (!body || !fills) return;

    const subjCount = fills.filter(f => f.fieldType === 'subjective').length;
    const factCount  = fills.filter(f => f.fieldType !== 'subjective' && !f.skip && !f.local).length;
    const localCount = fills.filter(f => f.local).length;
    const skipCount  = fills.filter(f => f.skip).length;

    body.innerHTML = '';

    fills.slice(0, 30).forEach(fill => {
      const field = allFields[fill.index];
      if (!field) return;
      const isSub  = fill.fieldType === 'subjective';
      const isSkip = fill.skip;
      const isLocal = fill.local;
      const icon   = isSkip ? '○' : isLocal ? '⚡' : '✦';
      const ic     = isSkip ? '#505070' : isLocal ? '#43e97b' : '#fbbf24';
      const vc     = isSkip ? '#404060' : '#e0e0ff';
      const maxLen = isSub ? 130 : 70;
      const val    = isSkip ? '<em style="color:#404060">skipped</em>'
                   : esc(String(fill.value||'').substring(0, maxLen)) + (String(fill.value||'').length > maxLen ? '…' : '');
      let badge    = isLocal ? `<span style="font-size:9px;padding:1px 5px;border-radius:6px;background:rgba(67,233,123,0.12);color:#43e97b;border:1px solid rgba(67,233,123,0.2);margin-left:4px;">LOCAL</span>`
                   : `<span style="font-size:9px;padding:1px 5px;border-radius:6px;background:rgba(251,191,36,0.12);color:#fbbf24;border:1px solid rgba(251,191,36,0.2);margin-left:4px;">AI</span>`;
      if (isSkip) badge = '';
      body.innerHTML += `
        <div class="ffp-field" id="__ff_plan_row_${fill.index}">
          <div class="ffp-field-icon" style="color:${ic}">${icon}</div>
          <div class="ffp-field-info">
            <div class="ffp-field-label">${esc((field.label||'').substring(0,50))}${badge}</div>
            <div class="ffp-field-value" style="color:${vc}">${val}</div>
            ${fill.reasoning ? `<div class="ffp-field-reason">${esc(fill.reasoning.substring(0,100))}</div>` : ''}
          </div>
        </div>`;
    });
    if (fills.length > 30) body.innerHTML += `<div class="ffp-field"><div class="ffp-field-info"><div style="color:#404060;font-size:12px;">+${fills.length-30} more…</div></div></div>`;
  }

  function updatePlanRow(index, icon, color) {
    const row = document.getElementById(`__ff_plan_row_${index}`);
    if (!row) return;
    const ic = row.querySelector('.ffp-field-icon');
    const vc = row.querySelector('.ffp-field-value');
    if (ic) { ic.textContent = icon; ic.style.color = color; }
    if (vc) vc.style.color = color;
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function nowStr() {
    const d = new Date();
    return `${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  }

  function log(type, msg) {
    const el = document.getElementById('__ff_log');
    if (!el) return;
    const line = document.createElement('div');
    line.className = `ffp-log-line ${type}`;
    line.innerHTML = `<span class="ts">${nowStr()}</span><span class="msg">${esc(msg)}</span>`;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function clearLog() { const el = document.getElementById('__ff_log'); if (el) el.innerHTML = ''; }
  function setProgress(p) { const b = document.getElementById('__ff_prog'); if (b) b.style.width = p + '%'; }
  function showWarn(m) { const w = document.getElementById('__ff_warn'); if (w) { w.textContent = m; w.style.display = 'block'; } }
  function hideWarn()  { const w = document.getElementById('__ff_warn'); if (w) w.style.display = 'none'; }
  function sleep(ms)   { return new Promise(r => setTimeout(r, ms)); }

  // ── Upgrade banner (shown when daily limit reached) ────────────────────
  function showUpgradeBanner() {
    if (document.getElementById('formfill-upgrade-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'formfill-upgrade-banner';
    banner.innerHTML = `
      <div style="position:fixed;bottom:20px;right:20px;z-index:2147483647;background:linear-gradient(135deg,#1a1a2e,#16213e);
                  border:1px solid #6c63ff;border-radius:14px;padding:18px 22px;max-width:320px;font-family:system-ui,sans-serif;
                  box-shadow:0 8px 32px rgba(0,0,0,.5);">
        <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:6px;">🚀 Daily Limit Reached</div>
        <div style="font-size:12px;color:#9898b8;line-height:1.5;margin-bottom:12px;">
          You've used all 5 free fills today. Upgrade to Premium for unlimited fills + AI-crafted answers.
        </div>
        <div style="display:flex;gap:8px;">
          <a href="https://form-fill-ai-ninja.vercel.app/" target="_blank"
             style="flex:1;text-align:center;padding:8px;border-radius:8px;background:#6c63ff;color:#fff;
                    font-size:12px;font-weight:600;text-decoration:none;">⭐ Upgrade — ₹19/mo or ₹2000 Lifetime</a>
          <button onclick="this.closest('#formfill-upgrade-banner').remove()"
                  style="padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.05);color:#9898b8;
                         border:1px solid rgba(255,255,255,.1);font-size:12px;cursor:pointer;">✕</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);
  }

  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'triggerFill') { openPanel(); }
  });

  init();
})();


