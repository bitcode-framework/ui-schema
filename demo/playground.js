/* ui-schema demo — drives the real ReactiveStore from the package source.
 * Every scenario is a set of declared reactions; the form is a thin renderer
 * over store.get()/getMeta() so the engine, not the DOM, owns the logic. */

import { ReactiveStore } from './ui-schema.js';

const formEl = document.getElementById('form');
const stateEl = document.getElementById('state');
const rulesEl = document.getElementById('rules');
const logEl = document.getElementById('log');
const scenariosEl = document.getElementById('scenarios');
const runCountEl = document.getElementById('run-count');

// ── scenarios ───────────────────────────────────────────────────────────────

const SCENARIOS = {
  'Dependent fields': {
    description: 'A shipping address is only relevant once "ship to a different address" is checked, and its fields become required at the same time.',
    initial: {
      sameAsBilling: true,
      shippingStreet: '',
      shippingCity: ''
    },
    fields: [
      { path: 'sameAsBilling', label: 'Ship to the same address', type: 'checkbox' },
      { path: 'shippingStreet', label: 'Shipping street', type: 'text', placeholder: '123 Main St' },
      { path: 'shippingCity', label: 'Shipping city', type: 'text', placeholder: 'Jakarta' }
    ],
    reactions: [
      {
        when: 'sameAsBilling',
        target: 'shippingStreet',
        effect: {
          kind: 'ui',
          ui: { visible: (s) => s.sameAsBilling === false, required: (s) => s.sameAsBilling === false }
        }
      },
      {
        when: 'sameAsBilling',
        target: 'shippingCity',
        effect: {
          kind: 'ui',
          ui: { visible: (s) => s.sameAsBilling === false, required: (s) => s.sameAsBilling === false }
        }
      }
    ],
    explain: [
      'when sameAsBilling → shippingStreet: visible/required = !sameAsBilling',
      'when sameAsBilling → shippingCity: visible/required = !sameAsBilling'
    ]
  },

  'Computed total': {
    description: 'A derived value with no input of its own. The total recomputes from quantity and unit price on every change.',
    initial: {
      quantity: 3,
      unitPrice: 25000,
      total: 75000
    },
    fields: [
      { path: 'quantity', label: 'Quantity', type: 'number', min: 0 },
      { path: 'unitPrice', label: 'Unit price (IDR)', type: 'number', min: 0 },
      { path: 'total', label: 'Total (computed)', type: 'text', readonly: true }
    ],
    reactions: [
      {
        when: ['quantity', 'unitPrice'],
        target: 'total',
        effect: {
          kind: 'value',
          value: {
            expr: (s) => Number(s.quantity || 0) * Number(s.unitPrice || 0)
          }
        }
      }
    ],
    explain: [
      'when [quantity, unitPrice] → total: value = quantity × unitPrice'
    ]
  },

  'Conditional validation': {
    description: 'Validation rules swap based on the selected account type. A company account requires a tax ID; a personal account does not.',
    initial: {
      accountType: 'personal',
      taxId: ''
    },
    fields: [
      {
        path: 'accountType',
        label: 'Account type',
        type: 'select',
        options: [
          { value: 'personal', label: 'Personal' },
          { value: 'company', label: 'Company' }
        ]
      },
      { path: 'taxId', label: 'Tax ID', type: 'text', placeholder: '00.000.000.0-000.000' }
    ],
    reactions: [
      {
        when: 'accountType',
        target: 'taxId',
        effect: {
          kind: 'ui',
          ui: { required: (s) => s.accountType === 'company' }
        }
      },
      {
        when: 'accountType',
        target: 'taxId',
        effect: {
          kind: 'validation',
          validation: {
            rules: (s) =>
              s.accountType === 'company'
                ? [{ type: 'required', message: 'A tax ID is required for company accounts' }]
                : []
          }
        }
      }
    ],
    explain: [
      "when accountType → taxId: required = (accountType == 'company')",
      'when accountType → taxId: rules = company ? [required] : []'
    ]
  },

  'Cascading options': {
    description: 'The city list depends on the chosen province, and the city resets when the province changes so stale selections cannot survive.',
    initial: {
      province: 'DKI Jakarta',
      city: ''
    },
    fields: [
      {
        path: 'province',
        label: 'Province',
        type: 'select',
        options: [
          { value: 'DKI Jakarta', label: 'DKI Jakarta' },
          { value: 'Jawa Barat', label: 'Jawa Barat' },
          { value: 'Bali', label: 'Bali' }
        ]
      },
      { path: 'city', label: 'City', type: 'select', options: [], optionsFrom: (s) => CITIES[s.province] ?? [] }
    ],
    reactions: [
      {
        when: 'province',
        target: 'city',
        effect: {
          kind: 'value',
          value: { expr: () => '' }
        }
      }
    ],
    explain: [
      'when province → city: value = "" (reset stale selection)',
      'city options are derived from province by the renderer'
    ]
  }
};

const CITIES = {
  'DKI Jakarta': [
    { value: 'Jakarta Pusat', label: 'Jakarta Pusat' },
    { value: 'Jakarta Selatan', label: 'Jakarta Selatan' },
    { value: 'Jakarta Barat', label: 'Jakarta Barat' }
  ],
  'Jawa Barat': [
    { value: 'Bandung', label: 'Bandung' },
    { value: 'Bogor', label: 'Bogor' },
    { value: 'Bekasi', label: 'Bekasi' }
  ],
  Bali: [
    { value: 'Denpasar', label: 'Denpasar' },
    { value: 'Ubud', label: 'Ubud' },
    { value: 'Kuta', label: 'Kuta' }
  ]
};

// ── rendering ───────────────────────────────────────────────────────────────

let store = null;
let currentScenario = 'Dependent fields';
let runs = 0;
const logEntries = [];

function addLog(message) {
  logEntries.unshift(message);
  if (logEntries.length > 40) logEntries.pop();
  logEl.innerHTML = '';
  for (const entry of logEntries) {
    const li = document.createElement('li');
    li.textContent = entry;
    logEl.appendChild(li);
  }
}

function formatValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === '' || value === null || value === undefined) return '—';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length ? `[${value.length} option(s)]` : '[]';
  return String(value);
}

function renderState() {
  const scenario = SCENARIOS[currentScenario];
  const snapshot = store.snapshot();
  stateEl.innerHTML = '';

  for (const field of scenario.fields) {
    const meta = store.getMeta(field.path);
    const row = document.createElement('div');

    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = field.path;
    row.appendChild(key);

    const val = document.createElement('span');
    val.textContent = ' = ' + formatValue(snapshot[field.path]);
    row.appendChild(val);

    const flags = [];
    if (meta.visible === false) flags.push('hidden');
    if (meta.required) flags.push('required');
    if (meta.disabled) flags.push('disabled');
    if (meta.rules && meta.rules.length) flags.push(meta.rules.length + ' rule(s)');
    if (flags.length) {
      const f = document.createElement('span');
      f.style.color = 'var(--muted)';
      f.textContent = '  ⟨' + flags.join(', ') + '⟩';
      row.appendChild(f);
    }

    stateEl.appendChild(row);
  }
}

// The engine publishes declarative rules; a renderer turns them into messages.
// This mirrors what @bitcode/ui does for the same metadata.
function validateField(path, value, meta) {
  const rules = meta.rules ?? [];
  for (const rule of rules) {
    if (rule.type === 'required') {
      const empty = value === '' || value === null || value === undefined;
      if (empty) return rule.message ?? 'This field is required';
    }
    if (rule.type === 'min' && Number(value) < Number(rule.value)) {
      return rule.message ?? `Must be at least ${rule.value}`;
    }
    if (rule.type === 'pattern' && rule.value && !new RegExp(rule.value).test(String(value))) {
      return rule.message ?? 'Invalid format';
    }
  }
  return null;
}

function renderForm() {
  const scenario = SCENARIOS[currentScenario];
  formEl.innerHTML = '';

  for (const field of scenario.fields) {
    const meta = store.getMeta(field.path);
    const value = store.get(field.path);
    const error = validateField(field.path, value, meta);

    const wrap = document.createElement('div');
    wrap.className = 'field';
    if (meta.visible === false) wrap.classList.add('hidden');

    const label = document.createElement('label');
    label.setAttribute('for', 'f-' + field.path);
    label.textContent = field.label;
    if (meta.required) {
      const req = document.createElement('span');
      req.className = 'req';
      req.textContent = '*';
      label.appendChild(req);
    }

    if (field.type === 'checkbox') {
      const check = document.createElement('div');
      check.className = 'check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'f-' + field.path;
      input.checked = Boolean(value);
      input.addEventListener('change', () => onInput(field.path, input.checked));
      label.setAttribute('for', input.id);
      check.appendChild(input);
      check.appendChild(label);
      wrap.appendChild(check);
    } else if (field.type === 'select') {
      wrap.appendChild(label);
      const select = document.createElement('select');
      select.id = 'f-' + field.path;

      const opts = Array.isArray(meta.options) && meta.options.length
        ? meta.options
        : field.optionsFrom
          ? field.optionsFrom(store.snapshot())
          : (field.options ?? []);

      if (!opts.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '— no options —';
        select.appendChild(opt);
      }
      for (const o of opts) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        if (String(value) === String(o.value)) opt.selected = true;
        select.appendChild(opt);
      }
      select.disabled = Boolean(meta.disabled) || field.readonly;
      select.addEventListener('change', () => onInput(field.path, select.value));
      wrap.appendChild(select);
    } else {
      wrap.appendChild(label);
      const input = document.createElement('input');
      input.id = 'f-' + field.path;
      input.type = field.type === 'number' ? 'number' : 'text';
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.min !== undefined) input.min = String(field.min);
      input.value = value ?? '';
      input.disabled = Boolean(meta.disabled) || field.readonly;
      if (field.readonly) input.setAttribute('aria-readonly', 'true');
      if (error) input.setAttribute('aria-invalid', 'true');
      input.addEventListener('input', () => {
        const raw = field.type === 'number' ? Number(input.value) : input.value;
        onInput(field.path, raw);
      });
      wrap.appendChild(input);
    }

    if (error) {
      const err = document.createElement('div');
      err.className = 'error';
      err.textContent = error;
      wrap.appendChild(err);
    }

    formEl.appendChild(wrap);
  }
}

function renderRules() {
  const scenario = SCENARIOS[currentScenario];
  rulesEl.innerHTML = '';
  for (const line of scenario.explain) {
    const li = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = line;
    li.appendChild(code);
    rulesEl.appendChild(li);
  }
}

function renderAll() {
  renderForm();
  renderState();
  runCountEl.textContent = runs + (runs === 1 ? ' run' : ' runs');
}

// ── interaction ─────────────────────────────────────────────────────────────

function onInput(path, value) {
  store.set(path, value);
  runs += 1;
  addLog(`set ${path} = ${formatValue(value)}`);

  // Selecting a province clears the dependent city so a stale value cannot
  // survive; this is application policy, not engine behaviour.
  if (currentScenario === 'Cascading options' && path === 'province') {
    store.set('city', '');
  }

  renderAll();
}

function loadScenario(name) {
  currentScenario = name;
  const scenario = SCENARIOS[name];

  for (const btn of scenariosEl.querySelectorAll('button')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.scenario === name));
  }

  store = new ReactiveStore({
    initialValues: { ...scenario.initial },
    reactions: scenario.reactions
  });
  store.runAll();

  logEntries.length = 0;
  addLog('loaded scenario: ' + name);

  renderRules();
  renderAll();
}

for (const name of Object.keys(SCENARIOS)) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.scenario = name;
  btn.textContent = name;
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => loadScenario(name));
  scenariosEl.appendChild(btn);
}

loadScenario('Dependent fields');
