from __future__ import annotations

import logging
from datetime import date

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN, CONF_EGG_COLORS, DEFAULT_EGG_COLORS

_LOGGER = logging.getLogger(__name__)

SIGNAL_UPDATE = f"{DOMAIN}_update"


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    store = hass.data[DOMAIN]["store"]
    colors = entry.options.get(
        CONF_EGG_COLORS, entry.data.get(CONF_EGG_COLORS, DEFAULT_EGG_COLORS)
    )

    entities = [EggTotalSensor(hass, store, entry)]
    for color in colors:
        entities.append(EggColorSensor(hass, store, entry, color))

    async_add_entities(entities, True)


class EggColorSensor(SensorEntity):
    """Sensor showing today's count for one egg color."""

    def __init__(self, hass, store, entry, color: str) -> None:
        self._store = store
        self._entry = entry
        self._color = color
        self._attr_name = f"Eggs Today — {color.title()}"
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_{color}"
        self._attr_icon = "mdi:egg"
        self._attr_native_unit_of_measurement = "eggs"
        self._attr_state_class = "measurement"

    @property
    def native_value(self):
        today = date.today().isoformat()
        return self._store.get_totals_for_date(today).get(self._color, 0)

    @property
    def extra_state_attributes(self):
        today = date.today().isoformat()
        return {
            "color": self._color,
            "date": today,
        }

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, SIGNAL_UPDATE, self._handle_update
            )
        )

    @callback
    def _handle_update(self):
        self.async_write_ha_state()


class EggTotalSensor(SensorEntity):
    """Sensor showing total eggs collected today across all colors."""

    def __init__(self, hass, store, entry) -> None:
        self._store = store
        self._entry = entry
        self._attr_name = "Eggs Today — Total"
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_total"
        self._attr_icon = "mdi:egg-outline"
        self._attr_native_unit_of_measurement = "eggs"
        self._attr_state_class = "measurement"

    @property
    def native_value(self):
        today = date.today().isoformat()
        return sum(self._store.get_totals_for_date(today).values())

    @property
    def extra_state_attributes(self):
        today = date.today().isoformat()
        totals = self._store.get_totals_for_date(today)
        return {"date": today, "by_color": totals}

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, SIGNAL_UPDATE, self._handle_update
            )
        )

    @callback
    def _handle_update(self):
        self.async_write_ha_state()
