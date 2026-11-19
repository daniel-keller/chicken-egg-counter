# Chicken Egg Counter — Home Assistant Integration

Track daily egg collection by color and view historical breakdowns on your dashboard.

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)

## One-Click Install via HACS

> **Requires [HACS](https://hacs.xyz) to be installed in Home Assistant.**

Click the button below to open your Home Assistant instance and add this repository directly:

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=daniel-keller&repository=chicken-egg-counter&category=integration)

> **Before publishing:** replace `daniel-keller` in the button URL above (and in the badge link) with your actual GitHub username, and make sure the repository name matches.

After clicking the button:
1. HACS will ask you to confirm adding the custom repository.
2. Find **Chicken Egg Counter** in HACS and click **Download**.
3. Restart Home Assistant.
4. Add the integration via **Settings → Devices & Services → Add Integration**.

> **Lovelace cards** are not installed by HACS automatically. After installing the integration, copy `www/community/chicken-egg-counter/` into `<config>/www/community/` and register the two JS files as Lovelace Resources (see [Manual Installation](#manual-installation) below).

---

## What's Included

| Path | Purpose |
|------|---------|
| `custom_components/chicken_egg_counter/` | HA custom integration (sensors + services) |
| `www/community/chicken-egg-counter/chicken-egg-counter-card.js` | Daily counter Lovelace card |
| `www/community/chicken-egg-counter/chicken-egg-report-card.js` | Historical report Lovelace card |

---

## Manual Installation

### 1. Copy Files

Copy `custom_components/chicken_egg_counter/` into your HA config directory:

```
<config>/custom_components/chicken_egg_counter/
```

Copy `www/community/chicken-egg-counter/` into:

```
<config>/www/community/chicken-egg-counter/
```

### 2. Add the Integration

1. Restart Home Assistant.
2. Go to **Settings → Devices & Services → Add Integration**.
3. Search for **Chicken Egg Counter**.
4. Enter your egg colors (comma-separated, e.g. `brown, white, blue, green, speckled`).

### 3. Register the Lovelace Resources

In HA go to **Settings → Dashboards → Resources** and add:

| URL | Type |
|-----|------|
| `/local/community/chicken-egg-counter/chicken-egg-counter-card.js` | JavaScript Module |
| `/local/community/chicken-egg-counter/chicken-egg-report-card.js` | JavaScript Module |

---

## Sensors Created

For each configured color the integration creates:

| Entity | Description |
|--------|-------------|
| `sensor.eggs_today_brown` | Brown eggs collected today |
| `sensor.eggs_today_white` | White eggs collected today |
| `sensor.eggs_today_total` | All eggs collected today (with `by_color` attribute) |

Sensor values reset to 0 at midnight as "today" rolls over.

---

## Services

### `chicken_egg_counter.add_eggs`

Record eggs collected.

```yaml
service: chicken_egg_counter.add_eggs
data:
  color: brown
  count: 3
  # date: "2024-01-15"   # optional, defaults to today
  # note: "Found in nesting box 2"
```

### `chicken_egg_counter.remove_eggs`

Correct a mistake.

```yaml
service: chicken_egg_counter.remove_eggs
data:
  color: brown
  count: 1
```

### `chicken_egg_counter.reset_day`

Clear all entries for a day.

```yaml
service: chicken_egg_counter.reset_day
data: {}   # omit date to reset today
```

---

## Dashboard Cards

### Daily Counter Card

Add eggs by color with + / − buttons, then hit **Save**.

```yaml
type: custom:chicken-egg-counter-card
title: "Morning Egg Collection"
colors:
  - brown
  - white
  - blue
  - green
  - speckled
```

The left column shows what has already been recorded today (pulled from the sensors). The right column shows how many you are about to add. Hit **Save** to call the service.

### Historical Report Card

Stacked bar chart and table view of the past N days.

```yaml
type: custom:chicken-egg-report-card
title: "30-Day Egg Report"
days: 30
```

Switch between **Chart** (stacked bars by color per day) and **Table** (sortable grid) using the tabs at the top.

---

## Example Dashboard YAML

```yaml
views:
  - title: Chickens
    cards:
      - type: custom:chicken-egg-counter-card
        title: "Today's Egg Collection"
        colors:
          - brown
          - white
          - blue
          - green
          - speckled

      - type: entities
        title: Today's Totals
        entities:
          - sensor.eggs_today_total
          - sensor.eggs_today_brown
          - sensor.eggs_today_white
          - sensor.eggs_today_blue
          - sensor.eggs_today_green
          - sensor.eggs_today_speckled

      - type: custom:chicken-egg-report-card
        title: "Egg Report — Last 30 Days"
        days: 30
```

---

## Data Storage

Egg records are stored in `<config>/.storage/chicken_egg_counter.data` as a JSON list of entries. Each entry records the date, color, count, timestamp, and optional note. Corrections use negative counts so the full audit trail is preserved.

---

## Customizing Colors

Go to **Settings → Devices & Services → Chicken Egg Counter → Configure** to update the tracked colors at any time. The color list affects which per-color sensors are created; historical data for removed colors is kept in storage.
