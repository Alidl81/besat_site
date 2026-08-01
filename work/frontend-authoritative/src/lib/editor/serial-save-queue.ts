export type SerialSaveQueue<T> = {
  enqueue(operation: () => Promise<T>): Promise<T>;
};

export function createSerialSaveQueue<T>(): SerialSaveQueue<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    enqueue(operation) {
      const next = tail.then(operation, operation);
      tail = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };
}
