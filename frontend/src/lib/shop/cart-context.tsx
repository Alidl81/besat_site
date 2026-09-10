"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getApiErrorMessage } from "@/lib/api/client";
import { hasSessionCookie } from "@/lib/auth/session-marker-cookie";
import { formatPrice } from "@/lib/shop/money";
import { addCartItem, getCart, mergeGuestCart, removeCartItem, updateCartItem } from "@/services/shop-service";
import type { CartTransportResult } from "@/lib/shop/cart-transport";
import type { Cart } from "@/types/shop";

// FE-SHOP-CART-CONTEXT-RESPONSE-ORDER-001: updateItem/removeItem responses
// are full-cart snapshots. Two concurrent mutations of *different* items
// intentionally run in parallel (their own per-item UI guards already allow
// this), but blindly replacing the whole local cart with whichever
// response lands last means a slower response -- serialized from a
// snapshot taken before the other item's update was applied -- silently
// regresses that other item. Merging only the field(s) this specific
// request actually targeted, and recomputing the cart-level aggregates
// from the merged item list, means an out-of-order response can no longer
// clobber a different item's already-accepted update.
//
// FE-SHOP-CART-CONTEXT-SAME-ITEM-RESPONSE-ORDER-001 (adjacent): the fix
// above alone doesn't order two responses for the *same* item -- e.g. two
// same-tick updateItem(41, ...) calls whose responses arrive in the
// opposite order from how the requests were issued. `seq` is a
// monotonically increasing number captured at request-*call* time (before
// the await), so a later-issued call for the same item always keeps
// `itemSeq` at its own, higher value even while its response is still
// in flight -- an older response that lands afterward compares its own
// (lower) seq against the current `itemSeq` value and is rejected.
function mergeSingleItemResponse(
  current: Cart | null,
  incoming: Cart,
  targetItemId: number,
  seq: number,
  itemSeq: Map<number, number>,
): Cart {
  if (!current) return incoming;
  if (seq < (itemSeq.get(targetItemId) ?? 0)) return current;

  const incomingTarget = incoming.items.find((item) => item.id === targetItemId);
  const items = incomingTarget
    ? current.items.some((item) => item.id === targetItemId)
      ? current.items.map((item) => (item.id === targetItemId ? incomingTarget : item))
      : [...current.items, incomingTarget]
    : current.items.filter((item) => item.id !== targetItemId);

  return recomputeCartAggregates(current, items);
}

// FE-SHOP-CART-CONTEXT-REFRESH-RACE-001 (adjacent): refresh() is a
// full-cart GET, not a targeted mutation -- it carries no per-item version
// info the way an updateItem/removeItem response does, so a plain seq
// comparison can't tell "issued later" apart from "reflects fresher
// state" (a refresh dispatched *after* a mutation can still race the
// server and return a snapshot from *before* that mutation landed).
// Instead, `excludeItemIds` is captured once, synchronously, at the
// moment refresh() itself is called: the set of items with a targeted
// mutation still in flight at that instant. Those items are left
// entirely untouched by this refresh's response and keep deferring to
// their own mutation's response -- every other item (including ones
// mutated in the past but not right now) is refreshed normally, so this
// never turns into a permanent exclusion.
//
// FE-SHOP-CART-CONTEXT-ADD-REFRESH-RACE-001 (adjacent): `excludeItemIds`
// alone doesn't cover addItem(), because the new item's id doesn't exist
// yet at the moment refresh() is *called* (it's created by the add's
// response), so it can never be pre-registered the way an in-flight
// update/remove is.
//
// FE-SHOP-CART-CONTEXT-REFRESH-GHOST-ITEM-001 (adjacent): the first fix
// for the add-vs-refresh race above went too far -- it *unconditionally*
// preserved any item present locally but missing from the incoming
// snapshot, which also preserves an item the server has legitimately
// dropped (expired reservation, cross-tab removal, admin action) even
// when nothing is racing at all, turning every refresh into a one-way
// ratchet that can only ever add items, never let a plain, uncontested
// refresh remove one. The fix is `itemSeq` (the same shared per-item
// sequence map as everywhere else): a locally-known item missing from
// this refresh's snapshot is preserved *only* if its most recent recorded
// seq is newer than this refresh's own `refreshSeq` -- i.e. only if it
// was touched by an operation this specific refresh could not possibly
// have already reflected. An item with no seq entry (never touched by a
// targeted mutation -- e.g. it only ever came from an earlier plain
// refresh) always loses to a fresher refresh's absence, exactly as it
// should.
function mergeRefreshResult(
  current: Cart | null,
  incoming: Cart,
  excludeItemIds: Set<number>,
  refreshSeq: number,
  itemSeq: Map<number, number>,
): Cart {
  if (!current) return incoming;

  const incomingIds = new Set(incoming.items.map((item) => item.id));
  const currentById = new Map(current.items.map((item) => [item.id, item]));
  const items = incoming.items.map((item) => (excludeItemIds.has(item.id) ? (currentById.get(item.id) ?? item) : item));
  for (const item of current.items) {
    if (!incomingIds.has(item.id) && (itemSeq.get(item.id) ?? 0) > refreshSeq) {
      items.push(item);
    }
  }

  return recomputeCartAggregates(current, items);
}

// FE-SHOP-CART-CONTEXT-ADD-RESPONSE-ORDER-001: addItem() had the same
// unconditional-full-replace shape as the other mutations before their
// fixes -- two concurrent adds of *different* products are legitimate
// (no reason to block one for the other), but each response is a
// full-cart snapshot, so whichever lands last silently erased the other
// add. Unlike updateItem/removeItem, there's no existing item id to key
// on here (the item doesn't exist until the response creates it), so the
// response this specific call is responsible for is identified by
// product/variant instead: only that one item is merged into the current
// list (added, or replacing itself if this is a repeat add that bumped
// an existing item's quantity), leaving every other item untouched. New
// items are inserted in *call* order (via `seq`, captured before the
// await, and remembered per item id in the shared `itemSeq` map -- the
// same one mergeSingleItemResponse uses) rather than response-arrival
// order, so a same-tick "add A, then add B" always ends up as [A, B]
// regardless of which response happens to land first.
//
// FE-SHOP-CART-CONTEXT-ADD-SAME-PRODUCT-RESPONSE-ORDER-001 (adjacent):
// two concurrent adds of the *same* product both resolve to the same
// existing line item id, and the "replace in place" branch below used to
// do that unconditionally -- an older, lower-quantity response landing
// after a newer one silently regressed the quantity. Reusing `itemSeq`
// (shared with mergeSingleItemResponse) for this line the same way fixes
// it: an add response is only applied to an existing line if its own seq
// is not older than the highest seq already recorded for that line,
// exactly mirroring the same-item update/remove fix.
//
// FE-SHOP-CART-CONTEXT-ADD-NULL-STATE-ORDER-001 (adjacent): the original
// `if (!current) return incoming` bypassed all of the above -- if an
// add's response arrived while the provider's lazy initial refresh
// hadn't resolved yet (`cart` still `null`), it skipped recording
// anything into `itemSeq` and returned its own snapshot wholesale, so a
// second concurrent add (same or different product) had no ordering
// information to compare against once its own response landed. Treating
// `null` as an empty cart shell (borrowing `incoming`'s own top-level
// fields, since there's no prior real cart to base them on) instead of
// short-circuiting means every add response -- the very first one
// included -- goes through the exact same seq-recording and
// insertion-order logic as any other, so this is just as correct
// whether or not the initial refresh has resolved yet.
function mergeAddedItemResponse(
  current: Cart | null,
  incoming: Cart,
  productId: number,
  variantId: number | null,
  seq: number,
  itemSeq: Map<number, number>,
): Cart {
  const base = current ?? { ...incoming, items: [] };

  const addedItem = incoming.items.find(
    (item) => item.product.id === productId && (item.variant ?? null) === variantId,
  );
  if (!addedItem) return base;

  const existing = base.items.some((item) => item.id === addedItem.id);
  if (existing && seq < (itemSeq.get(addedItem.id) ?? 0)) return base;

  itemSeq.set(addedItem.id, Math.max(seq, itemSeq.get(addedItem.id) ?? 0));

  let items: Cart["items"];
  if (existing) {
    items = base.items.map((item) => (item.id === addedItem.id ? addedItem : item));
  } else {
    const insertIndex = base.items.findIndex((item) => {
      const otherSeq = itemSeq.get(item.id);
      return otherSeq !== undefined && otherSeq > seq;
    });
    items = insertIndex === -1
      ? [...base.items, addedItem]
      : [...base.items.slice(0, insertIndex), addedItem, ...base.items.slice(insertIndex)];
  }

  return recomputeCartAggregates(base, items);
}

function recomputeCartAggregates(current: Cart, items: Cart["items"]): Cart {
  const subtotalAmount = items.reduce((sum, item) => sum + item.line_total_amount, 0);
  return {
    ...current,
    items,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal_amount: subtotalAmount,
    subtotal_display: formatPrice(subtotalAmount),
    requires_shipping: items.some((item) => item.product.product_type === "physical"),
    has_blocking_issue: items.some((item) => item.issue !== null),
  };
}

/**
 * The guest-cart token only identifies an anonymous shopping cart (no
 * auth capability, no PII beyond what's already in the cart) -- unlike
 * the real session tokens, it does not need to be an httpOnly cookie
 * managed by the BFF proxy. It lives in localStorage instead, which
 * turned out to need zero changes to the proxy: `backend-client.ts`
 * only strips a fixed header blocklist that doesn't include this custom
 * header in either direction (verified by reading it), so a plain
 * client-side header round-trip already works end-to-end.
 */
const GUEST_TOKEN_STORAGE_KEY = "besat_guest_cart_token";

function readGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeGuestToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode, quota) -- cart still works
    // for the current tab session via in-memory state, just won't persist.
  }
}

// REL-FE-CART-ADD-IDEMPOTENCY-RELOAD-001: addRequestIdsRef (see addItem()
// below) is pure in-memory React state -- a page reload, or the provider
// simply unmounting/remounting, between a failed add and its retry loses
// it entirely, so the "retry" mints a brand-new key and the backend,
// having genuinely never seen it before, correctly (from its own
// perspective) applies it as a second add. Persisting the same
// productId/variantId -> key mapping to localStorage lets a fresh mount
// rehydrate a still-pending key instead of generating a new one. Scoped
// only by product/variant, not by cart -- perfectly fine even if reused
// across a logout/login in the same TTL window, since the backend's own
// dedup check only ever compares against the specific CartItem row being
// written, so a coincidentally-reused key against a *different* cart's
// row simply never matches anything there. `ADD_REQUEST_ID_TTL_MS` is
// bounded for the same reason the backend's own MAX_TRACKED_ADD_REQUEST_
// IDS is bounded: this exists to survive a realistic reload-mid-retry,
// not to remember a half-finished add from days ago.
const ADD_REQUEST_ID_STORAGE_KEY = "besat_cart_add_request_ids";
const ADD_REQUEST_ID_TTL_MS = 10 * 60 * 1000;

type StoredAddRequestIds = Record<string, { id: string; ts: number }>;

function readStoredAddRequestIds(): StoredAddRequestIds {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ADD_REQUEST_ID_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as StoredAddRequestIds) : {};
  } catch {
    return {};
  }
}

function writeStoredAddRequestIds(entries: StoredAddRequestIds) {
  if (typeof window === "undefined") return;
  try {
    if (Object.keys(entries).length === 0) window.localStorage.removeItem(ADD_REQUEST_ID_STORAGE_KEY);
    else window.localStorage.setItem(ADD_REQUEST_ID_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable -- falls back to in-memory-only behavior
    // for this tab, same as the guest token above.
  }
}

function readPersistedAddRequestId(targetKey: string): string | null {
  const entry = readStoredAddRequestIds()[targetKey];
  if (!entry || Date.now() - entry.ts > ADD_REQUEST_ID_TTL_MS) return null;
  return entry.id;
}

function writePersistedAddRequestId(targetKey: string, id: string) {
  const entries = readStoredAddRequestIds();
  entries[targetKey] = { id, ts: Date.now() };
  writeStoredAddRequestIds(entries);
}

function clearPersistedAddRequestId(targetKey: string) {
  const entries = readStoredAddRequestIds();
  if (targetKey in entries) {
    delete entries[targetKey];
    writeStoredAddRequestIds(entries);
  }
}

type ShopCartContextValue = {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  announcement: string;
  addItem: (productId: number, quantity?: number, variantId?: number | null) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  refresh: () => Promise<void>;
  mergeAfterLogin: () => Promise<void>;
};

const ShopCartContext = createContext<ShopCartContextValue | null>(null);

export function ShopCartProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const fetchedRef = useRef(false);
  const nextSeqRef = useRef(0);
  const itemSeqRef = useRef<Map<number, number>>(new Map());
  // REL-FE-CART-ADD-RESPONSE-LOSS-001: keyed by `${productId}:${variantId
  // ?? ""}` -- see addItem()'s own comment for why this persists a
  // client-generated idempotency key across a failed attempt (so a retry
  // reuses it) and clears it on success (so the next add is a fresh key).
  const addRequestIdsRef = useRef<Map<string, string>>(new Map());
  // FE-SHOP-CART-CONTEXT-MULTI-MUTATION-REFRESH-RACE-001: a plain Set only
  // tracks *whether* an item has a mutation in flight, not *how many* --
  // when two same-item mutations overlap, the first one to settle deletes
  // the item from the Set in its `finally`, even though the second is
  // still pending, so a refresh() issued right after can no longer see
  // that item as excluded. A reference count (increment on call, decrement
  // in `finally`, only actually removing the entry once it reaches zero)
  // keeps the item excluded for as long as *any* mutation targeting it is
  // still outstanding.
  const pendingMutationCountsRef = useRef<Map<number, number>>(new Map());
  const lastAppliedRefreshSeqRef = useRef(0);
  // FE-SHOP-CART-CONTEXT-REFRESH-LOADING-RACE-001: `lastAppliedRefreshSeqRef`
  // above only tracks the newest refresh whose response has *landed* -- it
  // says nothing about whether an even newer refresh call is still
  // in-flight. Two overlapping refresh() calls used to unconditionally
  // clear `loading`/apply `error` in their own `finally`/`catch`, so
  // whichever one settled *first* (regardless of which was issued more
  // recently) could flip loading back to idle -- or surface a stale
  // failure as the current error -- while a still-pending, more recent
  // refresh's authoritative result hadn't arrived yet. `latestRefreshCallSeqRef`
  // records the seq of the most recently *issued* refresh call (captured
  // at call time, before its await, same as every other seq in this file);
  // only the call whose own seq still matches it when it settles is
  // allowed to touch `loading`/`error`.
  const latestRefreshCallSeqRef = useRef(0);

  function addPendingMutation(itemId: number) {
    pendingMutationCountsRef.current.set(itemId, (pendingMutationCountsRef.current.get(itemId) ?? 0) + 1);
  }

  function removePendingMutation(itemId: number) {
    const next = (pendingMutationCountsRef.current.get(itemId) ?? 0) - 1;
    if (next <= 0) pendingMutationCountsRef.current.delete(itemId);
    else pendingMutationCountsRef.current.set(itemId, next);
  }

  // `seq` is captured by the caller at request-*call* time (before the
  // await), not here at response-apply time -- see the comment on
  // mergeSingleItemResponse for why that ordering matters.
  const applyTargetedResult = useCallback((result: CartTransportResult<Cart>, targetItemId: number, seq: number) => {
    if (result.clearGuestToken) writeGuestToken(null);
    else if (result.guestToken) writeGuestToken(result.guestToken);
    setCart((current) => mergeSingleItemResponse(current, result.data, targetItemId, seq, itemSeqRef.current));
    return result.data;
  }, []);

  const applyResult = useCallback((result: CartTransportResult<Cart>) => {
    if (result.clearGuestToken) writeGuestToken(null);
    else if (result.guestToken) writeGuestToken(result.guestToken);
    setCart(result.data);
    return result.data;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const excludeItemIds = new Set(pendingMutationCountsRef.current.keys());
    // FE-SHOP-CART-CONTEXT-REFRESH-RESPONSE-ORDER-001: two overlapping
    // refresh() calls are both plain full-cart GETs -- unlike a refresh
    // racing a targeted mutation (where the mutation's response is
    // authoritative for its own item regardless of issue order), two
    // GETs of the same resource have no such asymmetry, so "the one
    // issued later is authoritative" is a safe, sufficient rule here.
    // `seq` is captured before the await for the same reason as the
    // mutation paths.
    const seq = ++nextSeqRef.current;
    latestRefreshCallSeqRef.current = seq;
    try {
      const result = await getCart(readGuestToken());
      if (result.clearGuestToken) writeGuestToken(null);
      else if (result.guestToken) writeGuestToken(result.guestToken);
      if (seq < lastAppliedRefreshSeqRef.current) return;
      lastAppliedRefreshSeqRef.current = seq;
      setCart((current) => mergeRefreshResult(current, result.data, excludeItemIds, seq, itemSeqRef.current));
    } catch (reason) {
      if (seq === latestRefreshCallSeqRef.current) setError(getApiErrorMessage(reason));
    } finally {
      if (seq === latestRefreshCallSeqRef.current) setLoading(false);
    }
  }, []);

  const addItem = useCallback(
    async (productId: number, quantity = 1, variantId: number | null = null) => {
      const seq = ++nextSeqRef.current;
      // REL-FE-CART-ADD-RESPONSE-LOSS-001: unlike removeItem's DELETE,
      // add-to-cart is not naturally idempotent -- a lost response
      // followed by the user clicking "Add to Cart" again for the same
      // product/variant is indistinguishable, from the request alone,
      // from a genuine second add (observed live: one intended add
      // recovered as quantity=2). Reusing the SAME client_request_id for
      // every attempt at this exact logical add lets add_item() on the
      // backend recognize a retry and no-op it instead of double-adding.
      // The key is only cleared once THIS call actually succeeds -- kept
      // on any failure, so the next click for the same product/variant
      // (whether an explicit retry or just the user trying again) reuses
      // it; a successful add "consumes" it so a later, genuinely new
      // add starts its own fresh key.
      //
      // REL-FE-CART-ADD-IDEMPOTENCY-RELOAD-001: addRequestIdsRef alone is
      // lost across a page reload between the failed attempt and its
      // retry -- readPersistedAddRequestId()/writePersistedAddRequestId()
      // (see their own comments) durably back it with localStorage so a
      // fresh mount can rehydrate a still-pending key instead of minting
      // a new one.
      const targetKey = `${productId}:${variantId ?? ""}`;
      let clientRequestId = addRequestIdsRef.current.get(targetKey) ?? readPersistedAddRequestId(targetKey);
      if (!clientRequestId) {
        clientRequestId = crypto.randomUUID();
      }
      addRequestIdsRef.current.set(targetKey, clientRequestId);
      writePersistedAddRequestId(targetKey, clientRequestId);
      const result = await addCartItem(readGuestToken(), {
        product_id: productId,
        variant_id: variantId,
        quantity,
        client_request_id: clientRequestId,
      });
      addRequestIdsRef.current.delete(targetKey);
      clearPersistedAddRequestId(targetKey);
      if (result.clearGuestToken) writeGuestToken(null);
      else if (result.guestToken) writeGuestToken(result.guestToken);
      setCart((current) => mergeAddedItemResponse(current, result.data, productId, variantId, seq, itemSeqRef.current));
      setAnnouncement("محصول به سبد خرید اضافه شد.");
    },
    [],
  );

  const updateItem = useCallback(
    async (itemId: number, quantity: number) => {
      // Stamped synchronously, before the await: a second same-tick call
      // targeting the same item (or a call issued shortly after, whose
      // response might still land first) must be visible to
      // mergeSingleItemResponse's ordering check the instant it's issued,
      // not only once its own response eventually arrives.
      const seq = ++nextSeqRef.current;
      itemSeqRef.current.set(itemId, Math.max(seq, itemSeqRef.current.get(itemId) ?? 0));
      addPendingMutation(itemId);
      try {
        const result = await updateCartItem(readGuestToken(), itemId, quantity);
        applyTargetedResult(result, itemId, seq);
        setAnnouncement("تعداد سبد خرید به‌روزرسانی شد.");
      } finally {
        removePendingMutation(itemId);
      }
    },
    [applyTargetedResult],
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      const seq = ++nextSeqRef.current;
      itemSeqRef.current.set(itemId, Math.max(seq, itemSeqRef.current.get(itemId) ?? 0));
      addPendingMutation(itemId);
      try {
        const result = await removeCartItem(readGuestToken(), itemId);
        applyTargetedResult(result, itemId, seq);
        setAnnouncement("محصول از سبد خرید حذف شد.");
      } catch (reason) {
        // REL-FE-CART-DELETE-RESPONSE-LOSS-001: a DELETE can commit on
        // the server while its response is lost in transit (a network
        // drop, a proxy 503) -- the caller sees a failure, and a retry
        // then correctly gets item_not_found for the row it already
        // deleted. DELETE is idempotent by nature: "the item is gone" is
        // success regardless of which attempt actually achieved it, so
        // rather than trust this rejection at face value, reconcile
        // against the server's real current state before giving up. A
        // fresh GET confirming the item is really gone is applied through
        // the exact same targeted-result path (and the same `seq`) a
        // genuine successful DELETE response would use, so it's subject
        // to the identical staleness guard against any other concurrent
        // mutation on this item.
        try {
          const confirmation = await getCart(readGuestToken());
          const stillPresent = confirmation.data.items.some((cartItem) => cartItem.id === itemId);
          if (!stillPresent) {
            applyTargetedResult(confirmation, itemId, seq);
            setAnnouncement("محصول از سبد خرید حذف شد.");
            return;
          }
        } catch {
          // Reconciliation itself failed (e.g. also offline) -- fall
          // through to surfacing the original error, the best
          // information actually available.
        }
        throw reason;
      } finally {
        removePendingMutation(itemId);
      }
    },
    [applyTargetedResult],
  );

  const mergeAfterLogin = useCallback(async () => {
    // FE-SHOP-GUEST-CART-MERGE-EMPTY-FLICKER-001: this function never
    // touched `loading` at all, so the /shop mount effect's retry path
    // (below) left `loading` false and `cart` null for the whole merge
    // round-trip -- CartPageView's own "no cart yet" branch has no way
    // to tell that apart from a genuinely empty cart, so it rendered the
    // empty-cart heading for the ~1-1.5s the retry was still pending,
    // then the real line popped in once it resolved. Wrapping the whole
    // call (success, failure, and the token-absent early return, all of
    // which end up awaiting refresh() one way or another) in the same
    // setLoading(true)/finally(setLoading(false)) refresh() itself
    // already uses gives the page a real, continuous loading state to
    // render instead of a premature empty state.
    setLoading(true);
    try {
      const token = readGuestToken();
      if (!token) {
        await refresh();
        return;
      }
      try {
        applyResult(await mergeGuestCart(token));
      } catch (reason) {
        // FE-SHOP-GUEST-CART-MERGE-FAILURE-001: the guest-cart token is the
        // only client handle for that cart -- a transient merge failure
        // (network blip, 500) does not prove the server ever consumed it,
        // so discarding the token here would strand those items with no
        // way to retry. Keep it and just surface the error; the mount effect
        // below actually performs that retry now (FE-SHOP-GUEST-CART-MERGE-
        // RETRY-001 -- this comment used to promise a retry that nothing
        // ever performed).
        setError(getApiErrorMessage(reason));
        await refresh();
      }
    } finally {
      setLoading(false);
    }
  }, [applyResult, refresh]);

  useEffect(() => {
    // The provider now wraps the whole app (so the header can show cart
    // state), but most pages never touch the cart -- fetch lazily, exactly
    // once, the first time a shop route is actually visited (whether that's
    // the initial load or a client-side navigation into /shop later).
    if (!pathname.startsWith("/shop") || fetchedRef.current) return;
    fetchedRef.current = true;
    // FE-SHOP-GUEST-CART-MERGE-RETRY-001: a guest token surviving to this
    // point while the visitor already has a real session can only mean an
    // earlier merge attempt (at login) never completed --
    // mergeAfterLogin()/mergeGuestCartAfterAuth() already deliberately
    // keep the token on a failed merge specifically so it can be retried
    // later (see their own comments), but nothing ever actually retried
    // it: a plain refresh() just fetches the (empty) authenticated cart
    // and silently ignores the still-present guest token, since
    // get_or_create_active_cart() never merges for an authenticated
    // caller -- only the dedicated merge endpoint does. Attempting the
    // merge here, instead of a plain refresh(), is the retry. Deliberately
    // gated on a real session (not merely "a token exists"): an anonymous
    // shopper's own guest token is the overwhelmingly common case for this
    // effect, and a blind merge attempt for them would just draw an
    // expected 401 and (via mergeAfterLogin's own catch branch) surface a
    // spurious error for a perfectly normal state.
    //
    // Reopened: gating this on readBesatSession() raced a real login --
    // that display cache is only written after SiteAuthActions' own async
    // getCurrentUser() call resolves, so a shop-cart mount immediately
    // after a login redirect (e.g. /login -> /dashboard -> /shop/cart)
    // could run this effect before that write landed and wrongly fall
    // through to a plain refresh(), never retrying at all. hasSessionCookie()
    // reads a marker the server sets synchronously alongside the real
    // session cookies, so it's correct the instant this effect runs, with
    // nothing async to race. fetchedRef.current above already guarantees
    // this effect body (and thus the merge attempt) runs at most once per
    // provider instance, so the retry itself stays single-flight.
    const shouldRetryMerge = Boolean(readGuestToken()) && hasSessionCookie();
    Promise.resolve().then(() => (shouldRetryMerge ? mergeAfterLogin() : refresh()));
  }, [pathname, refresh, mergeAfterLogin]);

  const value = useMemo<ShopCartContextValue>(
    () => ({ cart, loading, error, announcement, addItem, updateItem, removeItem, refresh, mergeAfterLogin }),
    [cart, loading, error, announcement, addItem, updateItem, removeItem, refresh, mergeAfterLogin],
  );

  return <ShopCartContext.Provider value={value}>{children}</ShopCartContext.Provider>;
}

export function useShopCart() {
  const context = useContext(ShopCartContext);
  if (!context) {
    throw new Error("useShopCart must be used within a ShopCartProvider");
  }
  return context;
}

/**
 * Standalone merge-on-login, for call sites outside the /shop route
 * segment (login-card.tsx, the registration page) that are never wrapped
 * in ShopCartProvider. Best-effort and silent on failure -- a guest cart
 * that fails to merge just stays a guest cart; it must never block login
 * or registration.
 */
export async function mergeGuestCartAfterAuth(): Promise<void> {
  const token = readGuestToken();
  if (!token) return;
  try {
    const result = await mergeGuestCart(token);
    if (result.clearGuestToken) writeGuestToken(null);
  } catch {
    // FE-SHOP-GUEST-CART-MERGE-FAILURE-001: do not discard the token on a
    // transient failure -- see mergeAfterLogin's identical comment above.
    // A failed merge is silent by design (this must never block login),
    // but silence must not also mean permanently losing the guest cart.
  }
}
