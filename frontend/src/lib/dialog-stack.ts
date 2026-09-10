// Tracks which dialog is topmost when more than one is open at once (e.g. a
// media picker opened from inside a "new item" modal). Each independent
// dialog implementation attaches its own document-level Escape listener, and
// since a single keydown event reaches every listener bound to `document`
// regardless of DOM nesting, an Escape press would otherwise close every
// open dialog at once instead of just the one on top. A dialog should only
// act on Escape when it is the last one pushed here.
let stack: symbol[] = [];

export function pushDialog(): symbol {
  const token = Symbol("dialog");
  stack = [...stack, token];
  return token;
}

export function popDialog(token: symbol): void {
  stack = stack.filter((entry) => entry !== token);
}

export function isTopDialog(token: symbol): boolean {
  return stack[stack.length - 1] === token;
}
