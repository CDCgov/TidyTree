import * as d3 from "d3";
globalThis.d3 = d3;
// These are unit tests with hand-mocked parents, not rendering tests: drop
// animation frames so redraw() never runs against a partial DOM mock after a
// test has finished. Real-DOM rendering tests are tracked in #59.
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
