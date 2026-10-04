import { privateSite } from "./media.mjs";
import allowlist from "../.cloudflare/private-images.mjs";

export default {
  fetch(request, env) {
    return privateSite(request, env, allowlist);
  },
};
