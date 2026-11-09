import { SystemRoot, bootStorefront } from "@storefront/core";
import "@storefront/core/system/base.css";
import { basic } from "./tokens";
import App from "./App";

const theme: "light" | "dark" =
  new URLSearchParams(window.location.search).get("theme") === "dark" ? "dark" : "light";

bootStorefront(document.getElementById("root")!, (config) => (
  <SystemRoot system={basic} theme={theme}>
    <App config={config} />
  </SystemRoot>
));
