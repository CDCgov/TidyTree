import * as d3 from "d3";
globalThis.d3 = d3;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
