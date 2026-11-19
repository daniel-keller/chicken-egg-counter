from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

from .const import (
    DOMAIN,
    CONF_EGG_COLORS,
    CONF_NAME,
    DEFAULT_NAME,
    DEFAULT_EGG_COLORS,
)


class ChickenEggCounterConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}

        if user_input is not None:
            colors_raw = user_input.get(CONF_EGG_COLORS, "")
            colors = [c.strip().lower() for c in colors_raw.split(",") if c.strip()]
            if not colors:
                errors[CONF_EGG_COLORS] = "invalid_colors"
            else:
                await self.async_set_unique_id(DOMAIN)
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=user_input.get(CONF_NAME, DEFAULT_NAME),
                    data={
                        CONF_NAME: user_input.get(CONF_NAME, DEFAULT_NAME),
                        CONF_EGG_COLORS: colors,
                    },
                )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Optional(CONF_NAME, default=DEFAULT_NAME): str,
                    vol.Optional(
                        CONF_EGG_COLORS,
                        default=", ".join(DEFAULT_EGG_COLORS),
                    ): str,
                }
            ),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return ChickenEggCounterOptionsFlow(config_entry)


class ChickenEggCounterOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        errors = {}

        if user_input is not None:
            colors_raw = user_input.get(CONF_EGG_COLORS, "")
            colors = [c.strip().lower() for c in colors_raw.split(",") if c.strip()]
            if not colors:
                errors[CONF_EGG_COLORS] = "invalid_colors"
            else:
                return self.async_create_entry(
                    title="",
                    data={CONF_EGG_COLORS: colors},
                )

        current_colors = self.config_entry.options.get(
            CONF_EGG_COLORS,
            self.config_entry.data.get(CONF_EGG_COLORS, DEFAULT_EGG_COLORS),
        )

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_EGG_COLORS,
                        default=", ".join(current_colors),
                    ): str,
                }
            ),
            errors=errors,
        )
