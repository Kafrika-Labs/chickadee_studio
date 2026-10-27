// English UI text keyed by the Korean source text, split by screen area.
import guide from "./guide.mjs";
import inspection from "./inspection.mjs";
import main from "./main.mjs";
import settings from "./settings.mjs";

export default { ...guide, ...inspection, ...settings, ...main };
