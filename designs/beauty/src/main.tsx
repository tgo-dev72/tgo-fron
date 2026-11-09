import { SystemRoot, bootStorefront, premiumThemeSystem } from "@storefront/core";
import "@storefront/core/system/base.css";
import App from "./App";

bootStorefront(document.getElementById("root")!, (config) => (
  <SystemRoot system={premiumThemeSystem("beauty")}><App config={config} /></SystemRoot>
));
