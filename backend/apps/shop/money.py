"""Centralized money handling for the shop.

Every ``*_amount`` field across shop models stores an integer number of
rial (Iran's smallest currency unit) -- never a float, never toman
directly. This keeps arithmetic exact and currency-agnostic; the
*display* currency (what a human reads on screen) is a separate,
temporary decision layered on top so it can be flipped without touching
any model or business logic.

TEMPORARY: whether the storefront should display rial or toman has not
been confirmed by the product owner yet (see the project decision gate).
Until confirmed, DISPLAY_CURRENCY defaults to toman -- the everyday
spoken unit in Iran -- purely as a working default. Every place that
needs to show money to a human MUST go through the functions below
rather than dividing/multiplying inline, so this default can be swapped
in one place, once, when the decision is made.
"""

from __future__ import annotations

# Canonical storage unit: every *_amount integer field in this app is
# always this many of Iran's smallest currency unit (rial). Do not change
# without a data migration -- this is the contract every model relies on.
STORAGE_CURRENCY = "IRR"

# TEMPORARY pending product-owner confirmation (rial vs toman for display).
DISPLAY_CURRENCY = "IRT"

_RIAL_PER_TOMAN = 10

_DISPLAY_DIVISORS = {
    "IRR": 1,
    "IRT": _RIAL_PER_TOMAN,
}


def to_display_amount(amount_rial: int | None) -> int | None:
    """Convert a canonical rial amount into the configured display unit."""
    if amount_rial is None:
        return None

    divisor = _DISPLAY_DIVISORS[DISPLAY_CURRENCY]
    return amount_rial // divisor


def format_amount_for_display(amount_rial: int | None) -> str | None:
    """The only function serializers should call to show an amount to a
    human. Returns a plain digit-grouped number; the currency word/suffix
    (toman/rial) is added by the frontend so this string stays
    locale-composable rather than hardcoding Persian text here."""
    if amount_rial is None:
        return None

    return f"{to_display_amount(amount_rial):,}"


def to_storage_amount(display_amount: int | float | str) -> int:
    """Convert an admin-entered display-unit amount into canonical rial."""
    divisor = _DISPLAY_DIVISORS[DISPLAY_CURRENCY]
    return int(display_amount) * divisor
