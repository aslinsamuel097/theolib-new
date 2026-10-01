/**
 * @fileOverview Polyfill for Promise.withResolvers.
 * Required for pdfjs-dist v4+ compatibility in environments lacking ES2024 support.
 */
if (typeof Promise !== 'undefined' && typeof (Promise as any).withResolvers === 'undefined') {
  (Promise as any).withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export {};
