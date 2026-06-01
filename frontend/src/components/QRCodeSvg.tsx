type QRCodeSvgProps = {
  value: string;
  size?: number;
  quietZone?: number;
};

const VERSION = 5;
const SIZE = 17 + VERSION * 4;
const DATA_CODEWORDS = 108;
const ECC_CODEWORDS = 26;
const FORMAT_XOR_MASK = 0x5412;
const FORMAT_GENERATOR = 0x537;
const BYTE_MODE = 0b0100;
const ECL_LOW_BITS = 0b01;

type QRMatrix = boolean[][];

type QRState = {
  modules: QRMatrix;
  isFunction: boolean[][];
};

function createEmptyMatrix(): QRMatrix {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => false));
}

function cloneMatrix(matrix: QRMatrix): QRMatrix {
  return matrix.map((row) => [...row]);
}

function setModule(state: QRState, x: number, y: number, value: boolean, isFunction = true) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  state.modules[y][x] = value;
  if (isFunction) state.isFunction[y][x] = true;
}

function drawFinderPattern(state: QRState, left: number, top: number) {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const absoluteX = left + x;
      const absoluteY = top + y;
      const isInside = x >= 0 && x <= 6 && y >= 0 && y <= 6;
      const isBlack = isInside && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
      setModule(state, absoluteX, absoluteY, isBlack, true);
    }
  }
}

function drawAlignmentPattern(state: QRState, centerX: number, centerY: number) {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const distance = Math.max(Math.abs(x), Math.abs(y));
      setModule(state, centerX + x, centerY + y, distance === 2 || distance === 0, true);
    }
  }
}

function drawFunctionPatterns(state: QRState) {
  drawFinderPattern(state, 0, 0);
  drawFinderPattern(state, SIZE - 7, 0);
  drawFinderPattern(state, 0, SIZE - 7);

  for (let i = 8; i < SIZE - 8; i += 1) {
    const value = i % 2 === 0;
    setModule(state, 6, i, value, true);
    setModule(state, i, 6, value, true);
  }

  drawAlignmentPattern(state, 30, 30);
  drawFormatBits(state, 0);
  setModule(state, 8, SIZE - 8, true, true);
}

function drawFormatBits(state: QRState, maskPattern: number) {
  let data = (ECL_LOW_BITS << 3) | maskPattern;
  let remainder = data << 10;

  for (let i = 14; i >= 10; i -= 1) {
    if (((remainder >> i) & 1) !== 0) {
      remainder ^= FORMAT_GENERATOR << (i - 10);
    }
  }

  const bits = ((data << 10) | remainder) ^ FORMAT_XOR_MASK;
  const getBit = (index: number) => ((bits >> index) & 1) !== 0;

  for (let i = 0; i <= 5; i += 1) setModule(state, 8, i, getBit(i), true);
  setModule(state, 8, 7, getBit(6), true);
  setModule(state, 8, 8, getBit(7), true);
  setModule(state, 7, 8, getBit(8), true);
  for (let i = 9; i <= 14; i += 1) setModule(state, 14 - i, 8, getBit(i), true);

  for (let i = 0; i <= 7; i += 1) setModule(state, SIZE - 1 - i, 8, getBit(i), true);
  for (let i = 8; i <= 14; i += 1) setModule(state, 8, SIZE - 15 + i, getBit(i), true);
  setModule(state, 8, SIZE - 8, true, true);
}

function appendBits(target: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i -= 1) {
    target.push((value >> i) & 1);
  }
}

function createGaloisTables() {
  const exp = Array.from({ length: 512 }, () => 0);
  const log = Array.from({ length: 256 }, () => 0);
  let value = 1;

  for (let i = 0; i < 255; i += 1) {
    exp[i] = value;
    log[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }

  for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255];
  return { exp, log };
}

const GALOIS = createGaloisTables();

function gfMultiply(left: number, right: number): number {
  if (left === 0 || right === 0) return 0;
  return GALOIS.exp[GALOIS.log[left] + GALOIS.log[right]];
}

function createGeneratorPolynomial(degree: number): number[] {
  let polynomial = [1];

  for (let i = 0; i < degree; i += 1) {
    const next = Array.from({ length: polynomial.length + 1 }, () => 0);
    polynomial.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= gfMultiply(coefficient, GALOIS.exp[i]);
    });
    polynomial = next;
  }

  return polynomial;
}

function createErrorCorrection(dataCodewords: number[]): number[] {
  const generator = createGeneratorPolynomial(ECC_CODEWORDS);
  const remainder = Array.from({ length: ECC_CODEWORDS }, () => 0);

  dataCodewords.forEach((codeword) => {
    const factor = codeword ^ remainder[0];
    remainder.shift();
    remainder.push(0);

    for (let i = 0; i < ECC_CODEWORDS; i += 1) {
      remainder[i] ^= gfMultiply(generator[i + 1], factor);
    }
  });

  return remainder;
}

function encodeCodewords(value: string): number[] {
  const data = new TextEncoder().encode(value);
  if (data.length > DATA_CODEWORDS - 3) {
    throw new Error("Ссылка слишком длинная для встроенного QR-кода.");
  }

  const bits: number[] = [];
  appendBits(bits, BYTE_MODE, 4);
  appendBits(bits, data.length, 8);
  data.forEach((byte) => appendBits(bits, byte, 8));

  const maxBits = DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCodewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let codeword = 0;
    for (let j = 0; j < 8; j += 1) codeword = (codeword << 1) | bits[i + j];
    dataCodewords.push(codeword);
  }

  for (let pad = 0xec; dataCodewords.length < DATA_CODEWORDS; pad ^= 0xfd) {
    dataCodewords.push(pad);
  }

  return [...dataCodewords, ...createErrorCorrection(dataCodewords)];
}

function placeCodewords(state: QRState, codewords: number[]) {
  const bits = codewords.flatMap((codeword) => {
    const result: number[] = [];
    appendBits(result, codeword, 8);
    return result;
  });

  let bitIndex = 0;
  let upward = true;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;

    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const y = upward ? SIZE - 1 - vertical : vertical;

      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (!state.isFunction[y][x] && bitIndex < bits.length) {
          state.modules[y][x] = bits[bitIndex] === 1;
          bitIndex += 1;
        }
      }
    }

    upward = !upward;
  }
}

function shouldMask(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return false;
  }
}

function applyMask(base: QRState, mask: number): QRState {
  const state: QRState = {
    modules: cloneMatrix(base.modules),
    isFunction: cloneMatrix(base.isFunction),
  };

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (!state.isFunction[y][x] && shouldMask(mask, x, y)) {
        state.modules[y][x] = !state.modules[y][x];
      }
    }
  }

  drawFormatBits(state, mask);
  return state;
}

function countRunsPenalty(line: boolean[]): number {
  let penalty = 0;
  let runColor = line[0];
  let runLength = 1;

  for (let i = 1; i < line.length; i += 1) {
    if (line[i] === runColor) {
      runLength += 1;
    } else {
      if (runLength >= 5) penalty += 3 + runLength - 5;
      runColor = line[i];
      runLength = 1;
    }
  }

  if (runLength >= 5) penalty += 3 + runLength - 5;
  return penalty;
}

function hasFinderLikePattern(line: boolean[], start: number): boolean {
  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  return pattern.every((value, index) => line[start + index] === value);
}

function calculatePenalty(matrix: QRMatrix): number {
  let penalty = 0;

  for (let y = 0; y < SIZE; y += 1) penalty += countRunsPenalty(matrix[y]);
  for (let x = 0; x < SIZE; x += 1) {
    const column = matrix.map((row) => row[x]);
    penalty += countRunsPenalty(column);
  }

  for (let y = 0; y < SIZE - 1; y += 1) {
    for (let x = 0; x < SIZE - 1; x += 1) {
      const value = matrix[y][x];
      if (matrix[y][x + 1] === value && matrix[y + 1][x] === value && matrix[y + 1][x + 1] === value) {
        penalty += 3;
      }
    }
  }

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x <= SIZE - 11; x += 1) {
      if (hasFinderLikePattern(matrix[y], x)) penalty += 40;
    }
  }

  for (let x = 0; x < SIZE; x += 1) {
    const column = matrix.map((row) => row[x]);
    for (let y = 0; y <= SIZE - 11; y += 1) {
      if (hasFinderLikePattern(column, y)) penalty += 40;
    }
  }

  const darkModules = matrix.flat().filter(Boolean).length;
  const percent = (darkModules * 100) / (SIZE * SIZE);
  penalty += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return penalty;
}

function generateQRCode(value: string): QRMatrix {
  const base: QRState = {
    modules: createEmptyMatrix(),
    isFunction: createEmptyMatrix(),
  };

  drawFunctionPatterns(base);
  placeCodewords(base, encodeCodewords(value));

  let best = applyMask(base, 0);
  let bestPenalty = calculatePenalty(best.modules);

  for (let mask = 1; mask < 8; mask += 1) {
    const candidate = applyMask(base, mask);
    const penalty = calculatePenalty(candidate.modules);
    if (penalty < bestPenalty) {
      best = candidate;
      bestPenalty = penalty;
    }
  }

  return best.modules;
}

export default function QRCodeSvg({ value, size = 220, quietZone = 4 }: QRCodeSvgProps) {
  try {
    const modules = generateQRCode(value);
    const fullSize = SIZE + quietZone * 2;
    const path = modules
      .flatMap((row, y) => row.map((cell, x) => (cell ? `M${x + quietZone} ${y + quietZone}h1v1h-1z` : "")))
      .filter(Boolean)
      .join(" ");

    return (
      <svg width={size} height={size} viewBox={`0 0 ${fullSize} ${fullSize}`} role="img" aria-label="QR-код для входа">
        <rect width={fullSize} height={fullSize} fill="white" />
        <path d={path} fill="#0F172A" />
      </svg>
    );
  } catch (err) {
    return (
      <div style={{ width: size, minHeight: size, display: "grid", placeItems: "center", textAlign: "center", color: "#B91C1C", padding: 12 }}>
        {err instanceof Error ? err.message : "Не удалось построить QR-код."}
      </div>
    );
  }
}
