/* Leegend Cars — icônes SVG inline */
(function () {
  const svg = (paths, opts) => {
    const o = opts || {};
    return `<svg viewBox="${o.viewBox || "0 0 24 24"}" fill="${o.fill || "none"}" stroke="${
      o.stroke === undefined ? "currentColor" : o.stroke
    }" stroke-width="${o.sw || 1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  };

  const Icons = {
    phone: () =>
      svg(
        `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.07 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />`
      ),
    mapPin: () =>
      svg(
        `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />`
      ),
    clock: () => svg(`<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />`),
    shield: () =>
      svg(
        `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" />`
      ),
    truck: () =>
      svg(
        `<path d="M10 17h4V5H2v12h3" /><path d="M14 9h4l4 4v4h-3" /><circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />`
      ),
    tag: () =>
      svg(
        `<path d="M12.6 2.6 21 11a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L2.6 12.6A2 2 0 0 1 2 11.2V4a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6Z" /><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />`
      ),
    sparkles: () =>
      svg(
        `<path d="m12 3 1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" /><path d="M19 15.5 19.8 17.4 21.7 18.2 19.8 19 19 20.9 18.2 19 16.3 18.2 18.2 17.4 19 15.5Z" /><path d="M5.5 15.5 6.2 17.1 7.8 17.8 6.2 18.5 5.5 20.1 4.8 18.5 3.2 17.8 4.8 17.1 5.5 15.5Z" />`
      ),
    arrowRight: () => svg(`<path d="M5 12h14" /><path d="m13 6 6 6-6 6" />`),
    arrowDown: () => svg(`<path d="M12 5v14" /><path d="m6 13 6 6 6-6" />`),
    arrowLeft: () => svg(`<path d="M19 12H5" /><path d="m11 6-6 6 6 6" />`),
    check: () => svg(`<path d="m5 12 5 5L20 7" />`),
    checkCircle: () =>
      svg(`<circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.4 2.4 4.6-4.8" />`),
    x: () => svg(`<path d="M18 6 6 18" /><path d="m6 6 12 12" />`),
    users: () =>
      svg(
        `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />`
      ),
    gear: () =>
      svg(
        `<circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />`
      ),
    door: () =>
      svg(
        `<path d="M4 21V5a2 2 0 0 1 1.6-2l8 -1.5A2 2 0 0 1 16 3.5V21" /><path d="M2.5 21h15" /><circle cx="13" cy="12" r="1" fill="currentColor" stroke="none" />`
      ),
    fuel: () =>
      svg(
        `<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" /><path d="M3 21h12" /><path d="M14 9h2.5a2 2 0 0 1 2 2v5.5a1.5 1.5 0 0 0 3 0V10l-2.5-3" /><path d="M6.5 8.5h5" />`
      ),
    snow: () =>
      svg(
        `<path d="M12 2v20M4.2 7l15.6 10M19.8 7 4.2 17" /><path d="m9.5 4.5 2.5 2.5 2.5-2.5M9.5 19.5 12 17l2.5 2.5" />`
      ),
    star: () =>
      svg(
        `<path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9L12 2.6Z" />`,
        { fill: "currentColor", stroke: "none", sw: 0 }
      ),
    calendar: () =>
      svg(
        `<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" />`
      ),
    car: () =>
      svg(
        `<path d="M5 17H3v-5l2-5h14l2 5v5h-2" /><path d="M5 17h14" /><circle cx="7.5" cy="17" r="2" /><circle cx="16.5" cy="17" r="2" /><path d="M5 12h14" />`
      ),
    plane: () =>
      svg(
        `<path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a.5.5 0 0 0-.5.8l4.2 4.2-2 2-2.3-.6a.5.5 0 0 0-.5.8L6 16.5l1.1 2.2a.5.5 0 0 0 .8-.1l-.6-2.3 2-2 4.2 4.2a.5.5 0 0 0 .8-.5Z" />`
      ),
    globe: () =>
      svg(`<circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" />`),
    alert: () =>
      svg(
        `<path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" />`
      ),
    lock: () =>
      svg(
        `<rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />`
      ),
    info: () =>
      svg(`<circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />`),
  };

  window.Icons = Icons;
})();
