// ROLE: Динамически расширяемые массивы Float32 и Uint32 для буферов геометрии.

const USE_SHARED_BUFFER = typeof SharedArrayBuffer !== "undefined";

if (!USE_SHARED_BUFFER) {
  console.warn("%c[GrowableArray] SharedArrayBuffer is not available. Using ArrayBuffer fallback.", "color: orange; font-weight: bold;");
}

export class GrowableFloat32Array {
  public array: Float32Array;
  public length = 0;

  constructor(initialCapacity = 65536) {
    const buf = USE_SHARED_BUFFER ? new SharedArrayBuffer(initialCapacity * 4) : new ArrayBuffer(initialCapacity * 4);
    this.array = new Float32Array(buf);
  }

  public reset() {
    this.length = 0;
  }

  public push2(v1: number, v2: number) {
    if (this.length + 2 > this.array.length) this.grow(this.length + 2);
    this.array[this.length++] = v1;
    this.array[this.length++] = v2;
  }

  public push3(v1: number, v2: number, v3: number) {
    if (this.length + 3 > this.array.length) this.grow(this.length + 3);
    this.array[this.length++] = v1;
    this.array[this.length++] = v2;
    this.array[this.length++] = v3;
  }

  public push4(v1: number, v2: number, v3: number, v4: number) {
    if (this.length + 4 > this.array.length) this.grow(this.length + 4);
    this.array[this.length++] = v1;
    this.array[this.length++] = v2;
    this.array[this.length++] = v3;
    this.array[this.length++] = v4;
  }

  public push6(v1: number, v2: number, v3: number, v4: number, v5: number, v6: number) {
    if (this.length + 6 > this.array.length) this.grow(this.length + 6);
    this.array[this.length++] = v1;
    this.array[this.length++] = v2;
    this.array[this.length++] = v3;
    this.array[this.length++] = v4;
    this.array[this.length++] = v5;
    this.array[this.length++] = v6;
  }

  private grow(minSize: number) {
    let newCap = this.array.length * 2;
    if (newCap < minSize) newCap = minSize;
    const buf = USE_SHARED_BUFFER ? new SharedArrayBuffer(newCap * 4) : new ArrayBuffer(newCap * 4);
    const newArr = new Float32Array(buf);
    newArr.set(this.array);
    this.array = newArr;
  }

  public slice(): Float32Array {
    if (USE_SHARED_BUFFER) {
      return this.array.subarray(0, this.length);
    } else {
      return this.array.slice(0, this.length);
    }
  }
}

export class GrowableUint32Array {
  public array: Uint32Array;
  public length = 0;

  constructor(initialCapacity = 32768) {
    const buf = USE_SHARED_BUFFER ? new SharedArrayBuffer(initialCapacity * 4) : new ArrayBuffer(initialCapacity * 4);
    this.array = new Uint32Array(buf);
  }

  public reset() {
    this.length = 0;
  }

  public push3(v1: number, v2: number, v3: number) {
    if (this.length + 3 > this.array.length) this.grow(this.length + 3);
    this.array[this.length++] = v1;
    this.array[this.length++] = v2;
    this.array[this.length++] = v3;
  }

  public push6(v1: number, v2: number, v3: number, v4: number, v5: number, v6: number) {
    if (this.length + 6 > this.array.length) this.grow(this.length + 6);
    this.array[this.length++] = v1;
    this.array[this.length++] = v2;
    this.array[this.length++] = v3;
    this.array[this.length++] = v4;
    this.array[this.length++] = v5;
    this.array[this.length++] = v6;
  }

  private grow(minSize: number) {
    let newCap = this.array.length * 2;
    if (newCap < minSize) newCap = minSize;
    const buf = USE_SHARED_BUFFER ? new SharedArrayBuffer(newCap * 4) : new ArrayBuffer(newCap * 4);
    const newArr = new Uint32Array(buf);
    newArr.set(this.array);
    this.array = newArr;
  }

  public slice(): Uint32Array {
    if (USE_SHARED_BUFFER) {
      return this.array.subarray(0, this.length);
    } else {
      return this.array.slice(0, this.length);
    }
  }
}
