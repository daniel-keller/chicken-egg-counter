/**
 * Chicken Egg Counter Card
 * Daily counter widget for recording eggs by color.
 */

const EGG_COLOR_MAP = {
  brown:    { hex: "#8B5E3C", emoji: "🥚" },
  white:    { hex: "#F5F0E8", emoji: "🥚" },
  blue:     { hex: "#7BAFD4", emoji: "🥚" },
  green:    { hex: "#7DAF7B", emoji: "🥚" },
  pink:     { hex: "#F4A7B9", emoji: "🥚" },
  speckled: { hex: "#C4A86B", emoji: "🥚" },
  other:    { hex: "#A09080", emoji: "🥚" },
};

function colorStyle(color) {
  const c = EGG_COLOR_MAP[color.toLowerCase()] || { hex: "#A09080" };
  return c.hex;
}

class ChickenEggCounterCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._pendingCounts = {};
    this._recordedCounts = {};
    this._saving = false;
  }

  setConfig(config) {
    if (!config.colors || !Array.isArray(config.colors)) {
      throw new Error("chicken-egg-counter-card: 'colors' array is required.");
    }
    this._config = {
      title: config.title || "Egg Counter",
      colors: config.colors,
      date: config.date || null,
    };
    this._pendingCounts = {};
    for (const color of this._config.colors) {
      this._pendingCounts[color] = 0;
    }
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateSensorValues();
  }

  _updateSensorValues() {
    if (!this._hass || !this.shadowRoot) return;
    const today = this._getTargetDate();
    for (const color of this._config.colors) {
      const entityId = `sensor.eggs_today_${color.replace(/\s+/g, "_")}`;
      const state = this._hass.states[entityId];
      const recorded = state ? parseInt(state.state, 10) || 0 : 0;
      this._recordedCounts[color] = recorded;
      const badge = this.shadowRoot.querySelector(`[data-recorded="${color}"]`);
      if (badge) badge.textContent = recorded;
      if ((this._pendingCounts[color] || 0) < -recorded) this._setPending(color, -recorded);
    }
    this._updateTotal();
  }

  _getTargetDate() {
    if (this._config.date) return this._config.date;
    return new Date().toISOString().split("T")[0];
  }

  _updateTotal() {
    const totalEl = this.shadowRoot.querySelector(".grand-total");
    if (!totalEl) return;
    let added = 0;
    let removed = 0;
    for (const color of this._config.colors) {
      const v = this._pendingCounts[color] || 0;
      if (v > 0) added += v;
      else removed -= v;
    }
    const parts = [];
    if (added) parts.push(`+${added}`);
    if (removed) parts.push(`−${removed}`);
    totalEl.textContent = `${parts.join(" / ")} unsaved`;
    totalEl.style.display = parts.length ? "block" : "none";
  }

  _setPending(color, value) {
    this._pendingCounts[color] = value;
    const el = this.shadowRoot.querySelector(`[data-pending="${color}"]`);
    if (!el) return;
    el.textContent = value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "0";
    el.classList.toggle("negative", value < 0);
  }

  _adjustCount(color, delta) {
    const min = -(this._recordedCounts[color] || 0);
    this._setPending(color, Math.max(min, (this._pendingCounts[color] || 0) + delta));
    this._updateTotal();
  }

  async _save() {
    if (!this._hass || this._saving) return;
    const toSave = Object.entries(this._pendingCounts).filter(([, v]) => v !== 0);
    if (toSave.length === 0) return;

    this._saving = true;
    const saveBtn = this.shadowRoot.querySelector(".save-btn");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }

    try {
      for (const [color, count] of toSave) {
        await this._hass.callService(
          "chicken_egg_counter",
          count > 0 ? "add_eggs" : "remove_eggs",
          {
            color,
            count: Math.abs(count),
            ...(this._config.date ? { date: this._config.date } : {}),
          },
        );
        // Clear per color so a mid-batch failure doesn't re-send what already saved.
        this._setPending(color, 0);
      }
      this._showToast("Saved!");
    } catch (e) {
      this._showToast("Error saving. Check logs.", true);
    } finally {
      this._saving = false;
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save"; }
      this._updateTotal();
    }
  }

  _showToast(msg, error = false) {
    const toast = this.shadowRoot.querySelector(".toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background = error ? "#c0392b" : "#27ae60";
    toast.style.opacity = "1";
    setTimeout(() => { toast.style.opacity = "0"; }, 2000);
  }

  _render() {
    if (!this._config.colors) return;
    const colors = this._config.colors;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          padding: 16px;
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
        }
        .title {
          font-size: 1.1em;
          font-weight: 600;
          margin-bottom: 16px;
          color: var(--primary-text-color);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .title span { font-size: 1.3em; }
        .color-row {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
          gap: 8px;
        }
        .egg-dot {
          width: 20px;
          height: 24px;
          border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          border: 1px solid rgba(0,0,0,0.15);
          flex-shrink: 0;
        }
        .color-label {
          flex: 1;
          text-transform: capitalize;
          color: var(--primary-text-color);
          font-size: 0.95em;
        }
        .recorded {
          font-size: 0.85em;
          color: var(--secondary-text-color);
          min-width: 28px;
          text-align: right;
        }
        .controls {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .btn {
          background: var(--primary-color, #03a9f4);
          color: black;
          border: none;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          font-size: 1.1em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .btn:active { opacity: 0.7; }
        .btn.minus { background: var(--error-color, #c0392b); }
        .pending {
          min-width: 28px;
          text-align: center;
          font-weight: 600;
          color: var(--primary-color, #03a9f4);
          font-size: 1em;
        }
        .pending.negative { color: var(--error-color, #c0392b); }
        .footer {
          margin-top: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .save-btn {
          background: var(--primary-color, #03a9f4);
          color: black;
          border: none;
          border-radius: 6px;
          padding: 8px 20px;
          font-size: 0.95em;
          cursor: pointer;
          font-weight: 600;
          transition: opacity 0.15s;
        }
        .save-btn:disabled { opacity: 0.5; cursor: default; }
        .grand-total {
          font-size: 0.85em;
          color: var(--primary-color, #03a9f4);
          display: none;
        }
        .toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: #27ae60;
          color: white;
          padding: 8px 20px;
          border-radius: 20px;
          font-size: 0.9em;
          opacity: 0;
          transition: opacity 0.4s;
          z-index: 9999;
          pointer-events: none;
        }
        .divider {
          border: none;
          border-top: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          margin: 10px 0;
        }
      </style>
      <ha-card>
        <div class="title">${this._config.title}</div>
        ${colors.map(color => `
          <div class="color-row">
            <div class="egg-dot" style="background:${colorStyle(color)}"></div>
            <div class="color-label">${color}</div>
            <div class="recorded" data-recorded="${color}">0</div>
            <div class="controls">
              <button class="btn minus" data-color="${color}" data-delta="-1">−</button>
              <div class="pending" data-pending="${color}">0</div>
              <button class="btn" data-color="${color}" data-delta="1">+</button>
            </div>
          </div>
        `).join("")}
        <hr class="divider"/>
        <div class="footer">
          <button class="save-btn">Save</button>
          <div class="grand-total"></div>
        </div>
        <div class="toast"></div>
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll("button[data-color]").forEach(btn => {
      btn.addEventListener("click", () => {
        const color = btn.dataset.color;
        const delta = parseInt(btn.dataset.delta, 10);
        this._adjustCount(color, delta);
      });
    });

    this.shadowRoot.querySelector(".save-btn").addEventListener("click", () => {
      this._save();
    });

    this._updateSensorValues();
  }

  getCardSize() { return Math.ceil(this._config.colors.length * 0.6) + 2; }

  static getStubConfig() {
    return {
      type: "custom:chicken-egg-counter-card",
      title: "Egg Counter",
      colors: ["brown", "white", "blue", "green", "speckled"],
    };
  }
}

customElements.define("chicken-egg-counter-card", ChickenEggCounterCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "chicken-egg-counter-card",
  name: "Chicken Egg Counter",
  description: "Record daily egg collection by color.",
  preview: true,
});
