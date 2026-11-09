import { SystemRoot, bootStorefront } from "@storefront/core";
import "@storefront/core/system/base.css";
import App from "./App";
import { nexaSystem } from "./system";
const root = document.getElementById("root");
if (!root) throw new Error("Missing storefront root");
bootStorefront(root, (config) => (
  <SystemRoot system={nexaSystem}><App config={config} /></SystemRoot>
));
