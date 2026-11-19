from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)


class EggStore:
    """Manages persistent storage of egg counter data."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {"entries": []}

    async def async_load(self) -> None:
        stored = await self._store.async_load()
        if stored:
            self._data = stored

    async def async_save(self) -> None:
        await self._store.async_save(self._data)

    def get_entries(self) -> list[dict]:
        return self._data.get("entries", [])

    def get_entries_for_date(self, day: str) -> list[dict]:
        return [e for e in self.get_entries() if e.get("date") == day]

    def get_totals_for_date(self, day: str) -> dict[str, int]:
        totals: dict[str, int] = {}
        for entry in self.get_entries_for_date(day):
            color = entry["color"]
            totals[color] = totals.get(color, 0) + entry["count"]
        return totals

    def get_daily_totals(self) -> dict[str, dict[str, int]]:
        """Return {date: {color: count}} for all recorded dates."""
        result: dict[str, dict[str, int]] = {}
        for entry in self.get_entries():
            day = entry["date"]
            color = entry["color"]
            if day not in result:
                result[day] = {}
            result[day][color] = result[day].get(color, 0) + entry["count"]
        return result

    async def async_add_eggs(
        self, color: str, count: int, day: str | None = None, note: str | None = None
    ) -> None:
        if day is None:
            day = date.today().isoformat()
        entry = {
            "date": day,
            "color": color.lower(),
            "count": count,
            "timestamp": datetime.now().isoformat(),
        }
        if note:
            entry["note"] = note
        self._data.setdefault("entries", []).append(entry)
        await self.async_save()

    async def async_remove_eggs(
        self, color: str, count: int, day: str | None = None
    ) -> None:
        """Remove eggs by adding a negative entry (keeps audit trail)."""
        if day is None:
            day = date.today().isoformat()
        current = self.get_totals_for_date(day).get(color.lower(), 0)
        actual_remove = min(count, current)
        if actual_remove > 0:
            await self.async_add_eggs(color, -actual_remove, day)

    async def async_reset_day(self, day: str | None = None) -> None:
        if day is None:
            day = date.today().isoformat()
        self._data["entries"] = [
            e for e in self._data.get("entries", []) if e.get("date") != day
        ]
        await self.async_save()

    def get_all_colors_used(self) -> list[str]:
        colors: set[str] = set()
        for entry in self.get_entries():
            colors.add(entry["color"])
        return sorted(colors)
