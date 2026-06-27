import type { Dict } from "./en";
import en from "./en";
import hi from "./hi";
import mr from "./mr";
import bn from "./bn";
import ta from "./ta";
import te from "./te";
import gu from "./gu";
import kn from "./kn";
import ml from "./ml";
import pa from "./pa";
import or from "./or";
import as from "./as";
import ur from "./ur";

// All bundled UI dictionaries (instant, offline). English is the base; others fall back to it per-key.
export const ALL: Record<string, Partial<Dict>> = { en, hi, mr, bn, ta, te, gu, kn, ml, pa, or, as, ur };
