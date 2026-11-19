from __future__ import annotations

import logging
import voluptuous as vol
from datetime import date

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import (
    DOMAIN,
    ATTR_COLOR,
    ATTR_COUNT,
    ATTR_DATE,
    ATTR_NOTE,
    SERVICE_ADD_EGGS,
    SERVICE_REMOVE_EGGS,
    SERVICE_RESET_DAY,
)
from .store import EggStore
from .sensor import SIGNAL_UPDATE

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor"]

ADD_EGGS_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_COLOR): cv.string,
        vol.Required(ATTR_COUNT): vol.All(vol.Coerce(int), vol.Range(min=1, max=100)),
        vol.Optional(ATTR_DATE): cv.string,
        vol.Optional(ATTR_NOTE): cv.string,
    }
)

REMOVE_EGGS_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_COLOR): cv.string,
        vol.Required(ATTR_COUNT): vol.All(vol.Coerce(int), vol.Range(min=1, max=100)),
        vol.Optional(ATTR_DATE): cv.string,
    }
)

RESET_DAY_SCHEMA = vol.Schema(
    {
        vol.Optional(ATTR_DATE): cv.string,
    }
)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})

    store = EggStore(hass)
    await store.async_load()
    hass.data[DOMAIN]["store"] = store

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    async def handle_add_eggs(call: ServiceCall) -> None:
        color = call.data[ATTR_COLOR].lower()
        count = call.data[ATTR_COUNT]
        day = call.data.get(ATTR_DATE)
        note = call.data.get(ATTR_NOTE)
        await store.async_add_eggs(color, count, day, note)
        async_dispatcher_send(hass, SIGNAL_UPDATE)
        _LOGGER.debug("Added %d %s egg(s) for %s", count, color, day or date.today())

    async def handle_remove_eggs(call: ServiceCall) -> None:
        color = call.data[ATTR_COLOR].lower()
        count = call.data[ATTR_COUNT]
        day = call.data.get(ATTR_DATE)
        await store.async_remove_eggs(color, count, day)
        async_dispatcher_send(hass, SIGNAL_UPDATE)
        _LOGGER.debug("Removed %d %s egg(s) for %s", count, color, day or date.today())

    async def handle_reset_day(call: ServiceCall) -> None:
        day = call.data.get(ATTR_DATE)
        await store.async_reset_day(day)
        async_dispatcher_send(hass, SIGNAL_UPDATE)
        _LOGGER.debug("Reset egg tally for %s", day or date.today())

    hass.services.async_register(
        DOMAIN, SERVICE_ADD_EGGS, handle_add_eggs, schema=ADD_EGGS_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_REMOVE_EGGS, handle_remove_eggs, schema=REMOVE_EGGS_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_RESET_DAY, handle_reset_day, schema=RESET_DAY_SCHEMA
    )

    entry.async_on_unload(entry.add_update_listener(async_reload_entry))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        hass.data[DOMAIN].pop("store", None)
        for service in [SERVICE_ADD_EGGS, SERVICE_REMOVE_EGGS, SERVICE_RESET_DAY]:
            hass.services.async_remove(DOMAIN, service)
    return unloaded


async def async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
