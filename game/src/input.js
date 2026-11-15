// input.js — keyboard + mouse state for the twin-stick controls.
//
// Movement keys are read live (held), action keys are edge-triggered: press()
// reports a key once, then clears it at the end of the frame so a single tap
// never fires twice. Mouse coordinates are converted into arena space using
// the canvas's on-screen rectangle.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 640, y: 360, down: false };
    this._onKeyDown = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    };
    this._onKeyUp = (event) => this.keys.delete(event.code);
    this._onMouseMove = (event) => this._trackMouse(event);
    this._onMouseDown = (event) => {
      if (event.button === 0) {
        this.mouse.down = true;
        this._trackMouse(event);
      }
    };
    this._onMouseUp = (event) => {
      if (event.button === 0) this.mouse.down = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
    this._onContext = (event) => event.preventDefault();
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('contextmenu', this._onContext);
  }

  _trackMouse(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / Math.max(1, rect.width);
    const scaleY = this.canvas.height / Math.max(1, rect.height);
    this.mouse.x = (event.clientX - rect.left) * scaleX;
    this.mouse.y = (event.clientY - rect.top) * scaleY;
  }

  // Held-down test, e.g. input.down('KeyW').
  down(code) {
    return this.keys.has(code);
  }

  // Edge test: true only on the first read after the key went down. The
  // read consumes the edge, so a frame that runs several fixed steps never
  // fires the same tap twice (pause would toggle straight back).
  pressedNow(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  // Any of the listed codes held.
  anyDown(codes) {
    return codes.some((code) => this.keys.has(code));
  }

  // Movement vector from WASD / arrows, normalised.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  // Call once per frame, after the game has read the edges.
  endFrame() {
    this.pressed.clear();
  }
}
