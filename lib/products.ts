export type MeasureType = "area" | "linear"

export interface Product {
  id: string
  brand: "james-hardie" | "affinity-stone"
  name: string
  category: "siding" | "trim" | "stone-veneer" | "soffit" | "accessory"
  measureType: MeasureType
  unitName: string
  coveragePerUnit: number
  coverageLabel: string
  description: string
}

export interface Brand {
  id: "james-hardie" | "affinity-stone"
  name: string
  logo?: string
}

export const BRANDS: Brand[] = [
  { id: "james-hardie", name: "James Hardie" },
  { id: "affinity-stone", name: "Affinity Stone" },
]

export const PRODUCTS: Product[] = [
  // ── James Hardie — Siding ──────────────────────────────────────────
  {
    id: "jh-hardiplank-825",
    brand: "james-hardie",
    name: 'HardiePlank Lap Siding 8.25"',
    category: "siding",
    measureType: "area",
    unitName: "plank",
    coveragePerUnit: 7,
    coverageLabel: "7 sq ft / plank",
    description: '12\' plank, 8.25" wide, 7" exposure. Cedarmill or Smooth.',
  },
  {
    id: "jh-hardiplank-625",
    brand: "james-hardie",
    name: 'HardiePlank Lap Siding 6.25"',
    category: "siding",
    measureType: "area",
    unitName: "plank",
    coveragePerUnit: 5,
    coverageLabel: "5 sq ft / plank",
    description: '12\' plank, 6.25" wide, 5" exposure. Cedarmill or Smooth.',
  },
  {
    id: "jh-hardipanel-4x8",
    brand: "james-hardie",
    name: "HardiePanel Vertical Siding 4×8",
    category: "siding",
    measureType: "area",
    unitName: "panel",
    coveragePerUnit: 32,
    coverageLabel: "32 sq ft / panel",
    description: "4\'×8\' sheet. Smooth finish for board-and-batten or flush applications.",
  },
  {
    id: "jh-hardipanel-4x10",
    brand: "james-hardie",
    name: "HardiePanel Vertical Siding 4×10",
    category: "siding",
    measureType: "area",
    unitName: "panel",
    coveragePerUnit: 40,
    coverageLabel: "40 sq ft / panel",
    description: "4\'×10\' sheet. Smooth finish for taller wall applications.",
  },
  {
    id: "jh-hardieshingle",
    brand: "james-hardie",
    name: "HardieShingle Staggered Edge Panel",
    category: "siding",
    measureType: "area",
    unitName: "panel",
    coveragePerUnit: 15.17,
    coverageLabel: "15.17 sq ft / panel",
    description: "Staggered-edge shingle panel for shake-style applications.",
  },
  {
    id: "jh-artisan-siding",
    brand: "james-hardie",
    name: "Hardie Artisan V-Groove Siding",
    category: "siding",
    measureType: "area",
    unitName: "plank",
    coveragePerUnit: 7,
    coverageLabel: "7 sq ft / plank",
    description: "Deep-textured shiplap profile with enhanced shadow lines.",
  },

  // ── James Hardie — Trim ────────────────────────────────────────────
  {
    id: "jh-trim-3.5",
    brand: "james-hardie",
    name: 'HardieTrim Board 3.5"',
    category: "trim",
    measureType: "linear",
    unitName: "board",
    coveragePerUnit: 12,
    coverageLabel: "12 lf / board",
    description: '3.5" wide × 12\' trim board. Smooth finish.',
  },
  {
    id: "jh-trim-5.5",
    brand: "james-hardie",
    name: 'HardieTrim Board 5.5"',
    category: "trim",
    measureType: "linear",
    unitName: "board",
    coveragePerUnit: 12,
    coverageLabel: "12 lf / board",
    description: '5.5" wide × 12\' trim board. Smooth finish.',
  },
  {
    id: "jh-trim-7.25",
    brand: "james-hardie",
    name: 'HardieTrim Board 7.25"',
    category: "trim",
    measureType: "linear",
    unitName: "board",
    coveragePerUnit: 12,
    coverageLabel: "12 lf / board",
    description: '7.25" wide × 12\' trim board. Smooth finish.',
  },
  {
    id: "jh-trim-9.25",
    brand: "james-hardie",
    name: 'HardieTrim Board 9.25"',
    category: "trim",
    measureType: "linear",
    unitName: "board",
    coveragePerUnit: 12,
    coverageLabel: "12 lf / board",
    description: '9.25" wide × 12\' trim board. Smooth finish.',
  },
  {
    id: "jh-trim-11.25",
    brand: "james-hardie",
    name: 'HardieTrim Board 11.25"',
    category: "trim",
    measureType: "linear",
    unitName: "board",
    coveragePerUnit: 12,
    coverageLabel: "12 lf / board",
    description: '11.25" wide × 12\' fascia/trim board. Smooth finish.',
  },
  {
    id: "jh-batten-2.5",
    brand: "james-hardie",
    name: 'HardieTrim Batten Board 2.5"',
    category: "trim",
    measureType: "linear",
    unitName: "board",
    coveragePerUnit: 10,
    coverageLabel: "10 lf / board",
    description: '2.5" batten strip for board-and-batten applications.',
  },
  {
    id: "jh-batten-4",
    brand: "james-hardie",
    name: 'HardieTrim Batten Board 4"',
    category: "trim",
    measureType: "linear",
    unitName: "board",
    coveragePerUnit: 10,
    coverageLabel: "10 lf / board",
    description: '4" batten strip for board-and-batten applications.',
  },

  // ── James Hardie — Soffit ──────────────────────────────────────────
  {
    id: "jh-soffit-vented",
    brand: "james-hardie",
    name: "Hardie Soffit Panel Vented",
    category: "soffit",
    measureType: "area",
    unitName: "panel",
    coveragePerUnit: 16,
    coverageLabel: "16 sq ft / panel",
    description: "12\' × 16\" vented soffit panel. Cedarmill texture.",
  },
  {
    id: "jh-soffit-nonvented",
    brand: "james-hardie",
    name: "Hardie Soffit Panel Non-Vented",
    category: "soffit",
    measureType: "area",
    unitName: "panel",
    coveragePerUnit: 16,
    coverageLabel: "16 sq ft / panel",
    description: "12\' × 16\" non-vented soffit panel. Cedarmill texture.",
  },

  // ── Affinity Stone — Stone Veneer ──────────────────────────────────
  {
    id: "as-ridgecut-aspen",
    brand: "affinity-stone",
    name: "Ridge Cut — Aspen",
    category: "stone-veneer",
    measureType: "area",
    unitName: "box",
    coveragePerUnit: 10,
    coverageLabel: "10 sq ft / box",
    description: 'Larger profile stone veneer. 2", 4" & 6" heights. Mortarless install.',
  },
  {
    id: "as-ridgecut-cambridge",
    brand: "affinity-stone",
    name: "Ridge Cut — Cambridge",
    category: "stone-veneer",
    measureType: "area",
    unitName: "box",
    coveragePerUnit: 10,
    coverageLabel: "10 sq ft / box",
    description: 'Larger profile stone veneer. 2", 4" & 6" heights. Mortarless install.',
  },
  {
    id: "as-ridgecut-glacier",
    brand: "affinity-stone",
    name: "Ridge Cut — Glacier",
    category: "stone-veneer",
    measureType: "area",
    unitName: "box",
    coveragePerUnit: 10,
    coverageLabel: "10 sq ft / box",
    description: 'Larger profile stone veneer. 2", 4" & 6" heights. Mortarless install.',
  },
  {
    id: "as-ridgecut-redwood",
    brand: "affinity-stone",
    name: "Ridge Cut — Redwood",
    category: "stone-veneer",
    measureType: "area",
    unitName: "box",
    coveragePerUnit: 10,
    coverageLabel: "10 sq ft / box",
    description: 'Larger profile stone veneer. 2", 4" & 6" heights. Mortarless install.',
  },
  {
    id: "as-ridgecut-yukon",
    brand: "affinity-stone",
    name: "Ridge Cut — Yukon",
    category: "stone-veneer",
    measureType: "area",
    unitName: "box",
    coveragePerUnit: 10,
    coverageLabel: "10 sq ft / box",
    description: 'Larger profile stone veneer. 2", 4" & 6" heights. Mortarless install.',
  },
  {
    id: "as-ridgecut-highland",
    brand: "affinity-stone",
    name: "Ridge Cut — Highland",
    category: "stone-veneer",
    measureType: "area",
    unitName: "box",
    coveragePerUnit: 10,
    coverageLabel: "10 sq ft / box",
    description: 'Larger profile stone veneer. 2", 4" & 6" heights. Mortarless install.',
  },
  {
    id: "as-cliffledge-aspen",
    brand: "affinity-stone",
    name: "Cliff Ledge — Aspen",
    category: "stone-veneer",
    measureType: "area",
    unitName: "box",
    coveragePerUnit: 10,
    coverageLabel: "10 sq ft / box",
    description: 'Stacked stone profile. 1.5" & 3" heights. Mortarless install.',
  },
  {
    id: "as-cliffledge-cambridge",
    brand: "affinity-stone",
    name: "Cliff Ledge — Cambridge",
    category: "stone-veneer",
    measureType: "area",
    unitName: "box",
    coveragePerUnit: 10,
    coverageLabel: "10 sq ft / box",
    description: 'Stacked stone profile. 1.5" & 3" heights. Mortarless install.',
  },
  {
    id: "as-cliffledge-glacier",
    brand: "affinity-stone",
    name: "Cliff Ledge — Glacier",
    category: "stone-veneer",
    measureType: "area",
    unitName: "box",
    coveragePerUnit: 10,
    coverageLabel: "10 sq ft / box",
    description: 'Stacked stone profile. 1.5" & 3" heights. Mortarless install.',
  },
  {
    id: "as-cliffledge-redwood",
    brand: "affinity-stone",
    name: "Cliff Ledge — Redwood",
    category: "stone-veneer",
    measureType: "area",
    unitName: "box",
    coveragePerUnit: 10,
    coverageLabel: "10 sq ft / box",
    description: 'Stacked stone profile. 1.5" & 3" heights. Mortarless install.',
  },
  {
    id: "as-cliffledge-yukon",
    brand: "affinity-stone",
    name: "Cliff Ledge — Yukon",
    category: "stone-veneer",
    measureType: "area",
    unitName: "box",
    coveragePerUnit: 10,
    coverageLabel: "10 sq ft / box",
    description: 'Stacked stone profile. 1.5" & 3" heights. Mortarless install.',
  },
  {
    id: "as-cliffledge-highland",
    brand: "affinity-stone",
    name: "Cliff Ledge — Highland",
    category: "stone-veneer",
    measureType: "area",
    unitName: "box",
    coveragePerUnit: 10,
    coverageLabel: "10 sq ft / box",
    description: 'Stacked stone profile. 1.5" & 3" heights. Mortarless install.',
  },

  // ── Affinity Stone — Accessories ───────────────────────────────────
  {
    id: "as-starter-strip",
    brand: "affinity-stone",
    name: "Starter Strip",
    category: "accessory",
    measureType: "linear",
    unitName: "piece",
    coveragePerUnit: 4,
    coverageLabel: "4 lf / piece",
    description: "Base starter strip for first course of stone veneer.",
  },
  {
    id: "as-wainscot-cap",
    brand: "affinity-stone",
    name: "Wainscot Cap",
    category: "accessory",
    measureType: "linear",
    unitName: "piece",
    coveragePerUnit: 4,
    coverageLabel: "4 lf / piece",
    description: "Finishing cap for wainscot-height stone applications.",
  },
  {
    id: "as-column-kit",
    brand: "affinity-stone",
    name: "Column Kit (6×6 post)",
    category: "accessory",
    measureType: "area",
    unitName: "kit",
    coveragePerUnit: 1,
    coverageLabel: "1 column / kit",
    description: "Pre-built kit with 12 panels and two-piece cap for a 6×6 post. Covers 3 vertical ft.",
  },
]

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id)
}

export function getProductsByBrand(brand: Brand["id"]): Product[] {
  return PRODUCTS.filter((p) => p.brand === brand)
}

export function getAreaProducts(): Product[] {
  return PRODUCTS.filter((p) => p.measureType === "area")
}

export function getLinearProducts(): Product[] {
  return PRODUCTS.filter((p) => p.measureType === "linear")
}

export function unitsNeeded(
  product: Product,
  measurement: number,
  wasteFactor: number,
): number {
  if (product.coveragePerUnit <= 0) return 0
  const withWaste = measurement * (1 + wasteFactor)
  return Math.ceil(withWaste / product.coveragePerUnit)
}
