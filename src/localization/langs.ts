import { Language } from "./language";

export default [
  {
    key: "en",
    nativeName: "English",
    prefix: "EN",
  },
  {
    key: "zh",
    nativeName: "中文",
    prefix: "中文",
  },
] as const satisfies Language[];
