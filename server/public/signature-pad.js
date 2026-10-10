/* Signature manuscrite au doigt / à la souris.
   Chargé en <script src> (la CSP interdit tout script inline), utilisé aussi bien
   par la modale de l'admin que par la page publique /sign/:token. */
(function () {
  "use strict";

  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.1;
    return ctx;
  }

  class SignaturePad {
    constructor(canvas, options) {
      this.canvas = canvas;
      this.ctx = fitCanvas(canvas);
      this.color = (options && options.color) || "#111";
      this.minWidth = (options && options.minWidth) || 0.35;
      this.empty = true;
      this._drawing = false;
      this._last = null;

      this._onDown = this._onDown.bind(this);
      this._onMove = this._onMove.bind(this);
      this._onUp = this._onUp.bind(this);

      canvas.style.touchAction = "none";
      canvas.addEventListener("pointerdown", this._onDown);
      canvas.addEventListener("pointermove", this._onMove);
      window.addEventListener("pointerup", this._onUp);
      window.addEventListener("pointercancel", this._onUp);
    }

    destroy() {
      this.canvas.removeEventListener("pointerdown", this._onDown);
      this.canvas.removeEventListener("pointermove", this._onMove);
      window.removeEventListener("pointerup", this._onUp);
      window.removeEventListener("pointercancel", this._onUp);
    }

    _pos(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    _onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      this._drawing = true;
      this._last = this._pos(e);
      this.ctx.beginPath();
      this.ctx.moveTo(this._last.x, this._last.y);
      /* Un simple point clic laisse une trace : on pose un palier minuscule. */
      this.ctx.lineTo(this._last.x + 0.1, this._last.y + 0.1);
      this.ctx.stroke();
      this.empty = false;
    }

    _onMove(e) {
      if (!this._drawing) return;
      e.preventDefault();
      const p = this._pos(e);
      const last = this._last;
      const mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
      const dist = Math.hypot(p.x - last.x, p.y - last.y);
      this.ctx.lineWidth = Math.max(1.1, Math.min(4.2, this.minWidth + dist / 22));
      this.ctx.beginPath();
      this.ctx.moveTo(last.x, last.y);
      this.ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();
      this._last = p;
      this.empty = false;
    }

    _onUp() {
      this._drawing = false;
    }

    clear() {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
      this.empty = true;
      this._last = null;
    }

    isEmpty() {
      return this.empty;
    }

    /* Recadre sur le tracé et réduit l'image : une signature de 640 px de large
       pèse alors 10 à 25 Ko au lieu de plusieurs centaines. */
    toDataURL(maxWidth) {
      if (this.empty) return "";
      const src = this.canvas;
      const ctx = src.getContext("2d");
      const w = src.width;
      const h = src.height;
      const px = ctx.getImageData(0, 0, w, h).data;
      let minX = w, minY = h, maxX = 0, maxY = 0, seen = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (px[(y * w + x) * 4 + 3] > 8) {
            seen = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (!seen) return "";

      const ratio = (window.devicePixelRatio || 1) * 2;
      const padX = Math.round(10 * ratio);
      const padY = Math.round(6 * ratio);
      minX = Math.max(0, minX - padX);
      minY = Math.max(0, minY - padY);
      maxX = Math.min(w - 1, maxX + padX);
      maxY = Math.min(h - 1, maxY + padY);

      let cw = maxX - minX + 1;
      let ch = maxY - minY + 1;
      const limit = maxWidth || 480;
      if (cw > limit) {
        ch = Math.round((ch * limit) / cw);
        cw = limit;
      }
      const out = document.createElement("canvas");
      out.width = cw;
      out.height = ch;
      const octx = out.getContext("2d");
      octx.drawImage(src, minX, minY, cw, ch, 0, 0, cw, ch);
      return out.toDataURL("image/png");
    }
  }

  window.SignaturePad = SignaturePad;
})();