"""Single source of truth for 'what does this line cost'. Cart display,
checkout preview and order creation all call this rather than each
re-deriving price logic -- the backend is the sole authority on price,
never the client."""

from __future__ import annotations


def effective_unit_price(product, variant=None) -> int:
    if variant is not None and variant.price_override_amount is not None:
        return variant.price_override_amount

    if product.sale_price_amount is not None:
        return product.sale_price_amount

    return product.price_amount
