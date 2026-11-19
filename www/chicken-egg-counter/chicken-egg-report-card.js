/**
 * Chicken Egg Report Card
 * Historical breakdown of egg collection by color over time.
 * Uses canvas bar chart — no external dependencies.
 */

const PALETTE = [
  "#8B5E3C", "#F0D080", "#7BAFD4", "#7DAF7B",
  "#C4A86B", "#A09080", "#E8907A", "#9B7BC4",
];

function getColorHex(color, idx) {
  const known = {
    brown: "#8B5E3C", white: "#F0E8C8", blue: "#7BAFD4",
    green: "#7DAF7B", pink: "#F4A7B9", speckled: "#C4A86B", other: "#A09080",
  };
  return known[color.toLowerCase()] || PALETTE[idx % PALETTE.length];
}

class ChickenEggReportCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._data = null;
    this._view = "bar"; // "bar" | "table"
  }

  setConfig(config) {
    this._config = {
      title: config.title || "Egg Report",
      days: config.days || 30,
    };
    this._render();
  }

  set hass(hass) {
    const wasNull = !this._hass;
    this._hass = hass;
    // Pull data from the total sensor's attributes
    this._loadData();
    if (wasNull) this._render();
    else this._updateChart();
  }

  _loadData() {
    if (!this._hass) return;

    // Find the total sensor (has by_color attribute per day aggregated by HA history)
    // We use a websocket API call to fetch history from HA
    // For simplicity we read from the sensor's extra state attributes which the
    // store exposes via a special "history" sensor if configured.
    // Fallback: build from individual color sensors.
    const totalSensor = this._findTotalSensor();
    if (totalSensor && totalSensor.attributes.history) {
      this._data = totalSensor.attributes.history;
    }
  }

  _findTotalSensor() {
    if (!this._hass) return null;
    return Object.values(this._hass.states).find(
      s => s.entity_id.startsWith("sensor.eggs_today") && s.entity_id.endsWith("_total")
    ) || null;
  }

  _getAllColorSensors() {
    if (!this._hass) return [];
    return Object.values(this._hass.states).filter(
      s => s.entity_id.startsWith("sensor.eggs_today_") &&
           !s.entity_id.endsWith("_total")
    );
  }

  async _fetchHistory() {
    if (!this._hass) return null;

    const days = this._config.days || 30;
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString();

    const sensors = this._getAllColorSensors().map(s => s.entity_id);
    if (sensors.length === 0) return null;

    try {
      const histories = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: startStr,
        entity_ids: sensors,
        no_attributes: true,
        minimal_response: true,
      });
      return this._processHistory(histories);
    } catch (e) {
      console.error("chicken-egg-report: history fetch failed", e);
      return null;
    }
  }

  _processHistory(histories) {
    // histories: { entity_id: [ { s: state, lu: last_updated }, ... ] }
    // We want: { "2024-01-15": { brown: 3, white: 1, ... }, ... }
    const result = {};
    for (const [entityId, entries] of Object.entries(histories || {})) {
      const colorMatch = entityId.match(/sensor\.eggs_today_(.+)/);
      if (!colorMatch) continue;
      const color = colorMatch[1].replace(/_/g, " ");

      for (const entry of entries) {
        const val = parseInt(entry.s, 10);
        if (isNaN(val) || val <= 0) continue;
        const day = new Date(entry.lu * 1000).toISOString().split("T")[0];
        result[day] = result[day] || {};
        // Take the max value seen for a day (sensor resets at midnight)
        result[day][color] = Math.max(result[day][color] || 0, val);
      }
    }
    return result;
  }

  _buildChartData(dailyData) {
    const days = this._config.days || 30;
    const dates = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }

    const colors = new Set();
    for (const data of Object.values(dailyData)) {
      for (const c of Object.keys(data)) colors.add(c);
    }
    const colorList = Array.from(colors).sort();

    return { dates, colorList, dailyData };
  }

  _drawBarChart(canvas, dates, colorList, dailyData) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const PAD = { top: 20, right: 16, bottom: 60, left: 36 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);

    // Find max
    const totals = dates.map(d =>
      colorList.reduce((s, c) => s + ((dailyData[d] || {})[c] || 0), 0)
    );
    const maxVal = Math.max(...totals, 1);

    const barW = Math.max(2, (chartW / dates.length) - 2);
    const gap = (chartW - barW * dates.length) / Math.max(1, dates.length - 1);

    // Grid lines
    ctx.strokeStyle = "rgba(128,128,128,0.2)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + chartH - (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(128,128,128,0.7)";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(Math.round((i / 4) * maxVal), PAD.left - 4, y + 4);
    }

    // Bars (stacked)
    dates.forEach((date, di) => {
      const x = PAD.left + di * (barW + gap);
      let yOff = 0;
      colorList.forEach((color, ci) => {
        const count = (dailyData[date] || {})[color] || 0;
        if (count <= 0) return;
        const barH = (count / maxVal) * chartH;
        const y = PAD.top + chartH - yOff - barH;
        ctx.fillStyle = getColorHex(color, ci);
        ctx.fillRect(x, y, barW, barH);
        yOff += barH;
      });

      // X axis label (every N days)
      const step = dates.length > 14 ? Math.ceil(dates.length / 10) : 1;
      if (di % step === 0) {
        ctx.save();
        ctx.translate(x + barW / 2, PAD.top + chartH + 8);
        ctx.rotate(-Math.PI / 4);
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "rgba(128,128,128,0.9)";
        ctx.textAlign = "right";
        ctx.fillText(date.slice(5), 0, 0); // MM-DD
        ctx.restore();
      }
    });
  }

  _buildTableHTML(dates, colorList, dailyData) {
    const activeDates = dates.filter(d => dailyData[d]);
    if (activeDates.length === 0) return "<p class='empty'>No data recorded yet.</p>";

    const rows = [...activeDates].reverse().slice(0, 60);
    const headerCols = colorList.map(c =>
      `<th style="text-transform:capitalize">${c}</th>`
    ).join("");

    const bodyRows = rows.map(date => {
      const dayCols = colorList.map(c =>
        `<td>${(dailyData[date] || {})[c] || "—"}</td>`
      ).join("");
      const total = colorList.reduce((s, c) => s + ((dailyData[date] || {})[c] || 0), 0);
      return `<tr>
        <td>${date}</td>
        ${dayCols}
        <td><strong>${total}</strong></td>
      </tr>`;
    }).join("");

    return `
      <table>
        <thead><tr>
          <th>Date</th>${headerCols}<th>Total</th>
        </tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    `;
  }

  _buildLegendHTML(colorList) {
    return colorList.map((c, i) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${getColorHex(c, i)}"></div>
        <span>${c}</span>
      </div>
    `).join("");
  }

  async _updateChart() {
    if (!this._hass || !this.shadowRoot) return;

    const rawHistory = await this._fetchHistory();
    const dailyData = rawHistory || {};
    const { dates, colorList } = this._buildChartData(dailyData);

    const canvas = this.shadowRoot.querySelector("canvas");
    if (canvas && this._view === "bar") {
      this._drawBarChart(canvas, dates, colorList, dailyData);
    }

    const legendEl = this.shadowRoot.querySelector(".legend");
    if (legendEl) legendEl.innerHTML = this._buildLegendHTML(colorList);

    const tableEl = this.shadowRoot.querySelector(".table-view");
    if (tableEl) tableEl.innerHTML = this._buildTableHTML(dates, colorList, dailyData);

    this._toggleView(this._view);
  }

  _toggleView(view) {
    this._view = view;
    const canvas = this.shadowRoot.querySelector(".chart-view");
    const table = this.shadowRoot.querySelector(".table-view");
    const barBtn = this.shadowRoot.querySelector(".tab-bar");
    const tblBtn = this.shadowRoot.querySelector(".tab-table");
    if (canvas) canvas.style.display = view === "bar" ? "block" : "none";
    if (table) table.style.display = view === "table" ? "block" : "none";
    if (barBtn) barBtn.classList.toggle("active", view === "bar");
    if (tblBtn) tblBtn.classList.toggle("active", view === "table");
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 16px; font-family: var(--paper-font-body1_-_font-family, sans-serif); }
        .title {
          font-size: 1.1em; font-weight: 600; margin-bottom: 12px;
          color: var(--primary-text-color);
          display: flex; align-items: center; gap: 8px;
        }
        .title span { font-size: 1.3em; }
        .tabs { display: flex; gap: 8px; margin-bottom: 12px; }
        .tab {
          border: none; border-radius: 6px; padding: 5px 14px;
          font-size: 0.85em; cursor: pointer;
          background: var(--secondary-background-color, #eee);
          color: var(--primary-text-color);
          transition: background 0.15s;
        }
        .tab.active {
          background: var(--primary-color, #03a9f4);
          color: white;
        }
        .chart-view canvas { width: 100%; display: block; }
        .legend {
          display: flex; flex-wrap: wrap; gap: 8px;
          margin-top: 10px; font-size: 0.82em;
        }
        .legend-item { display: flex; align-items: center; gap: 4px; text-transform: capitalize; }
        .legend-dot { width: 12px; height: 12px; border-radius: 50%; }
        .table-view { display: none; overflow-x: auto; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
        th, td { padding: 5px 8px; text-align: center; border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.1)); }
        th { font-weight: 600; color: var(--primary-text-color); }
        td { color: var(--secondary-text-color); }
        td:first-child, th:first-child { text-align: left; }
        .empty { color: var(--secondary-text-color); font-style: italic; font-size: 0.9em; }
        .loading { color: var(--secondary-text-color); font-size: 0.9em; padding: 20px 0; text-align: center; }
      </style>
      <ha-card>
        <div class="title"><span>📊</span>${this._config.title}</div>
        <div class="tabs">
          <button class="tab tab-bar active">Chart</button>
          <button class="tab tab-table">Table</button>
        </div>
        <div class="chart-view">
          <canvas width="600" height="260"></canvas>
          <div class="legend"></div>
        </div>
        <div class="table-view">
          <div class="loading">Loading…</div>
        </div>
      </ha-card>
    `;

    this.shadowRoot.querySelector(".tab-bar").addEventListener("click", () => {
      this._toggleView("bar");
    });
    this.shadowRoot.querySelector(".tab-table").addEventListener("click", () => {
      this._toggleView("table");
    });

    if (this._hass) this._updateChart();
  }

  getCardSize() { return 5; }

  static getStubConfig() {
    return {
      type: "custom:chicken-egg-report-card",
      title: "Egg Report",
      days: 30,
    };
  }
}

customElements.define("chicken-egg-report-card", ChickenEggReportCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "chicken-egg-report-card",
  name: "Chicken Egg Report",
  description: "Historical breakdown of egg collection by color.",
  preview: true,
});
