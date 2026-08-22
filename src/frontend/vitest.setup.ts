import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount React trees between tests so one test's DOM never leaks into the next.
afterEach(() => {
  cleanup();
});

// jsdom implements no layout, so `scrollIntoView` simply does not exist on an
// element — and a component that calls it (#453) throws in every test that
// renders it, however unrelated. Stubbed here rather than guarded at each call
// site: the gap is the test environment's, not the code's.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Same gap, same reason (#455): jsdom ships no ResizeObserver, so a component
// that watches its own box for overflow throws on render. The stub observes
// nothing — a test that needs a measurement sets scrollWidth/clientWidth itself
// and fires the scroll event.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
